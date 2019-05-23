import Datasets from 'paraview-glance/src/components/core/Datasets';
import EditTools from 'paraview-glance/src/components/core/EditTools';
import SegmentTools from 'paraview-glance/src/components/core/SegmentTools';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
  components: {
    Datasets,
    EditTools,
    SegmentTools,
    GlobalSettings,
  },
  data() {
    return {
      activeTab: 0,
      tabs: [
        {
          name: 'Datasets',
          component: Datasets,
          paginate: false,
        },
        {
          name: 'Preprocess',
          component: SegmentTools,
          paginate: true,
        },
        {
          name: 'Extract',
          component: null,
          paginate: true,
        },
        {
          name: 'Tubes',
          component: null,
          paginate: true,
        },
        {
          name: 'Statistics',
          component: null,
          paginate: true,
        },
        {
          name: 'Register',
          component: null,
          paginate: true,
        },
        {
          name: 'Global',
          component: GlobalSettings,
          paginate: false,
        },
      ],
    };
  },
};
