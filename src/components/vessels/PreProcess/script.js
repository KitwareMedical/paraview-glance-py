import SourceSelect from 'paraview-glance/src/components/widgets/SourceSelect';
import { mapActions } from 'vuex';

// ----------------------------------------------------------------------------

export default {
  name: 'PreProcess',
  components: {
    SourceSelect,
  },
  data() {
    return {
      inputSourceId: -1,
      outputCache: {}, // inputSourceId -> outputSourceId
      filters: ['windowLevel', 'median'],
      enabled: {
        windowLevel: false,
        median: false,
      },
      params: {
        windowLevel: {
          width: 255,
          level: 127,
        },
        median: {
          radius: 1,
        },
      },
      loading: false,
    };
  },
  computed: {
    inputSource() {
      return this.$proxyManager.getProxyById(this.inputSourceId);
    },
    outputSource() {
      const outputSourceId = this.outputCache[this.inputSourceId];
      return this.$proxyManager.getProxyById(outputSourceId);
    },
    canRunFilters() {
      const args = this.filters
        .filter((name) => this.enabled[name])
        .map((filter) => ({ filter, ...this.params[filter] }));
      return !!args.length;
    },
  },
  methods: {
    ...mapActions('remote', {
      invokePreprocessRPC: (dispatch, dataset, args) =>
        dispatch('invokeRPC', {
          rpc: 'preprocess',
          args: [dataset, args],
        }),
    }),
    filterImageData(source) {
      return (
        source.getProxyName() === 'TrivialProducer' &&
        source.getType() === 'vtkImageData'
      );
    },
    setInputImage(sourceId) {
      this.inputSourceId = sourceId;
    },
    runFilters() {
      const dataset = this.inputSource.getDataset();

      // window-level params are from the 2d representations
      const reps = this.$proxyManager
        .getRepresentations()
        .filter((r) => r.getInput() === this.inputSource)
        .filter((r) => r.isA('vtkSliceRepresentationProxy'));
      if (reps.length) {
        this.params.windowLevel.width = reps[0].getWindowWidth();
        this.params.windowLevel.level = reps[0].getWindowLevel();
      }

      const args = this.filters
        .filter((name) => this.enabled[name])
        .map((filter) => ({ filter, ...this.params[filter] }));

      if (args.length) {
        this.loading = true;
        this.invokePreprocessRPC(dataset, args)
          .then((vtkImage) => {
            if (!this.outputSource) {
              const source = this.$proxyManager.createProxy(
                'Sources',
                'TrivialProducer',
                {
                  name: `Pre-Processed ${this.inputSource.getName()}`,
                }
              );

              this.outputCache = {
                ...this.outputCache,
                [this.inputSourceId]: source.getProxyId(),
              };
            }

            this.outputSource.setInputData(vtkImage);
            this.$proxyManager.createRepresentationInAllViews(
              this.outputSource
            );
            this.$proxyManager.renderAllViews();
          })
          .finally(() => {
            this.loading = false;
          });
      }
    },
  },
};
