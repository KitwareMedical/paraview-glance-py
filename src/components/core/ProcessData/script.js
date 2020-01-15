import { mapActions, mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';

import ProxyManagerMixin from 'paraview-glance/src/mixins/ProxyManagerMixin';

// ----------------------------------------------------------------------------

export default {
  name: 'ProcessData',
  mixins: [ProxyManagerMixin],
  data() {
    return {
      loading: false,
      error: null,
    };
  },
  computed: {
    ...mapState(['proxyManager']),
    ...mapState('processData', {
      parameters: 'parameters',
      args: 'args',
      inputImage(state) {
        const { inputImageId } = state;
        if (inputImageId !== null) {
          const inputImage = this.proxyManager.getProxyById(inputImageId);
          return {
            name: inputImage.getName(),
            sourceId: inputImageId,
          };
        }
        return null;
      },
      inputLabelmap(state) {
        const { inputLabelmapId } = state;
        if (inputLabelmapId !== null) {
          const inputLabelmap = this.proxyManager.getProxyById(inputLabelmapId);
          return {
            name: inputLabelmap.getName(),
            sourceId: inputLabelmapId,
          };
        }
        return null;
      },
    }),
    canRun() {
      return !!this.inputImage && !!this.inputLabelmap;
    },
  },
  proxyManager: {
    onProxyRegistrationChange({ proxyGroup }) {
      if (proxyGroup === 'Sources') {
        // update selections
        this.$forceUpdate();
      }
    },
  },
  methods: {
    ...mapActions('processData', {
      run: 'run',
      setInputImageId: 'setInputImageId',
      setInputLabelmapId: 'setInputLabelmapId',
    }),
    getAvailableDatasets(type) {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === type)
        .map((s) => ({
          name: s.getName(),
          sourceId: s.getProxyId(),
        }));
    },
    setArgument(name, value) {
      this.$store.dispatch('processData/setArgument', { name, value });
    },
    processData() {
      this.loading = true;
      this.error = null;

      this.run()
        .catch((error) => {
          this.error = error;
        })
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
