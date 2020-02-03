import PaintTool from 'paraview-glance/src/components/tools/PaintTool';
import MeasurementTools from 'paraview-glance/src/components/tools/MeasurementTools';
import CropTool from 'paraview-glance/src/components/tools/CropTool';
import MedianFilter from 'paraview-glance/src/components/tools/MedianFilter';
import RemoteProcessing from 'paraview-glance/src/components/tools/RemoteProcessing';

// ----------------------------------------------------------------------------

export default {
  name: 'EditTools',
  components: {
    PaintTool,
    MeasurementTools,
    CropTool,
    MedianFilter,
    RemoteProcessing,
  },
  data() {
    return {
      enabledTool: '',
    };
  },
  methods: {
    setEnabledTool(tool, flag) {
      this.enabledTool = flag ? tool : '';
    },
  },
};
