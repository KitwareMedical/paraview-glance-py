import Datasets from 'paraview-glance/src/components/core/Datasets';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';
import EditTools from 'paraview-glance/src/components/core/EditTools';
import ProcessData from 'paraview-glance/src/components/core/ProcessData';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
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
          name: 'Paint',
          component: EditTools,
          paginate: true,
        },
        {
          name: 'Process',
          component: ProcessData,
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
