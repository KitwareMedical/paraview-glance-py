import { mapActions, mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';

import ProxyManagerMixin from 'paraview-glance/src/mixins/ProxyManagerMixin';
import VtkMixin from 'paraview-glance/src/mixins/VtkMixin';

// global pickers
const pointPicker = vtkPointPicker.newInstance();

// ----------------------------------------------------------------------------

function onClick(interactor, button, cb) {
  const pressFn = `on${macro.capitalize(button)}ButtonPress`;
  const releaseFn = `on${macro.capitalize(button)}ButtonRelease`;
  let ox = 0;
  let oy = 0;
  const pressSub = interactor[pressFn]((ev) => {
    ox = ev.position.x;
    oy = ev.position.y;
  });
  const releaseSub = interactor[releaseFn]((ev) => {
    const { x, y } = ev.position;
    if ((x - ox) ** 2 + (y - oy) ** 2 < 9) {
      cb(ev);
    }
  });
  return {
    unsubscribe: () => {
      pressSub.unsubscribe();
      releaseSub.unsubscribe();
    },
  };
}

// ----------------------------------------------------------------------------

export default {
  name: 'ExtractTool',
  mixins: [ProxyManagerMixin, VtkMixin],
  data() {
    const tubeSizes = [
      { size: 'Small', args: { ridge: 1, radius: 1 } },
      { size: 'Medium', args: { ridge: 2, radius: 2 } },
      { size: 'Large', args: { ridge: 4, radius: 4 } },
      { size: 'Custom', args: null },
    ];

    return {
      extractSource: null,
      enabled: false,
      scale: 2, // TO REMOVE
      ridgeScale: 2,
      radiusScale: 2,
      dynamicScale: false,
      tubeScale: tubeSizes[0],
      tubeSizes,
      pendingSegs: 0,
      readyPromise: Promise.resolve(),

      selectedTubes: {
        order: [],
        map: {},
      },


      pipelines: new WeakMap(),
      menuX: 0,
      menuY: 0,
      contextMenu: false,
      segmentScale: 5,
    };
  },
  computed: {
    ...mapState({
      remote: 'remote',
      autoExtractSource: (state) => state.vessels.preProcessedSource,
      numberOfTubes: (state) => state.vessels.tubes.length,
    }),
    ready() {
      return this.extractSource && this.enabled;
    },
    extractionImage() {
      if (this.extractSource) {
        return {
          name: this.extractSource.getName(),
          source: this.extractSource,
        };
      }
      return null;
    },
  },
  watch: {
    autoExtractSource(source) {
      this.setExtractionImage(source);
    },
    tubeScale(scale) {
      if (scale.args) {
        const { ridge, radius } = scale.args;
        this.ridgeScale = ridge;
        this.radiusScale = radius;
      }
    },
  },
  proxyManager: {
    onProxyRegistrationChange({ proxyGroup }) {
      if (proxyGroup === 'Sources') {
        // update image selection
        this.$forceUpdate();
      }
    },
  },
  mounted() {
    this.forEachView((view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        pointPicker.setPickFromList(1);
        interactor.setPicker(pointPicker);

        // left mouse click
        this.autoSub(
          onClick(interactor, 'left', (ev) => {
            if (this.ready) {
              this.pendingSegs++;
              this.segmentAtClick(ev.position, view).finally(() => {
                this.pendingSegs--;
              });
            }
          })
        );
      }
    });
  },
  methods: {
    ...mapActions({
      extractTube: 'vessels/extractTube',
    }),
    // TODO move this to vessels store action
    setExtractionImage(source) {
      this.extractSource = source;
      this.readyPromise = this.remote.call(
        'set_segment_image',
        this.remote.persist(this.extractSource.getDataset())
      );
    },
    getAvailableImages() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          source: s,
        }));
    },
    segmentAtClick(position, view) {
      const point = [position.x, position.y, 0];
      const source = this.extractSource;

      pointPicker.initializePickList();
      const rep = this.proxyManager.getRepresentation(source, view);
      rep.getActors().forEach(pointPicker.addPickList);

      pointPicker.pick(point, view.getRenderer());

      return this.readyPromise.then(() =>
        this.extractTube({
          coords: pointPicker.getPointIJK(),
          scale: this.scale,
        })
      );
    },

    // setMasterVolume(source) {
    //   this.master = source;
    //   if (!this.pipelines.has(source)) {
    //     // so we can re-activate current source
    //     const activeSource = this.proxyManager.getActiveSource();

    //     const tubeSource = this.proxyManager.createProxy(
    //       'Sources',
    //       'TrivialProducer',
    //       {
    //         name: `Tubes for ${activeSource.getName()}`,
    //       }
    //     );

    //     tubeSource.setInputData(vtkTubeGroup.newInstance());
    //     this.proxyManager.createRepresentationInAllViews(tubeSource);

    //     // TODO pipeline isn't cleared if a source is deleted
    //     this.pipelines.set(source, {
    //       original: source,
    //       preProcessed: null,
    //       tubeSource,
    //       tubes: new TubeUtils.TubeCollection(),
    //     });

    //     // re-activate previous active source
    //     activeSource.activate();
    //   }
    // },
    // setPreProcessed(image) {
    //   const pipeline = this.pipelines.get(this.master);

    //   if (pipeline.preProcessed === null) {
    //     // so we can re-activate current source
    //     const activeSource = this.proxyManager.getActiveSource();

    //     const source = this.proxyManager.createProxy(
    //       'Sources',
    //       'TrivialProducer',
    //       {
    //         name: `Pre-processed ${this.master.getName()}`,
    //       }
    //     );
    //     pipeline.preProcessed = source;

    //     // re-activate previous active source
    //     activeSource.activate();
    //   }

    //   const { preProcessed } = pipeline;

    //   preProcessed.setInputData(image);
    //   this.proxyManager.createRepresentationInAllViews(preProcessed);

    //   // allow child components to update with new preProcessed info
    //   this.pipelines.set(this.master, Object.assign({}, pipeline));
    // },
  },
};
