'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const Core = require('../kl-catalog-core.js');
const App = require('../kl-catalog-app.js');

test('distingue loading, erro de fonte, schema inválido, vazio e sucesso', () => {
  assert.equal(App.classifyData(undefined, Core.validateProducts, 'loading'), 'loading');
  assert.equal(App.classifyData(undefined, Core.validateProducts), 'data-error');
  assert.equal(App.classifyData(null, Core.validateProducts), 'data-error');
  assert.equal(App.classifyData([], Core.validateProducts), 'empty');
  assert.equal(App.classifyData(fixtures, Core.validateProducts), 'ready');
  assert.equal(
    App.classifyData([{ ...fixtures[0], un: 'invalida' }], Core.validateProducts),
    'data-error',
  );
});

test('janela de página é derivada somente do state.page canônico', () => {
  assert.deepEqual(App.pageWindow(25, 1, 12), { page: 1, visible: 12, hasMore: true });
  assert.deepEqual(App.pageWindow(25, 2, 12), { page: 2, visible: 24, hasMore: true });
  assert.deepEqual(App.pageWindow(25, 3, 12), { page: 3, visible: 25, hasMore: false });
});

test('janela de página limita entradas adversariais sem criar outro contador', () => {
  assert.deepEqual(App.pageWindow(-4, 0, 0), { page: 1, visible: 0, hasMore: false });
  assert.deepEqual(App.pageWindow(25, -3, -5), { page: 1, visible: 12, hasMore: true });
  assert.deepEqual(App.pageWindow(25, Infinity, NaN), { page: 1, visible: 12, hasMore: true });
});

test('controller emite intenção manual e observer sem possuir contador de página', () => {
  const callbacks = [];
  const requests = [];
  let disconnects = 0;
  const automatic = App.createPagingController({
    onRequestMore: source => requests.push(source),
    observerFactory: callback => ({
      observe: () => callbacks.push(callback),
      disconnect: () => { disconnects += 1; },
    }),
  });

  assert.equal(automatic.connect({}), 'automatic');
  callbacks[0]([{ isIntersecting: false }]);
  callbacks[0]([{ isIntersecting: true }]);
  automatic.requestManual();
  assert.deepEqual(requests, ['observer', 'manual']);
  assert.equal(automatic.snapshot, undefined);
  assert.equal(automatic.page, undefined);
  automatic.destroy();
  assert.equal(disconnects, 1);

  const manualRequests = [];
  const manual = App.createPagingController({
    onRequestMore: source => manualRequests.push(source),
  });
  assert.equal(manual.connect({}), 'manual');
  manual.requestManual();
  assert.deepEqual(manualRequests, ['manual']);
});

test('erro da miniatura vira placeholder e nunca pede a original', () => {
  assert.deepEqual(App.gridImageFailurePolicy(), {
    showPlaceholder: true,
    requestOriginal: false,
  });
});

test('UMD publica a API exata no browser e agenda init uma única vez', () => {
  assert.deepEqual(Object.keys(App).sort(), [
    'classifyData',
    'createPagingController',
    'getSnapshot',
    'gridImageFailurePolicy',
    'init',
    'pageWindow',
  ]);

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'kl-catalog-app.js'),
    'utf8',
  );
  const listeners = [];
  const sandbox = {
    document: {
      readyState: 'loading',
      addEventListener(type, callback, options) {
        listeners.push({ type, callback, options });
      },
    },
  };
  sandbox.window = sandbox;

  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, {
    filename: 'kl-catalog-app.js',
  }));
  assert.equal(typeof sandbox.window.KLCatalog.App, 'object');
  assert.equal(typeof sandbox.window.KLCatalog.App.init, 'function');
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].type, 'DOMContentLoaded');
  assert.equal(listeners[0].options.once, true);
});
