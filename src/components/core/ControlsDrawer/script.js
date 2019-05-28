import Datasets from 'paraview-glance/src/components/core/Datasets';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';
import PreProcess from 'paraview-glance/src/components/vessels/PreProcess';
import ExtractTool from 'paraview-glance/src/components/vessels/ExtractTool';
import TubeTools from 'paraview-glance/src/components/vessels/TubeTools';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
  components: {
    Datasets,
    GlobalSettings,
    PreProcess,
    ExtractTool,
    TubeTools,
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
          component: PreProcess,
          paginate: true,
        },
        {
          name: 'Extract',
          component: ExtractTool,
          paginate: true,
        },
        {
          name: 'Tubes',
          component: TubeTools,
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
