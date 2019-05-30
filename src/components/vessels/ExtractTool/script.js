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
      enabled: false,
      scale: 2, // TO REMOVE
      ridgeScale: 2,
      radiusScale: 2,
      dynamicScale: false,
      tubeScale: tubeSizes[0],
      tubeSizes,
      pendingSegs: 0,
      readyPromise: Promise.resolve(),
    };
  },
  computed: {
    ...mapState({
      proxyManager: 'proxyManager',
      remote: 'remote',
      extractSource: (state) => state.vessels.extractSource,
      autoExtractSource: (state) =>
        state.vessels.preProcessedSource || state.vessels.inputSource,
      numberOfTubes: (state) => state.vessels.tubes.length,
    }),
    ready() {
      return this.extractSource && this.enabled;
    },
    extractionImage() {
      if (this.extractSource) {
        return {
          name: this.extractSource.getName(),
          sourceId: this.extractSource.getProxyId(),
        };
      }
      return null;
    },
  },
  watch: {
    enabled(enabled) {
      if (enabled) {
        this.readyPromise = this.uploadExtractionImage();
      }
    },
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
      setExtractionImage: 'vessels/setExtractionImage',
      uploadExtractionImage: 'vessels/uploadExtractionImage',
    }),
    setExtractionImageById(sourceId) {
      this.setExtractionImage(this.proxyManager.getProxyById(sourceId));
    },
    getAvailableImages() {
      return this.proxyManager
        .getSources()
        .filter((s) => s.getType() === 'vtkImageData')
        .map((s) => ({
          name: s.getName(),
          sourceId: s.getProxyId(),
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
  },
};
