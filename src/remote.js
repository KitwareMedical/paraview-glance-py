import WebsocketConnection from 'paraview-glance/wslink/js/src/WebsocketConnection';

import * as serializable from 'paraview-glance/src/serializable';
// register transformers
import 'paraview-glance/src/transformers';

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

  // handles return results
  const handleResult = function handleResult(result) {
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

      return serializable.revert(data).then((obj) => {
        if (uid) {
          objDir.set(obj, uid);
        }

        if (deferred) {
          deferred.resolve(obj);
          return deferred.promise;
        }

        return obj;
      });
    }
    return Promise.reject(new Error('No result from server'));
  };

  const call = function call(rpcEndpoint, skipObjDir, ...args) {
    return pSession.then((session) => {
      const preparedArgs = args.map((arg) => {
        if (!skipObjDir && objDir.has(arg)) {
          return Promise.resolve(objDir.get(arg)).then((uid) => ({
            uid,
            data: null,
          }));
        }

        const attachTypedArrays = (key, value) => {
          if (!Array.isArray(value) && ArrayBuffer.isView(value)) {
            return session.addAttachment(value.buffer);
          }
          return value;
        };

        return serializable.prepare(arg, attachTypedArrays).then((data) => ({
          uid: null,
          data,
        }));
      });

      return Promise.all(preparedArgs)
        .then((newArgs) => session.call(rpcEndpoint, newArgs))
        .then(handleResult);
    });
  };

  // connection lifecycle callbacks
  pSession
    .then((session) => cbs.ready.forEach((cb) => cb(session)))
    .catch((error) => cbs.error.forEach((cb) => cb(error)));

  // handle deferred results
  pSession.then((session) => session.subscribe('defer.results', handleResult));

  return {
    onready: (cb) => setCallback(cbs.ready, cb),
    onerror: (cb) => setCallback(cbs.error, cb),
    call: (rpcEndpoint, ...args) => call(rpcEndpoint, false, ...args),
    persist: (obj) => {
      if (objDir.has(obj)) {
        return Promise.resolve(objDir.get(obj));
      }
      const promise = call('persist_object', true, obj).then((uid) => {
        objDir.set(obj, uid);
        return uid;
      });

      // set objDir's contents with a promsie
      objDir.set(obj, promise);
      return promise;
    },
    delete: (obj) => {
      if (objDir.has(obj)) {
        return call('delete_object', false, obj).then(() => {
          objDir.delete(obj);
        });
      }
      return Promise.resolve();
    },
  };
}

export default {
  connect,
};
