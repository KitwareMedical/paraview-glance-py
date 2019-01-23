import Datasets from 'paraview-glance/src/components/core/Datasets';
import DataTools from 'paraview-glance/src/components/core/DataTools';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
  components: {
    Datasets,
    DataTools,
    GlobalSettings,
  },
  data() {
    return {
      activeTab: 0,
    };
  },
};
