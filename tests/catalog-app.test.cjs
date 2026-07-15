'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const { createFakeCatalogBrowser } = require('./helpers/fake-browser.cjs');
const Core = require('../kl-catalog-core.js');
const Actions = require('../kl-catalog-actions.js');
const App = require('../kl-catalog-app.js');

const APP_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'kl-catalog-app.js'),
  'utf8',
);

function makeProducts(count, onlyCategory) {
  return Array.from({ length: count }, (_value, index) => {
    const number = String(index + 1).padStart(3, '0');
    const category = onlyCategory || Core.CATEGORY_ORDER[index % Core.CATEGORY_ORDER.length];
    return {
      c: category,
      l: `Peça ${number}`,
      k: `TS-${number}`,
      un: index % 2 ? 'sf' : 'barra',
      t: index % 3 ? 'M' : 'G',
      co: index % 2 ? 'vinho' : 'off-white',
      u: `https://img.test/catalogo/TS-${number}-ia.jpg`,
    };
  });
}

function mountBrowser({ raw, search, core, actions, onStorageAccess }) {
  const browser = createFakeCatalogBrowser({ search, onStorageAccess });
  browser.window.KLCatalog = { Core: core || Core, Actions: actions || Actions };
  browser.window.KL_DATA = raw;
  vm.runInNewContext(APP_SOURCE, browser.window, { filename: 'kl-catalog-app.js' });
  return { browser, app: browser.window.KLCatalog.App };
}

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

test('UMD mantém o subset público obrigatório e agenda init uma única vez', () => {
  const required = [
    'classifyData',
    'createPagingController',
    'getSnapshot',
    'gridImageFailurePolicy',
    'init',
    'pageWindow',
  ];
  required.forEach(name => assert.equal(typeof App[name], 'function', name));

  const { browser, app } = mountBrowser({ raw: fixtures });
  assert.equal(typeof app, 'object');
  required.forEach(name => assert.equal(typeof app[name], 'function', name));
  assert.equal(browser.document.listenerCount('DOMContentLoaded'), 1);
});

test('init inválido valida antes de state, storage e favoritos e rende recuperação', () => {
  const order = [];
  const core = Object.assign({}, Core, {
    validateProducts(raw) {
      order.push('validate');
      return Core.validateProducts(raw);
    },
    readState() {
      order.push('readState');
      throw new Error('readState não deve rodar para base inválida');
    },
  });
  const actions = Object.assign({}, Actions, {
    createFavorites() {
      order.push('createFavorites');
      throw new Error('createFavorites não deve rodar para base inválida');
    },
  });
  const { browser, app } = mountBrowser({
    raw: [{ ...fixtures[0], un: 'invalida' }],
    core,
    actions,
    onStorageAccess: () => order.push('storage'),
  });

  browser.triggerDOMContentLoaded();

  assert.deepEqual(order, ['validate']);
  assert.equal(app.getSnapshot().phase, 'data-error');
  assert.equal(browser.nodes.results.getAttribute('aria-busy'), 'false');
  assert.equal(browser.nodes.grid.children.length, 1);
  const buttons = browser.findAll(
    browser.nodes.grid,
    node => node.tagName === 'BUTTON',
  );
  const links = browser.findAll(
    browser.nodes.grid,
    node => node.tagName === 'A',
  );
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, 'Tentar novamente');
  assert.equal(links.length, 1);
  assert.equal(links[0].textContent, 'Ver unidades');
  assert.equal(links[0].href, 'unidades.html');
  buttons[0].click();
  assert.equal(browser.window.location.reloadCount, 1);
});

test('init válido renderiza 12 thumbs e permanece idempotente', () => {
  const order = [];
  const products = makeProducts(25);
  const core = Object.assign({}, Core, {
    validateProducts(raw) {
      order.push('validate');
      return Core.validateProducts(raw);
    },
    readState(search, validProducts) {
      order.push('readState');
      return Core.readState(search, validProducts);
    },
  });
  const actions = Object.assign({}, Actions, {
    createFavorites(storage, validProducts) {
      order.push('createFavorites');
      return Actions.createFavorites(storage, validProducts);
    },
  });
  const { browser, app } = mountBrowser({
    raw: products,
    core,
    actions,
    onStorageAccess: () => order.push('storage'),
  });

  browser.triggerDOMContentLoaded();

  assert.deepEqual(order, ['validate', 'readState', 'storage', 'createFavorites']);
  assert.equal(browser.nodes.grid.children.length, 12);
  browser.nodes.grid.children.forEach((card) => {
    const photo = card.children[0];
    const image = photo.children[0];
    assert.match(photo.href, /^peca\.html\?codigo=TS-/);
    assert.equal(image.loading, 'lazy');
    assert.match(image.src, /-thumb\.jpg$/);
  });
  const firstCard = browser.nodes.grid.children[0];
  const firstPhoto = firstCard.children[0];
  const firstImage = firstPhoto.children[0];
  assert.deepEqual(browser.marks, ['kl-catalog-first-grid']);
  assert.equal(browser.nodes.loadMore.listenerCount('click'), 1);

  app.init();

  assert.equal(browser.nodes.grid.children.length, 12);
  assert.strictEqual(browser.nodes.grid.children[0], firstCard);
  assert.strictEqual(firstCard.children[0].children[0], firstImage);
  assert.deepEqual(browser.marks, ['kl-catalog-first-grid']);
  assert.equal(browser.nodes.loadMore.listenerCount('click'), 1);
});

test('paginação manual e observer anexam cartões e preservam os nós existentes', () => {
  const { browser, app } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();
  const firstCard = browser.nodes.grid.children[0];
  const firstImage = firstCard.children[0].children[0];

  browser.nodes.loadMore.click();

  assert.equal(browser.nodes.grid.children.length, 24);
  assert.equal(browser.nodes.grid.children[0] === firstCard, true, 'primeiro card deve ser preservado');
  assert.equal(
    firstCard.children[0].children[0] === firstImage,
    true,
    'imagem do primeiro card deve ser preservada',
  );
  assert.equal(browser.historyOperations.length, 1);
  assert.equal(browser.historyOperations[0].url, '/catalogo.html?pg=2');
  assert.equal(app.getSnapshot().page, 2);
  assert.equal(app.getSnapshot().visibleCount, 24);

  browser.triggerIntersection(true);

  assert.equal(browser.nodes.grid.children.length, 25);
  assert.equal(browser.nodes.grid.children[0] === firstCard, true, 'observer preserva primeiro card');
  assert.equal(
    firstCard.children[0].children[0] === firstImage,
    true,
    'observer preserva imagem do primeiro card',
  );
  assert.equal(browser.historyOperations.length, 2);
  assert.equal(browser.historyOperations[1].url, '/catalogo.html?pg=3');
  assert.equal(app.getSnapshot().page, 3);
  assert.equal(app.getSnapshot().visibleCount, 25);
  assert.equal(browser.marks.length, 1);
});

test('deep-link inicial materializa todos os cartões até a página resolvida', () => {
  const products = makeProducts(30);
  const requested = Core.interleave(products)[18].k;
  const { browser, app } = mountBrowser({
    raw: products,
    search: `?p=${encodeURIComponent(requested)}`,
  });

  browser.triggerDOMContentLoaded();

  assert.equal(app.getSnapshot().page, 2);
  assert.equal(app.getSnapshot().visibleCount, 24);
  assert.equal(browser.nodes.grid.children.length, 24);
});

test('mudança de categoria reconstrói a grade e no-results remove cartões antigos', () => {
  const { browser, app } = mountBrowser({
    raw: makeProducts(13, 'vestidos-noiva'),
  });
  browser.triggerDOMContentLoaded();
  const firstCard = browser.nodes.grid.children[0];

  browser.nodes.category.value = 'ternos';
  browser.nodes.category.dispatchEvent({ type: 'change' });

  assert.equal(app.getSnapshot().phase, 'no-results');
  assert.equal(app.getSnapshot().visibleCount, 0);
  assert.equal(browser.nodes.grid.children.length, 1);
  assert.equal(firstCard.parentNode, null);
  assert.match(browser.nodes.grid.children[0].className, /catalog-state-no-results/);
  assert.equal(browser.historyOperations.at(-1).url, '/catalogo.html?cat=ternos');
});
