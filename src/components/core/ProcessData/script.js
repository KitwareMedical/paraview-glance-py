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
      inputImage: (processData) => {
        if (processData.inputImage) {
          return {
            name: processData.inputImage.getName(),
            sourceId: processData.inputImage.getProxyId(),
          };
        }
        return null;
      },
      inputLabelmap: (processData) => {
        if (processData.inputLabelmap) {
          return {
            name: processData.inputLabelmap.getName(),
            sourceId: processData.inputLabelmap.getProxyId(),
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
      setInputImage: 'setInputImage',
      setInputLabelmap: 'setInputLabelmap',
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
