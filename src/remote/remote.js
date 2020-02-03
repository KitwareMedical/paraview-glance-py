import WebsocketConnection from 'wslink/src/WebsocketConnection';

import * as serializable from 'paraview-glance/src/remote/serializable';
// register transformers
import 'paraview-glance/src/remote/transformers';

function generateConversionLookup(conversions) {
  const lookup = {};
  for (let i = 0; i < conversions.length; i++) {
    const conversion = conversions[i];
    const keys = Object.keys(conversion);
    for (let j = 0; j < keys.length; j++) {
      lookup[conversion[keys[j]]] = conversion;
    }
  }
  return lookup;
}

const TypeConversions = generateConversionLookup([
  { js: 'Uint8Array', numpy: 'uint8' },
  { js: 'Int8Array', numpy: 'int8' },
  { js: 'Uint16Array', numpy: 'uint16' },
  { js: 'Int16Array', numpy: 'int16' },
  { js: 'Uint32Array', numpy: 'uint32' },
  { js: 'Int32Array', numpy: 'int32' },
  { js: 'Float32Array', numpy: 'float32' },
  { js: 'Float64Array', numpy: 'float64' },
]);

function blobToTypedArray(key, value) {
  if (value && value.classType === 'ArrayBuffer') {
    const { dataType, buffer: blob } = value;
    const type = TypeConversions[dataType].js;

    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        resolve(new window[type](event.target.result));
      };
      fileReader.onerror = (event) => reject(event.error);
      fileReader.readAsArrayBuffer(blob);
    });
  }
  return value;
}

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

function addCallback(arr, cb) {
  arr.push(cb);
  return () => {
    const idx = arr.findIndex(cb);
    if (idx > -1) {
      arr.splice(idx, 1);
    }
  };
}

function Remote() {
  this.closed = false;
  this.connected = false;
  this.ws = null;
  this.session = null;
  this.priv = {
    readyCallbacks: [],
    errorCallbacks: [],
    deferredWaitlist: new Map(),
  };
}

// handles return results
function handleResult(result) {
  if (result) {
    const { data, deferredId } = result;
    let deferred = null;

    if (deferredId) {
      if (data && this.priv.deferredWaitlist.has(deferredId)) {
        deferred = this.priv.deferredWaitlist.get(deferredId);
        this.priv.deferredWaitlist.delete(deferredId);
      } else if (!data) {
        deferred = defer();
        this.priv.deferredWaitlist.set(deferredId, deferred);
        return deferred.promise;
      } else {
        return Promise.reject(
          new Error('Received deferred data, but no consumers')
        );
      }
    }

    return serializable.revert(data, blobToTypedArray).then((obj) => {
      if (deferred) {
        deferred.resolve(obj);
        return deferred.promise;
      }

      return obj;
    });
  }
  return Promise.reject(new Error('No result from server'));
}

Remote.prototype.connect = function connect(endpoint) {
  return new Promise((resolve, reject) => {
    if (this.closed) {
      throw new Error('Cannot re-connect on a closed session');
    }

    if (this.connected) {
      resolve(this.session);
    } else {
      this.ws = WebsocketConnection.newInstance({ urls: endpoint });

      this.ws.onConnectionReady(() => {
        this.connected = true;
        this.session = this.ws.getSession();

        this.priv.readyCallbacks.forEach((cb) => cb(this.session));

        // handle deferred results
        this.session.subscribe('defer.results', handleResult.bind(this));

        resolve(this.session);
      });

      this.ws.onConnectionError(() => {
        const error = new Error(`Connection to ${endpoint} failed`);
        this.priv.errorCallbacks.forEach((cb) => cb(error));
        reject(error);
      });

      this.ws.connect();
    }
  });
};

Remote.prototype.call = function call(rpcEndpoint, ...args) {
  return new Promise((resolve, reject) => {
    if (this.closed || !this.connected) {
      throw new Error('Connetion is closed or not connected');
    }

    const preparedArgs = args.map((arg) => {
      const attachTypedArrays = (key, value) => {
        if (!Array.isArray(value) && ArrayBuffer.isView(value)) {
          return this.session.addAttachment(value.buffer);
        }
        return value;
      };

      return serializable.prepare(arg, attachTypedArrays).then((data) => ({
        uid: null,
        data,
      }));
    });

    Promise.all(preparedArgs)
      .then((newArgs) => this.session.call(rpcEndpoint, newArgs))
      .then(handleResult.bind(this))
      .then(resolve)
      .catch(reject);
  });
};

Remote.prototype.onReady = function onReady(cb) {
  addCallback(this.priv.readyCallbacks, cb);
};

Remote.prototype.onError = function onError(cb) {
  addCallback(this.priv.errorCallbacks, cb);
};

export default Remote;
