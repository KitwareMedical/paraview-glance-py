import { mapState } from 'vuex';
import macro from 'vtk.js/Sources/macro';
import vtkPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

import utils from 'paraview-glance/src/utils';

const { forAllViews } = utils;

function onClick(interactor, button, cb) {
  const pressFn = `on${macro.capitalize(button)}ButtonPress`;
  const releaseFn = `on${macro.capitalize(button)}ButtonRelease`;
  let pressTime = 0;
  const pressSub = interactor[pressFn](() => {
    pressTime = +new Date();
  });
  const releaseSub = interactor[releaseFn]((ev) => {
    if (+new Date() - pressTime < 250) {
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

function centerlineToTube(centerline) {
  const pd = vtkPolyData.newInstance();
  const pts = vtkPoints.newInstance({
    dataType: VtkDataTypes.FLOAT,
    numberOfComponents: 3,
  });
  pts.setNumberOfPoints(centerline.length);

  const pointData = new Float32Array(3 * centerline.length);
  const lines = new Uint32Array(centerline.length + 1);

  lines[0] = centerline.length;
  for (let i = 0; i < centerline.length; ++i) {
    pointData[3 * i + 0] = centerline[i].point[0];
    pointData[3 * i + 1] = centerline[i].point[1];
    pointData[3 * i + 2] = centerline[i].point[2];
    lines[i + 1] = i;
  }

  const radii = centerline.map((p) => p.radius);
  const scalarsData = new Float32Array(radii);
  const scalars = vtkDataArray.newInstance({
    name: 'Radius',
    values: scalarsData,
  });

  pts.setData(pointData);
  pd.setPoints(pts);
  pd.getLines().setData(lines);
  pd.getPointData().setScalars(scalars);

  const filter = vtkTubeFilter.newInstance({
    capping: true,
    radius: 1, // scaling factor
    varyRadius: VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR,
    numberOfSides: 50,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

const picker = vtkPicker.newInstance();

export default {
  name: 'SegmentTools',
  data() {
    return {
      resultSources: new WeakMap(),
      menuX: 0,
      menuY: 0,
      contextMenu: false,
      segmentScale: 5,
    };
  },
  computed: mapState(['proxyManager', 'remote']),
  methods: {
    run() {
      const activeSource = this.proxyManager.getActiveSource();
      const dataset = activeSource.getDataset();
      this.remote.call('median_filter', dataset, 2).then(([vtkResult]) => {
        if (!this.resultSources.has(dataset)) {
          const source = this.proxyManager.createProxy(
            'Sources',
            'TrivialProducer',
            {
              name: '<div>', // TODO vtkResult.name
            }
          );
          this.resultSources.set(dataset, source);
        }

        const source = this.resultSources.get(dataset);
        if (source !== undefined) {
          const image = vtk(vtkResult);
          source.setInputData(image);
          this.proxyManager.createRepresentationInAllViews(source);
        }
      });
    },
  },
  mounted() {
    // TODO unsub
    forAllViews(this.proxyManager, (view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        interactor.setPicker(picker);

        // left mouse click
        // TODO unsub
        onClick(interactor, 'left', (ev) => {
          const point = [ev.position.x, ev.position.y, 0];
          picker.pick(point, ev.pokedRenderer);

          // TODO use selected source
          const activeSource = this.proxyManager.getActiveSource();
          const dataset = activeSource.getDataset();

          this.remote
            .call('segment', dataset, picker.getPointIJK())
            // TODO receive whole tube set
            .then((centerline) => {
              if (!this.resultSources.has(dataset)) {
                const source = this.proxyManager.createProxy(
                  'Sources',
                  'TrivialProducer',
                  {
                    name: 'name', // TODO vtkResult.name
                  }
                );
                this.resultSources.set(dataset, source);
              }

              const source = this.resultSources.get(dataset);
              if (source !== undefined) {
                const tube = centerlineToTube(centerline);
                source.setInputData(tube);
                this.proxyManager.createRepresentationInAllViews(source);
              }
            });
          console.log(picker.getPointIJK());
        });

        // right mouse click
        // TODO unsub
        onClick(interactor, 'right', (ev) => {
          const point = [ev.position.x, ev.position.y, 0];
          picker.pick(point, ev.pokedRenderer);

          // TODO use selected source
          const activeSource = this.proxyManager.getActiveSource();
          const dataset = activeSource.getDataset();

          console.log(ev.position);
          // ev.pokedRenderer.getRenderWindow().getInteractor().getContainer()
        });
      }
    });
  },
};
