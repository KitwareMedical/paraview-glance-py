import { mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkCellPicker from 'vtk.js/Sources/Rendering/Core/CellPicker';

import ProxyManagerMixin from 'paraview-glance/src/mixins/ProxyManagerMixin';
import VtkMixin from 'paraview-glance/src/mixins/VtkMixin';

// global pickers
const cellPicker = vtkCellPicker.newInstance();

// ----------------------------------------------------------------------------

// function onClick(interactor, button, cb) {
//   const pressFn = `on${macro.capitalize(button)}ButtonPress`;
//   const releaseFn = `on${macro.capitalize(button)}ButtonRelease`;
//   let ox = 0;
//   let oy = 0;
//   const pressSub = interactor[pressFn]((ev) => {
//     ox = ev.position.x;
//     oy = ev.position.y;
//   });
//   const releaseSub = interactor[releaseFn]((ev) => {
//     const { x, y } = ev.position;
//     if ((x - ox) ** 2 + (y - oy) ** 2 < 9) {
//       cb(ev);
//     }
//   });
//   return {
//     unsubscribe: () => {
//       pressSub.unsubscribe();
//       releaseSub.unsubscribe();
//     },
//   };
// }

// ----------------------------------------------------------------------------

export default {
  name: 'TubeTools',
  mixins: [ProxyManagerMixin, VtkMixin],
  data() {
    return {
      selection: [],
      selectionLookup: {},
      showSelected: false,
    };
  },
  computed: {
    ...mapState({
      tubes: (state) => state.vessels.tubes,
      tubeIdMap: (state) => state.vessels.tubesLookup,
    }),
    shownTubes() {
      if (this.showSelected) {
        return this.selection.map((id) => this.tubes[this.tubeIdMap[id]]);
      }
      return this.tubes;
    },
  },
  methods: {
    toggleSelectAll() {
      if (this.selection.length) {
        this.clearSelection();
      } else {
        // select all
        const lookup = {};
        for (let i = 0; i < this.tubes.length; i++) {
          lookup[this.tubes[i].id] = i;
        }
        this.selection = this.tubes.map((tube) => tube.id);
        this.selectionLookup = lookup;
      }
    },
    toggleSelection(tubeId) {
      let idx = this.selectionLookup[tubeId];
      if (this.selectionLookup[tubeId] === undefined) {
        idx = this.selection.length;
        this.selectionLookup = {
          [tubeId]: idx,
          ...this.selectionLookup,
        };
        this.selection.push(tubeId);
      } else {
        this.selection.splice(idx, 1);
        this.$delete(this.selectionLookup, tubeId);

        // fix map from tubeId to order position
        for (; idx < this.selection.length; idx++) {
          this.selectionLookup[this.selection[idx]]--;
        }
      }
    },
    isTubeSelected(tubeId) {
      return this.selectionLookup[tubeId] !== undefined;
    },
    clearSelection() {
      this.selection = [];
      this.selectionLookup = {};
    },
    deleteSelected() {
      // TODO call "delete_tubes" rpc
    },


    deleteTube(tubeId) {
      if (this.inputData) {
        this.remote.call('delete_tube', this.inputData.tubes.get(tubeId)).then(() => {
          this.inputData.tubes.delete(tubeId);
          this.deselectTube(tubeId);
          this.refreshTubeUI();
        });
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

          if (this.isTubeSelected(tubeId)) {
            this.deselectTube(tubeId);
          } else {
            this.selectTube(tubeId);
          }

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
