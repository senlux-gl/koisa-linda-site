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

function createScrollEnvironment(options) {
  options = options || {};
  const body = {
    style: {
      position: options.position || '',
      top: options.top || '',
      left: options.left || '',
      right: options.right || '',
      width: options.width || '',
      paddingRight: options.paddingRight == null ? '' : `${options.paddingRight}px`,
      overflow: options.bodyOverflow || '',
    },
  };
  const documentElement = {
    clientWidth: Number(options.clientWidth || 0),
    style: { overflow: options.rootOverflow || '' },
  };
  const scrollCalls = [];
  const environment = {
    body,
    documentElement,
    window: {
      scrollY: Number(options.scrollY || 0),
      innerWidth: Number(options.innerWidth || 0),
      scrollTo(x, y) { scrollCalls.push([x, y]); },
    },
    getComputedStyle(node) {
      return { paddingRight: node.style.paddingRight || '0px' };
    },
  };
  const snapshotStyles = () => ({
    body: cloneValue(body.style),
    root: cloneValue(documentElement.style),
  });
  const initialStyles = snapshotStyles();

  return { environment, initialStyles, scrollCalls, snapshotStyles };
}

class FakeEventTarget {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, callback, options) {
    const key = String(type);
    const listeners = this._listeners.get(key) || [];
    listeners.push({ callback, once: Boolean(options && options.once) });
    this._listeners.set(key, listeners);
  }

  removeEventListener(type, callback) {
    const key = String(type);
    const listeners = this._listeners.get(key) || [];
    this._listeners.set(key, listeners.filter(record => record.callback !== callback));
  }

  dispatchEvent(input) {
    const event = typeof input === 'string' ? { type: input } : input;
    const type = event && String(event.type || '');
    if (!type) throw new TypeError('event.type is required');
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const listeners = (this._listeners.get(type) || []).slice();
    listeners.forEach((record) => {
      record.callback.call(this, event);
      if (record.once) {
        const active = this._listeners.get(type) || [];
        const index = active.indexOf(record);
        if (index >= 0) active.splice(index, 1);
      }
    });
    return true;
  }

  listenerCount(type) {
    return (this._listeners.get(String(type)) || []).length;
  }
}

function dataProperty(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function classTokens(element) {
  return String(element.className || '').split(/\s+/).filter(Boolean);
}

function createStyleDeclaration() {
  const style = {};
  Object.defineProperties(style, {
    setProperty: {
      value(name, value) { this[String(name)] = String(value); },
    },
    getPropertyValue: {
      value(name) { return this[String(name)] || ''; },
    },
  });
  return style;
}

class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument, nodeType) {
    super();
    this.nodeType = nodeType || 1;
    this.tagName = this.nodeType === 1 ? String(tagName).toUpperCase() : undefined;
    this.ownerDocument = ownerDocument || null;
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.hidden = false;
    this.style = createStyleDeclaration();
    this.value = '';
    this._textContent = '';
    this._boundingClientRect = {
      top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0,
    };
    this.focusOptions = undefined;
    this.scrollIntoViewCalls = [];
    if (this.tagName === 'DIALOG') {
      this.open = false;
      this.showModal = () => {
        if (this.open) throw new Error('dialog already open');
        this.open = true;
      };
      this.close = () => {
        if (!this.open) return;
        this.open = false;
        this.dispatchEvent({ type: 'close' });
      };
    }
    this.classList = {
      add: (...tokens) => {
        const next = new Set(classTokens(this));
        tokens.forEach(token => next.add(String(token)));
        this.className = Array.from(next).join(' ');
      },
      remove: (...tokens) => {
        const removed = new Set(tokens.map(String));
        this.className = classTokens(this).filter(token => !removed.has(token)).join(' ');
      },
      contains: token => classTokens(this).includes(String(token)),
    };
  }

  get children() {
    return this.childNodes.filter(node => node && node.nodeType === 1);
  }

  get isConnected() {
    let node = this;
    while (node && node.parentNode) node = node.parentNode;
    return Boolean(this.ownerDocument && node === this.ownerDocument.documentElement);
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get textContent() {
    return this._textContent + this.childNodes.map(node => node.textContent || '').join('');
  }

  set textContent(value) {
    this.childNodes.forEach((child) => { child.parentNode = null; });
    this.childNodes = [];
    this._textContent = String(value == null ? '' : value);
  }

  appendChild(child) {
    if (!child) throw new TypeError('child is required');
    if (child.nodeType === 11) {
      while (child.firstChild) this.appendChild(child.firstChild);
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new Error('child not found');
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    const key = String(name);
    const stringValue = String(value);
    this.attributes.set(key, stringValue);
    if (key === 'id' && this.ownerDocument) this.ownerDocument._registerId(stringValue, this);
    if (key === 'class') this.className = stringValue;
    if (key.startsWith('data-')) this.dataset[dataProperty(key)] = stringValue;
  }

  getAttribute(name) {
    const key = String(name);
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'src') this.src = '';
    if (key.startsWith('data-')) delete this.dataset[dataProperty(key)];
  }

  querySelectorAll(selector) {
    return querySelectorAllFrom(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return Object.assign({}, this._boundingClientRect);
  }

  setBoundingClientRect(rect) {
    this._boundingClientRect = Object.assign({}, this._boundingClientRect, rect || {});
  }

  focus(options) {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    this.focusOptions = options;
  }

  scrollIntoView(options) {
    this.scrollIntoViewCalls.push(options);
  }

  click() {
    return this.dispatchEvent({ type: 'click' });
  }
}

function descendants(root) {
  const output = [];
  (root.childNodes || []).forEach((child) => {
    output.push(child);
    output.push(...descendants(child));
  });
  return output;
}

function matchesSimple(element, selector) {
  if (!element || element.nodeType !== 1) return false;
  if (selector.startsWith('#')) return element.getAttribute('id') === selector.slice(1);
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  if (selector.startsWith('[data-') && selector.endsWith(']')) {
    const attribute = selector.slice(1, -1);
    return Object.prototype.hasOwnProperty.call(element.dataset, dataProperty(attribute));
  }
  return element.tagName === selector.toUpperCase();
}

function querySelectorAllFrom(root, selector) {
  return String(selector).trim().split(/\s+/).reduce((containers, part) => {
    const matches = [];
    containers.forEach((container) => {
      descendants(container).forEach((candidate) => {
        if (matchesSimple(candidate, part) && !matches.includes(candidate)) matches.push(candidate);
      });
    });
    return matches;
  }, [root]);
}

function findAll(root, predicate) {
  return [root, ...descendants(root)].filter(node => predicate(node));
}

class FakeDocument extends FakeEventTarget {
  constructor(readyState) {
    super();
    this.readyState = readyState || 'loading';
    this._ids = new Map();
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
  }

  _registerId(id, element) {
    this._ids.set(String(id), element);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createDocumentFragment() {
    return new FakeElement('', this, 11);
  }

  getElementById(id) {
    return this._ids.get(String(id)) || null;
  }

  querySelectorAll(selector) {
    return querySelectorAllFrom(this.body, selector);
  }
}

function createFakeCatalogBrowser(options) {
  options = options || {};
  const document = new FakeDocument(options.readyState || 'loading');
  const nodes = {};

  function add(tagName, id, parent) {
    const node = document.createElement(tagName);
    if (id) node.setAttribute('id', id);
    (parent || document.body).appendChild(node);
    if (id) nodes[id] = node;
    return node;
  }

  const header = add('header');
  header.setBoundingClientRect({ height: options.headerHeight == null ? 71 : options.headerHeight });
  const app = add('main', 'catalog-app');
  const filterPanel = add('section', 'catalog-filters', app);
  const category = add('select', 'catalog-category', filterPanel);
  [
    ['', 'Todas as categorias'],
    ['vestidos-noiva', 'Noivas'],
    ['vestidos-debutante', 'Debutantes'],
    ['vestidos-madrinha', 'Madrinhas & Festa'],
    ['ternos', 'Ternos'],
    ['bolsas', 'Bolsas'],
    ['calcados', 'Calçados'],
    ['acessorios', 'Acessórios'],
  ].forEach(([value, label]) => {
    const option = add('option', '', category);
    option.value = value;
    option.textContent = label;
  });
  const count = add('p', 'catalog-count', filterPanel);
  count.textContent = 'Carregando catálogo…';
  const favoriteCount = add('span', 'catalog-favorite-count', filterPanel);
  const units = add('fieldset', 'catalog-units', filterPanel);
  ['', 'barra', 'sf'].forEach((unit) => {
    const button = add('button', '', units);
    button.setAttribute('data-unit', unit);
  });
  ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha'].forEach((value) => {
    const shortcut = add('button', '', app);
    shortcut.setAttribute('data-shortcut-cat', value);
  });
  const filterSentinel = add('div', 'catalog-filter-sentinel', filterPanel);
  const filterRail = add('section', 'catalog-filter-rail', app);
  filterRail.hidden = true;
  const filterRailCount = add('span', 'catalog-filter-rail-count', filterRail);
  filterRailCount.textContent = 'Carregando catálogo…';
  const filterRailCategory = add('span', 'catalog-filter-rail-category', filterRail);
  filterRailCategory.textContent = 'Todas as categorias';
  const filterRailUnits = add('fieldset', 'catalog-filter-rail-units', filterRail);
  const filterRailUnitButtons = ['', 'barra', 'sf'].map((unit) => {
    const button = add('button', '', filterRailUnits);
    button.setAttribute('data-unit', unit);
    return button;
  });
  const filterRailAdjust = add('button', 'catalog-adjust-filters', filterRail);
  const results = add('section', 'catalog-results', app);
  results.setAttribute('aria-busy', 'true');
  const status = add('div', 'catalog-status', results);
  const grid = add('div', 'catalog-grid', results);
  const loadMore = add('button', 'catalog-load-more', results);
  loadMore.hidden = true;
  const sentinel = add('div', 'catalog-sentinel', results);

  let galleryDialog = null;
  let galleryImage = null;
  let favoritesDialog = null;
  let favoritesContent = null;
  let favoritesOpen = null;
  let favoritesClose = null;
  if (options.dialogs) {
    favoritesOpen = add('button', 'catalog-open-favorites', filterPanel);
    galleryDialog = add('dialog', 'catalog-gallery');
    galleryImage = add('img', 'gallery-image', galleryDialog);
    favoritesDialog = add('dialog', 'catalog-favorites');
    favoritesClose = add('button', '', favoritesDialog);
    favoritesClose.setAttribute('data-close-favorites', '');
    favoritesContent = add('div', 'favorites-content', favoritesDialog);
  }

  const location = {
    pathname: options.pathname || '/catalogo.html',
    search: options.search || '',
    hash: options.hash || '',
    reloadCount: 0,
    reload() { this.reloadCount += 1; },
  };
  const historyOperations = [];
  const initialUrl = location.pathname + location.search + location.hash;
  const historyEntries = [{
    state: cloneValue(options.historyState == null ? null : options.historyState),
    url: initialUrl,
  }];
  let historyIndex = 0;

  function applyUrl(url) {
    const stringUrl = String(url);
    const match = stringUrl.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    if (match) {
      location.pathname = match[1] || location.pathname;
      location.search = match[2] || '';
      location.hash = match[3] || '';
    }
    return stringUrl;
  }

  const history = {
    get state() {
      return cloneValue(historyEntries[historyIndex].state);
    },
    pushState(state, _title, url) {
      const stringUrl = applyUrl(url);
      historyEntries.splice(historyIndex + 1);
      historyEntries.push({ state: cloneValue(state), url: stringUrl });
      historyIndex += 1;
      historyOperations.push({ type: 'push', state: cloneValue(state), url: stringUrl });
    },
    replaceState(state, _title, url) {
      const stringUrl = applyUrl(url);
      historyEntries[historyIndex] = { state: cloneValue(state), url: stringUrl };
      historyOperations.push({ type: 'replace', state: cloneValue(state), url: stringUrl });
    },
    back() {
      historyOperations.push({ type: 'back' });
      if (historyIndex > 0) historyIndex -= 1;
      applyUrl(historyEntries[historyIndex].url);
    },
  };
  const marks = [];
  const consoleErrors = [];
  const observers = [];
  const storage = options.storage || createStorage();
  const sandbox = {
    console: { error: (...args) => consoleErrors.push(args) },
    document,
    history,
    location,
    performance: { mark: name => marks.push(String(name)) },
    URLSearchParams,
  };
  sandbox.innerWidth = Number(options.innerWidth || 1200);
  document.documentElement.clientWidth = Number(options.clientWidth || 1180);
  sandbox.getComputedStyle = node => ({ paddingRight: node.style.paddingRight || '0px' });
  if (options.intersectionObserver !== false) {
    sandbox.IntersectionObserver = function IntersectionObserver(callback, observerOptions) {
      const observer = {
        callback,
        options: observerOptions,
        observed: [],
        disconnected: false,
        observe(node) {
          if (!this.observed.includes(node)) this.observed.push(node);
        },
        disconnect() { this.disconnected = true; },
      };
      observers.push(observer);
      return observer;
    };
  }
  sandbox.matchMedia = query => ({
    media: String(query),
    matches: String(query) === '(prefers-reduced-motion: reduce)'
      && Boolean(options.prefersReducedMotion),
  });
  Object.defineProperty(sandbox, 'localStorage', {
    configurable: true,
    get() {
      if (typeof options.onStorageAccess === 'function') options.onStorageAccess();
      return storage;
    },
  });
  sandbox.window = sandbox;

  return {
    consoleErrors,
    document,
    findAll: (root, predicate) => findAll(root, predicate),
    historyOperations,
    historySnapshot() {
      return {
        entries: cloneValue(historyEntries),
        index: historyIndex,
        operations: cloneValue(historyOperations),
      };
    },
    marks,
    nodes: Object.assign(nodes, {
      app,
      category,
      count,
      favoriteCount,
      favoritesClose,
      favoritesContent,
      favoritesDialog,
      favoritesOpen,
      filterPanel,
      filterRail,
      filterRailAdjust,
      filterRailCategory,
      filterRailCount,
      filterRailUnitButtons,
      filterRailUnits,
      filterSentinel,
      grid,
      galleryDialog,
      galleryImage,
      header,
      loadMore,
      results,
      sentinel,
      status,
      units,
    }),
    observers,
    storage,
    triggerDOMContentLoaded() {
      document.readyState = 'interactive';
      document.dispatchEvent({ type: 'DOMContentLoaded' });
    },
    triggerIntersection(isIntersecting) {
      observers
        .filter(observer => !observer.disconnected && observer.observed.includes(sentinel))
        .forEach((observer) => {
          observer.callback([{ target: sentinel, isIntersecting: Boolean(isIntersecting) }]);
        });
    },
    triggerIntersectionFor(node, entry) {
      observers
        .filter(observer => !observer.disconnected && observer.observed.includes(node))
        .forEach((observer) => {
          observer.callback([Object.assign({}, entry || {}, { target: node })]);
        });
    },
    window: sandbox,
  };
}

module.exports = {
  createFakeCatalogBrowser,
  createHistory,
  createImageLoader,
  createScrollEnvironment,
  createStorage,
  findAll,
};
