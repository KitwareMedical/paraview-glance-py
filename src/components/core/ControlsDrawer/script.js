import Datasets from 'paraview-glance/src/components/core/Datasets';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';
import PreProcess from 'paraview-glance/src/components/vessels/PreProcess';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
  components: {
    Datasets,
    GlobalSettings,
    PreProcess,
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
          component: Preprocess,
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
