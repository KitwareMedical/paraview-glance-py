import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

import vtkTubeGroup from 'paraview-glance/src/vtk/TubeGroup';
import {
  convertStripsToPolys,
  centerlineToTube,
} from 'paraview-glance/src/utils';

const createState = () => ({
  inputSource: null,
  preProcessedSource: null,
  tubeSource: null,
  extractSource: null,
  /* eslint-disable-next-line import/no-named-as-default-member */
  tubePolyData: vtkTubeGroup.newInstance(),
  tubeCache: {},
  tubes: [],
  tubesLookup: {},
});

export const proxyManagerHooks = {
  onProxyRegistrationChange: (store) => (info) => {
    const { proxy, proxyGroup, action, proxyId } = info;
    const { state } = store;

    if (
      action === 'register' &&
      proxyGroup === 'Representations' &&
      proxy.getInput() === state.vessels.tubeSource
    ) {
      proxy.setColorBy('Colors', 'cellData');
    }

    if (action === 'unregister') {
      const { inputSource, preProcessedSource, tubeSource } = state.vessels;

      // const { remote } = store.state;

      if (inputSource && inputSource.getProxyId() === proxyId) {
        // just to make sure we remove it from the shared object pool
        // remote.removeObject(inputSource.getDataset())
        // TODO delete from server
        store.dispatch('vessels/setInputSource', null);
      }

      if (preProcessedSource) {
        // TODO delete from server
        // remote.removeObject(preProcessedSource.getDataset())
        store.dispatch('vessels/setPreProcessedSource', null);
      }

      if (tubeSource) {
        // TODO delete tubes locally and on server
      }
    }
  },
};

export function serialize(state) {
  const idCombinator = (src) => (src ? src.getProxyId() : null);

  return {
    inputSource: idCombinator(state.inputSource),
    preProcessedSource: idCombinator(state.preProcessedSource),
    tubeSource: idCombinator(state.tubeSource),
    tubes: state.tubes,
  };
}

export function unserialize(serialized, pxm) {
  const newState = createState();
  const proxyCombinator = (id) => (id !== null ? pxm.getProxyById(id) : null);

  const tubesLookup = {};
  for (let i = 0; i < serialized.tubes.length; i++) {
    tubesLookup[serialized.tubes[i].id] = i;
  }

  return Object.assign(newState, {
    inputSource: proxyCombinator(serialized.inputSource),
    preProcessedSource: proxyCombinator(serialized.preProcessedSource),
    tubeSource: proxyCombinator(serialized.tubeSource),
    tubesLookup,
  });
}

const actions = {
  /**
   * Sets the input source.
   *
   * This will automatically set the extraction source as well.
   */
  setInputSource: ({ dispatch, commit }, source) => {
    commit('setInputSource', source);
    return dispatch('setExtractionSource', source);
  },

  /**
   * Sets the preprocessed image.
   */
  setPreProcessedImage: ({ dispatch, state, rootState }, vtkImage) => {
    const pxm = rootState.proxyManager;

    let source = state.preProcessedSource;
    if (!source) {
      const name = state.inputSource ? state.inputSource.getName() : 'Image';
      source = pxm.createProxy('Sources', 'TrivialProducer', {
        name: `Pre-processed ${name}`,
      });
    }

    source.setInputData(vtkImage);
    pxm.createRepresentationInAllViews(source);

    return dispatch('setPreProcessedSource', source);
  },

  /**
   * Sets the preprocessed source.
   *
   * This differs from setPreProcessedImage in that the other action
   * accepts a vtk image, and will create a source if one doesn't already
   * exist.
   *
   * This will automatically set the extraction source as well.
   */
  setPreProcessedSource: ({ dispatch, commit }, source) => {
    commit('setPreProcessedSource', source);
    return dispatch('setExtractionSource', source);
  },

  /**
   * Sets extraction source.
   */
  setExtractionSource: ({ commit, rootState }, source) => {
    const { proxyManager } = rootState;

    source.activate();
    proxyManager.getRepresentations().forEach((rep) => {
      if (rep.getInput() === source) {
        rep.setVisibility(true);
      } else if (rep.getInput().getType() === 'vtkImageData') {
        // don't show other images. we ignore non-images.
        rep.setVisibility(false);
      }
    });

    commit('setExtractionSource', source);
  },

  /**
   * Uploads extraction image.
   */
  uploadExtractionImage: ({ state, rootState }) => {
    const { remote } = rootState;
    const dataset = state.extractSource.getDataset();

    remote.persist(dataset);
    return remote.call('set_segment_image', dataset);
  },

  /**
   * Extracts a tube from the given coordinates with given scales.
   */
  extractTube: ({ commit, dispatch, rootState }, { coords, scale }) => {
    const { remote } = rootState;

    return remote.call('segment', coords, scale).then((centerline) => {
      if (centerline) {
        commit('addTube', centerline);
        return dispatch('updateTubeSource');
      }
      return null;
    });
  },

  /**
   * Updates tube source by regenerating tube data.
   */
  updateTubeSource: ({ commit, dispatch, state, rootState }) => {
    const { proxyManager, remote } = rootState;

    const p1 = remote.call('get_tube_image');
    const p2 = dispatch('rebuildTubePolyData');

    return Promise.all([p1, p2]).then(([labelmap, tubeGroup]) => {
      // add empty color to colormap
      labelmap.setLabelColor(0, [0, 0, 0, 0]);

      // set tube group labelmap
      tubeGroup.setLabelMap(labelmap);

      let tubeSource = state.tubeSource;
      if (!tubeSource) {
        const activeSource = proxyManager.getActiveSource();

        tubeSource = proxyManager.createProxy('Sources', 'TrivialProducer', {
          name: 'Tubes',
        });

        activeSource.activate();
      }

      tubeSource.setInputData(tubeGroup);

      proxyManager.createRepresentationInAllViews(tubeSource);

      // set tube polydata colors
      proxyManager
        .getRepresentations()
        .filter(
          (r) =>
            r.getInput() === tubeSource &&
            r.getClassName() === 'vtkTubeGroupPolyDataRepresentationProxy'
        )
        .forEach((rep) => rep.setColorBy('Colors', 'cellData'));

      commit('setTubeSource', tubeSource);
    });
  },

  /**
   * Rebuilds tube polydata.
   */
  rebuildTubePolyData: ({ state }) => {
    const filter = vtkAppendPolyData.newInstance();
    filter.setInputData(vtkPolyData.newInstance());

    let numberOfCells = 0;
    for (let i = 0; i < state.tubes.length; i++) {
      const tubePd = state.tubeCache[state.tubes[i].id];
      filter.addInputData(tubePd);
      numberOfCells += tubePd.getNumberOfCells();
    }

    const polyData = filter.getOutputData();

    // add colors
    const colorsData = new Uint8Array(4 * numberOfCells);
    let colorIndex = 0;
    for (let i = 0; i < state.tubes.length; i++) {
      const tubePd = state.tubeCache[state.tubes[i].id];
      const tubeColor = state.tubes[i].color;
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

    /* eslint-disable-next-line import/no-named-as-default-member */
    return vtkTubeGroup.newInstance({ polyData });
  },

  /**
   * Computes roots from a given set of tubes.
   *
   * If no tubes are provided, all tubes are assumed to be valid roots.
   */
  computeRoots: ({ commit, rootState }, tubeIds) => {
    const { remote } = rootState;
    return remote.call('root_tubes', tubeIds).then((newParentIds) => {
      const remap = {};
      for (let i = 0; i < newParentIds.length; i++) {
        const [tubeId, newParentId] = newParentIds[i];
        remap[tubeId] = newParentId;
      }
      commit('reparentTubes', remap);
    });
  },

  /**
   * Deletes a list of tubes.
   */
  deleteTubes: ({ commit, dispatch, rootState }, tubeIds) => {
    const { remote } = rootState;
    return remote.call('delete_tubes', tubeIds).then(() => {
      commit('deleteTubes', tubeIds);
      return dispatch('updateTubeSource');
    });
  },

  /**
   * Resets local and remote segmentation state.
   */
  reset: () => {},
};

const mutations = {
  setInputSource: (state, source) => {
    state.inputSource = source;
  },
  setPreProcessedSource: (state, source) => {
    state.preProcessedSource = source;
  },
  setExtractionSource: (state, source) => {
    state.extractSource = source;
  },
  setTubePolyData: (state, group) => {
    state.tubePolyData = group;
  },
  setTubeSource: (state, source) => {
    state.tubeSource = source;
  },
  // TODO what if tube.id exists? Should update. This should handle cases like tube smoothing
  addTube: (state, tube) => {
    state.tubesLookup = {
      [tube.id]: state.tubes.length,
      ...state.tubesLookup,
    };
    state.tubes.push(
      // ensure all properties are set
      Object.assign(
        {
          id: -1,
          parentId: -1,
          points: [],
          color: [1, 0, 0],
        },
        tube
      )
    );

    const tubePoly = centerlineToTube(tube.points);
    state.tubeCache = {
      [tube.id]: convertStripsToPolys(tubePoly),
      ...state.tubeCache,
    };
  },
  deleteTubes: (state, tubeIds) => {
    const set = new Set(tubeIds);
    state.tubes = state.tubes.filter((tube) => !set.has(tube.id));

    // rebuild tube lookup
    const lookup = {};
    for (let i = 0; i < state.tubes.length; i++) {
      lookup[state.tubes[i].id] = i;
    }
    state.tubesLookup = lookup;
  },
  setTubeColor: (state, tubeId, rgb) => {
    const pos = state.tubesLookup[tubeId];
    if (pos !== undefined) {
      state.tubes[pos].color = rgb.slice();
    }
  },
  reparentTubes: (state, remap) => {
    const tubesToChange = Object.keys(remap);
    for (let i = 0; i < tubesToChange.length; i++) {
      const childId = tubesToChange[i];
      const parentId = remap[childId];

      const childPos = state.tubesLookup[childId];
      const parentPos = state.tubesLookup[parentId];
      if (
        childPos !== undefined &&
        // allow unparenting a child tube
        (parentId === -1 || parentPos !== undefined)
      ) {
        state.tubes[childPos].parentId = parentId;
      }
    }
  },
};

export default {
  namespaced: true,
  state: createState(),
  actions,
  mutations,

  // custom properties
  serialize,
  unserialize,
  proxyManagerHooks,
};
