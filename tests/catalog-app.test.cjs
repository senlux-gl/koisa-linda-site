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
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function createElement(tagName) {
    const node = originalCreateElement(tagName);
    node.focus = function focus(options) {
      document.activeElement = node;
      node.focusOptions = options;
    };
    return node;
  };
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

function mountBrowser({ raw, search, core, actions, onStorageAccess, sessionSeed, scrollY }) {
  const browser = createFakeCatalogBrowser({ search, onStorageAccess });
  enhanceBrowser(browser, { sessionSeed, scrollY });
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
    'createPagingController',
    'createRequestMore',
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
