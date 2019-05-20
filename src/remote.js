import WebsocketConnection from 'paraview-glance/wslink/js/src/WebsocketConnection';

import serialize from 'paraview-glance/src/serialize';

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

function connect(endpoint) {
  const cbs = {
    ready: [],
    error: [],
  };

  // obj -> guid
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

  function handleResult(result) {
    if (result) {
      const { uid, data, deferredId } = result;
      let deferred = null;

      if (deferredId) {
        if (data && deferredWaitlist.has(deferredId)) {
          deferred = deferredWaitlist.get(deferredId);
          deferredWaitlist.delete(deferredId);
        } else if (!data) {
          deferred = defer();
          deferredWaitlist.set(deferredId, deferred);
          return deferred.promise;
        } else {
          return Promise.reject(
            new Error('Received deferred data, but no consumers')
          );
        }
      }

      return serialize.transform(data).then((transformedData) => {
        if (uid) {
          objDir.set(transformedData, uid);
        }

        if (deferred) {
          deferred.resolve(transformedData);
          return deferred.promise;
        }

        return transformedData;
      });
    }
    return Promise.reject(new Error('No result from server'));
  }

  // connection lifecycle callbacks
  pSession
    .then((session) => cbs.ready.forEach((cb) => cb(session)))
    .catch((error) => cbs.error.forEach((cb) => cb(error)));

  // handle deferred results
  pSession.then((session) => session.subscribe('defer.results', handleResult));

  const api = {
    onready: (cb) => setCallback(cbs.ready, cb),
    onerror: (cb) => setCallback(cbs.error, cb),
    call: (rpcEndpoint, ...args) =>
      pSession.then((session) => {
        const promisedArgs = args.map((arg) => {
          if (arg instanceof Promise) {
            return arg.then((uid) => ({
              uid,
              data: null,
            }));
          }

          if (objDir.has(arg)) {
            return Promise.resolve({
              uid: objDir.get(arg),
              data: null,
            });
          }

          return serialize
            .transform(arg, session.addAttachment)
            .then((data) => ({
              uid: null,
              data,
            }));
        });

        return Promise.all(promisedArgs)
          .then((newArgs) => session.call(rpcEndpoint, newArgs))
          .then(handleResult);
      }),
    // markDirty(targetObject) {
    //   if (targetObject && objDir.has(targetObject)) {
    //     const state = objDir.get(targetObject);
    //     objDir.set(targetObject, Object.assign(state, { dirty: true }));
    //   }
    // },
    persist: (obj) => {
      if (objDir.has(obj)) {
        return Promise.resolve(objDir.get(obj));
      }
      return api.call('persist_object', obj).then((uid) => {
        objDir.set(obj, uid);
        return uid;
      });
    },
    delete: (obj) => {
      if (objDir.has(obj)) {
        return api.call('delete_object', obj).then(() => {
          objDir.delete(obj);
        });
      }
      return Promise.resolve();
    },
  };

  return api;
}

export default {
  connect,
};
