import { mapState } from 'vuex';
import vtk from 'vtk.js/Sources/vtk';
import vtkPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';

/**
 * handler should return an "unsubscribe" for when a view is destructed.
 */
function listenForEachView(pxm, handler) {
  const subs = [];
  subs.push(
    pxm.onProxyRegistrationChange((info) => {
      if (info.proxyGroup === 'Views') {
        if (info.action === 'register') {
          subs.push({
            view: info.proxy,
            unsubscribe: handler(info.proxy),
          });
        } else if (info.action === 'unregister') {
          for (let i = 0; i < subs.length; i++) {
            if (subs[i].view === info.proxy) {
              subs[i].unsubscribe();
              subs.splice(i, 1);
              break;
            }
          }
        }
      }
    })
  );

  return () => {
    while (subs.length) {
      subs.pop().unsubscribe();
    }
  };
}

function onClick(interactor, cb) {
  let pressTime = 0;
  const pressSub = interactor.onLeftButtonPress(() => {
    pressTime = +new Date();
  });
  const releaseSub = interactor.onLeftButtonRelease((ev) => {
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

const picker = vtkPicker.newInstance();

export default {
  name: 'DataTools',
  data() {
    return {
      resultSources: new WeakMap(),
    };
  },
  computed: mapState(['proxyManager', 'remote']),
  methods: {
    run() {
      const activeSource = this.proxyManager.getActiveSource();
      const dataset = activeSource.getDataset();
      this.remote.call('median_filter', dataset, 3).then((vtkResult) => {
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
          const image = vtk(vtkResult);
          source.setInputData(image);
          this.proxyManager.createRepresentationInAllViews(source);
        }
      });
    },
  },
  mounted() {
    listenForEachView(this.proxyManager, (view) => {
      if (view.isA('vtkView2DProxy')) {
        const interactor = view.getRenderWindow().getInteractor();
        interactor.setPicker(picker);
        onClick(interactor, (ev) => {
          const point = [ev.position.x, ev.position.y, 10];
          picker.pick(point, ev.pokedRenderer);
          // TODO send this over to the server
          console.log(picker.getPointIJK());
        });
      }
    });
  },
};
