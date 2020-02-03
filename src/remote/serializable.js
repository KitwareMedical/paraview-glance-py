const replacers = [];

const revivers = [];

const defIdent = (k, v) => Promise.resolve(v);

function recurse(obj, preFn = defIdent, postFn = defIdent) {
  const clone = function clone(o) {
    if (Array.isArray(o)) {
      return o.slice();
    }
    if (
      typeof o === 'object' &&
      !!o &&
      (!Object.prototype.hasOwnProperty.call(o, 'constructor') &&
        o.constructor === Object)
    ) {
      return { ...o };
    }
    return o;
  };

  const set = function set(o, k, v) {
    /* eslint-disable-next-line no-param-reassign */
    o[k] = v;
    return v;
  };

  const helpRecurse = function helpRecurse(o) {
    const promises = [];

    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        promises.push(
          Promise.resolve(clone(o[i]))
            .then((newValue) => preFn(i, newValue))
            .then((newValue) => set(o, i, newValue))
            .then(helpRecurse)
            .then((newValue) => postFn(i, newValue))
            .then((newValue) => set(o, i, newValue))
        );
      }
    } else if (
      typeof o === 'object' &&
      !!o &&
      // only recurse on plain objects
      (!Object.prototype.hasOwnProperty.call(o, 'constructor') &&
        o.constructor === Object)
    ) {
      const keys = Object.keys(o);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const descriptor = Object.getOwnPropertyDescriptor(o, key);
        // only recurse on writable properties
        // vtk.js objects disable overwriting func properties
        if (descriptor.writable) {
          promises.push(
            Promise.resolve(clone(o[key]))
              .then((newValue) => preFn(key, newValue))
              .then((newValue) => set(o, key, newValue))
              .then(helpRecurse)
              .then((newValue) => postFn(key, newValue))
              .then((newValue) => set(o, key, newValue))
          );
        }
      }
    }
    return Promise.all(promises).then(() => clone(o));
  };

  return preFn(undefined, clone(obj))
    .then(helpRecurse)
    .then((newObj) => postFn(undefined, newObj));
}

function replacer(key, value) {
  for (let i = 0; i < replacers.length; i++) {
    const result = replacers[i](key, value);
    if (result !== undefined) {
      return result;
    }
  }
  return value;
}

function reviver(key, value) {
  for (let i = 0; i < revivers.length; i++) {
    const result = revivers[i](key, value);
    if (result !== undefined) {
      return result;
    }
  }
  return value;
}

export function prepare(obj, otherReplacer = null) {
  const repFunc = otherReplacer || ((key, value) => value);

  return recurse(obj, (key, value) => {
    const newValue = replacer(key, value);
    return Promise.resolve(newValue).then((v) => repFunc(key, v));
  });
}

export function revert(obj, otherReviver = null) {
  const revFunc = otherReviver || ((key, value) => value);

  return recurse(obj, undefined, (key, value) => {
    const newValue = reviver(key, value);
    return Promise.resolve(newValue).then((v) => revFunc(key, v));
  });
}

export function registerReplacer(fn) {
  replacers.push(fn);
}

export function registerReviver(fn) {
  revivers.push(fn);
}

export default {
  prepare,
  revert,
  registerReplacer,
  registerReviver,
};
