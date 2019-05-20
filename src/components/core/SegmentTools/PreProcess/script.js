import { mapState } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';

// ----------------------------------------------------------------------------

export default {
  name: 'PreProcess',
  props: ['inputSource'],
  data() {
    return {
      filters: ['windowLevel', 'median'],
      enabled: {
        windowLevel: false,
        median: false,
      },
      params: {
        windowLevel: {
          window: 255,
          level: 127,
        },
        median: {
          radius: 1,
        },
      },
      loading: false,
    };
  },
  computed: mapState(['remote']),
  methods: {
    run() {
      const dataset = this.inputSource.getDataset();

      // persist dataset on server b/c it won't change
      this.remote.persist(dataset);

      // TODO window-level params are from the 2d representations

      const args = this.filters
        .filter((name) => this.enabled[name])
        .map((filter) => Object.assign({ filter }, this.params[filter]));

      if (args.length) {
        this.loading = true;
        this.remote
          .call('preprocess', dataset, args)
          .then((vtkResult) => {
            // TODO vtk() call in serialize.js
            this.$emit('outputImage', vtk(vtkResult));
          })
          .finally(() => {
            this.loading = false;
          });
      } else {
        this.$emit('outputImage', dataset);
      }
    },
  },
};
