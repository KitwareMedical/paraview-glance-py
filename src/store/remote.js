import { wrapMutationAsAction } from 'paraview-glance/src/utils';

export default ({ remote }) => ({
  namespaced: true,

  state: () => ({
    connected: false,
    connectError: null,
    processing: false,
    serverStdout: '',
  }),

  mutations: {
    connected(state) {
      state.connected = true;
    },
    disconnected(state) {
      state.connected = false;
    },
    connectError(state, error) {
      state.connectError = error;
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
      remote.onClose(() => commit('disconnected'));

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
    invokeRPC(_, kwargs) {
      const { rpc, args } = kwargs;
      return remote.call(rpc, ...args);
    },
    clearStdout: wrapMutationAsAction('clearStdout'),
  },
});
