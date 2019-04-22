import { mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkCellPicker from 'vtk.js/Sources/Rendering/Core/CellPicker';

import utils from 'paraview-glance/src/utils';
import TubeUtils from 'paraview-glance/src/components/core/SegmentTools/TubeUtils';
import stripsToPolys from 'paraview-glance/src/components/core/SegmentTools/StripsToPolys';

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
  },
  mounted() {
    // TODO unsub
    forAllViews(this.proxyManager, (view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        cellPicker.setPickFromList(1);
        interactor.setPicker(pointPicker);

        // left mouse click
        // TODO unsub
        onClick(interactor, 'left', (ev) => {
          if (this.ready) {
            this.pendingSegs++;
            this.segmentAtClick(ev.position, view)
              .then(() => {
                this.pendingSegs--;
                this.$forceUpdate();
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
      } else { // 3D view
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
        return this.inputData.tubes.getList();
      }
      return [];
    },
    deleteTube(tubeId) {
      // TODO delete tube server-side
      if (this.inputData) {
        this.inputData.tubes.delete(tubeId);
        this.$forceUpdate();
      }
    },
    segmentAtClick(position, view) {
      const point = [position.x, position.y, 0];
      const source = this.inputData.postProcessed;

      pointPicker.initializePickList();
      const rep = this.proxyManager.getRepresentation(source, view);
      rep.getActors().forEach(pointPicker.addPickList);

      pointPicker.pick(point, view.getRenderer());

      const dataset = source.getDataset();
      return this.remote
        .call('segment', dataset, pointPicker.getPointIJK(), 2.0)
        .then((centerline) => {
          console.log(centerline);
          const { postProcessed, tubes, cellToTubeId, tubeSource } = this.inputData;

          tubes.put(centerline.id, centerline);

          const newTube = TubeUtils.centerlineToTube(centerline.points);
          stripsToPolys(newTube);

          // append tube to existing tubes
          const appendFilter = vtkAppendPolyData.newInstance();
          appendFilter.setInputData(tubeSource.getDataset());
          appendFilter.addInputData(newTube);
          const allTubes = appendFilter.getOutputData();

          const totalNumberOfCells = allTubes.getNumberOfCells();
          cellToTubeId.push([totalNumberOfCells, centerline.id]);

          tubeSource.setInputData(allTubes);
          this.proxyManager.createRepresentationInAllViews(tubeSource);
        });
    },
    tryPickTube(position, view) {
      const { tubeSource, tubes, cellToTubeId } = this.inputData;
      cellPicker.initializePickList();

      const rep = this.proxyManager.getRepresentation(tubeSource, view);
      rep.getActors().forEach(cellPicker.addPickList);

      const point = [position.x, position.y, 0];
      cellPicker.pick(point, view.getRenderer());

      const cellId = cellPicker.getCellId();
      if (cellId > -1) {
        const tubeId = TubeUtils.getTubeIdFromCell(cellId, cellToTubeId);
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
