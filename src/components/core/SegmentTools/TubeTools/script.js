import { mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkCellPicker from 'vtk.js/Sources/Rendering/Core/CellPicker';

import utils from 'paraview-glance/src/utils';
import TubeUtils from 'paraview-glance/src/components/core/SegmentTools/TubeUtils';

const { forAllViews } = utils;
// global pickers
const pointPicker = vtkPointPicker.newInstance();
const cellPicker = vtkCellPicker.newInstance();

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
  name: 'TubeTools',
  props: ['inputData'],
  data() {
    return {
      enabled: false,
      scale: 2,
      pendingSegs: 0,
      readyPromise: Promise.resolve(),
    };
  },
  computed: {
    ready() {
      return this.inputData && this.enabled;
    },
    ...mapState(['proxyManager', 'remote']),
  },
  watch: {
    inputData(data) {
      if (!data) {
        this.enabled = false;
      }
    },
    enabled(state) {
      if (state) {
        const source = this.inputData.postProcessed;
        const dataset = source.getDataset();
        this.readyPromise = this.remote.call(
          'set_segment_image',
          this.remote.persist(dataset)
        );
      }
    },
  },
  mounted() {
    // TODO unsub
    forAllViews(this.proxyManager, (view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        pointPicker.setPickFromList(1);
        interactor.setPicker(pointPicker);

        // left mouse click
        // TODO unsub
        onClick(interactor, 'left', (ev) => {
          if (this.ready) {
            this.pendingSegs++;
            this.segmentAtClick(ev.position, view)
              .finally(() => {
                this.pendingSegs--;
              });
          }
        });

        // right mouse click
        // TODO unsub
        onClick(interactor, 'right', (ev) => {
          const point = [ev.position.x, ev.position.y, 0];
          pointPicker.pick(point, ev.pokedRenderer);

          // TODO use selected source
          const activeSource = this.proxyManager.getActiveSource();

          console.log(ev.position);
          // ev.pokedRenderer.getRenderWindow().getInteractor().getContainer()
        });
      } else {
        // 3D view
        const interactor = view.getRenderWindow().getInteractor();
        cellPicker.setPickFromList(1);
        interactor.setPicker(cellPicker);

        // TODO unsub
        onClick(interactor, 'left', (ev) => {
          if (this.inputData && this.inputData.tubeSource) {
            this.tryPickTube(ev.position, view);
          }
        });
      }
    });
  },
  methods: {
    listTubes() {
      if (this.inputData) {
        return this.inputData.tubes.getAll();
      }
      return [];
    },
    deleteTube(tubeId) {
      // TODO delete tube server-side
      if (this.inputData) {
        const { source } = this.inputData;
        const dataset = source.getDataset();
        this.inputData.tubes.delete(tubeId);
        this.refreshTubeUI();
      }
    },
    toggleTubeVisibility(tubeId) {
      if (this.inputData) {
        const { tubes } = this.inputData;
        const color = tubes.get(tubeId).color.slice();
        color[3] = 1 - color[3]; // alpha color is in [0, 1]
        tubes.setColor(tubeId, color);
        this.refreshTubeUI();
      }
    },
    refreshTubeUI() {
      const { tubes, tubeSource } = this.inputData;
      tubeSource.setInputData(tubes.getTubeGroup());

      const reps = this.proxyManager
        .getRepresentations()
        .filter((r) => r.getInput() === this.inputData.tubeSource);

      for (let i = 0; i < reps.length; i++) {
        reps[i].setColorBy('Colors', 'cellData');
      }

      this.proxyManager.renderAllViews();
      this.$forceUpdate();
    },
    segmentAtClick(position, view) {
      const point = [position.x, position.y, 0];
      const source = this.inputData.postProcessed;

      pointPicker.initializePickList();
      const rep = this.proxyManager.getRepresentation(source, view);
      rep.getActors().forEach(pointPicker.addPickList);

      pointPicker.pick(point, view.getRenderer());

      return this.readyPromise.then(() => this.remote
        .call('segment', pointPicker.getPointIJK(), this.scale)
        .then((centerline) => {
          if (centerline) {
            const { tubes, tubeSource } = this.inputData;
            tubes.put(centerline);
          }

          this.refreshTubeUI();
        })
      );
    },
    tryPickTube(position, view) {
      const { tubeSource, tubes } = this.inputData;
      cellPicker.initializePickList();

      const rep = this.proxyManager.getRepresentation(tubeSource, view);
      rep.getActors().forEach(cellPicker.addPickList);

      const point = [position.x, position.y, 0];
      cellPicker.pick(point, view.getRenderer());

      const cellId = cellPicker.getCellId();
      if (cellId > -1) {
        const tubeId = tubes.findTubeFromCell(cellId);
        if (tubeId > -1) {
          console.log('Found tube', tubeId);

          // get closest point on centerline
          // probably do this on python side
          const centerline = tubes.get(tubeId);
          const pickCoord = cellPicker.getPickPosition();

          const closestPoint = function() {
            let dist = Infinity;
            let index = -1;
            for (let i = 0; i < centerline.points.length; i++) {
              const [x, y, z] = centerline.points[i].point;
              const d2 =
                (x - pickCoord[0]) ** 2 +
                (y - pickCoord[1]) ** 2 +
                (z - pickCoord[2]) ** 2;
              if (d2 > dist) {
                return index;
              }
              dist = d2;
              index = i;
            }
            return index;
          };
          const ptIndex = closestPoint();
          console.log('closest point', ptIndex, centerline.points[ptIndex]);
        }
      }
    },
  },
};
