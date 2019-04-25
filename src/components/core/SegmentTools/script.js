/* eslint-disable import/no-named-as-default-member */
import { mapState } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';
import macro from 'vtk.js/Sources/macro';

import vtkTubeGroup from 'paraview-glance/src/models/TubeGroup';

import PreProcess from './PreProcess';
import TubeTools from './TubeTools';
import TubeUtils from './TubeUtils';

export default {
  name: 'SegmentTools',
  components: {
    PreProcess,
    TubeTools,
  },
  data() {
    return {
      master: null,
      pipelines: new WeakMap(),
      menuX: 0,
      menuY: 0,
      contextMenu: false,
      segmentScale: 5,
    };
  },
  computed: mapState(['proxyManager', 'remote']),
  mounted() {
    // TODO unsub
    this.proxyManager.onProxyRegistrationChange((info) => {
      if (info.proxyGroup === 'Sources') {
        if (
          info.action === 'unregister' &&
          this.master &&
          this.master.getProxyId() === info.proxyId
        ) {
          this.master = null;
        }
        // update image selection
        this.$forceUpdate();
      }
    });
  },
  methods: {
    getVolumes() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          source: s,
        }));
    },
    setMasterVolume(source) {
      this.master = source;
      // TODO resultMap isn't cleared if a source is deleted
      if (!this.pipelines.has(source)) {
        // so we can re-activate current source
        const activeSource = this.proxyManager.getActiveSource();

        const tubeSource = this.proxyManager.createProxy(
          'Sources',
          'TrivialProducer',
          {
            name: `Tubes for ${activeSource.getName()}`,
          }
        );

        tubeSource.setInputData(vtkTubeGroup.newInstance());
        this.proxyManager.createRepresentationInAllViews(tubeSource);

        this.pipelines.set(source, {
          // when no post-processing, postProcessed is original source
          postProcessed: source,
          tubeSource,
          tubes: new TubeUtils.TubeCollection(),
        });

        // re-activate previous active source
        activeSource.activate();
      }
    },
    setPostProcessed(image) {
      const pipeline = this.pipelines.get(this.master);

      if (pipeline.postProcessed == this.master) {
        // so we can re-activate current source
        const activeSource = this.proxyManager.getActiveSource();

        const source = this.proxyManager.createProxy(
          'Sources',
          'TrivialProducer',
          {
            name: `Pre-processed ${this.master.getName()}`,
          }
        );
        pipeline.postProcessed = source;

        // re-activate previous active source
        activeSource.activate();
      }

      const { postProcessed } = pipeline;

      postProcessed.setInputData(image);
      this.proxyManager.createRepresentationInAllViews(postProcessed);
    },
  },
};
