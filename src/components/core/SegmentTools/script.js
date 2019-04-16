import { mapState } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';
import macro from 'vtk.js/Sources/macro';
import vtkPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkCellPicker from 'vtk.js/Sources/Rendering/Core/CellPicker';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

import utils from 'paraview-glance/src/utils';
import stripsToPolys from './StripsToPolys';

const { forAllViews } = utils;

function getTubeIdFromCell(cellId, cellToTube) {
  for (let i = 0; i < cellToTube.length; i++) {
    const [cellIdThreshold, tubeId] = cellToTube[i];
    if (cellId < cellIdThreshold) {
      return tubeId;
    }
  }
  return -1;
}

function makeTubeCollection() {
  const order = [];
  const map = {};

  return {
    getList() {
      return order;
    },
    get(id) {
      const index = map[id];
      if (index !== undefined) {
        return order[index];
      }
      return null;
    },
    put(id, obj) {
      const index = map[id];
      if (index === undefined) {
        map[id] = order.length;
        order.push(obj);
      } else {
        order[index] = obj;
      }
    },
    delete(id) {
      const index = map[id];
      if (index !== undefined) {
        order.splice(index, 1);
        delete map[id];
      }
    },
  };
}

function onClick(interactor, button, cb) {
  const pressFn = `on${macro.capitalize(button)}ButtonPress`;
  const releaseFn = `on${macro.capitalize(button)}ButtonRelease`;
  let pressTime = 0;
  const pressSub = interactor[pressFn](() => {
    pressTime = +new Date();
  });
  const releaseSub = interactor[releaseFn]((ev) => {
    if (+new Date() - pressTime < 250) {
      cb(ev);
    }
  });
  return {
    unsubscribe: () => {
      pressSub.unsubscribe();
      releaseSub.unsubscribe();
    },
  };
}

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
  const scalarsData = new Float32Array(radii);
  const scalars = vtkDataArray.newInstance({
    name: 'Radius',
    values: scalarsData,
  });

  pts.setData(pointData);
  pd.setPoints(pts);
  pd.getLines().setData(lines);
  pd.getPointData().setScalars(scalars);

  const filter = vtkTubeFilter.newInstance({
    capping: true,
    radius: 1, // scaling factor
    varyRadius: VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR,
    numberOfSides: 50,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

const picker = vtkPicker.newInstance();
const cellPicker = vtkCellPicker.newInstance();

export default {
  name: 'SegmentTools',
  data() {
    return {
      results: new WeakMap(),
      menuX: 0,
      menuY: 0,
      contextMenu: false,
      segmentScale: 5,
      medianRadius: 2,
      loading: false,
      master: null,
    };
  },
  computed: mapState(['proxyManager', 'remote']),
  methods: {
    getVolumes() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          source: s,
        }));
    },
    setMasterVolume(source) {
      this.master = source;
    },
    run() {
      const master = this.master;
      const dataset = master.getDataset();

      this.loading = true;

      this.remote
        .call('median_filter', dataset, this.medianRadius)
        .then((vtkResult) => {
          this.loading = false;

          if (!this.results.has(master)) {
            const source = this.proxyManager.createProxy(
              'Sources',
              'TrivialProducer',
              {
                name: vtkResult.name,
              }
            );
            this.results.set(master, source);
          }

          const source = this.results.get(master);
          if (source !== undefined) {
            const image = vtk(vtkResult);
            source.setInputData(image);
            this.proxyManager.createRepresentationInAllViews(source);
          }
        });
    },
  },
};
