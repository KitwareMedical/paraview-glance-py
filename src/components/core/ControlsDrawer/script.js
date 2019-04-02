import Datasets from 'paraview-glance/src/components/core/Datasets';
import SegmentTools from 'paraview-glance/src/components/core/SegmentTools';
import GlobalSettings from 'paraview-glance/src/components/core/GlobalSettings';

// ----------------------------------------------------------------------------

export default {
  name: 'ControlsDrawer',
  components: {
    Datasets,
    SegmentTools,
    GlobalSettings,
  },
  data() {
    return {
      activeTab: 0,
    };
  },
};
