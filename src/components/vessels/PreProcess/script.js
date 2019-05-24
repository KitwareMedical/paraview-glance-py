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
    ...mapVesselState({
      inputSource: (state) => {
        if (state.inputSource) {
          return {
            name: state.inputSource.getName(),
            source: state.inputSource,
          };
        }
        return null;
      },
    }),
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
    ...mapVesselActions({
      setInputSource: 'setInputSource',
      setPreProcessedImage: 'setPreProcessedImage',
    }),
    getAvailableImages() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          source: s,
        }));
    },
    runFilters() {
      const dataset = this.inputSource.source.getDataset();

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
          .then((vtkResult) => {
            // TODO vtk() call in serialize.js
            const outputDataset = vtk(vtkResult);
            this.setPreProcessedImage(outputDataset);
          })
          .finally(() => {
            this.loading = false;
          });
      // } else {
      //   this.$emit('outputImage', dataset);
      }
    },
  },
};
