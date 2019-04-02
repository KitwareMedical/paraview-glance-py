import WebsocketConnection from 'paraview-glance/wslink/js/src/WebsocketConnection';

function defer() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

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
 * Walks an object tree and converts any vtkDataArrays to
 * a wslink attachment.
 *
 * This mutates the given object.
 */
function extractVtkAttachments(obj, session) {
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

  extract(obj);
  return obj;
}

function connect(endpoint) {
  const cbs = {
    ready: [],
    error: [],
  };

  // obj -> { guid, dirty }
  const objDir = new WeakMap();

  // resultId -> deferred
  const deferredWaitlist = new Map();

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

  // handle deferred results
  pSession.then((session) => {
    session.subscribe('defer.results', (deferredResult) => {
      const { $resultId, $results } = deferredResult[0];
      if (deferredWaitlist.has($resultId)) {
        const deferred = deferredWaitlist.get($resultId);
        deferredWaitlist.delete($resultId);
        deferred.resolve($results);
      }
    });
  });

  const api = {
    onready: (cb) => setCallback(cbs.ready, cb),
    onerror: (cb) => setCallback(cbs.error, cb),
    call: (rpcEndpoint, ...args) =>
      pSession.then((session) => {
        const newArgs = Array(args.length);
        let uploadPromise = Promise.resolve();
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg && arg.isA && arg.isA('vtkObject')) {
            let guid = null;
            let dirty = false;
            if (objDir.has(arg)) {
              const state = objDir.get(arg);
              guid = state.guid;
              dirty = state.dirty;
            }

            if (objDir.has(arg) && !dirty) {
              newArgs[i] = {
                __objguid__: guid,
              };
            } else {
              const serialized = arg.getState();
              extractVtkAttachments(serialized, session);
              uploadPromise = uploadPromise
                .then(() => api.call('objdir_put', serialized, guid))
                .then((newGuid) => {
                  newArgs[i] = {
                    __objguid__: newGuid,
                  };
                  objDir.set(arg, {
                    guid: newGuid,
                    dirty: false,
                  });
                });
            }
          } else {
            newArgs[i] = arg;
          }
        }
        return uploadPromise
          .then(() => session.call(rpcEndpoint, newArgs))
          .then((result) => {
            if (result && result.$deferredResultId) {
              const resultId = result.$deferredResultId;
              const deferred = defer();
              deferredWaitlist.set(resultId, deferred);
              return deferred.promise;
            }
            return result;
          });
      }),
    markDirty(targetObject) {
      if (targetObject && objDir.has(targetObject)) {
        const state = objDir.get(targetObject);
        objDir.set(targetObject, Object.assign(state, { dirty: true }));
      }
    },
  };

  return api;
}

export default {
  connect,
};
