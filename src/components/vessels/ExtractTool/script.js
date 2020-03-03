import { mapActions, mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';

import SourceSelect from 'paraview-glance/src/components/widgets/SourceSelect';

// global pickers
const pointPicker = vtkPointPicker.newInstance();

const NO_PROXY = -1;

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
  components: {
    SourceSelect,
  },
  data() {
    const TubeSizes = [
      { size: 'Small', args: { ridge: 1, radius: 1 } },
      { size: 'Medium', args: { ridge: 2, radius: 2 } },
      { size: 'Large', args: { ridge: 4, radius: 4 } },
      { size: 'Custom', args: null },
    ];

    return {
      enabled: false,
      extractionSourceId: NO_PROXY,

      scale: 2, // TO REMOVE
      ridgeScale: 2,
      radiusScale: 2,
      dynamicScale: false,
      tubeScale: TubeSizes[0],
      pendingSegs: 0,

      TubeSizes,
    };
  },
  computed: {
    ...mapState('vessels', {
      numberOfTubes: (state) => state.tubes.length,
    }),
    extractionSource() {
      return this.$proxyManager.getProxyById(this.extractionSourceId);
    },
    ready() {
      return this.extractionSource && this.enabled;
    },
  },
  watch: {
    tubeScale(scale) {
      if (scale.args) {
        const { ridge, radius } = scale.args;
        this.ridgeScale = ridge;
        this.radiusScale = radius;
      }
    },
  },
  mounted() {
    this.subs = [];
    this.$proxyManager.getViews().forEach((view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        pointPicker.setPickFromList(1);
        interactor.setPicker(pointPicker);

        // left mouse click
        // TODO unsub
        this.subs.push(
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
  beforeDestroy() {
    while (this.subs.length) {
      this.subs.pop().unsubscribe();
    }
  },
  methods: {
    ...mapActions('vessels', ['extractTube']),
    filterImageData(source) {
      return (
        source.getProxyName() === 'TrivialProducer' &&
        source.getType() === 'vtkImageData'
      );
    },
    setExtractionImage(sourceId) {
      this.extractionSourceId = sourceId;
    },
    segmentAtClick(position, view) {
      const point = [position.x, position.y, 0];
      const source = this.extractionSource;

      pointPicker.initializePickList();
      const rep = this.$proxyManager.getRepresentation(source, view);
      rep.getActors().forEach(pointPicker.addPickList);

      pointPicker.pick(point, view.getRenderer());

      return this.extractTube({
        source: this.extractionSource,
        coords: pointPicker.getPointIJK(),
        scale: this.scale,
      });
    },
  },
};
