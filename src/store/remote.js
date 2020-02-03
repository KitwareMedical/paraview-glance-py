import { wrapMutationAsAction } from 'paraview-glance/src/utils';

const ParamDefaults = {
  source: -1,
  range: 0,
  bool: false,
};

export default ({ proxyManager, remote }) => ({
  namespaced: true,

  state: () => ({
    connected: false,
    connectError: null,
    processing: false,
    params: {},
    paramOrder: [],
    serverStdout: '',
  }),

  mutations: {
    connected(state) {
      state.connected = true;
    },
    connectError(state, error) {
      state.connectError = error;
    },
    loadParams(state, params) {
      const paramMap = {};
      params.forEach((param) => {
        paramMap[param.name] = param;
      });

      state.paramOrder = params.map((p) => p.name);
      state.params = paramMap;
    },
    setParameter(state, { name, value }) {
      state.params[name].value = value;
    },
    processing(state, flag) {
      state.processing = flag;
    },
    appendStdout(state, text) {
      state.serverStdout += text;
    },
    clearStdout(state) {
      state.serverStdout = '';
    },
  },

  actions: {
    connect({ commit }, endpoint) {
      return remote
        .connect(endpoint)
        .then(() => {
          commit('connected');
          remote.session.subscribe('streams.stdout', (stdout) =>
            commit('appendStdout', stdout)
          );
        })
        .catch((error) => commit('connectError', error));
    },
    fetchParamList({ commit }) {
      return remote.call('get_parameters').then((params) => {
        commit(
          'loadParams',
          params.map((param) => ({
            ...param,
            value: param.default || ParamDefaults[param.type],
          }))
        );
      });
    },
    runRemoteAlgorithm({ state, commit }) {
      const args = {};
      state.paramOrder.forEach((name) => {
        args[name] = state.params[name].value;
        if (state.params[name].type === 'source') {
          const source = proxyManager.getProxyById(args[name]);
          if (source) {
            // replace value with actual dataset
            args[name] = source.getDataset();
          } else {
            args[name] = null;
          }
        }
      });

      commit('processing', true);
      const promise = remote.call('run', args);
      promise.finally(() => commit('processing', false));
      return promise;
    },
    setParameter: wrapMutationAsAction('setParameter'),
    clearStdout: wrapMutationAsAction('clearStdout'),
  },
});
