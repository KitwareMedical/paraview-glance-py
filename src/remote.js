import WebsocketConnection from 'paraview-glance/wslink/src/WebsocketConnection';

function setCallback(arr, cb) {
  arr.push(cb);
  return () => {
    const idx = arr.findIndex(cb);
    if (idx > -1) {
      arr.splice(idx, 1);
    }
  };
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

function connect(endpoint) {
  const cbs = {
    ready: [],
    error: [],
  };

  // a promise holding our session
  const pSession = new Promise((resolve, reject) => {
    // eslint-disable-next-line
    const ws = WebsocketConnection.newInstance({ urls: endpoint });
    ws.onConnectionReady(() => resolve(ws.getSession()));
    ws.onConnectionError((error) => reject(error));
    ws.connect();
  });

  pSession
    .then((session) => cbs.ready.forEach((cb) => cb(session)))
    .catch((error) => cbs.error.forEach((cb) => cb(error)));

  return {
    onready: (cb) => setCallback(cbs.ready, cb),
    onerror: (cb) => setCallback(cbs.error, cb),
    call: (rpcEndpoint, ...args) =>
      pSession.then((session) => session.call(rpcEndpoint, args)),
    attachVtkObj: (obj) =>
      pSession.then((session) => extractAttachments(obj, session)),
  };
}

export default {
  connect,
  extractAttachments,
};
