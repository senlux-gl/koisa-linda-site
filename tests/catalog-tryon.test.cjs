'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const TryOn = require('../kl-catalog-tryon.js');

const ELIGIBLE_CATEGORIES = new Set([
  'vestidos-noiva',
  'vestidos-madrinha',
  'vestidos-debutante',
]);

function isEligible(product) {
  return Boolean(product && ELIGIBLE_CATEGORIES.has(product.c));
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function invalidJsonResponse(message, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new SyntaxError(message); },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(count = 24) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function createScheduler(initialTime = 0) {
  let clock = initialTime;
  let nextId = 0;
  const timers = new Map();

  function runDueTimers() {
    let due = Array.from(timers.entries())
      .filter(([, timer]) => timer.at <= clock)
      .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
    while (due.length) {
      due.forEach(([id, timer]) => {
        if (!timers.delete(id)) return;
        timer.callback();
      });
      due = Array.from(timers.entries())
        .filter(([, timer]) => timer.at <= clock)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
    }
  }

  return {
    now: () => clock,
    setTimer(callback, milliseconds) {
      nextId += 1;
      timers.set(nextId, { callback, at: clock + Math.max(0, Number(milliseconds) || 0) });
      return nextId;
    },
    clearTimer(id) { timers.delete(id); },
    advance(milliseconds) {
      clock += milliseconds;
      runDueTimers();
    },
    pendingTimers: () => timers.size,
  };
}

function createAbortHarness() {
  const controllers = [];

  class FakeAbortController {
    constructor() {
      const listeners = new Set();
      this.signal = {
        aborted: false,
        addEventListener(name, listener) {
          if (name === 'abort') listeners.add(listener);
        },
        removeEventListener(name, listener) {
          if (name === 'abort') listeners.delete(listener);
        },
        listenerCount() { return listeners.size; },
      };
      this.abort = () => {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        Array.from(listeners).forEach((listener) => listener());
      };
      controllers.push(this);
    }
  }

  return { AbortController: FakeAbortController, controllers };
}

function workerInput(overrides) {
  return {
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
    ...(overrides || {}),
  };
}

function workerClient(options) {
  return TryOn.createWorkerClient({
    setTimer: () => 1,
    clearTimer: () => {},
    ...options,
  });
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(String(type)) || [];
    listeners.push(listener);
    this.listeners.set(String(type), listeners);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.listeners.get(key) || [];
    this.listeners.set(key, listeners.filter(candidate => candidate !== listener));
  }

  dispatchEvent(input) {
    const event = typeof input === 'string' ? { type: input } : input;
    if (!event || !event.type) throw new TypeError('event.type is required');
    if (!event.target) event.target = this;
    if (!event.preventDefault) {
      event.preventDefault = () => { event.defaultPrevented = true; };
    }
    event.currentTarget = this;
    (this.listeners.get(String(event.type)) || []).slice().forEach((listener) => {
      listener.call(this, event);
    });
    return !event.defaultPrevented;
  }

  listenerCount(type) {
    return (this.listeners.get(String(type)) || []).length;
  }
}

function dataName(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function classNames(element) {
  return String(element.className || '').split(/\s+/).filter(Boolean);
}

class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.files = [];
    this.open = false;
    this.src = '';
    this.href = '';
    this.type = '';
    this._textContent = '';
    this.showModalCalls = 0;
    this.closeCalls = 0;
    this.focusCalls = 0;
    this.classList = {
      add: (...tokens) => {
        const next = new Set(classNames(this));
        tokens.forEach(token => next.add(String(token)));
        this.className = Array.from(next).join(' ');
      },
      contains: token => classNames(this).includes(String(token)),
    };
  }

  get children() {
    return this.childNodes.slice();
  }

  get textContent() {
    return this._textContent + this.childNodes.map(child => child.textContent || '').join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this._textContent = String(value == null ? '' : value);
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.childNodes = [];
    children.forEach(child => this.appendChild(child));
  }

  setAttribute(name, value) {
    const key = String(name);
    const stringValue = String(value);
    this.attributes.set(key, stringValue);
    if (key === 'class') this.className = stringValue;
    if (key === 'src') this.src = stringValue;
    if (key === 'href') this.href = stringValue;
    if (key === 'type') this.type = stringValue;
    if (key.startsWith('data-')) this.dataset[dataName(key)] = stringValue;
  }

  getAttribute(name) {
    const key = String(name);
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'src') this.src = '';
    if (key === 'href') this.href = '';
    if (key.startsWith('data-')) delete this.dataset[dataName(key)];
  }

  focus() {
    this.focusCalls += 1;
    this.ownerDocument.activeElement = this;
  }

  showModal() {
    this.showModalCalls += 1;
    this.open = true;
  }

  close() {
    this.closeCalls += 1;
    this.open = false;
  }

  click() {
    return this.dispatchEvent({ type: 'click' });
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

}

function createStorageFake(initialValue) {
  const values = new Map();
  if (initialValue != null) values.set('kl_manequim', initialValue);
  const calls = [];
  return {
    calls,
    getItem(key) {
      calls.push(['get', key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['set', key, String(value)]);
      values.set(key, String(value));
    },
    removeItem(key) {
      calls.push(['remove', key]);
      values.delete(key);
    },
  };
}

const ELEMENT_IDS = Object.freeze({
  title: 'tryon-title',
  closeButton: 'tryon-close',
  sizes: 'tryon-sizes',
  unknownSize: 'tryon-unknown-size',
  clearSize: 'tryon-clear-size',
  categories: 'tryon-categories',
  search: 'tryon-search',
  dresses: 'tryon-dresses',
  noResults: 'tryon-no-results',
  more: 'tryon-more',
  clearSelection: 'tryon-clear-selection',
  file: 'tryon-file',
  preview: 'tryon-preview',
  previewImage: 'tryon-preview-image',
  submit: 'tryon-submit',
  form: 'tryon-form',
  loading: 'tryon-loading',
  result: 'tryon-result',
  resultImage: 'tryon-result-image',
  remaining: 'tryon-remaining',
  again: 'tryon-again',
  error: 'tryon-error',
  errorMessage: 'tryon-error-message',
  errorAgain: 'tryon-error-again',
  whatsapp: 'tryon-whatsapp',
  errorWhatsapp: 'tryon-error-whatsapp',
});

function createControllerHarness(overrides) {
  const document = new FakeDocument();
  const dialog = document.createElement('dialog');
  dialog.setAttribute('id', 'catalog-tryon');
  const elements = {};
  Object.entries(ELEMENT_IDS).forEach(([key, id]) => {
    let tagName = 'div';
    if (/Button|more|clearSelection|submit|again|errorAgain|unknownSize|clearSize/.test(key)) tagName = 'button';
    if (key === 'search' || key === 'file') tagName = 'input';
    if (key === 'previewImage' || key === 'resultImage') tagName = 'img';
    if (key === 'form') tagName = 'form';
    if (key === 'whatsapp' || key === 'errorWhatsapp') tagName = 'a';
    const element = document.createElement(tagName);
    element.setAttribute('id', id);
    dialog.appendChild(element);
    elements[key] = element;
  });

  elements.sizeButtons = ['PP', 'P', 'M', 'G', 'GG'].map((size) => {
    const button = document.createElement('button');
    button.setAttribute('data-size', size);
    button.setAttribute('aria-pressed', 'false');
    elements.sizes.appendChild(button);
    return button;
  });
  elements.categoryButtons = [
    'all',
    'vestidos-noiva',
    'vestidos-madrinha',
    'vestidos-debutante',
  ].map((category) => {
    const button = document.createElement('button');
    button.setAttribute('data-category', category);
    button.setAttribute('aria-pressed', category === 'all' ? 'true' : 'false');
    elements.categories.appendChild(button);
    return button;
  });

  const selections = [];
  const closeRequests = [];
  const storage = createStorageFake(overrides && overrides.mannequin);
  const objectURL = {
    created: [],
    revoked: [],
    create(file) {
      this.created.push(file);
      return `blob:preview-${this.created.length}`;
    },
    revoke(url) { this.revoked.push(url); },
  };
  const readFiles = [];
  const readFile = async (file) => {
    readFiles.push(file);
    return 'data:image/jpeg;base64,PRIVATE_PHOTO_BYTES';
  };
  const workerCalls = [];
  const workerClientFake = {
    async run(input) {
      workerCalls.push(input);
      return { kind: 'success', image: 'https://img.test/generated.jpg?raw=SECRET', remaining: 2 };
    },
  };
  const aborts = createAbortHarness();
  const core = {
    thumbUrl(product) { return `thumb:${product.k}`; },
  };
  const actions = {
    CONTACTS: { barra: 'BARRA-CONTACT', sf: 'SF-CONTACT' },
    isTryOnEligible: isEligible,
    unitOf(product) { return product && product.un; },
    whatsappHref(contact, message) { return `wa:${contact}:${message}`; },
  };
  const baseOptions = {
    dialog,
    elements,
    document,
    products: fixtures,
    core,
    actions,
    storage,
    objectURL,
    readFile,
    AbortController: aborts.AbortController,
    workerClient: workerClientFake,
    onSelectionChange(code) { selections.push(code); },
    onRequestClose() { closeRequests.push(true); },
  };
  const options = Object.assign(baseOptions, overrides || {});
  delete options.mannequin;
  const controller = TryOn.create(options);
  return {
    aborts,
    actions,
    closeRequests,
    controller,
    core,
    dialog,
    document,
    elements,
    objectURL,
    options,
    readFiles,
    selections,
    storage,
    workerCalls,
    workerClient: workerClientFake,
  };
}

function dressCards(harness) {
  return harness.elements.dresses.children;
}

function cardFor(harness, code) {
  return dressCards(harness).find(card => card.dataset.code === code);
}

function choosePhoto(harness, file) {
  harness.elements.file.files = file ? [file] : [];
  harness.elements.file.value = file ? 'C:\\fakepath\\private-photo.jpg' : '';
  harness.elements.file.dispatchEvent({ type: 'change' });
}

async function submitTryOn(harness) {
  harness.elements.form.dispatchEvent({ type: 'submit' });
  await flushMicrotasks();
}

test('controller abre com seleção exclusiva, formulário limpo e foco no título', () => {
  const harness = createControllerHarness();

  assert.equal(harness.controller.isReady(), true);
  assert.equal(typeof harness.controller.getSnapshot, 'function');
  assert.equal(harness.controller.open(' nv-001 '), true);
  assert.equal(harness.dialog.open, true);
  assert.equal(harness.dialog.showModalCalls, 1);
  assert.equal(harness.document.activeElement, harness.elements.title);
  assert.equal(harness.elements.search.value, '');
  assert.equal(harness.elements.form.hidden, false);
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.error.hidden, true);
  assert.deepEqual(harness.selections, []);
  assert.equal(cardFor(harness, 'NV-001').getAttribute('aria-pressed'), 'true');
  assert.equal(
    dressCards(harness).filter(card => card.getAttribute('aria-pressed') === 'true').length,
    1,
  );
});

test('controller valida dependências e o mapa completo de elementos com mensagens claras', () => {
  [undefined, null, [], 'options'].forEach((options) => {
    assert.throws(() => TryOn.create(options), /options must be an object/);
  });
  const harness = createControllerHarness();
  assert.throws(
    () => TryOn.create({ ...harness.options, dialog: null }),
    /requires a dialog element/,
  );
  assert.throws(
    () => TryOn.create({ ...harness.options, products: null }),
    /requires a products array/,
  );
  assert.throws(
    () => TryOn.create({ ...harness.options, core: {} }),
    /requires core\.thumbUrl/,
  );
  assert.throws(
    () => TryOn.create({ ...harness.options, actions: {} }),
    /requires actions\.isTryOnEligible/,
  );
  const incomplete = { ...harness.elements };
  delete incomplete.resultImage;
  assert.throws(
    () => TryOn.create({ ...harness.options, elements: incomplete }),
    /tryon-result-image/,
  );
  harness.controller.destroy();
});

test('seleção, limpeza e update sincronizam uma vez sem apagar filtros internos', () => {
  const harness = createControllerHarness();
  harness.controller.open('NV-001');
  harness.elements.search.value = 'off-white';
  harness.elements.search.dispatchEvent({ type: 'input' });
  harness.elements.categoryButtons[1].click();
  harness.elements.sizeButtons[2].click();

  const nextCard = cardFor(harness, 'NV-002');
  assert.ok(nextCard);
  nextCard.click();
  assert.deepEqual(harness.selections, ['NV-002']);
  assert.equal(harness.controller.getSnapshot().selectedCode, 'NV-002');
  const selectedCard = cardFor(harness, 'NV-002');
  assert.equal(selectedCard.getAttribute('role'), 'listitem');
  assert.equal(selectedCard.getAttribute('type'), 'button');
  assert.equal(selectedCard.getAttribute('aria-pressed'), 'true');
  assert.equal(selectedCard.children[0].tagName, 'IMG');
  assert.equal(selectedCard.children[1].className, 'tryon-dress-copy');
  assert.match(selectedCard.children[1].textContent, /NV-002/);

  harness.elements.clearSelection.click();
  assert.deepEqual(harness.selections, ['NV-002', null]);
  assert.equal(harness.controller.getSnapshot().selectedCode, null);
  assert.equal(harness.elements.search.value, 'off-white');
  assert.equal(harness.elements.categoryButtons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(harness.elements.sizeButtons[2].getAttribute('aria-pressed'), 'true');

  harness.controller.update('MD-020');
  assert.equal(harness.controller.getSnapshot().selectedCode, 'MD-020');
  assert.equal(harness.elements.search.value, 'off-white');
  assert.equal(harness.elements.categoryButtons[1].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(harness.selections, ['NV-002', null]);

  harness.controller.open(null);
  assert.equal(harness.controller.getSnapshot().selectedCode, null);
  assert.equal(harness.elements.search.value, '');
  assert.equal(harness.elements.categoryButtons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(harness.elements.sizeButtons[2].getAttribute('aria-pressed'), 'true');
});

test('busca, categoria, manequim e lotes filtram sem mutar base nem disparar efeitos privados', () => {
  const products = Array.from({ length: 55 }, (_, index) => ({
    ...fixtures[index % 4],
    k: `V-${String(index).padStart(2, '0')}`,
    co: index === 54 ? 'azul céu' : fixtures[index % 4].co,
    c: index === 54 ? 'vestidos-debutante' : fixtures[index % 4].c,
  }));
  const before = JSON.stringify(products);
  const harness = createControllerHarness({ products, mannequin: 'M' });
  harness.controller.open('V-00');

  assert.equal(dressCards(harness).length, 24);
  assert.equal(harness.elements.more.hidden, false);
  assert.equal(harness.elements.sizeButtons[2].getAttribute('aria-pressed'), 'true');
  assert.ok(dressCards(harness).every(card => !/não serve/i.test(card.textContent)));
  harness.elements.more.click();
  assert.equal(dressCards(harness).length, 48);

  harness.elements.search.value = 'AZUL CEU';
  harness.elements.search.dispatchEvent({ type: 'input' });
  assert.deepEqual(dressCards(harness).map(card => card.dataset.code), ['V-54']);
  assert.equal(harness.controller.getSnapshot().selectedCode, 'V-00');
  harness.elements.categoryButtons[3].click();
  assert.deepEqual(dressCards(harness).map(card => card.dataset.code), ['V-54']);
  harness.elements.sizeButtons[3].click();
  assert.equal(harness.elements.sizeButtons[3].getAttribute('aria-pressed'), 'true');
  assert.ok(dressCards(harness).every(card => !/não serve/i.test(card.textContent)));
  assert.deepEqual(harness.selections, []);
  assert.deepEqual(harness.objectURL.created, []);
  assert.deepEqual(harness.readFiles, []);
  assert.deepEqual(harness.workerCalls, []);
  assert.equal(JSON.stringify(products), before);
  assert.ok(harness.storage.calls.every(call => call[1] === 'kl_manequim'));
  assert.deepEqual(harness.storage.calls.at(-1), ['set', 'kl_manequim', 'G']);

  harness.elements.clearSize.click();
  assert.equal(harness.elements.sizeButtons[3].getAttribute('aria-pressed'), 'false');
  assert.deepEqual(harness.storage.calls.at(-1), ['remove', 'kl_manequim']);
});

test('miniatura tenta original uma vez e depois marca imagem indisponível sem loop', () => {
  const harness = createControllerHarness();
  harness.controller.open('NV-001');
  const card = cardFor(harness, 'NV-001');
  const image = card.children[0];

  assert.equal(image.src, 'thumb:NV-001');
  image.dispatchEvent({ type: 'error' });
  assert.equal(image.src, fixtures[0].u);
  image.dispatchEvent({ type: 'error' });
  assert.equal(image.src, '');
  assert.equal(card.classList.contains('is-image-unavailable'), true);
  assert.equal(image.listenerCount('error'), 0);
  image.dispatchEvent({ type: 'error' });
  assert.equal(image.src, '');
});

test('foto usa object URL no change e só lê/envia no submit explícito', async () => {
  const harness = createControllerHarness();
  const firstFile = { name: 'private-photo.jpg', type: 'image/jpeg' };
  const secondFile = { name: 'other-private-photo.webp', type: 'image/webp' };
  harness.controller.open('NV-001');

  choosePhoto(harness, firstFile);
  assert.deepEqual(harness.objectURL.created, [firstFile]);
  assert.deepEqual(harness.readFiles, []);
  assert.equal(harness.elements.preview.hidden, false);
  assert.equal(harness.elements.previewImage.src, 'blob:preview-1');
  assert.equal(harness.elements.submit.disabled, false);

  choosePhoto(harness, secondFile);
  assert.deepEqual(harness.objectURL.revoked, ['blob:preview-1']);
  assert.equal(harness.elements.previewImage.src, 'blob:preview-2');
  assert.deepEqual(harness.readFiles, []);
  harness.controller.update('MD-020');
  assert.equal(harness.elements.previewImage.src, 'blob:preview-2');
  assert.equal(harness.elements.submit.disabled, false);
  harness.controller.update('NV-001');

  harness.elements.search.value = 'PRIVATE_QUERY';
  harness.elements.search.dispatchEvent({ type: 'input' });
  await submitTryOn(harness);

  assert.deepEqual(harness.readFiles, [secondFile]);
  assert.equal(harness.workerCalls.length, 1);
  assert.equal(harness.workerCalls[0].garmentUrl, fixtures[0].u);
  assert.equal(harness.workerCalls[0].imageBase64, 'data:image/jpeg;base64,PRIVATE_PHOTO_BYTES');
  assert.equal(typeof harness.workerCalls[0].isCurrent, 'function');
  assert.equal(harness.workerCalls[0].isCurrent(), true);
  assert.equal(harness.workerCalls[0].signal, harness.aborts.controllers[0].signal);
  assert.equal(harness.elements.form.hidden, true);
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.result.hidden, false);
  assert.equal(harness.elements.resultImage.src, 'https://img.test/generated.jpg?raw=SECRET');
  assert.match(harness.elements.remaining.textContent, /2/);
  assert.match(harness.elements.whatsapp.href, /^wa:BARRA-CONTACT:/);

  const snapshot = JSON.stringify(harness.controller.getSnapshot());
  [
    firstFile.name,
    secondFile.name,
    'PRIVATE_PHOTO_BYTES',
    'PRIVATE_QUERY',
    'raw=SECRET',
  ].forEach(secret => assert.equal(snapshot.includes(secret), false, secret));
});

test('resultados do Worker têm mensagens distintas, seguras e saída por WhatsApp', async () => {
  const outcomes = [
    { kind: 'limit', expected: /limite/i },
    { kind: 'invalid-response', expected: /resposta inesperada/i },
    { kind: 'generation-error', expected: /gerar esta simulação/i },
    { kind: 'timeout', expected: /mais tempo/i },
    { kind: 'network', expected: /conectar/i },
  ];
  const messages = [];

  for (const outcome of outcomes) {
    const workerCalls = [];
    const harness = createControllerHarness({
      workerClient: {
        async run(input) {
          workerCalls.push(input);
          return { ...outcome, raw: 'PRIVATE_PHOTO_BYTES private-photo.jpg' };
        },
      },
    });
    harness.controller.open('NV-001');
    choosePhoto(harness, { name: 'private-photo.jpg' });
    await submitTryOn(harness);

    assert.equal(workerCalls.length, 1, outcome.kind);
    assert.equal(harness.elements.error.hidden, false, outcome.kind);
    assert.equal(harness.elements.result.hidden, true, outcome.kind);
    assert.match(harness.elements.errorMessage.textContent, outcome.expected, outcome.kind);
    assert.match(harness.elements.errorWhatsapp.href, /^wa:BARRA-CONTACT:/, outcome.kind);
    assert.equal(harness.elements.errorMessage.textContent.includes('PRIVATE_PHOTO_BYTES'), false);
    assert.equal(harness.elements.errorMessage.textContent.includes('private-photo.jpg'), false);
    messages.push(harness.elements.errorMessage.textContent);
    harness.elements.errorAgain.click();
    assert.equal(harness.elements.form.hidden, false, outcome.kind);
    assert.equal(harness.elements.error.hidden, true, outcome.kind);
  }
  assert.equal(new Set(messages).size, outcomes.length);
});

test('open/close invalidam awaits, abortam e limpam todo estado sensível', async () => {
  const reading = deferred();
  const workerCalls = [];
  const harness = createControllerHarness({
    readFile: () => reading.promise,
    workerClient: { async run(input) { workerCalls.push(input); return { kind: 'success' }; } },
  });
  harness.controller.open('NV-001');
  harness.elements.search.value = 'vinho';
  harness.elements.search.dispatchEvent({ type: 'input' });
  harness.elements.categoryButtons[3].click();
  choosePhoto(harness, { name: 'private-photo.jpg' });
  harness.elements.form.dispatchEvent({ type: 'submit' });
  await flushMicrotasks();
  assert.equal(harness.elements.loading.hidden, false);
  assert.equal(harness.aborts.controllers.length, 1);

  assert.equal(harness.controller.close(), true);
  assert.equal(harness.aborts.controllers[0].signal.aborted, true);
  assert.deepEqual(harness.objectURL.revoked, ['blob:preview-1']);
  assert.equal(harness.elements.file.value, '');
  assert.equal(harness.elements.preview.hidden, true);
  assert.equal(harness.elements.previewImage.src, '');
  assert.equal(harness.elements.resultImage.src, '');
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.error.hidden, true);
  assert.equal(harness.elements.search.value, '');
  assert.equal(harness.elements.categoryButtons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(harness.controller.getSnapshot().selectedCode, null);
  assert.equal(harness.dialog.open, false);
  assert.deepEqual(harness.closeRequests, []);

  reading.resolve('data:image/jpeg;base64,PRIVATE_PHOTO_BYTES');
  await flushMicrotasks();
  assert.deepEqual(workerCalls, []);
  harness.controller.open(null);
  assert.equal(harness.elements.preview.hidden, true);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.error.hidden, true);
});

test('cancelamento corrente volta ao form e preserva seleção e foto para nova tentativa', async () => {
  let workerRuns = 0;
  const harness = createControllerHarness({
    workerClient: {
      async run() {
        workerRuns += 1;
        return { kind: 'cancelled' };
      },
    },
  });
  const file = { name: 'private-photo.jpg' };
  harness.controller.open('NV-001');
  choosePhoto(harness, file);

  await submitTryOn(harness);

  assert.equal(workerRuns, 1);
  assert.deepEqual(harness.readFiles, [file]);
  assert.equal(harness.controller.getSnapshot().phase, 'form');
  assert.equal(harness.controller.getSnapshot().selectedCode, 'NV-001');
  assert.equal(harness.elements.form.hidden, false);
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.error.hidden, true);
  assert.equal(harness.elements.preview.hidden, false);
  assert.equal(harness.elements.previewImage.src, 'blob:preview-1');
  assert.equal(harness.elements.submit.disabled, false);
  assert.deepEqual(harness.selections, []);
});

test('cancelled tardio não sobrescreve nova abertura e todo await exige dialog aberto', async () => {
  const pendingWorker = deferred();
  const harness = createControllerHarness({
    workerClient: { run: () => pendingWorker.promise },
  });
  harness.controller.open('NV-001');
  choosePhoto(harness, { name: 'private-photo.jpg' });
  harness.elements.form.dispatchEvent({ type: 'submit' });
  await flushMicrotasks();

  harness.controller.open('DB-010');
  assert.equal(harness.aborts.controllers[0].signal.aborted, true);
  assert.equal(harness.controller.getSnapshot().phase, 'form');
  assert.equal(harness.elements.form.hidden, false);
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.preview.hidden, true);
  pendingWorker.resolve({ kind: 'cancelled' });
  await flushMicrotasks();
  assert.equal(harness.controller.getSnapshot().selectedCode, 'DB-010');
  assert.equal(harness.controller.getSnapshot().phase, 'form');
  assert.equal(harness.elements.form.hidden, false);
  assert.equal(harness.elements.loading.hidden, true);
  assert.equal(harness.elements.preview.hidden, true);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.resultImage.src, '');

  const secondWorker = deferred();
  const second = createControllerHarness({ workerClient: { run: () => secondWorker.promise } });
  second.controller.open('NV-001');
  choosePhoto(second, { name: 'private-photo.jpg' });
  second.elements.form.dispatchEvent({ type: 'submit' });
  await flushMicrotasks();
  second.dialog.open = false;
  secondWorker.resolve({ kind: 'success', image: 'https://img.test/closed.jpg', remaining: 1 });
  await flushMicrotasks();
  assert.equal(second.elements.result.hidden, true);
  assert.equal(second.elements.resultImage.src, '');
});

test('pedidos de fechar delegam; novamente volta ao form; destroy remove todos listeners', async () => {
  const harness = createControllerHarness();
  harness.controller.open('NV-001');
  choosePhoto(harness, { name: 'private-photo.jpg' });
  await submitTryOn(harness);

  harness.elements.again.click();
  assert.equal(harness.elements.form.hidden, false);
  assert.equal(harness.elements.result.hidden, true);
  assert.equal(harness.elements.resultImage.src, '');
  harness.elements.closeButton.click();
  assert.equal(harness.dialog.open, true);
  const cancel = { type: 'cancel' };
  harness.dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  harness.dialog.dispatchEvent({ type: 'click', target: harness.elements.title });
  harness.dialog.dispatchEvent({ type: 'click', target: harness.dialog });
  assert.deepEqual(harness.closeRequests, [true, true, true]);
  assert.equal(harness.dialog.open, true);

  const staleCard = cardFor(harness, 'NV-002');
  const selectionsBefore = harness.selections.slice();
  assert.equal(harness.controller.destroy(), true);
  assert.equal(harness.controller.isReady(), false);
  assert.equal(harness.dialog.open, false);
  assert.equal(harness.elements.closeButton.listenerCount('click'), 0);
  assert.equal(harness.dialog.listenerCount('cancel'), 0);
  assert.equal(staleCard.listenerCount('click'), 0);
  staleCard.click();
  harness.elements.closeButton.click();
  assert.deepEqual(harness.selections, selectionsBefore);
  assert.deepEqual(harness.closeRequests, [true, true, true]);
  assert.equal(harness.controller.destroy(), false);
});

test('lista interna usa a base completa, o callback injetado e só categorias elegíveis', () => {
  const visited = [];
  const source = fixtures.slice().reverse();
  const before = JSON.stringify(source);
  const eligible = TryOn.filterEligibleProducts(source, (product) => {
    visited.push(product.k);
    return isEligible(product);
  });

  assert.deepEqual(visited, source.map((product) => product.k));
  assert.deepEqual(
    eligible.map((product) => product.k).sort(),
    ['DB-010', 'MD-020', 'NV-001', 'NV-002'],
  );
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(TryOn.filterEligibleProducts(source, null), []);
});

test('busca interna normaliza diacríticos e case em código e cor', () => {
  const products = [
    { ...fixtures[0], k: ' Nv-Á01 ', co: 'Rosé' },
    fixtures[2],
  ];

  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'nv-a01', category: 'all' }).map((item) => item.k),
    [' Nv-Á01 '],
  );
  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'ROSE', category: 'all' }).map((item) => item.k),
    [' Nv-Á01 '],
  );
  assert.deepEqual(
    TryOn.filterProducts(products, { query: 'vinho', category: 'vestidos-debutante' }).map((item) => item.k),
    ['DB-010'],
  );
});

test('filtro interno aceita categoria e revela lotes cumulativos de 24 sem mutar entrada', () => {
  const source = Array.from({ length: 55 }, (_, index) => ({
    ...fixtures[index % 4],
    k: `V-${String(index).padStart(2, '0')}`,
    c: index === 54 ? 'vestidos-debutante' : 'vestidos-noiva',
  }));
  const before = JSON.stringify(source);

  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 1 }).length, 24);
  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 2 }).length, 48);
  assert.equal(TryOn.filterProducts(source, { category: 'all', page: 3 }).length, 55);
  assert.deepEqual(
    TryOn.filterProducts(source, { category: 'vestidos-debutante', page: 1 }).map((item) => item.k),
    ['V-54'],
  );
  assert.equal(JSON.stringify(source), before);
});

test('manequim nunca declara que o vestido não serve', () => {
  assert.deepEqual(TryOn.fitFor({ t: 'm' }, 'M'), { kind: 'ok', label: 'cabe' });
  assert.deepEqual(TryOn.fitFor({ t: 'P' }, 'M'), { kind: 'adjust', label: 'ajustável' });
  assert.deepEqual(TryOn.fitFor({ t: 'Único' }, 'M'), { kind: 'made', label: 'sob medida' });
  assert.deepEqual(TryOn.fitFor({ t: '42' }, 'M'), { kind: 'made', label: 'sob medida' });
  assert.deepEqual(TryOn.fitFor({}, 'M'), { kind: 'made', label: 'sob medida' });
  assert.equal(TryOn.fitFor({ t: 'M' }, null), null);
});

test('WhatsApp do resultado usa unidade válida, contato injetado e código normalizado', () => {
  const contacts = Object.freeze({ barra: 'BARRA-CONTACT', sf: 'SF-CONTACT' });
  const actions = {
    CONTACTS: contacts,
    unitOf(product) {
      return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
    },
    whatsappHref(contact, message) {
      return `wa:${contact}:${message}`;
    },
  };

  const href = TryOn.resultWhatsAppHref({ k: ' nv 001/azul ', un: 'barra' }, actions);

  assert.match(href, /^wa:BARRA-CONTACT:/);
  assert.match(href, /NV 001\/AZUL/);
  assert.equal(href.includes(' nv 001/azul '), false);
  assert.equal(
    TryOn.resultWhatsAppHref({ k: 'NV-001', un: 'invalida' }, actions),
    'unidades.html',
  );
});

test('intercepta somente clique primário simples sem target ou download especial', () => {
  const event = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  const plainLink = {
    target: '',
    hasAttribute() { return false; },
  };

  assert.equal(TryOn.shouldInterceptLink(event, plainLink), true);
  assert.equal(TryOn.shouldInterceptLink({ ...event, button: 1 }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, metaKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, ctrlKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, shiftKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, altKey: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink({ ...event, defaultPrevented: true }, plainLink), false);
  assert.equal(TryOn.shouldInterceptLink(event, { ...plainLink, target: '_blank' }), false);
  assert.equal(TryOn.shouldInterceptLink(event, {
    target: '',
    hasAttribute(name) { return name === 'download'; },
  }), false);
  assert.equal(TryOn.shouldInterceptLink(null, plainLink), false);
});

test('request guard gera tokens, identifica o atual e invalida respostas antigas', () => {
  const guard = TryOn.createRequestGuard();
  const first = guard.token();

  assert.equal(guard.current(first), true);
  const second = guard.token();
  assert.equal(guard.current(first), false);
  assert.equal(guard.current(second), true);
  guard.invalidate();
  assert.equal(guard.current(second), false);
});

test('Worker faz POST explícito sem query, usa só image_b64 e consulta status a cada 2500 ms', async () => {
  const scheduler = createScheduler();
  const aborts = createAbortHarness();
  const calls = [];
  const waits = [];
  const queued = [
    response({ id: 'job/with space', restam_voce: 2 }),
    response({ status: 'processing' }),
    response({ status: 'done', image: 'https://img.test/generated.jpg' }),
  ];
  const client = workerClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      return queued.shift();
    },
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      scheduler.advance(milliseconds);
    },
    now: scheduler.now,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    AbortController: aborts.AbortController,
    workerUrl: 'https://worker.test/',
  });

  assert.deepEqual(calls, []);
  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'data:image/png;base64,PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(result, {
    kind: 'success',
    image: 'https://img.test/generated.jpg',
    remaining: 2,
  });
  assert.deepEqual(waits, [2500, 2500]);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://worker.test/tryon',
    'https://worker.test/status?id=job%2Fwith%20space',
    'https://worker.test/status?id=job%2Fwith%20space',
  ]);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    garment_url: 'https://img.test/dress.jpg',
    image_b64: 'data:image/png;base64,PRIVATE_PHOTO_BYTES',
  });
  assert.equal('image_url' in JSON.parse(calls[0].options.body), false);
  assert.equal(aborts.controllers.length, 1);
  assert.equal(calls[0].options.signal, aborts.controllers[0].signal);
  assert.equal(calls[1].options.signal, aborts.controllers[0].signal);
  assert.equal(aborts.controllers[0].signal.aborted, false);
  assert.equal(scheduler.pendingTimers(), 0);
});

test('Worker retorna limite em 429 sem tentar ler ou expor a resposta', async () => {
  let jsonCalled = false;
  const client = workerClient({
    fetch: async () => ({
      ok: false,
      status: 429,
      json: async () => {
        jsonCalled = true;
        return { raw: 'PRIVATE_PHOTO_BYTES' };
      },
    }),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(result, { kind: 'limit' });
  assert.equal(jsonCalled, false);
});

test('Worker distingue JSON inválido, forma inválida e erro de geração', async (t) => {
  const runWithResponses = async (responses) => {
    const client = workerClient({
      fetch: async () => responses.shift(),
      wait: async () => {},
      now: () => 0,
      workerUrl: 'https://worker.test',
    });
    return client.run({
      garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
      imageBase64: 'PRIVATE_PHOTO_BYTES',
      isCurrent: () => true,
    });
  };

  await t.test('JSON inválido', async () => {
    assert.deepEqual(
      await runWithResponses([invalidJsonResponse('raw PRIVATE_PHOTO_BYTES private-photo.jpg')]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('forma inválida no POST', async () => {
    assert.deepEqual(
      await runWithResponses([response({ restam_voce: 2, raw: 'PRIVATE_PHOTO_BYTES' })]),
      { kind: 'invalid-response' },
    );
    assert.deepEqual(
      await runWithResponses([undefined]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('forma inválida no status', async () => {
    assert.deepEqual(
      await runWithResponses([
        response({ id: 'job', restam_voce: 2 }),
        response({ status: 'done', raw: 'PRIVATE_PHOTO_BYTES' }),
      ]),
      { kind: 'invalid-response' },
    );
  });

  await t.test('status error', async () => {
    assert.deepEqual(
      await runWithResponses([
        response({ id: 'job', restam_voce: 2 }),
        response({ status: 'error', error: 'raw PRIVATE_PHOTO_BYTES private-photo.jpg' }),
      ]),
      { kind: 'generation-error' },
    );
  });
});

test('Worker distingue timeout e falha de rede sem vazar dados da requisição', async () => {
  let clock = 0;
  const timeoutClient = workerClient({
    fetch: async (url) => url.endsWith('/tryon')
      ? response({ id: 'job', restam_voce: 1 })
      : response({ status: 'processing' }),
    wait: async (milliseconds) => { clock += milliseconds; },
    now: () => clock,
    workerUrl: 'https://worker.test',
    timeout: 5000,
  });
  const timeoutResult = await timeoutClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  const networkClient = workerClient({
    fetch: async () => {
      throw new Error('PRIVATE_PHOTO_BYTES private-photo.jpg https://img.test/dress.jpg?x=TRACKING_VALUE');
    },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });
  const networkResult = await networkClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
  });

  assert.deepEqual(timeoutResult, { kind: 'timeout' });
  assert.deepEqual(networkResult, { kind: 'network' });
  const failures = JSON.stringify([timeoutResult, networkResult]);
  assert.equal(failures.includes('PRIVATE_PHOTO_BYTES'), false);
  assert.equal(failures.includes('private-photo.jpg'), false);
  assert.equal(failures.includes('TRACKING_VALUE'), false);
});

test('deadline nasce antes do POST, limita promessa pendente e aborta o signal interno', async () => {
  const scheduler = createScheduler();
  const aborts = createAbortHarness();
  const pendingPost = deferred();
  let requestOptions;
  const client = workerClient({
    fetch: async (url, options) => {
      requestOptions = options;
      return pendingPost.promise;
    },
    wait: async () => {},
    now: scheduler.now,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    AbortController: aborts.AbortController,
    workerUrl: 'https://worker.test',
    timeout: 100,
  });

  const running = client.run(workerInput());
  scheduler.advance(100);
  await flushMicrotasks();
  const observed = await Promise.race([
    running,
    Promise.resolve({ kind: 'still-pending' }),
  ]);

  assert.deepEqual(observed, { kind: 'timeout' });
  assert.equal(aborts.controllers.length, 1);
  assert.equal(requestOptions.signal, aborts.controllers[0].signal);
  assert.equal(aborts.controllers[0].signal.aborted, true);
  assert.equal(scheduler.pendingTimers(), 0);
});

test('POST ou POST.json concluído depois do prazo retorna timeout, nunca sucesso', async (t) => {
  async function runLate(stage) {
    const scheduler = createScheduler();
    const aborts = createAbortHarness();
    const late = deferred();
    let fetchCount = 0;
    const client = workerClient({
      fetch: async () => {
        fetchCount += 1;
        if (fetchCount === 1 && stage === 'fetch') return late.promise;
        if (fetchCount === 1) {
          return { ok: true, status: 200, json: () => late.promise };
        }
        return response({ status: 'done', image: 'https://img.test/generated.jpg' });
      },
      wait: async () => {},
      now: scheduler.now,
      setTimer: scheduler.setTimer,
      clearTimer: scheduler.clearTimer,
      AbortController: aborts.AbortController,
      workerUrl: 'https://worker.test',
      timeout: 100,
    });
    const running = client.run(workerInput());

    await flushMicrotasks();
    scheduler.advance(101);
    if (stage === 'fetch') late.resolve(response({ id: 'job', restam_voce: 1 }));
    else late.resolve({ id: 'job', restam_voce: 1 });
    await flushMicrotasks();

    const result = await running;
    assert.equal(fetchCount, 1);
    assert.equal(aborts.controllers[0].signal.aborted, true);
    assert.equal(scheduler.pendingTimers(), 0);
    return result;
  }

  await t.test('POST fetch tardio', async () => {
    assert.deepEqual(await runLate('fetch'), { kind: 'timeout' });
  });
  await t.test('POST json tardio', async () => {
    assert.deepEqual(await runLate('json'), { kind: 'timeout' });
  });
});

test('GET de status ou status.json pendente é limitado pelo mesmo deadline absoluto', async (t) => {
  async function runLate(stage) {
    const scheduler = createScheduler();
    const aborts = createAbortHarness();
    const late = deferred();
    let fetchCount = 0;
    const client = workerClient({
      fetch: async () => {
        fetchCount += 1;
        if (fetchCount === 1) return response({ id: 'job', restam_voce: 1 });
        if (stage === 'fetch') return late.promise;
        return { ok: true, status: 200, json: () => late.promise };
      },
      wait: async () => {},
      now: scheduler.now,
      setTimer: scheduler.setTimer,
      clearTimer: scheduler.clearTimer,
      AbortController: aborts.AbortController,
      workerUrl: 'https://worker.test',
      timeout: 100,
    });
    const running = client.run(workerInput());

    await flushMicrotasks();
    assert.equal(fetchCount, 2);
    scheduler.advance(100);
    if (stage === 'fetch') {
      late.resolve(response({ status: 'done', image: 'https://img.test/generated.jpg' }));
    } else {
      late.resolve({ status: 'done', image: 'https://img.test/generated.jpg' });
    }
    await flushMicrotasks();

    const result = await running;
    assert.equal(aborts.controllers.length, 1);
    assert.equal(aborts.controllers[0].signal.aborted, true);
    assert.equal(scheduler.pendingTimers(), 0);
    return result;
  }

  await t.test('GET fetch pendente', async () => {
    assert.deepEqual(await runLate('fetch'), { kind: 'timeout' });
  });
  await t.test('GET json pendente e done tardio', async () => {
    assert.deepEqual(await runLate('json'), { kind: 'timeout' });
  });
});

test('espera de polling pendente é limitada e sua rejeição tardia fica absorvida', async () => {
  const scheduler = createScheduler();
  const aborts = createAbortHarness();
  const lateWait = deferred();
  let fetchCount = 0;
  const client = workerClient({
    fetch: async () => {
      fetchCount += 1;
      return response({ id: 'job', restam_voce: 1 });
    },
    wait: async () => lateWait.promise,
    now: scheduler.now,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    AbortController: aborts.AbortController,
    workerUrl: 'https://worker.test',
    timeout: 100,
  });
  const running = client.run(workerInput());

  await flushMicrotasks();
  assert.equal(fetchCount, 1);
  scheduler.advance(100);
  await flushMicrotasks();
  const result = await running;

  assert.deepEqual(result, { kind: 'timeout' });
  assert.equal(aborts.controllers[0].signal.aborted, true);
  assert.equal(scheduler.pendingTimers(), 0);
  lateWait.reject(new Error('late PRIVATE_PHOTO_BYTES private-photo.jpg'));
  await flushMicrotasks();
});

test('timeout consome rejeição tardia sem unhandled rejection nem vazamento', async () => {
  const scheduler = createScheduler();
  const aborts = createAbortHarness();
  const late = deferred();
  const unhandled = [];
  const onUnhandled = (reason) => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);

  try {
    const client = workerClient({
      fetch: async () => late.promise,
      wait: async () => {},
      now: scheduler.now,
      setTimer: scheduler.setTimer,
      clearTimer: scheduler.clearTimer,
      AbortController: aborts.AbortController,
      workerUrl: 'https://worker.test',
      timeout: 100,
    });
    const running = client.run(workerInput());

    scheduler.advance(100);
    await flushMicrotasks();
    late.reject(new Error(
      'PRIVATE_PHOTO_BYTES private-photo.jpg https://img.test/dress.jpg?x=TRACKING_VALUE',
    ));
    await flushMicrotasks();
    const result = await running;

    assert.deepEqual(result, { kind: 'timeout' });
    assert.deepEqual(unhandled, []);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('PRIVATE_PHOTO_BYTES'), false);
    assert.equal(serialized.includes('private-photo.jpg'), false);
    assert.equal(serialized.includes('TRACKING_VALUE'), false);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
});

test('guard inválido antes ou após await cancela e resposta tardia nunca é lida', async () => {
  let fetchCalls = 0;
  const inactiveClient = workerClient({
    fetch: async () => { fetchCalls += 1; return response({}); },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  assert.deepEqual(await inactiveClient.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => false,
  }), { kind: 'cancelled' });
  assert.equal(fetchCalls, 0);

  let resolveFetch;
  let current = true;
  let jsonCalled = false;
  const delayedClient = workerClient({
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });
  const pending = delayedClient.run({
    garmentUrl: 'https://img.test/dress.jpg?x=TRACKING_VALUE',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => current,
  });

  current = false;
  resolveFetch({
    ok: true,
    status: 200,
    json: async () => {
      jsonCalled = true;
      return { id: 'late', restam_voce: 1 };
    },
  });

  assert.deepEqual(await pending, { kind: 'cancelled' });
  assert.equal(jsonCalled, false);
});

test('invalidação entre o json e a continuação do run ainda cancela o sucesso', async () => {
  let current = true;
  let parsedFinalStatus = false;
  let scheduledInvalidation = false;
  const responses = [
    response({ id: 'job', restam_voce: 1 }),
    {
      ok: true,
      status: 200,
      json: async () => {
        parsedFinalStatus = true;
        return { status: 'done', image: 'https://img.test/generated.jpg' };
      },
    },
  ];
  const client = workerClient({
    fetch: async () => responses.shift(),
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  const result = await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => {
      if (parsedFinalStatus && !scheduledInvalidation) {
        scheduledInvalidation = true;
        queueMicrotask(() => { current = false; });
      }
      return current;
    },
  });

  assert.deepEqual(result, { kind: 'cancelled' });
});

test('AbortSignal e AbortError são cancelamento, não falha de rede', async () => {
  let calls = 0;
  const client = workerClient({
    fetch: async () => {
      calls += 1;
      const error = new Error('aborted PRIVATE_PHOTO_BYTES');
      error.name = 'AbortError';
      throw error;
    },
    wait: async () => {},
    now: () => 0,
    workerUrl: 'https://worker.test',
  });

  assert.deepEqual(await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
    signal: { aborted: true },
  }), { kind: 'cancelled' });
  assert.equal(calls, 0);

  assert.deepEqual(await client.run({
    garmentUrl: 'https://img.test/dress.jpg',
    imageBase64: 'PRIVATE_PHOTO_BYTES',
    isCurrent: () => true,
    signal: { aborted: false },
  }), { kind: 'cancelled' });
});

test('abort externo cancela operação pendente e limpa timer, listener e rejeição tardia', async () => {
  const scheduler = createScheduler();
  const aborts = createAbortHarness();
  const external = new aborts.AbortController();
  const late = deferred();
  let requestOptions;
  const client = workerClient({
    fetch: async (url, options) => {
      requestOptions = options;
      return late.promise;
    },
    wait: async () => {},
    now: scheduler.now,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    AbortController: aborts.AbortController,
    workerUrl: 'https://worker.test',
    timeout: 100,
  });
  const running = client.run(workerInput({ signal: external.signal }));

  await flushMicrotasks();
  assert.equal(aborts.controllers.length, 2);
  external.abort();
  await flushMicrotasks();
  const result = await running;

  assert.deepEqual(result, { kind: 'cancelled' });
  assert.equal(requestOptions.signal, aborts.controllers[1].signal);
  assert.equal(aborts.controllers[1].signal.aborted, true);
  assert.equal(external.signal.listenerCount(), 0);
  assert.equal(scheduler.pendingTimers(), 0);
  late.reject(new Error('late PRIVATE_PHOTO_BYTES private-photo.jpg'));
  await flushMicrotasks();
});

test('UMD publica API exata mínima sem tocar document, storage ou fetch globais', () => {
  [
    'filterEligibleProducts',
    'filterProducts',
    'fitFor',
    'createRequestGuard',
    'createWorkerClient',
    'resultWhatsAppHref',
    'shouldInterceptLink',
    'create',
  ].forEach((name) => assert.equal(typeof TryOn[name], 'function', name));
  assert.equal(TryOn.DEFAULT_WORKER_URL, 'https://kl-tryon.contato-4d7.workers.dev');

  const source = fs.readFileSync(path.join(__dirname, '..', 'kl-catalog-tryon.js'), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  ['document', 'localStorage', 'fetch'].forEach((name) => {
    Object.defineProperty(sandbox, name, {
      configurable: true,
      get() { throw new Error(`${name} must not be read`); },
    });
  });

  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, {
    filename: 'kl-catalog-tryon.js',
  }));
  assert.equal(typeof sandbox.window.KLCatalog.TryOn, 'object');
  assert.equal(typeof sandbox.window.KLCatalog.TryOn.createWorkerClient, 'function');
});
