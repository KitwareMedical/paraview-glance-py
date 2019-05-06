import { mapState } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';

// ----------------------------------------------------------------------------

export default {
  name: 'PreProcess',
  props: ['inputSource'],
  data() {
    return {
      medianRadius: 1,
      loading: false,
    };
  },
  computed: mapState(['remote']),
  methods: {
    run() {
      const dataset = this.inputSource.getDataset();

      this.loading = true;

      this.remote
        .call(
          'median_filter',
          this.remote.persist(dataset),
          this.medianRadius
        )
        .then((vtkResult) => {
          this.loading = false;
          this.$emit('outputImage', vtk(vtkResult));
        });
    },
  },
};
