function blobToTypedArray(blob, type) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      resolve(new window[type](event.target.result));
    };
    fileReader.onerror = (event) => reject(event.error);
    fileReader.readAsArrayBuffer(blob);
  });
}

function forEachDataArray(obj, callback) {
  function iterate(parent, key) {
    const o = parent[key];

    if (o === null || o === undefined) {
      return;
    }

    if (o.vtkClass && o.vtkClass === 'vtkDataArray') {
      callback(o, (newValue) => {
        /* eslint-disable-next-line no-param-reassign */
        parent[key] = newValue;
      });
    } else if (typeof o === 'object') {
      const keys = Object.keys(o);
      for (let i = 0; i < keys.length; i++) {
        iterate(o, keys[i]);
      }
    }
  }

  iterate({ obj }, 'obj');
  return obj;
}

const adapters = [
  function vtkDataSet(obj, addAttachment) {
    if (obj && typeof obj === 'object' && obj.isA && obj.isA('vtkDataSet')) {
      return forEachDataArray(obj.getState(), (ds, assign) => {
        const attachment = new window[ds.dataType](ds.values).buffer;
        assign(
          Object.assign(ds, {
            values: addAttachment(attachment),
          })
        );
      });
    }
    return undefined;
  },

  function unserializeVtkDataSet(obj) {
    const promises = [];
    const result = forEachDataArray(obj, (ds, assign) => {
      if (ds.values instanceof Blob) {
        promises.push(
          blobToTypedArray(ds.values, ds.dataType).then((arr) =>
            assign(Object.assign(ds, { values: arr }))
          )
        );
      }
    });
    return Promise.all(promises).then(() => result);
  },
];

function transform(obj, addAttachment) {
  for (let i = 0; i < adapters.length; i++) {
    const adapter = adapters[i];
    const result = adapter(obj, addAttachment);
    if (result !== undefined) {
      return Promise.resolve(result);
    }
  }
  return Promise.resolve(obj);
}

export default {
  transform,
};
