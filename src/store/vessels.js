import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

import vtkTubeGroup from 'paraview-glance/src/vtk/TubeGroup';
import vtkLabelMap from 'paraview-glance/src/vtk/LabelMap';

// import { wrapMutationAsAction } from 'paraview-glance/src/utils';

/**
 * Converts a centerline to a tube poly data
 */
function centerlineToTube(centerline) {
  const pd = vtkPolyData.newInstance();
  const pts = vtkPoints.newInstance({
    dataType: VtkDataTypes.FLOAT,
    numberOfComponents: 3,
  });
  pts.setNumberOfPoints(centerline.length);

  const pointData = new Float32Array(3 * centerline.length);
  const lines = new Uint32Array(centerline.length + 1);

  lines[0] = centerline.length;
  for (let i = 0; i < centerline.length; ++i) {
    pointData[3 * i + 0] = centerline[i].point[0];
    pointData[3 * i + 1] = centerline[i].point[1];
    pointData[3 * i + 2] = centerline[i].point[2];
    lines[i + 1] = i;
  }

  const radii = centerline.map((p) => p.radius);
  const radiusData = new Float32Array(radii);
  const radius = vtkDataArray.newInstance({
    name: 'Radius',
    values: radiusData,
  });

  pts.setData(pointData);
  pd.setPoints(pts);
  pd.getLines().setData(lines);
  pd.getPointData().addArray(radius);

  const filter = vtkTubeFilter.newInstance({
    capping: true,
    radius: 1, // scaling factor
    varyRadius: VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR,
    numberOfSides: 20,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

/**
 * Converts a polydata consisting of triangle strips into polys.
 */
function convertStripsToPolys(pd) {
  const strips = pd.getStrips().getData();

  // compute number of triangles
  let numTriangles = 0;
  for (let i = 0; i < strips.length; i++) {
    const stripLen = strips[i];
    numTriangles += stripLen - 2;
    i += stripLen;
  }

  const polys = new strips.constructor(numTriangles * 4);
  let pindex = 0;
  for (let i = 0; i < strips.length; i++) {
    let stripLen = strips[i];
    let flip = false;
    while (stripLen > 2) {
      i++;
      stripLen--;
      polys[pindex++] = 3;
      if (flip) {
        polys[pindex++] = strips[i + 1];
        polys[pindex++] = strips[i];
        polys[pindex++] = strips[i + 2];
      } else {
        polys[pindex++] = strips[i];
        polys[pindex++] = strips[i + 1];
        polys[pindex++] = strips[i + 2];
      }
      flip = !flip;
    }
    i += 2;
  }

  pd.getPolys().setData(polys);
  // clear strips
  pd.getStrips().setData(new strips.constructor());

  return pd;
}

function buildTubePolyData(tubes, cache) {
  const filter = vtkAppendPolyData.newInstance();
  filter.setInputData(vtkPolyData.newInstance());

  let numberOfCells = 0;
  for (let i = 0; i < tubes.length; i++) {
    const tubePd = cache[tubes[i].id];
    filter.addInputData(tubePd);
    numberOfCells += tubePd.getNumberOfCells();
  }

  const polyData = filter.getOutputData();

  // add colors
  const colorsData = new Uint8Array(4 * numberOfCells);
  let colorIndex = 0;
  for (let i = 0; i < tubes.length; i++) {
    const tubePd = cache[tubes[i].id];
    const tubeColor = tubes[i].color;
    for (let j = 0; j < tubePd.getNumberOfCells(); j++) {
      colorsData[colorIndex++] = tubeColor[0] * 255;
      colorsData[colorIndex++] = tubeColor[1] * 255;
      colorsData[colorIndex++] = tubeColor[2] * 255;
      colorsData[colorIndex++] = tubeColor[3] * 255;
    }
  }

  const colors = vtkDataArray.newInstance({
    name: 'Colors',
    values: colorsData,
    numberOfComponents: 4,
  });

  polyData.getCellData().addArray(colors);

  // rebuild cellToTubeId
  // this.cellToTubeId = new Array(this.order.length);
  // let cumulativeCellCount = 0;
  // for (let i = 0; i < this.order.length; i++) {
  //   const id = this.order[i].id;
  //   const tubePd = this.tubeCache[id];
  //   cumulativeCellCount += tubePd.getNumberOfCells();
  //   this.cellToTubeId[i] = [cumulativeCellCount, id];
  // }

  return polyData;
}

export default ({ proxyManager, remote }) => ({
  namespaced: true,

  state: () => ({
    tubeSources: {}, // extractionImageId -> tubeSourceId
    currentExtractImageId: -1,
    tubes: {}, // extractionImageId -> [tubes]
    tubeCache: {}, // extractionImageId -> tube ID -> polydata
  }),

  mutations: {
    setExtractionImage(state, id) {
      state.currentExtractImageId = id;
    },
    addTube(state, tube) {
      const imgId = state.currentExtractImageId;
      if (imgId === -1) {
        return;
      }
      state.tubes[imgId] = state.tubes[imgId] || [];
      state.tubes[imgId].push({
        id: -1,
        parentId: -1,
        points: [],
        color: [1, 0, 0],
        ...tube,
      });

      const tubePoly = centerlineToTube(tube.points);
      state.tubeCache[imgId] = {
        ...(state.tubeCache[imgId] || {}),
        [tube.id]: convertStripsToPolys(tubePoly),
      };
    },
    setTubeSourceId(state, id) {
      const imgId = state.currentExtractImageId;
      if (imgId > -1) {
        state.tubeSources[imgId] = id;
      }
    },
  },

  actions: {
    pxmProxyCreated: {
      root: true,
      handler(_, { proxyGroup, proxy }) {
        if (
          proxyGroup === 'Representations' &&
          proxy.getClassName() === 'vtkTubeGroupPolyDataRepresentationProxy'
        ) {
          proxy.setColorBy('Colors', 'cellData');
        }
      },
    },

    extractTube({ state, commit, dispatch }, { source, coords, scale }) {
      let promise = Promise.resolve();
      if (state.currentExtractImageId !== source.getProxyId()) {
        promise = dispatch('setExtractionImage', source);
      }
      return promise
        .then(() => remote.call('segment', coords, scale))
        .then((centerline) => {
          if (centerline) {
            commit('addTube', centerline.tube);
            const tubePolyData = buildTubePolyData(
              state.tubes[state.currentExtractImageId],
              state.tubeCache[state.currentExtractImageId]
            );
            return dispatch('updateTubeSource', {
              tube: centerline.tube,
              tubeMaskRle: centerline.rle_mask,
              polyData: tubePolyData,
            });
          }
          return null;
        });
    },

    setExtractionImage({ commit }, source) {
      const dataset = source.getDataset();
      const id = source.getProxyId();
      if (dataset) {
        return remote
          .call('set_segment_image', dataset)
          .then(() => commit('setExtractionImage', id));
      }
      return null;
    },

    updateTubeSource: ({ state, commit }, { tube, tubeMaskRle, polyData }) => {
      const extractionSource = proxyManager.getProxyById(
        state.currentExtractImageId
      );
      const tubeSourceId = state.tubeSources[state.currentExtractImageId];
      let tubeSource = proxyManager.getProxyById(tubeSourceId);

      // preserve active source
      const activeSource = proxyManager.getActiveSource();

      if (!tubeSource) {
        tubeSource = proxyManager.createProxy('Sources', 'TrivialProducer', {
          name: 'Tubes',
        });
        /* eslint-disable-next-line import/no-named-as-default-member */
        tubeSource.setInputData(vtkTubeGroup.newInstance());

        commit('setTubeSourceId', tubeSource.getProxyId());
      }

      const tubeGroup = tubeSource.getDataset();

      // update polydata
      if (tubeGroup.getPolyData()) {
        const pd = tubeGroup.getPolyData();
        // this will update the polydata rendering, unlike using
        // tubeGroup.setPolyData().
        pd.shallowCopy(polyData);
      } else {
        tubeGroup.setPolyData(polyData);
      }

      // create labelmap if it doesn't exist
      if (!tubeGroup.getLabelMap()) {
        // clone extraction image
        const extractionImage = extractionSource.getDataset();
        /* eslint-disable import/no-named-as-default-member */
        const image = vtkLabelMap.newInstance({
          ...extractionImage.get('spacing', 'origin', 'direction'),
          colorMap: {
            0: [0, 0, 0, 0], // empty color for label 0
          },
        });
        image.setDimensions(extractionImage.getDimensions());
        image.computeTransforms();

        // set labelmap as all zeros
        const values = new Uint16Array(extractionImage.getNumberOfPoints());
        const dataArray = vtkDataArray.newInstance({
          numberOfComponents: 1,
          values,
        });
        image.getPointData().setScalars(dataArray);

        tubeGroup.setLabelMap(image);
      }

      // update labelmap
      const labelMap = tubeGroup.getLabelMap();
      const scalars = labelMap.getPointData().getArrays()[0];
      const rawData = scalars.getData();

      for (let i = 0; i < tubeMaskRle.length; i += 2) {
        const start = tubeMaskRle[i];
        const length = tubeMaskRle[i + 1];
        rawData.fill(tube.id, start, start + length);
      }
      scalars.modified();

      labelMap.setColorMap({
        ...labelMap.getColorMap(),
        [tube.id]: tube.color.map((c) => c * 255),
      });

      // tube polydata colors are set in the proxy manager hook
      proxyManager.createRepresentationInAllViews(tubeSource);
      proxyManager.renderAllViews();

      // preserve active source
      tubeSource.activate();
      activeSource.activate();
    },
  },
});
