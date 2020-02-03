import { mapState, mapActions } from 'vuex';

import SourceSelect from 'paraview-glance/src/components/widgets/SourceSelect';

// ----------------------------------------------------------------------------

export default {
  name: 'RemoteProcessing',
  components: {
    SourceSelect,
  },
  data() {
    return {
      error: '',
    };
  },
  computed: {
    ...mapState('remote', {
      processing: 'processing',
      parameters: (state) => state.paramOrder.map((name) => state.params[name]),
    }),
  },
  mounted() {
    this.fetchParamList();
  },
  methods: {
    run() {
      this.error = '';
      this.runRemoteAlgorithm()
        .then((results) => {
          if (results.datasets) {
            results.datasets.forEach((datasetInfo) =>
              this.registerDataset(datasetInfo)
            );
          }
        })
        .catch((error) => {
          this.error = error.data.exception;
        });
    },

    registerDataset(info) {
      const { name, dataset, type = 'TrivialProducer' } = info;
      console.log('registerDataset', name, dataset);

      const proxy = this.$proxyManager
        .getSources()
        .filter((source) => source.getProxyName() === 'TrivialProducer')
        .find((source) => source.getName() === name);
      if (proxy) {
        proxy.setInputData(dataset);
      } else {
        const newProxy = this.$proxyManager.createProxy('Sources', type, {
          name,
        });
        newProxy.setInputData(dataset);
        this.$proxyManager.createRepresentationInAllViews(newProxy);
      }
    },

    ...mapActions('remote', {
      fetchParamList: 'fetchParamList',
      runRemoteAlgorithm: 'runRemoteAlgorithm',
      setParameter: (dispatch, name, value) => {
        dispatch('setParameter', { name, value });
      },
    }),
  },
};
