import { mapActions, mapGetters, mapState } from 'vuex';
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
      numberOfTubes: (state) => state.vessels.tubes.length,
    }),
    ...mapGetters({
      extractionSource: 'vessels/extractionSource',
    }),
    ready() {
      return this.extractionSource && this.enabled;
    },
    selectedImage() {
      if (this.extractionSource) {
        return {
          name: this.extractionSource.getName(),
          sourceId: this.extractionSource.getProxyId(),
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
      setExtractionSource: 'vessels/setExtractionSource',
      uploadExtractionImage: 'vessels/uploadExtractionImage',
    }),
    setExtractionImage(sourceId) {
      this.setExtractionSource(this.proxyManager.getProxyById(sourceId));
      if (this.enabled) {
        this.readyPromise = this.uploadExtractionImage();
      }
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
      const source = this.extractionSource;

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
