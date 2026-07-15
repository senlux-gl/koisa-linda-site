'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TRACKING_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'kl-tracking.js'),
  'utf8',
);

function createStorage(seed) {
  const values = new Map(Object.entries(seed || {}).map(([key, value]) => [String(key), String(value)]));
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    snapshot() { return Object.fromEntries(values); },
  };
}

function loadTracking(options) {
  options = options || {};
  const storage = createStorage(options.storage);
  const fbqCalls = [];
  const listeners = new Map();
  const location = new URL(
    'https://koisalinda.com.br/catalogo.html' + String(options.search || ''),
  );
  const document = {
    readyState: 'loading',
    referrer: '',
    title: 'Catálogo - Koisa Linda',
    visibilityState: 'visible',
    documentElement: { scrollHeight: 1200, scrollTop: 0 },
    addEventListener(type, callback) {
      const callbacks = listeners.get(String(type)) || [];
      callbacks.push(callback);
      listeners.set(String(type), callbacks);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = {
    document,
    fbq(...args) { fbqCalls.push(args); },
    innerHeight: 800,
    innerWidth: 1280,
    KL_DATA: Array.isArray(options.products) ? options.products : [],
    location,
    requestAnimationFrame() { return 1; },
    sessionStorage: storage,
    setInterval() { return 1; },
    setTimeout() { return 1; },
    clearInterval() {},
    clearTimeout() {},
    addEventListener(type, callback) {
      const callbacks = listeners.get(String(type)) || [];
      callbacks.push(callback);
      listeners.set(String(type), callbacks);
    },
  };
  window.window = window;

  const sandbox = {
    URL,
    URLSearchParams,
    clearInterval: window.clearInterval,
    clearTimeout: window.clearTimeout,
    document,
    location,
    requestAnimationFrame: window.requestAnimationFrame,
    sessionStorage: storage,
    setInterval: window.setInterval,
    setTimeout: window.setTimeout,
    window,
  };
  vm.runInNewContext(TRACKING_SOURCE, sandbox, { filename: 'kl-tracking.js' });
  return { window, fbqCalls, storage };
}

module.exports = { loadTracking };
