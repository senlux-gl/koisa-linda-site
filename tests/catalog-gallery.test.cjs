'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHistory, createImageLoader } = require('./helpers/fake-browser.cjs');
const Gallery = require('../kl-catalog-gallery.js');

test('intercepta somente clique primário simples com galeria pronta', () => {
  const base = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };

  assert.equal(Gallery.shouldInterceptProductLink(base, true), true);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, button: 1 }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, metaKey: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, ctrlKey: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, shiftKey: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, altKey: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, defaultPrevented: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink(base, false), false);
  assert.equal(Gallery.shouldInterceptProductLink(null, true), false);
});

test('fecha por back somente quando a entrada pertence à abertura da grade', () => {
  assert.equal(Gallery.closeAction({ ownedHistoryEntry: true }), 'back');
  assert.equal(Gallery.closeAction({ ownedHistoryEntry: false }), 'replace-without-product');
  assert.equal(Gallery.closeAction({}), 'replace-without-product');
  assert.equal(Gallery.closeAction(), 'replace-without-product');
});

test('preload inclui no máximo uma vizinha válida por lado', () => {
  assert.deepEqual(Gallery.neighborIndexes(2, 6), [1, 3]);
  assert.deepEqual(Gallery.neighborIndexes(0, 1), []);
  assert.deepEqual(Gallery.neighborIndexes(0, 6), [1]);
  assert.deepEqual(Gallery.neighborIndexes(5, 6), [4]);

  [
    [-1, 6],
    [6, 6],
    [0, 0],
    [1, -1],
    [1.5, 6],
    [1, 6.5],
    ['2', 6],
  ].forEach(([index, length]) => {
    const neighbors = Gallery.neighborIndexes(index, length);
    assert.ok(neighbors.length <= 2, `${index}/${length}`);
    assert.ok(neighbors.every((value) => (
      Number.isInteger(value) && value >= 0 && value < length
    )), `${index}/${length}`);
  });
});

test('resposta atrasada ou de outro código não pode substituir a peça ativa', () => {
  const guard = Gallery.createRequestGuard();
  const first = guard.next('A');
  const second = guard.next('B');

  assert.equal(guard.isCurrent(first, 'A'), false);
  assert.equal(guard.isCurrent(second, 'B'), true);
  assert.equal(guard.isCurrent(second, 'A'), false);
});

test('create valida opções e retorna API inerte segura', () => {
  [undefined, null, [], 'options'].forEach((options) => {
    assert.throws(
      () => Gallery.create(options),
      (error) => error instanceof TypeError
        && error.message === 'Gallery.create options must be an object.',
    );
  });

  const gallery = Gallery.create({});

  assert.equal(gallery.isReady(), false);
  ['open', 'update', 'close', 'destroy'].forEach((method) => {
    assert.equal(typeof gallery[method], 'function');
    assert.doesNotThrow(() => gallery[method]());
  });
});

test('UMD publica CommonJS e window.KLCatalog.Gallery sem tocar document', () => {
  assert.equal(typeof Gallery.shouldInterceptProductLink, 'function');
  assert.equal(typeof Gallery.create, 'function');

  const source = fs.readFileSync(path.join(__dirname, '..', 'kl-catalog-gallery.js'), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  Object.defineProperty(sandbox, 'document', {
    configurable: true,
    get() { throw new Error('document must not be read'); },
  });

  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, {
    filename: 'kl-catalog-gallery.js',
  }));
  assert.equal(typeof sandbox.window.KLCatalog.Gallery, 'object');
  assert.equal(typeof sandbox.window.KLCatalog.Gallery.createRequestGuard, 'function');
});

test('history registra operações e remove entradas futuras após back', () => {
  const history = createHistory('/catalogo.html');
  const firstState = { product: 'A', nested: { active: true } };

  assert.deepEqual(history.snapshot(), {
    entries: [{ url: '/catalogo.html', state: null }],
    operations: [],
    index: 0,
  });
  assert.equal(history.getState(), null);

  history.pushState(firstState, '', '/catalogo.html?p=A');
  history.pushState({ product: 'B' }, '', '/catalogo.html?p=B');
  history.back();
  assert.equal(history.getState(), firstState);
  history.pushState({ product: 'C' }, '', '/catalogo.html?p=C');
  history.replaceState({ product: 'D' }, '', '/catalogo.html?p=D');
  history.back();

  assert.deepEqual(history.snapshot(), {
    entries: [
      { url: '/catalogo.html', state: null },
      { url: '/catalogo.html?p=A', state: firstState },
      { url: '/catalogo.html?p=D', state: { product: 'D' } },
    ],
    operations: ['push', 'push', 'back', 'push', 'replace', 'back'],
    index: 1,
  });
  assert.equal(history.getState(), firstState);
});

test('snapshot do history é um clone defensivo', () => {
  const history = createHistory('/catalogo.html');
  history.pushState({ nested: { product: 'A' } }, '', '/catalogo.html?p=A');

  const snapshot = history.snapshot();
  snapshot.entries[1].url = '/alterada';
  snapshot.entries[1].state.nested.product = 'ALTERADA';
  snapshot.operations.push('replace');
  snapshot.index = 0;

  assert.deepEqual(history.snapshot(), {
    entries: [
      { url: '/catalogo.html', state: null },
      { url: '/catalogo.html?p=A', state: { nested: { product: 'A' } } },
    ],
    operations: ['push'],
    index: 1,
  });
});

test('image loader expõe promises controláveis por requisição', async () => {
  const loader = createImageLoader();
  const loaded = loader.load('/imagem-a.jpg');

  assert.equal(loader.requests.length, 1);
  assert.equal(loader.requests[0].url, '/imagem-a.jpg');
  assert.equal(typeof loader.requests[0].resolve, 'function');
  assert.equal(typeof loader.requests[0].reject, 'function');

  loader.requests[0].resolve('ok');
  assert.equal(await loaded, 'ok');

  const failed = loader.load('/imagem-b.jpg');
  const failure = new Error('synthetic failure');
  loader.requests[1].reject(failure);
  await assert.rejects(failed, failure);
});
