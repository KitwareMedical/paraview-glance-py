import Vue from 'vue';

import { wrapMutationAsAction } from 'paraview-glance/src/utils';

const createState = () => ({
  inputImage: null,
  inputLabelmap: null,
  outputs: {},
  parameters: [],
  args: {},
});

// export const proxyManagerHooks = {
//   onProxyRegistrationChange: (store) => (info) => {},
// };

// export function serialize(state) {
//   const idCombinator = (src) => (src ? src.getProxyId() : null);
// }

// export function unserialize(serialized, pxm) {
//   const newState = createState();
//   const proxyCombinator = (id) => (id !== null ? pxm.getProxyById(id) : null);
// }

const actions = {
  setInputImage: ({ commit, rootState }, sourceId) =>
    commit('setInputImage', rootState.proxyManager.getProxyById(sourceId)),

  setInputLabelmap: ({ commit, rootState }, sourceId) =>
    commit('setInputLabelmap', rootState.proxyManager.getProxyById(sourceId)),

  setOutput: ({ commit, state, rootState }, { dataset, name }) => {
    const { proxyManager } = rootState;

    let source = state.outputs[name];
    if (!source) {
      source = proxyManager.createProxy('Sources', 'TrivialProducer', {
        name,
      });
      source.setInputData(dataset);
    }

    proxyManager.createRepresentationInAllViews(source);
    commit('setOutput', { name, source });
  },

  setArgument: wrapMutationAsAction('setArgument'),

  run: ({ dispatch, state, rootState }) => {
    const { remote } = rootState;

    const inputImage = state.inputImage.getDataset();
    const inputLabelmap = state.inputLabelmap.getDataset();

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
  setInputImage: (state, source) => {
    state.inputImage = source;
  },
  setInputLabelmap: (state, source) => {
    state.inputLabelmap = source;
  },
  setOutput: (state, { name, source }) => {
    if (!(name in state.outputs)) {
      Vue.set(state.outputs, name, null);
    }
    state.outputs[name] = source;
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
  // proxyManagerHooks,
};
