import { mapActions, mapState, createNamespacedHelpers } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';

import ProxyManagerMixin from 'paraview-glance/src/mixins/ProxyManagerMixin';

const {
  mapActions: mapVesselActions,
  mapState: mapVesselState,
} = createNamespacedHelpers('vessels');

// ----------------------------------------------------------------------------

export default {
  name: 'PreProcess',
  mixins: [ProxyManagerMixin],
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
    ...mapState(['proxyManager', 'remote']),
    inputSource() {
      return this.proxyManager.getProxyById(this.inputSourceId);
    },
    outputSource() {
      const outputSourceId = this.outputCache[this.inputSourceId];
      return this.proxyManager.getProxyById(outputSourceId);
    },
    selectedImage() {
      if (this.inputSource) {
        return {
          name: this.inputSource.getName(),
          sourceId: this.inputSource.getProxyId(),
        };
      }
    },
  },
  proxyManager: {
    onProxyRegistrationChange({ proxyGroup, proxyId }) {
      if (proxyGroup === 'Sources') {
        // update image selection
        this.$forceUpdate();
      }
    },
  },
  methods: {
    setInputImage(sourceId) {
      this.inputSourceId = sourceId;
    },
    getAvailableImages() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          sourceId: s.getProxyId(),
        }));
    },
    runFilters() {
      const dataset = this.inputSource.getDataset();

      // persist dataset on server b/c it won't change
      this.remote.persist(dataset);

      // window-level params are from the 2d representations
      const reps = this.proxyManager
        .getRepresentations()
        .filter((r) => r.getInput() === this.inputSource)
        .filter((r) => r.isA('vtkSliceRepresentationProxy'));
      if (reps.length) {
        this.params.windowLevel.width = reps[0].getWindowWidth();
        this.params.windowLevel.level = reps[0].getWindowLevel();
      }

      const args = this.filters
        .filter((name) => this.enabled[name])
        .map((filter) => Object.assign({ filter }, this.params[filter]));

      if (args.length) {
        this.loading = true;
        this.remote
          .call('preprocess', dataset, args)
          .then((vtkImage) => {
            if (!this.outputSource) {
              const source = this.proxyManager.createProxy(
                'Sources',
                'TrivialProducer',
                {
                  name: `Pre-Processed ${this.inputSource.getName()}`,
                },
              );

              this.$set(
                this.outputCache,
                this.inputSourceId,
                source.getProxyId()
              );
            }

            this.outputSource.setInputData(vtkImage);
            this.proxyManager.createRepresentationInAllViews(this.outputSource);

            // TODO set output as extraction image
          })
          .finally(() => {
            this.loading = false;
          });
      }
    },
  },
};
