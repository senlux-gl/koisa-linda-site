'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const {
  createFakeCatalogBrowser,
  createHistory,
  createScrollEnvironment,
  createStorage,
} = require('./helpers/fake-browser.cjs');
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

function enhanceBrowser(browser, { sessionSeed, scrollY } = {}) {
  const { document, window } = browser;
  function add(tagName, id) {
    const node = document.createElement(tagName);
    node.setAttribute('id', id);
    browser.nodes.app.appendChild(node);
    browser.nodes[id.replace(/^catalog-/, '').replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = node;
    return node;
  }
  const title = add('h1', 'catalog-title');
  const search = add('input', 'catalog-search');
  const facets = add('div', 'catalog-facets');
  const activeFilters = add('div', 'catalog-active-filters');
  Object.assign(browser.nodes, { title, search, facets, activeFilters });

  const listeners = new Map();
  window.addEventListener = (type, callback, options) => {
    const records = listeners.get(type) || [];
    records.push({ callback, once: Boolean(options && options.once) });
    listeners.set(type, records);
  };
  window.dispatchEvent = (event) => {
    const records = (listeners.get(event.type) || []).slice();
    records.forEach((record) => {
      record.callback.call(window, event);
      if (record.once) listeners.set(event.type, (listeners.get(event.type) || []).filter(item => item !== record));
    });
    return true;
  };
  window.CustomEvent = function CustomEvent(type, init) {
    this.type = type;
    this.detail = init && init.detail;
  };
  browser.windowListenerCount = type => (listeners.get(type) || []).length;
  browser.catalogEvents = [];
  window.addEventListener('kl:catalog-state', event => browser.catalogEvents.push(event.detail));
  browser.trackingCalls = [];
  window.KLTracking = {
    catalog(name, context) {
      browser.trackingCalls.push({ name, context });
    },
  };

  let now = 0;
  let nextTimer = 1;
  const timers = new Map();
  window.setTimeout = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, due: now + Number(delay || 0) });
    return id;
  };
  window.clearTimeout = id => timers.delete(id);
  browser.advanceTime = (milliseconds) => {
    now += milliseconds;
    let due = Array.from(timers.entries()).filter(([, timer]) => timer.due <= now)
      .sort((left, right) => left[1].due - right[1].due);
    while (due.length) {
      const [id, timer] = due.shift();
      if (!timers.delete(id)) continue;
      timer.callback();
      due = Array.from(timers.entries()).filter(([, item]) => item.due <= now)
        .sort((left, right) => left[1].due - right[1].due);
    }
  };

  const sessionStorage = createStorage(sessionSeed);
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: sessionStorage });
  window.scrollY = Number(scrollY || 0);
  browser.scrollCalls = [];
  window.scrollTo = (...args) => browser.scrollCalls.push(args);
  browser.sessionStorage = sessionStorage;
  browser.dispatchWindow = type => window.dispatchEvent({ type });
}

function mountBrowser({
  raw,
  search,
  core,
  actions,
  onStorageAccess,
  sessionSeed,
  scrollY,
  headerHeight,
  intersectionObserver,
  prefersReducedMotion,
}) {
  const browser = createFakeCatalogBrowser({
    search,
    onStorageAccess,
    headerHeight,
    intersectionObserver,
    prefersReducedMotion,
  });
  enhanceBrowser(browser, { sessionSeed, scrollY });
  browser.window.KLCatalog = { Core: core || Core, Actions: actions || Actions };
  browser.window.KL_DATA = raw;
  vm.runInNewContext(APP_SOURCE, browser.window, { filename: 'kl-catalog-app.js' });
  return { browser, app: browser.window.KLCatalog.App };
}

function createLocalLayerHistory(url, initialState) {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  const entries = [{ url, state: clone(initialState == null ? null : initialState) }];
  const operations = [];
  let index = 0;

  return {
    get state() {
      return clone(entries[index].state);
    },
    pushState(nextState, _title, nextUrl) {
      entries.splice(index + 1);
      entries.push({ url: nextUrl, state: clone(nextState) });
      index += 1;
      operations.push({ type: 'push', url: nextUrl, state: clone(nextState) });
    },
    replaceState(nextState, _title, nextUrl) {
      entries[index] = { url: nextUrl, state: clone(nextState) };
      operations.push({ type: 'replace', url: nextUrl, state: clone(nextState) });
    },
    back() {
      if (index > 0) index -= 1;
      operations.push({ type: 'back' });
    },
    snapshot() {
      return {
        entries: clone(entries),
        index,
        operations: clone(operations),
      };
    },
  };
}

function createLocalDialogDependencies() {
  const classes = new Set();
  const calls = [];
  return {
    body: {
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
      },
    },
    scrollLock: {
      lock() { calls.push({ type: 'lock' }); },
      unlock(options) { calls.push({ type: 'unlock', options }); },
    },
    calls,
  };
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

test('createRequestMore usa somente state externo para observer, manual e fim', () => {
  let state = { page: 1 };
  const commits = [];
  let observerCallback;
  const requestMore = App.createRequestMore({
    getState: () => state,
    getTotal: () => 25,
    batchSize: 12,
    commit(next, meta) {
      state = next;
      commits.push({ next, meta });
    },
  });
  const controller = App.createPagingController({
    onRequestMore: requestMore,
    observerFactory(callback) {
      observerCallback = callback;
      return { observe() {}, disconnect() {} };
    },
  });

  controller.connect({});
  observerCallback([{ isIntersecting: true }]);
  controller.requestManual();
  observerCallback([{ isIntersecting: true }]);

  assert.equal(state.page, 3);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits.map(item => item.meta), [
    { source: 'observer', replaceHistory: true },
    { source: 'manual', replaceHistory: true },
  ]);
  assert.equal(requestMore.page, undefined);
  assert.equal(requestMore.snapshot, undefined);
});

test('camadas de grid, galeria e prova criam entradas reversíveis sem duplicar seleção', () => {
  const history = createLocalLayerHistory('/catalogo.html', { analytics: { source: 'catalog' } });
  const controller = App.createLayerHistoryController(history, { initialLayer: null });

  assert.equal(controller.currentLayer(), null);
  assert.equal(controller.currentOrigin(), null);
  assert.equal(history.snapshot().entries.length, 1);
  controller.openLayer('gallery', '/catalogo.html?p=NV-001', 'grid');
  assert.deepEqual(history.state.klCatalog, { layer: 'gallery', origin: 'grid' });
  controller.openLayer('tryOn', '/catalogo.html?prova=1&p=NV-001', 'gallery');
  assert.deepEqual(history.state.klCatalog, { layer: 'tryOn', origin: 'gallery' });
  controller.replaceCurrent('/catalogo.html?prova=1&p=NV-002');

  const snapshot = history.snapshot();
  assert.equal(snapshot.entries.length, 3);
  assert.deepEqual(snapshot.operations.map(operation => operation.type), ['push', 'push', 'replace']);
  assert.deepEqual(snapshot.entries[2].state, {
    analytics: { source: 'catalog' },
    klCatalog: { layer: 'tryOn', origin: 'gallery' },
  });
  assert.equal(controller.currentLayer(), 'tryOn');
  assert.equal(controller.currentOrigin(), 'gallery');

  assert.equal(controller.requestClose('tryOn', '/catalogo.html?p=NV-001'), 'back');
  const afterBack = history.snapshot();
  assert.equal(afterBack.index, 1);
  assert.equal(afterBack.operations.at(-1).type, 'back');
  assert.equal(controller.requestClose('tryOn', '/catalogo.html?p=NV-001'), 'back');
  assert.equal(history.snapshot().operations.length, afterBack.operations.length);

  const beforePop = afterBack.operations.length;
  controller.onPopState(history.state);
  assert.equal(history.snapshot().operations.length, beforePop);
  assert.equal(controller.currentLayer(), 'gallery');
  assert.equal(controller.currentOrigin(), 'grid');
  assert.equal(controller.requestClose('gallery', '/catalogo.html'), 'back');
  assert.equal(history.snapshot().index, 0);
});

test('deep-link sem ownership fecha por replace e preserva state alheio', () => {
  const history = createLocalLayerHistory('/catalogo.html?prova=1&p=NV-001', {
    router: { key: 'kept' },
  });
  const controller = App.createLayerHistoryController(history, { initialLayer: 'tryOn' });

  assert.equal(controller.currentLayer(), 'tryOn');
  assert.equal(controller.currentOrigin(), null);
  assert.equal(controller.requestClose('tryOn', '/catalogo.html'), 'replace');
  assert.equal(history.snapshot().entries.length, 1);
  assert.deepEqual(history.snapshot().entries[0], {
    url: '/catalogo.html',
    state: { router: { key: 'kept' } },
  });
});

test('close atrasado de outra camada é ignorado sem mutar history', () => {
  const history = createLocalLayerHistory('/catalogo.html');
  const controller = App.createLayerHistoryController(history, { initialLayer: null });
  controller.openLayer('gallery', '/catalogo.html?p=NV-001', 'grid');
  controller.openLayer('tryOn', '/catalogo.html?prova=1&p=NV-001', 'gallery');
  const before = history.snapshot();

  assert.equal(controller.requestClose('gallery', '/catalogo.html'), 'ignore');
  assert.deepEqual(history.snapshot(), before);
  assert.deepEqual(history.state.klCatalog, { layer: 'tryOn', origin: 'gallery' });
  assert.equal(controller.currentLayer(), 'tryOn');
});

test('controller recriado trata marcador restaurado como deep-link não possuído', () => {
  const history = createLocalLayerHistory('/catalogo.html');
  const firstController = App.createLayerHistoryController(history, { initialLayer: null });
  firstController.openLayer('gallery', '/catalogo.html?p=NV-001', 'grid');

  const reloadedController = App.createLayerHistoryController(history, { initialLayer: 'gallery' });
  assert.equal(reloadedController.currentLayer(), 'gallery');
  assert.equal(reloadedController.currentOrigin(), 'grid');
  assert.equal(reloadedController.requestClose('gallery', '/catalogo.html'), 'replace');
  assert.equal(history.snapshot().index, 1, 'reload nunca consome a entrada anterior com back');
  assert.equal(history.snapshot().operations.at(-1).type, 'replace');
});

test('replaceCurrent preserva history.state e nunca cria ownership', () => {
  const initialState = {
    router: { key: 'deep-link' },
    klCatalog: { layer: 'gallery', origin: 'grid' },
  };
  const history = createLocalLayerHistory('/catalogo.html?p=NV-001', initialState);
  const controller = App.createLayerHistoryController(history, { initialLayer: 'gallery' });

  controller.replaceCurrent('/catalogo.html?p=NV-002');
  assert.deepEqual(history.state, initialState);
  assert.equal(history.snapshot().entries.length, 1);
  assert.equal(controller.requestClose('gallery', '/catalogo.html'), 'replace');
});

test('popstate só lê marcador válido e state inválido limpa a camada', () => {
  const history = createLocalLayerHistory('/catalogo.html');
  const controller = App.createLayerHistoryController(history, { initialLayer: null });
  controller.openLayer('gallery', '/catalogo.html?p=NV-001', 'grid');
  const before = history.snapshot().operations.length;

  controller.onPopState({ klCatalog: { layer: 'tryOn', origin: 'menu' } });
  assert.equal(controller.currentLayer(), 'tryOn');
  assert.equal(controller.currentOrigin(), 'menu');
  controller.onPopState({ klCatalog: { layer: 'favorites', origin: 'menu' } });
  assert.equal(controller.currentLayer(), null);
  assert.equal(controller.currentOrigin(), null);
  controller.onPopState({ klCatalog: { layer: 'gallery', origin: 'invalid' } });
  assert.equal(controller.currentLayer(), null);
  assert.equal(controller.currentOrigin(), null);
  controller.onPopState(null);
  assert.equal(history.snapshot().operations.length, before);
});

test('controller de camadas rejeita adapter, layer e origin inválidos com TypeError claro', () => {
  assert.throws(
    () => App.createLayerHistoryController({}, { initialLayer: null }),
    error => error instanceof TypeError && /history adapter is incomplete/.test(error.message),
  );
  assert.throws(
    () => App.createLayerHistoryController({
      pushState() {}, replaceState() {}, back() {},
    }, { initialLayer: null }),
    error => error instanceof TypeError && /history adapter is incomplete/.test(error.message),
  );
  const history = createLocalLayerHistory('/catalogo.html');
  assert.throws(
    () => App.createLayerHistoryController(history, { initialLayer: 'favorites' }),
    error => error instanceof TypeError && /layer must be gallery or tryOn/.test(error.message),
  );
  const controller = App.createLayerHistoryController(history, { initialLayer: null });
  assert.throws(
    () => controller.openLayer('favorites', '/catalogo.html', 'menu'),
    error => error instanceof TypeError && /layer must be gallery or tryOn/.test(error.message),
  );
  assert.throws(
    () => controller.openLayer('gallery', '/catalogo.html', 'favorites'),
    error => error instanceof TypeError && /origin must be grid, menu or gallery/.test(error.message),
  );
});

test('dialog shell mantém um lock entre camadas e limpa uma única vez', () => {
  const dependencies = createLocalDialogDependencies();
  const shell = App.createDialogShell(dependencies);

  assert.equal(shell.current(), null);
  assert.equal(shell.activate('gallery'), true);
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), true);
  assert.deepEqual(dependencies.calls, [{ type: 'lock' }]);
  assert.equal(shell.activate('tryOn'), true);
  assert.equal(shell.activate('favorites'), true);
  assert.equal(shell.current(), 'favorites');
  assert.deepEqual(dependencies.calls, [{ type: 'lock' }]);

  assert.equal(shell.clear(), true);
  assert.equal(shell.current(), null);
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), false);
  assert.deepEqual(dependencies.calls, [
    { type: 'lock' },
    { type: 'unlock', options: { restoreScroll: true } },
  ]);
  assert.equal(shell.clear(), false);
  assert.equal(dependencies.calls.length, 2);
});

test('dialog shell permite limpar sem restaurar scroll e não usa DOM global', () => {
  const dependencies = createLocalDialogDependencies();
  const shell = App.createDialogShell(dependencies);
  shell.activate('tryOn');

  assert.equal(shell.clear({ restoreScroll: false }), true);
  assert.deepEqual(dependencies.calls.at(-1), {
    type: 'unlock',
    options: { restoreScroll: false },
  });
  assert.throws(
    () => App.createDialogShell({ body: dependencies.body }),
    error => error instanceof TypeError && /dialog shell dependencies are incomplete/.test(error.message),
  );
});

test('dialog shell não ativa classe quando scroll lock falha e permite retry', () => {
  const dependencies = createLocalDialogDependencies();
  dependencies.scrollLock.lock = () => { throw new Error('lock failed'); };
  const shell = App.createDialogShell(dependencies);

  assert.throws(() => shell.activate('gallery'), /lock failed/);
  assert.equal(shell.current(), null);
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), false);

  dependencies.scrollLock.lock = () => dependencies.calls.push({ type: 'lock-retry' });
  assert.equal(shell.activate('gallery'), true);
  assert.equal(shell.current(), 'gallery');
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), true);
});

test('dialog shell mantém camada ativa quando unlock falha e permite retry', () => {
  const dependencies = createLocalDialogDependencies();
  const shell = App.createDialogShell(dependencies);
  shell.activate('gallery');
  let unlockAttempts = 0;
  dependencies.scrollLock.unlock = (options) => {
    unlockAttempts += 1;
    dependencies.calls.push({ type: 'unlock-attempt', options });
    if (unlockAttempts === 1) throw new Error('unlock failed');
  };

  assert.throws(() => shell.clear(), /unlock failed/);
  assert.equal(shell.current(), 'gallery');
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), true);

  assert.equal(shell.clear(), true);
  assert.equal(unlockAttempts, 2);
  assert.equal(shell.current(), null);
  assert.equal(dependencies.body.classList.contains('kl-dialog-open'), false);
  assert.deepEqual(dependencies.calls.at(-1).options, { restoreScroll: true });
});

test('grid usa push, troca usa replace e popstate nunca escreve', () => {
  const history = createHistory('/catalogo.html?un=sf');
  const controller = App.createHistoryController(history);
  controller.openFromGrid('/catalogo.html?un=sf&p=DB-010');
  assert.equal(history.snapshot().entries.length, 2);
  controller.replaceProduct('/catalogo.html?un=sf&p=NV-002');
  assert.equal(history.snapshot().entries.length, 2);
  assert.equal(controller.requestClose(), 'back');
  assert.equal(history.snapshot().index, 0);
  const before = history.snapshot().operations.length;
  controller.onPopState(null);
  assert.equal(history.snapshot().operations.length, before);
});

test('deep-link inicial fecha por replace sem sair do catálogo', () => {
  const history = createHistory('/catalogo.html?cat=vestidos-noiva&p=NV-001');
  const controller = App.createHistoryController(history, { initialDeepLink: true });
  controller.replaceProduct('/catalogo.html?cat=vestidos-noiva&p=NV-002');
  assert.equal(controller.requestClose('/catalogo.html?cat=vestidos-noiva'), 'replace');
  assert.equal(history.snapshot().entries.length, 1);
  assert.equal(history.snapshot().entries[0].url, '/catalogo.html?cat=vestidos-noiva');
});

test('popstate usa o mesmo pipeline de derive/render e nunca escreve history', () => {
  const history = createHistory('/catalogo.html?un=sf&p=DB-010');
  const controller = App.createHistoryController(history, { initialDeepLink: true });
  const renders = [];
  const galleryStates = [];
  const handler = App.createPopStateHandler({
    historyController: controller,
    readState: () => ({ openProduct: null, unit: 'sf' }),
    derive: state => ({ state, products: [] }),
    render: (derived, meta) => renders.push({ derived, meta }),
    syncGallery: code => galleryStates.push(code),
  });
  const before = history.snapshot().operations.length;
  handler({ state: null });
  assert.equal(history.snapshot().operations.length, before);
  assert.equal(renders.length, 1);
  assert.deepEqual(renders[0].meta, { fromPopState: true });
  assert.deepEqual(galleryStates, [null]);
});

test('scroll lock compensa scrollbar e restaura estilos e posição exatos', () => {
  const fake = createScrollEnvironment({ scrollY: 640, innerWidth: 1200, clientWidth: 1180, paddingRight: 4 });
  const lock = App.createScrollLock(fake.environment);
  assert.equal(lock.lock(), true);
  assert.equal(lock.lock(), false);
  assert.equal(fake.environment.body.style.position, 'fixed');
  assert.equal(fake.environment.body.style.top, '-640px');
  assert.equal(fake.environment.body.style.paddingRight, '24px');
  assert.equal(fake.environment.documentElement.style.overflow, 'hidden');
  assert.equal(lock.unlock(), true);
  assert.equal(lock.unlock(), false);
  assert.deepEqual(fake.scrollCalls, [[0, 640]]);
  assert.deepEqual(fake.snapshotStyles(), fake.initialStyles);
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
    'createDialogShell',
    'createFilterRailController',
    'createLayerHistoryController',
    'createPagingController',
    'createRequestMore',
    'getSnapshot',
    'gridImageFailurePolicy',
    'init',
    'pageWindow',
    'shouldShowFilterRail',
  ];
  required.forEach(name => assert.equal(typeof App[name], 'function', name));

  const { browser, app } = mountBrowser({ raw: fixtures });
  assert.equal(typeof app, 'object');
  required.forEach(name => assert.equal(typeof app[name], 'function', name));
  assert.equal(browser.document.listenerCount('DOMContentLoaded'), 1);
});

test('fake browser entrega interseção somente ao observer ativo que observa o nó', () => {
  const browser = createFakeCatalogBrowser();
  const calls = [];
  const filterObserver = new browser.window.IntersectionObserver(() => calls.push('filter'));
  const pagingObserver = new browser.window.IntersectionObserver(() => calls.push('paging'));
  const disconnectedObserver = new browser.window.IntersectionObserver(
    () => calls.push('disconnected'),
  );
  filterObserver.observe(browser.nodes.filterSentinel);
  pagingObserver.observe(browser.nodes.sentinel);
  disconnectedObserver.observe(browser.nodes.filterSentinel);
  disconnectedObserver.disconnect();

  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: false,
    boundingClientRect: { top: 12 },
  });

  assert.deepEqual(calls, ['filter']);
});

test('regra do rail só mostra sentinela não intersectante acima do offset', () => {
  assert.equal(App.shouldShowFilterRail(null, 83), false);
  assert.equal(App.shouldShowFilterRail({ isIntersecting: false }, 83), false);
  assert.equal(App.shouldShowFilterRail({
    isIntersecting: false,
    boundingClientRect: { top: 900 },
  }, 83), false);
  assert.equal(App.shouldShowFilterRail({
    isIntersecting: false,
    boundingClientRect: { top: 83 },
  }, 83), true);
  assert.equal(App.shouldShowFilterRail({
    isIntersecting: true,
    boundingClientRect: { top: 20 },
  }, 83), false);
});

test('controller do rail usa fallback 71, inicia oculto e desconecta seu observer', () => {
  const browser = createFakeCatalogBrowser({ headerHeight: 0 });
  const records = [];
  browser.nodes.filterRail.hidden = false;
  const controller = App.createFilterRailController({
    rail: browser.nodes.filterRail,
    sentinel: browser.nodes.filterSentinel,
    header: browser.nodes.header,
    documentElement: browser.document.documentElement,
    observerFactory(callback, options) {
      const record = {
        callback,
        options,
        disconnected: false,
        observe(node) { this.observed = node; },
        disconnect() { this.disconnected = true; },
      };
      records.push(record);
      return record;
    },
  });

  assert.equal(browser.nodes.filterRail.hidden, true);
  assert.equal(controller.offset, 71);
  assert.equal(
    browser.document.documentElement.style.getPropertyValue('--catalog-header-offset'),
    '71px',
  );
  assert.equal(records[0].options.rootMargin, '-71px 0px 0px 0px');
  assert.strictEqual(records[0].observed, browser.nodes.filterSentinel);
  controller.destroy();
  assert.equal(records[0].disconnected, true);
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
  assert.deepEqual(JSON.parse(JSON.stringify(browser.catalogEvents.at(-1))), {
    status: 'data-error',
    unit: null,
    openProduct: null,
    resultCount: 0,
  });
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

test('rail usa segundo observer, altura real do header e nunca listener de scroll', () => {
  const { browser, app } = mountBrowser({ raw: makeProducts(25), headerHeight: 83 });
  assert.equal(browser.nodes.filterRail.hidden, true);

  browser.triggerDOMContentLoaded();

  assert.equal(browser.nodes.filterRail.hidden, true);
  const railObserver = browser.observers.find(
    observer => observer.observed.includes(browser.nodes.filterSentinel),
  );
  const pagingObserver = browser.observers.find(
    observer => observer.observed.includes(browser.nodes.sentinel),
  );
  assert.ok(railObserver);
  assert.ok(pagingObserver);
  assert.notStrictEqual(railObserver, pagingObserver);
  assert.equal(railObserver.options.rootMargin, '-83px 0px 0px 0px');
  assert.equal(
    browser.document.documentElement.style.getPropertyValue('--catalog-header-offset'),
    '83px',
  );

  const pageBefore = app.getSnapshot().page;
  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: false,
    boundingClientRect: { top: 900 },
  });
  assert.equal(browser.nodes.filterRail.hidden, true);
  assert.equal(app.getSnapshot().page, pageBefore, 'observer do rail não pagina');

  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: false,
    boundingClientRect: { top: 83 },
  });
  assert.equal(browser.nodes.filterRail.hidden, false);

  browser.triggerIntersection(true);
  assert.equal(app.getSnapshot().page, pageBefore + 1, 'trigger legado continua paginando');
  assert.equal(browser.nodes.filterRail.hidden, false, 'trigger de paginação não toca o rail');

  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: true,
    boundingClientRect: { top: 83 },
  });
  assert.equal(browser.nodes.filterRail.hidden, true);
  assert.equal(browser.windowListenerCount('scroll'), 0);
  assert.equal(browser.document.listenerCount('scroll'), 0);

  browser.window.dispatchEvent({ type: 'pagehide', persisted: true });
  assert.equal(railObserver.disconnected, false, 'BFCache mantém observer ativo');
  browser.window.dispatchEvent({ type: 'pagehide', persisted: false });
  assert.equal(railObserver.disconnected, true, 'saída definitiva desconecta observer');
});

test('sem IntersectionObserver rail fica oculto e controles compactos continuam funcionais', () => {
  const { browser, app } = mountBrowser({
    raw: fixtures,
    intersectionObserver: false,
  });

  browser.triggerDOMContentLoaded();

  assert.equal(browser.nodes.filterRail.hidden, true);
  assert.equal(browser.observers.length, 0);
  assert.equal(app.getSnapshot().pagingMode, 'manual');
  browser.nodes.filterRailUnitButtons[1].click();
  assert.equal(browser.historyOperations.length, 1);
  assert.equal(browser.historyOperations[0].url, '/catalogo.html?un=barra');
  assert.equal(browser.nodes.units.children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailUnitButtons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRail.hidden, true);
});

test('resumo compacto espelha contador, categoria humana e unidade do state canônico', () => {
  const { browser } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();

  assert.equal(browser.nodes.count.textContent, '12 visíveis de 25 peças');
  assert.equal(browser.nodes.filterRailCount.textContent, browser.nodes.count.textContent);
  assert.equal(browser.nodes.filterRailCount.getAttribute('aria-live'), null);
  assert.equal(browser.nodes.filterRailCategory.textContent, 'Todas as categorias');
  assert.equal(browser.nodes.units.children[0].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailUnitButtons[0].getAttribute('aria-pressed'), 'true');

  browser.triggerIntersectionFor(browser.nodes.sentinel, { isIntersecting: true });
  assert.equal(browser.nodes.count.textContent, '24 visíveis de 25 peças');
  assert.equal(browser.nodes.filterRailCount.textContent, browser.nodes.count.textContent);

  browser.nodes.category.value = 'vestidos-madrinha';
  browser.nodes.category.dispatchEvent({ type: 'change' });
  assert.equal(browser.nodes.filterRailCategory.textContent, 'Madrinhas & Festa');
  assert.equal(browser.nodes.filterRailCount.textContent, browser.nodes.count.textContent);
});

test('unidade compacta já ativa é no-op sem history, render, tracking, scroll ou paginação', () => {
  const { browser, app } = mountBrowser({
    raw: makeProducts(50),
    search: '?un=sf&pg=2',
  });
  browser.triggerDOMContentLoaded();
  const snapshot = app.getSnapshot();
  const firstCard = browser.nodes.grid.children[0];
  const historyCount = browser.historyOperations.length;
  const trackingCount = browser.trackingCalls.length;
  const eventCount = browser.catalogEvents.length;
  const scrollCount = browser.scrollCalls.length;

  browser.nodes.filterRailUnitButtons[2].click();

  assert.deepEqual(app.getSnapshot(), snapshot);
  assert.strictEqual(browser.nodes.grid.children[0], firstCard);
  assert.equal(browser.historyOperations.length, historyCount);
  assert.equal(browser.trackingCalls.length, trackingCount);
  assert.equal(browser.catalogEvents.length, eventCount);
  assert.equal(browser.scrollCalls.length, scrollCount);
  assert.equal(browser.nodes.units.children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailUnitButtons[2].getAttribute('aria-pressed'), 'true');
});

test('troca compacta usa patchFilters, reconcilia facetas e emite uma mudança filter-rail', () => {
  const { browser, app } = mountBrowser({
    raw: fixtures,
    search: '?co=rosa&pg=2&p=MD-020',
  });
  browser.triggerDOMContentLoaded();

  browser.nodes.filterRailUnitButtons[2].click();

  assert.equal(app.getSnapshot().page, 1);
  assert.equal(browser.historyOperations.length, 1);
  assert.equal(browser.historyOperations[0].type, 'replace');
  assert.equal(browser.historyOperations[0].url, '/catalogo.html?un=sf');
  assert.equal(browser.window.location.search, '?un=sf');
  assert.equal(browser.scrollCalls.length, 0);
  assert.equal(browser.nodes.units.children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailUnitButtons[2].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailCount.textContent, browser.nodes.count.textContent);
  assert.equal(browser.catalogEvents.at(-1).openProduct, null);
  const filterChanges = browser.trackingCalls.filter(call => call.name === 'KL_Filter_Change');
  assert.equal(filterChanges.length, 1);
  assert.equal(filterChanges[0].context.source, 'filter-rail');
});

test('unidade do painel completo mantém source unit e sincroniza o rail', () => {
  const { browser } = mountBrowser({ raw: fixtures });
  browser.triggerDOMContentLoaded();

  browser.nodes.units.children[1].click();

  const filterChanges = browser.trackingCalls.filter(call => call.name === 'KL_Filter_Change');
  assert.equal(filterChanges.length, 1);
  assert.equal(filterChanges[0].context.source, 'unit');
  assert.equal(browser.nodes.units.children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(browser.nodes.filterRailUnitButtons[1].getAttribute('aria-pressed'), 'true');
});

test('Ajustar filtros rola painel e foca categoria sem alterar catálogo', () => {
  const { browser, app } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();
  const snapshot = app.getSnapshot();
  const firstCard = browser.nodes.grid.children[0];
  const historyCount = browser.historyOperations.length;
  const trackingCount = browser.trackingCalls.length;
  const eventCount = browser.catalogEvents.length;
  const scrollCount = browser.scrollCalls.length;

  browser.nodes.filterRailAdjust.click();

  assert.deepEqual(
    JSON.parse(JSON.stringify(browser.nodes.filterPanel.scrollIntoViewCalls)),
    [{ block: 'start', behavior: 'smooth' }],
  );
  assert.strictEqual(browser.document.activeElement, browser.nodes.category);
  assert.deepEqual(
    JSON.parse(JSON.stringify(browser.nodes.category.focusOptions)),
    { preventScroll: true },
  );
  assert.deepEqual(app.getSnapshot(), snapshot);
  assert.strictEqual(browser.nodes.grid.children[0], firstCard);
  assert.equal(browser.historyOperations.length, historyCount);
  assert.equal(browser.trackingCalls.length, trackingCount);
  assert.equal(browser.catalogEvents.length, eventCount);
  assert.equal(browser.scrollCalls.length, scrollCount);
});

test('Ajustar filtros respeita prefers-reduced-motion', () => {
  const { browser } = mountBrowser({
    raw: fixtures,
    prefersReducedMotion: true,
  });
  browser.triggerDOMContentLoaded();

  browser.nodes.filterRailAdjust.click();

  assert.deepEqual(
    JSON.parse(JSON.stringify(browser.nodes.filterPanel.scrollIntoViewCalls)),
    [{ block: 'start', behavior: 'auto' }],
  );
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

test('URL, busca, categorias e unidades compartilham state canônico sem vazar a query em eventos', () => {
  const products = makeProducts(25);
  const { browser, app } = mountBrowser({
    raw: products,
    search: '?cat=ternos&un=sf&co=invalida&tam=ZZ&pg=2abc&lixo=1',
  });
  browser.triggerDOMContentLoaded();

  assert.equal(browser.historyOperations.at(-1).url, '/catalogo.html?cat=ternos&un=sf');
  assert.equal(browser.nodes.category.value, 'ternos');
  assert.equal(browser.nodes.search.value, '');
  assert.equal(browser.nodes.units.children[2].getAttribute('aria-pressed'), 'true');

  browser.nodes.category.value = '';
  browser.nodes.category.dispatchEvent({ type: 'change' });
  assert.equal(browser.historyOperations.at(-1).url, '/catalogo.html?un=sf');
  browser.document.querySelectorAll('[data-shortcut-cat]')[0].click();
  assert.equal(browser.nodes.category.value, 'vestidos-noiva');
  assert.match(browser.historyOperations.at(-1).url, /cat=vestidos-noiva/);

  browser.nodes.units.children[0].click();
  assert.equal(browser.nodes.units.children[0].getAttribute('aria-pressed'), 'true');
  assert.doesNotMatch(browser.historyOperations.at(-1).url, /un=/);
  assert.match(browser.nodes.count.textContent, /peça/);

  browser.nodes.search.value = 'Peça 005 privada';
  browser.nodes.search.dispatchEvent({ type: 'input' });
  browser.advanceTime(179);
  assert.doesNotMatch(browser.window.location.search, /q=/);
  browser.advanceTime(1);
  assert.match(browser.window.location.search, /q=Pe%C3%A7a\+005\+privada/);
  assert.equal(app.getSnapshot().page, 1);
  const detail = browser.catalogEvents.at(-1);
  assert.deepEqual(Object.keys(detail).sort(), ['openProduct', 'resultCount', 'status', 'unit']);
  assert.equal(JSON.stringify(browser.catalogEvents).includes('Peça 005 privada'), false);
});

test('facetas e chips são dinâmicos, combinam OR/AND e limpam refinamentos', () => {
  const { browser } = mountBrowser({ raw: fixtures });
  browser.triggerDOMContentLoaded();
  const facet = (kind, value) => browser.findAll(
    browser.nodes.facets,
    node => node.dataset && node.dataset.facet === kind && node.dataset.value === value,
  )[0];
  const chip = (kind, value) => browser.findAll(
    browser.nodes.activeFilters,
    node => node.dataset && node.dataset.filter === kind && node.dataset.value === value,
  )[0];

  assert.ok(facet('color', 'off-white'));
  assert.ok(facet('size', '33'));
  assert.match(facet('color', 'off-white').textContent, /\d+/);
  facet('color', 'off-white').click();
  facet('color', 'vinho').click();
  assert.deepEqual(
    browser.nodes.grid.children.map(card => card.dataset.code).sort(),
    ['DB-010', 'NV-001', 'NV-002'],
  );
  chip('color', 'off-white').click();
  assert.match(browser.window.location.search, /co=vinho/);
  assert.doesNotMatch(browser.window.location.search, /co=off-white/);
  facet('size', 'P').click();
  const expected = Core.derive(fixtures, {
    query: '', category: null, unit: null, colors: ['vinho'], sizes: ['P'], page: 1, openProduct: null,
  }).products.map(product => product.k).sort();
  assert.deepEqual(browser.nodes.grid.children.map(card => card.dataset.code).sort(), expected);

  browser.nodes.category.value = 'ternos';
  browser.nodes.category.dispatchEvent({ type: 'change' });
  const announcers = browser.findAll(
    browser.nodes.activeFilters,
    node => /catalog-filter-announcement/.test(node.className || ''),
  );
  assert.equal(announcers.length, 1);
  assert.match(announcers[0].textContent, /vinho/i);
  const announcement = announcers[0].textContent;
  browser.nodes.category.dispatchEvent({ type: 'change' });
  assert.equal(announcers[0].textContent, announcement);

  const clear = browser.findAll(
    browser.nodes.activeFilters,
    node => node.tagName === 'BUTTON' && node.textContent === 'Limpar refinamentos',
  )[0];
  clear.click();
  assert.equal(browser.window.location.search, '');
  assert.equal(browser.nodes.category.value, '');
  assert.equal(browser.nodes.search.value, '');
  assert.equal(browser.scrollCalls.length, 0);
});

test('observer, manual e popstate usam page canônica e não emitem carga no fim', () => {
  const { browser, app } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();
  const firstCard = browser.nodes.grid.children[0];
  browser.triggerIntersection(true);
  browser.nodes.loadMore.click();
  const eventsAtEnd = browser.catalogEvents.length;
  browser.triggerIntersection(true);

  assert.equal(app.getSnapshot().page, 3);
  assert.strictEqual(browser.nodes.grid.children[0], firstCard);
  assert.equal(browser.catalogEvents.length, eventsAtEnd);
  assert.equal(browser.historyOperations.length, 2);

  browser.window.location.search = '?pg=1';
  browser.dispatchWindow('popstate');
  assert.equal(app.getSnapshot().page, 1);
  assert.equal(browser.nodes.grid.children.length, 12);
  browser.triggerIntersection(true);
  assert.equal(app.getSnapshot().page, 2);
  assert.equal(browser.historyOperations.at(-1).url, '/catalogo.html?pg=2');
});

test('pagehide e carga sem p restauram lote, scroll e foco sem scrollRestoration', () => {
  const products = makeProducts(25);
  const focusCode = Core.interleave(products)[15].k;
  const first = mountBrowser({
    raw: products,
    search: `?pg=2&p=${focusCode}`,
    scrollY: 640,
  });
  first.browser.triggerDOMContentLoaded();
  const favorite = first.browser.findAll(
    first.browser.nodes.grid,
    node => node.dataset && node.dataset.favoriteCode === focusCode,
  )[0];
  favorite.focus();
  first.browser.dispatchWindow('pagehide');
  const saved = first.browser.sessionStorage.snapshot();
  const key = Object.keys(saved)[0];
  assert.doesNotMatch(key, /[?&]p=/);
  assert.deepEqual(JSON.parse(saved[key]), { y: 640, focusCode });
  assert.equal(first.browser.window.history.scrollRestoration, undefined);

  const second = mountBrowser({ raw: products, search: '?pg=2', sessionSeed: saved });
  second.browser.triggerDOMContentLoaded();
  assert.equal(second.app.getSnapshot().visibleCount, 24);
  assert.equal(second.browser.scrollCalls.length, 1);
  assert.equal(second.browser.document.activeElement.dataset.favoriteCode, focusCode);
  second.app.init();
  assert.equal(second.browser.windowListenerCount('popstate'), 1);
  assert.equal(second.browser.windowListenerCount('pagehide'), 1);
  assert.equal(second.browser.nodes.search.listenerCount('input'), 1);
});

test('tracking explícito cobre a matriz e não inclui query bruta no contexto', () => {
  const names = [
    'KL_Catalog_Loaded', 'KL_Catalog_Error', 'KL_Catalog_Search',
    'KL_Filter_Change', 'KL_Catalog_Load_More', 'KL_Product_Open',
    'KL_Product_Navigate', 'KL_Favorite_Toggle', 'KL_Favorites_View',
    'KL_WhatsApp_Click', 'KL_Try_On_Click', 'KL_Catalog_Empty',
  ];
  names.forEach(name => assert.match(APP_SOURCE, new RegExp("trackCatalog\\('" + name)));

  const { browser, app } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();
  app.init();
  assert.equal(browser.trackingCalls.filter(call => call.name === 'KL_Catalog_Loaded').length, 1);

  browser.nodes.search.value = 'Peça 005 privada';
  browser.nodes.search.dispatchEvent({ type: 'input' });
  browser.advanceTime(180);
  const search = browser.trackingCalls.find(call => call.name === 'KL_Catalog_Search');
  assert.ok(search);
  assert.deepEqual(Object.keys(search.context).sort(), [
    'category', 'productCode', 'queryHasProductCode', 'queryLength', 'resultCount', 'source', 'unit',
  ]);
  assert.equal(JSON.stringify(search.context).includes('Peça 005 privada'), false);
});

test('tracking de ação não duplica em rerender, popstate ou paginação no fim', () => {
  const { browser, app } = mountBrowser({ raw: makeProducts(25) });
  browser.triggerDOMContentLoaded();
  browser.nodes.grid.children[0].children[1].children[2].click();
  browser.nodes.loadMore.click();
  browser.triggerIntersection(true);
  const actionNames = browser.trackingCalls.map(call => call.name);
  assert.equal(actionNames.filter(name => name === 'KL_Favorite_Toggle').length, 1);
  assert.equal(actionNames.filter(name => name === 'KL_Catalog_Load_More').length, 2);

  const before = browser.trackingCalls.length;
  app.init();
  browser.triggerIntersection(true);
  browser.window.location.search = '?pg=1';
  browser.dispatchWindow('popstate');
  assert.equal(browser.trackingCalls.length, before);
});
