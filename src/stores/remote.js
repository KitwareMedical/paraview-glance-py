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
      ws.onConnectionError(() => {
        ws = null;
        reject();
      });
      ws.connect();
    } else {
      reject(new Error('empty endpoint'));
    }
  });
}

/**
 * Serializes a vtk object and converts all vtkDataArrays into
 * a wslink binary attachment.
 */
function extractAttachments(vtkObj, session) {
  const state = vtkObj.getState();

  function extract(o) {
    if (o === null || o === undefined) {
      return;
    }

    if (o.vtkClass && o.vtkClass === 'vtkDataArray') {
      const attachment = new window[o.dataType](o.values).buffer;
      /* eslint-disable-next-line no-param-reassign */
      o.values = session.addAttachment(attachment);
    } else if (typeof o === 'object') {
      const keys = Object.keys(o);
      for (let i = 0; i < keys.length; i++) {
        extract(o[keys[i]]);
      }
    }
  }

  extract(state);
  return state;
}

export default {
  state: {
    endpoint: '',
  },
  mutations: {
    SET_REMOTE_ENDPOINT(state, endpoint) {
      state.endpoint = endpoint;
    },
  },
  actions: {
    CONNECT({ commit }, endpoint) {
      return connect(endpoint)
        .then(() => {
          commit('SET_REMOTE_ENDPOINT', endpoint || '');
          // TODO send HELLO
        })
        .catch((error) => {
          commit('SET_REMOTE_ENDPOINT', '');
          console.error('Failed to connect:', error);
        });
    },
    UPLOAD_DATA({ state }, vtkObj) {
      return connect(state.endpoint).then((session) => {
        const obj = extractAttachments(vtkObj, session);
        session.call('upload', [obj]).then((r) => {
          console.log('data ID:', r);
        });
      });
    },
  },
};
