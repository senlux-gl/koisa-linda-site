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

module.exports = { createStorage };
