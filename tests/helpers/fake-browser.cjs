'use strict';

function createStorage(seed) {
  const values = new Map(Object.entries(seed || {}).map(([key, value]) => [key, String(value)]));

  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

function cloneFallback(value, seen) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  const clone = Array.isArray(value) ? [] : {};
  seen.set(value, clone);
  Object.keys(value).forEach((key) => {
    clone[key] = cloneFallback(value[key], seen);
  });
  return clone;
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return cloneFallback(value, new WeakMap());
}

function createHistory(initialUrl) {
  const entries = [{ url: initialUrl, state: null }];
  const operations = [];
  let index = 0;

  return {
    getState() {
      return entries[index].state;
    },
    pushState(state, _title, url) {
      operations.push('push');
      entries.splice(++index);
      entries.push({ state, url: String(url) });
    },
    replaceState(state, _title, url) {
      operations.push('replace');
      entries[index] = { state, url: String(url) };
    },
    back() {
      operations.push('back');
      if (index > 0) index -= 1;
    },
    snapshot() {
      return {
        entries: cloneValue(entries),
        operations: operations.slice(),
        index,
      };
    },
  };
}

function createImageLoader() {
  const requests = [];

  return {
    load(url) {
      let resolve;
      let reject;
      const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      requests.push({ url, resolve, reject });
      return promise;
    },
    requests,
  };
}

module.exports = { createStorage, createHistory, createImageLoader };
