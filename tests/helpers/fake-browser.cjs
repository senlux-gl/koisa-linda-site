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
    this.value = '';
    this._textContent = '';
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
    this.body = new FakeElement('body', this);
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

  const app = add('main', 'catalog-app');
  const category = add('select', 'catalog-category', app);
  const count = add('p', 'catalog-count', app);
  const favoriteCount = add('span', 'catalog-favorite-count', app);
  const units = add('fieldset', 'catalog-units', app);
  ['', 'barra', 'sf'].forEach((unit) => {
    const button = add('button', '', units);
    button.setAttribute('data-unit', unit);
  });
  ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha'].forEach((value) => {
    const shortcut = add('button', '', app);
    shortcut.setAttribute('data-shortcut-cat', value);
  });
  const results = add('section', 'catalog-results', app);
  results.setAttribute('aria-busy', 'true');
  const status = add('div', 'catalog-status', results);
  const grid = add('div', 'catalog-grid', results);
  const loadMore = add('button', 'catalog-load-more', results);
  loadMore.hidden = true;
  const sentinel = add('div', 'catalog-sentinel', results);

  const location = {
    pathname: options.pathname || '/catalogo.html',
    search: options.search || '',
    hash: options.hash || '',
    reloadCount: 0,
    reload() { this.reloadCount += 1; },
  };
  const historyOperations = [];
  const history = {
    state: null,
    replaceState(state, _title, url) {
      const stringUrl = String(url);
      this.state = state;
      historyOperations.push({ type: 'replace', state, url: stringUrl });
      const match = stringUrl.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
      if (match) {
        location.pathname = match[1] || location.pathname;
        location.search = match[2] || '';
        location.hash = match[3] || '';
      }
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
  sandbox.IntersectionObserver = function IntersectionObserver(callback, observerOptions) {
    const observer = {
      callback,
      options: observerOptions,
      observed: [],
      disconnected: false,
      observe(node) { this.observed.push(node); },
      disconnect() { this.disconnected = true; },
    };
    observers.push(observer);
    return observer;
  };
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
    marks,
    nodes: Object.assign(nodes, {
      app, category, count, favoriteCount, grid, loadMore, results, sentinel, status, units,
    }),
    observers,
    storage,
    triggerDOMContentLoaded() {
      document.readyState = 'interactive';
      document.dispatchEvent({ type: 'DOMContentLoaded' });
    },
    triggerIntersection(isIntersecting) {
      observers.filter(observer => !observer.disconnected).forEach((observer) => {
        observer.callback([{ isIntersecting: Boolean(isIntersecting) }]);
      });
    },
    window: sandbox,
  };
}

module.exports = {
  createFakeCatalogBrowser,
  createHistory,
  createImageLoader,
  createStorage,
  findAll,
};
