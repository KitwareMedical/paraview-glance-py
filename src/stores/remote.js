import WebsocketConnection from 'paraview-glance/wslink/src/WebsocketConnection';

let ws = null;

function connect(endpoint) {
  return new Promise((resolve, reject) => {
    if (ws) {
      resolve(ws.getSession());
    } else if (endpoint) {
      // eslint-disable-next-line
      ws = WebsocketConnection.newInstance({ urls: endpoint });
      ws.onConnectionReady(() => resolve(ws.getSession()));
      ws.onConnectionError(reject);
      ws.connect();
    } else {
      reject(new Error('empty endpoint'));
    }
  });
}

export default {
  state: {
    endpoint: '',
  },
  mutations: {
    SET_REMOTE_ENDPOINT(state, endpoint) {
      state.endpoint = endpoint || '';
    },
  },
  actions: {
    UPLOAD_DATA({ rootState, state }) {
      // connect, then upload current image
      return connect(state.endpoint)
        .then((session) => {
          const source = rootState.proxyManager.getActiveSource();
          if (source && source.getDataset()) {
            const serialized = source.getDataset().getState();
            const findBinary = (o) => {
              if (o) {
                if (Array.isArray(o)) {
                  o.forEach((v) => findBinary(v));
                } else if (o.constructor === Object) {
                  if (o.vtkClass && o.vtkClass === 'vtkDataArray') {
                    // eslint-disable-next-line
                    o.values = session.addAttachment(
                      new window[o.dataType](o.values).buffer
                    );
                  } else {
                    Object.keys(o).forEach((k) => findBinary(o[k]));
                  }
                }
              }
            };
            findBinary(serialized);
            console.log(JSON.stringify(serialized).length);

            session.call('upload', [serialized]);
          }
        })
        .catch((error) => {
          console.error('failed to connect', error);
        });
    },
  },
};
