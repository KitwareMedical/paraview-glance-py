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

        // TODO pipeline isn't cleared if a source is deleted
        this.pipelines.set(source, {
          original: source,
          preProcessed: null,
          tubeSource,
          tubes: new TubeUtils.TubeCollection(),
        });

        // re-activate previous active source
        activeSource.activate();
      }
    },
    setPreProcessed(image) {
      const pipeline = this.pipelines.get(this.master);

      if (pipeline.preProcessed === null) {
        // so we can re-activate current source
        const activeSource = this.proxyManager.getActiveSource();

        const source = this.proxyManager.createProxy(
          'Sources',
          'TrivialProducer',
          {
            name: `Pre-processed ${this.master.getName()}`,
          }
        );
        pipeline.preProcessed = source;

        // re-activate previous active source
        activeSource.activate();
      }

      const { preProcessed } = pipeline;

      preProcessed.setInputData(image);
      this.proxyManager.createRepresentationInAllViews(preProcessed);

      // allow child components to update with new preProcessed info
      this.pipelines.set(this.master, Object.assign({}, pipeline));
    },
  },
};
