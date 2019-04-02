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
    };
  },
};
