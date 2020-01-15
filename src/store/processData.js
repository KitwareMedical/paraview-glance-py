import Vue from 'vue';

import { wrapMutationAsAction } from 'paraview-glance/src/utils';

const createState = () => ({
  inputImageId: null,
  inputLabelmapId: null,
  outputs: {},
  parameters: [],
  args: {},
});

export const proxyManagerHooks = {
  onProxyRegistrationChange: (store) => (info) => {
    const { processData: state } = store;
    const { action, proxyId } = info;
    if (action === 'unregister') {
      Object.keys(state.outputs).forEach((key) => {
        if (proxyId === state.outputs[key]) {
          debugger;
        }
      });
    }
  },
};

// export function serialize(state) {
//   const idCombinator = (src) => (src ? src.getProxyId() : null);
// }

// export function unserialize(serialized, pxm) {
//   const newState = createState();
//   const proxyCombinator = (id) => (id !== null ? pxm.getProxyById(id) : null);
// }

const actions = {
  setInputImageId: wrapMutationAsAction('setInputImageId'),

  setInputLabelmapId: wrapMutationAsAction('setInputLabelmapId'),

  setOutput: ({ commit, state, rootState }, { dataset, name }) => {
    const { proxyManager } = rootState;

    const sourceId = state.outputs[name];
    let source;
    if (sourceId === undefined) {
      source = proxyManager.createProxy('Sources', 'TrivialProducer', {
        name,
      });
    } else {
      source = proxyManager.getProxyById(sourceId);
    }

    source.setInputData(dataset);
    proxyManager.createRepresentationInAllViews(source);
    commit('setOutput', { name, source });
  },

  setArgument: wrapMutationAsAction('setArgument'),

  run: ({ dispatch, state, rootState }) => {
    const { proxyManager, remote } = rootState;

    const inputImage = proxyManager
      .getProxyById(state.inputImageId)
      .getDataset();
    const inputLabelmap = proxyManager
      .getProxyById(state.inputLabelmapId)
      .getDataset();

    remote.persist(inputImage);
    remote.persist(inputLabelmap);
    return remote
      .call('run', inputImage, inputLabelmap, state.args)
      .then((result) => {
        const { image, imageName, labelmap, labelmapName } = result;

        return Promise.all([
          dispatch('setOutput', {
            dataset: image,
            name: imageName,
          }),
          dispatch('setOutput', {
            dataset: labelmap,
            name: labelmapName,
          }),
        ]);
      });
  },

  loadParameters: ({ commit, rootState }) => {
    const { remote } = rootState;

    remote
      .call('get_parameters')
      .then((params) => commit('setParameters', params));
  },
};

const mutations = {
  setInputImageId: (state, sourceId) => {
    state.inputImageId = sourceId;
  },
  setInputLabelmapId: (state, sourceId) => {
    state.inputLabelmapId = sourceId;
  },
  setOutput: (state, { name, source }) => {
    if (!(name in state.outputs)) {
      Vue.set(state.outputs, name, null);
    }
    state.outputs[name] = source.getProxyId();
  },
  setParameters: (state, params) => {
    state.parameters = params;

    // reset args
    state.args = {};
    params.forEach((param) => Vue.set(state.args, param.name, param.default));
  },
  setArgument: (state, { name, value }) => {
    if (name in state.args) {
      state.args[name] = value;
    }
  },
};

export default {
  namespaced: true,
  state: createState(),
  actions,
  mutations,

  // custom properties
  // serialize,
  // unserialize,
  proxyManagerHooks,
};
