import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

import vtkTubeGroup from 'paraview-glance/src/models/TubeGroup';
import {
  wrapMutationAsAction,
  convertStripsToPolys,
  centerlineToTube,
} from 'paraview-glance/src/utils';

const createState = () => ({
  inputSource: null,
  preProcessedSource: null,
  tubePdSource: null,
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
      proxy.getInput() === state.vessels.tubePdSource
    ) {
      proxy.setColorBy('Colors', 'cellData');
    }

    if (action === 'unregister') {
      const { inputSource, preProcessedSource, tubePdSource } = state.vessels;

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

      if (tubePdSource) {
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
    tubePdSource: idCombinator(state.tubePdSource),
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
    tubePdSource: proxyCombinator(serialized.tubePdSource),
    tubesLookup,
  });
}

const actions = {
  /**
   * Sets the input source.
   */
  setInputSource: wrapMutationAsAction('setInputSource'),

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
   */
  setPreProcessedSource: wrapMutationAsAction('setPreProcessedSource'),

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
      return Promise.resolve();
    });
  },

  /**
   * Updates tube source by rebuilding tube polydata.
   */
  updateTubeSource: ({ commit, dispatch, state, rootState }) =>
    dispatch('rebuildTubePolyData').then(() => {
      const { proxyManager } = rootState;

      let { tubePdSource: tubeSource } = state;
      if (!tubeSource) {
        const activeSource = proxyManager.getActiveSource();
        tubeSource = proxyManager.createProxy('Sources', 'TrivialProducer', {
          name: 'Tubes',
        });
        activeSource.activate();
      }

      tubeSource.setInputData(state.tubePolyData);

      proxyManager.createRepresentationInAllViews(tubeSource);
      proxyManager
        .getRepresentations()
        .filter((r) => r.getInput() === tubeSource)
        .forEach((rep) => rep.setColorBy('Colors', 'cellData'));

      commit('setTubeSource', tubeSource);
    }),

  /**
   * Rebuilds tube polydata.
   */
  rebuildTubePolyData: ({ commit, state }) => {
    const filter = vtkAppendPolyData.newInstance();
    filter.setInputData(vtkPolyData.newInstance());

    let numberOfCells = 0;
    for (let i = 0; i < state.tubes.length; i++) {
      const tubePd = state.tubeCache[state.tubes[i].id];
      filter.addInputData(tubePd);
      numberOfCells += tubePd.getNumberOfCells();
    }

    /* eslint-disable-next-line import/no-named-as-default-member */
    const tubeGroup = vtkTubeGroup.newInstance({
      polyData: filter.getOutputData(),
    });

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

    tubeGroup.getCellData().addArray(colors);

    // rebuild cellToTubeId
    // this.cellToTubeId = new Array(this.order.length);
    // let cumulativeCellCount = 0;
    // for (let i = 0; i < this.order.length; i++) {
    //   const id = this.order[i].id;
    //   const tubePd = this.tubeCache[id];
    //   cumulativeCellCount += tubePd.getNumberOfCells();
    //   this.cellToTubeId[i] = [cumulativeCellCount, id];
    // }

    commit('setTubePolyData', tubeGroup);
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
  setTubePolyData: (state, group) => {
    state.tubePolyData = group;
  },
  setTubeSource: (state, source) => {
    state.tubePdSource = source;
  },
  // TODO what if tube.id exists? Should update.
  // TODO generate tube polydata and insert into cache
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
  removeTube: (state, tubeId) => {
    let pos = state.tubesLookup[tubeId];
    if (pos !== undefined) {
      state.tubes.splice(pos, 1);
      // fix tube lookup
      for (; pos < state.tubes.length; pos++) {
        state.tubesLookup[state.tubes[pos]]--;
      }
    }
  },
  setTubeColor: (state, tubeId, rgb) => {
    const pos = state.tubesLookup[tubeId];
    if (pos !== undefined) {
      state.tubes[pos].color = rgb.slice();
    }
  },
  setTubeParent: (state, tubeId, parentId) => {
    const childPos = state.tubesLookup[tubeId];
    const parentPos = state.tubesLookup[parentId];
    if (childPos !== undefined && parentPos !== undefined) {
      state.tubes[childPos].parentId = parentId;
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
