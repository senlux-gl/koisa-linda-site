(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.TryOn = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_WORKER_URL = 'https://kl-tryon.contato-4d7.workers.dev';
  var DEFAULT_BATCH_SIZE = 24;
  var DEFAULT_POLL_INTERVAL = 2500;
  var DEFAULT_TIMEOUT = 90000;
  var LETTER_SIZES = /^(PP|P|M|G|GG|XG)$/;
  var TERMINAL_ERRORS = ['error', 'failed'];
  var PENDING_STATUSES = ['pending', 'processing', 'queued', 'running', 'in_progress'];
  var STATIC_RESULTS = Object.freeze({
    cancelled: Object.freeze({ kind: 'cancelled' }),
    generationError: Object.freeze({ kind: 'generation-error' }),
    invalidResponse: Object.freeze({ kind: 'invalid-response' }),
    limit: Object.freeze({ kind: 'limit' }),
    network: Object.freeze({ kind: 'network' }),
    timeout: Object.freeze({ kind: 'timeout' }),
  });
  var CONTROLLER_ELEMENT_IDS = Object.freeze({
    title: 'tryon-title', closeButton: 'tryon-close', sizes: 'tryon-sizes',
    unknownSize: 'tryon-unknown-size', clearSize: 'tryon-clear-size',
    categories: 'tryon-categories', search: 'tryon-search', dresses: 'tryon-dresses',
    noResults: 'tryon-no-results', more: 'tryon-more',
    clearSelection: 'tryon-clear-selection', file: 'tryon-file', preview: 'tryon-preview',
    previewImage: 'tryon-preview-image', submit: 'tryon-submit', form: 'tryon-form',
    loading: 'tryon-loading', result: 'tryon-result', resultImage: 'tryon-result-image',
    remaining: 'tryon-remaining', again: 'tryon-again', error: 'tryon-error',
    errorMessage: 'tryon-error-message', errorAgain: 'tryon-error-again',
    whatsapp: 'tryon-whatsapp', errorWhatsapp: 'tryon-error-whatsapp',
  });
  var CONTROLLER_ERROR_MESSAGES = Object.freeze({
    limit: 'Você atingiu o limite de Provas Virtuais por enquanto. Nossa equipe pode ajudar pelo WhatsApp.',
    'invalid-response': 'Recebemos uma resposta inesperada. Tente novamente ou fale com nossa equipe pelo WhatsApp.',
    'generation-error': 'Não conseguimos gerar esta simulação. Escolha outra foto ou fale com nossa equipe pelo WhatsApp.',
    timeout: 'A Prova Virtual levou mais tempo que o esperado. Tente novamente ou fale com nossa equipe pelo WhatsApp.',
    network: 'Não foi possível conectar à Prova Virtual. Confira sua conexão ou fale com nossa equipe pelo WhatsApp.',
  });

  function fold(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value).trim().toUpperCase();
  }

  function positiveInteger(value, fallback) {
    var number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  function positiveNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function filterEligibleProducts(products, isEligible) {
    if (!Array.isArray(products) || typeof isEligible !== 'function') return [];
    return products.filter(function (product) {
      return Boolean(isEligible(product));
    });
  }

  function filterProducts(products, options) {
    options = options && typeof options === 'object' ? options : {};
    var query = fold(options.query);
    var category = String(options.category || 'all');
    var page = positiveInteger(options.page, 1);
    var batchSize = positiveInteger(options.batchSize, DEFAULT_BATCH_SIZE);
    var filtered = (Array.isArray(products) ? products : []).filter(function (product) {
      if (!product || typeof product !== 'object') return false;
      if (category !== 'all' && product.c !== category) return false;
      if (!query) return true;
      return fold(product.k).indexOf(query) > -1 || fold(product.co).indexOf(query) > -1;
    });
    return filtered.slice(0, page * batchSize);
  }

  function fitFor(product, mannequin) {
    var selected = fold(mannequin).toUpperCase();
    if (!selected) return null;
    var size = fold(product && product.t).toUpperCase();
    if (!LETTER_SIZES.test(size)) return { kind: 'made', label: 'sob medida' };
    return size === selected
      ? { kind: 'ok', label: 'cabe' }
      : { kind: 'adjust', label: 'ajustável' };
  }

  function createRequestGuard() {
    var value = 0;

    function token() {
      value += 1;
      return value;
    }

    function current(candidate) {
      return candidate === value;
    }

    function invalidate() {
      value += 1;
      return value;
    }

    return {
      token: token,
      current: current,
      invalidate: invalidate,
      next: token,
      isCurrent: current,
    };
  }

  function resultWhatsAppHref(product, actions, contacts) {
    actions = actions && typeof actions === 'object' ? actions : {};
    contacts = contacts || actions.CONTACTS || {};
    var unit = typeof actions.unitOf === 'function'
      ? actions.unitOf(product)
      : product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
    var contact = unit && contacts[unit];
    if (!contact) return 'unidades.html';

    var code = normalizeCode(product && product.k);
    var message = 'Oi! Fiz a prova virtual do vestido ' + code
      + ' e amei. Quero provar de verdade 💜';
    return typeof actions.whatsappHref === 'function'
      ? actions.whatsappHref(contact, message)
      : 'https://wa.me/' + contact + '?text=' + encodeURIComponent(message);
  }

  function attribute(element, name) {
    if (!element) return '';
    if (typeof element.getAttribute === 'function') {
      var value = element.getAttribute(name);
      return value == null ? '' : String(value);
    }
    return element[name] == null ? '' : String(element[name]);
  }

  function shouldInterceptLink(event, link) {
    if (
      !event
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return false;

    link = link || event.currentTarget;
    if (attribute(link, 'target').trim()) return false;
    var hasDownload = link && typeof link.hasAttribute === 'function'
      ? link.hasAttribute('download')
      : Boolean(attribute(link, 'download'));
    return !hasDownload;
  }

  function withoutQuery(url) {
    return String(url == null ? '' : url).split('?')[0].split('#')[0];
  }

  function isAbort(error, signal) {
    return Boolean((signal && signal.aborted) || (error && error.name === 'AbortError'));
  }

  function createWorkerClient(options) {
    if (!options || typeof options !== 'object' || typeof options.fetch !== 'function') {
      throw new TypeError('TryOn worker client requires an injected fetch function.');
    }

    var fetchRequest = options.fetch;
    var wait = typeof options.wait === 'function'
      ? options.wait
      : function (milliseconds) {
        return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
      };
    var now = typeof options.now === 'function' ? options.now : Date.now;
    var setTimer = typeof options.setTimer === 'function'
      ? options.setTimer
      : function (callback, milliseconds) { return setTimeout(callback, milliseconds); };
    var clearTimer = typeof options.clearTimer === 'function'
      ? options.clearTimer
      : function (timer) { clearTimeout(timer); };
    var AbortControllerClass = Object.prototype.hasOwnProperty.call(options, 'AbortController')
      ? options.AbortController
      : typeof AbortController === 'function' ? AbortController : null;
    var workerUrl = String(options.workerUrl || DEFAULT_WORKER_URL).replace(/\/+$/, '');
    var pollInterval = positiveNumber(options.pollInterval, DEFAULT_POLL_INTERVAL);
    var timeout = positiveNumber(options.timeout, DEFAULT_TIMEOUT);

    async function run(input) {
      input = input && typeof input === 'object' ? input : {};
      var externalSignal = input.signal;
      var checkCurrent = typeof input.isCurrent === 'function' ? input.isCurrent : function () {
        return true;
      };

      function isCurrent() {
        try {
          return checkCurrent() !== false;
        } catch (error) {
          return false;
        }
      }

      var garmentUrl = withoutQuery(input.garmentUrl);
      if (!garmentUrl || typeof input.imageBase64 !== 'string' || !input.imageBase64) {
        return STATIC_RESULTS.invalidResponse;
      }
      if ((externalSignal && externalSignal.aborted) || !isCurrent()) {
        return STATIC_RESULTS.cancelled;
      }

      var controller = typeof AbortControllerClass === 'function'
        ? new AbortControllerClass()
        : null;
      var requestSignal = controller && controller.signal ? controller.signal : externalSignal;
      var startedAt = Number(now());
      var deadlineAt = startedAt + timeout;
      var timedOut = false;
      var timerCreated = false;
      var deadlineTimer;
      var externalAbortListener = null;
      var resolveDeadline;
      var resolveCancellation;
      var timeoutOutcome = Object.freeze({ kind: 'timeout' });
      var cancelledOutcome = Object.freeze({ kind: 'cancelled' });
      var deadlinePromise = new Promise(function (resolve) { resolveDeadline = resolve; });
      var cancellationPromise = new Promise(function (resolve) { resolveCancellation = resolve; });

      function abortInternal() {
        if (controller && controller.signal && !controller.signal.aborted) controller.abort();
      }

      function expire() {
        if (timedOut) return;
        timedOut = true;
        abortInternal();
        resolveDeadline(timeoutOutcome);
      }

      function boundary() {
        if ((externalSignal && externalSignal.aborted) || !isCurrent()) {
          abortInternal();
          return cancelledOutcome;
        }
        if (timedOut || Number(now()) >= deadlineAt) {
          expire();
          return timeoutOutcome;
        }
        return null;
      }

      async function bounded(promise) {
        var before = boundary();
        if (before) return before;
        var operation = Promise.resolve(promise).then(function (value) {
          return { kind: 'value', value: value };
        }, function (error) {
          return { kind: 'error', error: error };
        });
        var outcome = await Promise.race([operation, deadlinePromise, cancellationPromise]);
        var after = boundary();
        return after || outcome;
      }

      async function request(url, requestOptions) {
        var before = boundary();
        if (before) return before;
        var pending;
        try {
          pending = fetchRequest(url, requestOptions);
        } catch (error) {
          pending = Promise.reject(error);
        }
        var outcome = await bounded(pending);
        var after = boundary();
        if (after) return after;
        if (outcome.kind === 'timeout' || outcome.kind === 'cancelled') return outcome;
        if (outcome.kind === 'error') {
          return isAbort(outcome.error, requestSignal)
            ? cancelledOutcome
            : { kind: 'network' };
        }
        return { kind: 'response', response: outcome.value };
      }

      async function readJson(httpResponse) {
        var before = boundary();
        if (before) return before;
        if (!httpResponse || typeof httpResponse.json !== 'function') {
          return { kind: 'invalid-response' };
        }
        var pending;
        try {
          pending = httpResponse.json();
        } catch (error) {
          pending = Promise.reject(error);
        }
        var outcome = await bounded(pending);
        var after = boundary();
        if (after) return after;
        if (outcome.kind === 'timeout' || outcome.kind === 'cancelled') return outcome;
        if (outcome.kind === 'error') {
          return isAbort(outcome.error, requestSignal)
            ? cancelledOutcome
            : { kind: 'invalid-response' };
        }
        return { kind: 'data', data: outcome.value };
      }

      async function pause() {
        var before = boundary();
        if (before) return before;
        var pending;
        try {
          pending = wait(pollInterval);
        } catch (error) {
          pending = Promise.reject(error);
        }
        var outcome = await bounded(pending);
        var after = boundary();
        if (after) return after;
        if (outcome.kind === 'timeout' || outcome.kind === 'cancelled') return outcome;
        return outcome.kind === 'error' ? { kind: 'network' } : { kind: 'ready' };
      }

      try {
        deadlineTimer = setTimer(expire, Math.max(0, deadlineAt - Number(now())));
        timerCreated = true;
        if (externalSignal && typeof externalSignal.addEventListener === 'function') {
          externalAbortListener = function () {
            abortInternal();
            resolveCancellation(cancelledOutcome);
          };
          externalSignal.addEventListener('abort', externalAbortListener, { once: true });
        }

        var postOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garment_url: garmentUrl,
            image_b64: input.imageBase64,
          }),
        };
        if (requestSignal) postOptions.signal = requestSignal;

        var post = await request(workerUrl + '/tryon', postOptions);
        var checkpoint = boundary();
        if (checkpoint) return checkpoint.kind === 'timeout'
          ? STATIC_RESULTS.timeout
          : STATIC_RESULTS.cancelled;
        if (post.kind === 'timeout') return STATIC_RESULTS.timeout;
        if (post.kind === 'cancelled') return STATIC_RESULTS.cancelled;
        if (post.kind === 'network') return STATIC_RESULTS.network;
        if (!post.response || typeof post.response !== 'object') {
          return STATIC_RESULTS.invalidResponse;
        }
        if (post.response.status === 429) return STATIC_RESULTS.limit;
        if (!post.response.ok) return STATIC_RESULTS.generationError;

        var postJson = await readJson(post.response);
        checkpoint = boundary();
        if (checkpoint) return checkpoint.kind === 'timeout'
          ? STATIC_RESULTS.timeout
          : STATIC_RESULTS.cancelled;
        if (postJson.kind === 'timeout') return STATIC_RESULTS.timeout;
        if (postJson.kind === 'cancelled') return STATIC_RESULTS.cancelled;
        if (postJson.kind !== 'data') return STATIC_RESULTS.invalidResponse;
        var postData = postJson.data;
        var id = postData && postData.id != null ? String(postData.id).trim() : '';
        var remaining = postData ? Number(postData.restam_voce) : Number.NaN;
        if (!id || !Number.isFinite(remaining) || remaining < 0) {
          return STATIC_RESULTS.invalidResponse;
        }

        while (true) {
          checkpoint = boundary();
          if (checkpoint) return checkpoint.kind === 'timeout'
            ? STATIC_RESULTS.timeout
            : STATIC_RESULTS.cancelled;

          var paused = await pause();
          checkpoint = boundary();
          if (checkpoint) return checkpoint.kind === 'timeout'
            ? STATIC_RESULTS.timeout
            : STATIC_RESULTS.cancelled;
          if (paused.kind === 'timeout') return STATIC_RESULTS.timeout;
          if (paused.kind === 'cancelled') return STATIC_RESULTS.cancelled;
          if (paused.kind === 'network') return STATIC_RESULTS.network;

          var statusOptions = requestSignal ? { signal: requestSignal } : undefined;
          var polled = await request(
            workerUrl + '/status?id=' + encodeURIComponent(id),
            statusOptions,
          );
          checkpoint = boundary();
          if (checkpoint) return checkpoint.kind === 'timeout'
            ? STATIC_RESULTS.timeout
            : STATIC_RESULTS.cancelled;
          if (polled.kind === 'timeout') return STATIC_RESULTS.timeout;
          if (polled.kind === 'cancelled') return STATIC_RESULTS.cancelled;
          if (polled.kind === 'network') return STATIC_RESULTS.network;
          if (!polled.response || typeof polled.response !== 'object') {
            return STATIC_RESULTS.invalidResponse;
          }
          if (polled.response.status === 429) return STATIC_RESULTS.limit;
          if (!polled.response.ok) return STATIC_RESULTS.generationError;

          var statusJson = await readJson(polled.response);
          checkpoint = boundary();
          if (checkpoint) return checkpoint.kind === 'timeout'
            ? STATIC_RESULTS.timeout
            : STATIC_RESULTS.cancelled;
          if (statusJson.kind === 'timeout') return STATIC_RESULTS.timeout;
          if (statusJson.kind === 'cancelled') return STATIC_RESULTS.cancelled;
          if (statusJson.kind !== 'data') return STATIC_RESULTS.invalidResponse;
          var statusData = statusJson.data;
          var status = statusData && typeof statusData.status === 'string'
            ? statusData.status.toLowerCase()
            : '';

          checkpoint = boundary();
          if (checkpoint) return checkpoint.kind === 'timeout'
            ? STATIC_RESULTS.timeout
            : STATIC_RESULTS.cancelled;
          if (status === 'done') {
            if (typeof statusData.image !== 'string' || !statusData.image.trim()) {
              return STATIC_RESULTS.invalidResponse;
            }
            return { kind: 'success', image: statusData.image, remaining: remaining };
          }
          if (TERMINAL_ERRORS.indexOf(status) > -1) return STATIC_RESULTS.generationError;
          if (PENDING_STATUSES.indexOf(status) < 0) return STATIC_RESULTS.invalidResponse;
        }
      } finally {
        if (timerCreated) clearTimer(deadlineTimer);
        if (
          externalSignal
          && externalAbortListener
          && typeof externalSignal.removeEventListener === 'function'
        ) externalSignal.removeEventListener('abort', externalAbortListener);
      }
    }

    return { run: run };
  }

  function validateControllerOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('TryOn.create options must be an object.');
    }
    var dialog = options.dialog;
    var documentRef = options.document || dialog && dialog.ownerDocument;
    var elements = options.elements;
    if (!dialog || typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') {
      throw new TypeError('TryOn.create requires a dialog element.');
    }
    if (!documentRef || typeof documentRef.createElement !== 'function') {
      throw new TypeError('TryOn.create requires a document.');
    }
    if (!elements || typeof elements !== 'object' || Array.isArray(elements)) {
      throw new TypeError('TryOn.create requires dialog elements.');
    }
    if (!Array.isArray(options.products)) {
      throw new TypeError('TryOn.create requires a products array.');
    }
    if (!options.core || typeof options.core.thumbUrl !== 'function') {
      throw new TypeError('TryOn.create requires core.thumbUrl(product).');
    }
    if (!options.actions || typeof options.actions.isTryOnEligible !== 'function') {
      throw new TypeError('TryOn.create requires actions.isTryOnEligible(product).');
    }
    if (!options.workerClient || typeof options.workerClient.run !== 'function') {
      throw new TypeError('TryOn.create requires workerClient.run(input).');
    }
    if (typeof options.readFile !== 'function') {
      throw new TypeError('TryOn.create requires readFile(file).');
    }
    if (typeof options.AbortController !== 'function') {
      throw new TypeError('TryOn.create requires an AbortController.');
    }
    if (
      !options.objectURL
      || typeof options.objectURL.create !== 'function'
      || typeof options.objectURL.revoke !== 'function'
    ) {
      throw new TypeError('TryOn.create requires objectURL.create(file) and objectURL.revoke(url).');
    }
    Object.keys(CONTROLLER_ELEMENT_IDS).forEach(function (key) {
      if (!elements[key]) {
        throw new TypeError(
          'TryOn.create requires dialog element #' + CONTROLLER_ELEMENT_IDS[key] + '.',
        );
      }
    });
    if (!Array.isArray(elements.sizeButtons) || elements.sizeButtons.length !== 5) {
      throw new TypeError('TryOn.create requires the five #tryon-sizes buttons.');
    }
    if (!Array.isArray(elements.categoryButtons) || !elements.categoryButtons.length) {
      throw new TypeError('TryOn.create requires #tryon-categories buttons.');
    }
  }

  function create(options) {
    validateControllerOptions(options);
    var dialog = options.dialog;
    var documentRef = options.document || dialog && dialog.ownerDocument;
    var elements = options.elements;
    var products = options.products;
    var core = options.core;
    var actions = options.actions;
    var workerClient = options.workerClient;
    var readFile = options.readFile;
    var AbortControllerClass = options.AbortController;
    var objectURL = options.objectURL;

    var eligibleProducts = filterEligibleProducts(products, actions.isTryOnEligible);
    var onSelectionChange = typeof options.onSelectionChange === 'function'
      ? options.onSelectionChange
      : function () {};
    var onRequestClose = typeof options.onRequestClose === 'function'
      ? options.onRequestClose
      : function () {};
    var storage = options.storage;
    var mannequin = '';
    if (storage && typeof storage.getItem === 'function') {
      try {
        var storedSize = normalizeCode(storage.getItem('kl_manequim'));
        if (['PP', 'P', 'M', 'G', 'GG'].indexOf(storedSize) > -1) mannequin = storedSize;
      } catch (error) {
        mannequin = '';
      }
    }
    var selectedCode = null;
    var query = '';
    var category = 'all';
    var page = 1;
    var visibleCount = 0;
    var selectedFile = null;
    var previewUrl = '';
    var objectUrls = new Set();
    var guard = createRequestGuard();
    var activeController = null;
    var phase = 'form';
    var ready = true;
    var listeners = [];
    var renderListeners = [];

    function productFor(code) {
      var normalized = normalizeCode(code);
      return eligibleProducts.find(function (product) {
        return normalizeCode(product && product.k) === normalized;
      }) || null;
    }

    function replaceChildren(element) {
      if (typeof element.replaceChildren === 'function') element.replaceChildren();
      else {
        while (element.firstChild) element.removeChild(element.firstChild);
      }
    }

    function listen(element, type, listener, bucket) {
      element.addEventListener(type, listener);
      (bucket || listeners).push({ element: element, type: type, listener: listener });
    }

    function removeListeners(bucket) {
      while (bucket.length) {
        var record = bucket.pop();
        record.element.removeEventListener(record.type, record.listener);
      }
    }

    function removeSource(element) {
      if (element && typeof element.removeAttribute === 'function') element.removeAttribute('src');
      else if (element) element.src = '';
    }

    function invalidateRequest() {
      guard.invalidate();
      if (
        activeController
        && activeController.signal
        && !activeController.signal.aborted
        && typeof activeController.abort === 'function'
      ) activeController.abort();
      activeController = null;
    }

    function revokeObjectUrl(url) {
      if (!url || !objectUrls.has(url)) return;
      objectUrls.delete(url);
      try { objectURL.revoke(url); } catch (error) { /* noop */ }
    }

    function revokeAllObjectUrls() {
      Array.from(objectUrls).forEach(revokeObjectUrl);
    }

    function clearPhoto() {
      selectedFile = null;
      elements.file.value = '';
      if (previewUrl) revokeObjectUrl(previewUrl);
      previewUrl = '';
      removeSource(elements.previewImage);
      elements.preview.hidden = true;
    }

    function clearResult() {
      removeSource(elements.resultImage);
      elements.remaining.textContent = '';
      elements.whatsapp.href = 'unidades.html';
    }

    function clearError() {
      elements.errorMessage.textContent = '';
      elements.errorWhatsapp.href = 'unidades.html';
    }

    function showPhase(nextPhase) {
      phase = nextPhase;
      ['form', 'loading', 'result', 'error'].forEach(function (name) {
        elements[name].hidden = name !== nextPhase;
      });
      renderControls();
    }

    function resetTransient(options) {
      options = options || {};
      invalidateRequest();
      if (options.photo !== false) clearPhoto();
      clearResult();
      clearError();
      showPhase('form');
    }

    function currentRequest(token) {
      return ready && dialog.open && guard.current(token);
    }

    function whatsappFor(product) {
      return resultWhatsAppHref(product, actions, actions.CONTACTS);
    }

    function showResult(result, product) {
      elements.resultImage.src = result.image;
      elements.remaining.textContent = result.remaining === 1
        ? 'Você ainda tem 1 Prova Virtual disponível.'
        : 'Você ainda tem ' + result.remaining + ' Provas Virtuais disponíveis.';
      elements.whatsapp.href = whatsappFor(product);
      showPhase('result');
    }

    function showError(kind, product) {
      elements.errorMessage.textContent = CONTROLLER_ERROR_MESSAGES[kind]
        || CONTROLLER_ERROR_MESSAGES['invalid-response'];
      elements.errorWhatsapp.href = whatsappFor(product);
      showPhase('error');
    }

    function setPressed(button, pressed) {
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    function renderControls() {
      elements.sizeButtons.forEach(function (button) {
        setPressed(button, normalizeCode(button.dataset && button.dataset.size) === mannequin);
      });
      elements.categoryButtons.forEach(function (button) {
        setPressed(button, String(button.dataset && button.dataset.category) === category);
      });
      elements.clearSelection.disabled = !selectedCode;
      elements.submit.disabled = !selectedCode || !selectedFile || phase === 'loading';
    }

    function renderCards() {
      removeListeners(renderListeners);
      replaceChildren(elements.dresses);
      var matching = filterProducts(eligibleProducts, {
        query: query,
        category: category,
        page: 1,
        batchSize: Number.MAX_SAFE_INTEGER,
      });
      var visible = matching.slice(0, page * DEFAULT_BATCH_SIZE);
      visibleCount = visible.length;
      visible.forEach(function (product) {
        var code = normalizeCode(product.k);
        var item = documentRef.createElement('div');
        item.setAttribute('role', 'listitem');
        var card = documentRef.createElement('button');
        card.type = 'button';
        card.setAttribute('type', 'button');
        card.setAttribute('data-code', code);
        card.setAttribute('aria-pressed', code === selectedCode ? 'true' : 'false');
        card.setAttribute('data-selected', code === selectedCode ? 'true' : 'false');
        card.className = 'tryon-dress-card';

        var image = documentRef.createElement('img');
        image.alt = (product.l || 'Vestido') + ' ' + code;
        var thumbnail = core.thumbUrl(product);
        if (thumbnail) image.src = thumbnail;
        var triedOriginal = false;
        var unavailable = false;
        var onImageError = function () {
          if (unavailable) return;
          if (!triedOriginal && product.u && String(product.u) !== String(image.src || '')) {
            triedOriginal = true;
            image.src = product.u;
            return;
          }
          unavailable = true;
          image.removeAttribute('src');
          card.classList.add('is-image-unavailable');
          image.removeEventListener('error', onImageError);
          renderListeners = renderListeners.filter(function (record) {
            return record.listener !== onImageError;
          });
        };
        listen(image, 'error', onImageError, renderListeners);
        card.appendChild(image);

        var copy = documentRef.createElement('span');
        copy.className = 'tryon-dress-copy';
        var codeText = documentRef.createElement('strong');
        codeText.className = 'tryon-dress-code';
        codeText.textContent = code;
        var caption = documentRef.createElement('span');
        caption.className = 'tryon-dress-caption';
        caption.textContent = product.co || product.l || 'Vestido';
        copy.appendChild(codeText);
        copy.appendChild(caption);
        var fit = fitFor(product, mannequin);
        if (fit) {
          var fitText = documentRef.createElement('span');
          fitText.className = 'tryon-dress-fit';
          fitText.setAttribute('data-fit', fit.kind);
          fitText.textContent = fit.label;
          copy.appendChild(fitText);
        }
        card.appendChild(copy);
        listen(card, 'click', function () {
          if (!ready || selectedCode === code) return;
          selectedCode = code;
          renderCards();
          onSelectionChange(code);
        }, renderListeners);
        item.appendChild(card);
        elements.dresses.appendChild(item);
      });
      elements.noResults.hidden = matching.length !== 0;
      elements.more.hidden = visible.length >= matching.length;
      renderControls();
    }

    function open(code) {
      if (!ready) return false;
      resetTransient();
      selectedCode = productFor(code) ? normalizeCode(code) : null;
      query = '';
      category = 'all';
      page = 1;
      elements.search.value = '';
      renderCards();
      if (!dialog.open) dialog.showModal();
      if (typeof elements.title.focus === 'function') elements.title.focus({ preventScroll: true });
      return true;
    }

    function update(code) {
      if (!ready) return false;
      var nextCode = productFor(code) ? normalizeCode(code) : null;
      if (nextCode !== selectedCode && phase !== 'form') resetTransient({ photo: false });
      selectedCode = nextCode;
      renderCards();
      return true;
    }

    function close() {
      if (!ready) return false;
      resetTransient();
      revokeAllObjectUrls();
      query = '';
      category = 'all';
      page = 1;
      selectedCode = null;
      elements.search.value = '';
      renderCards();
      if (dialog.open) dialog.close();
      return true;
    }

    function destroy() {
      if (!ready) return false;
      close();
      removeListeners(renderListeners);
      removeListeners(listeners);
      ready = false;
      return true;
    }

    function getSnapshot() {
      return {
        ready: ready,
        open: Boolean(dialog.open),
        selectedCode: selectedCode,
        mannequin: mannequin || null,
        category: category,
        page: page,
        visibleCount: visibleCount,
        hasPhoto: Boolean(selectedFile),
        phase: phase,
      };
    }

    async function submit() {
      var product = productFor(selectedCode);
      var file = selectedFile;
      if (!ready || !dialog.open || !product || !file) return false;

      invalidateRequest();
      var token = guard.token();
      var controller = new AbortControllerClass();
      activeController = controller;
      showPhase('loading');

      var imageBase64;
      try {
        imageBase64 = await readFile(file);
      } catch (error) {
        if (!currentRequest(token)) return false;
        activeController = null;
        showError('network', product);
        return false;
      }
      if (!currentRequest(token)) return false;

      var result;
      try {
        result = await workerClient.run({
          garmentUrl: product.u,
          imageBase64: imageBase64,
          isCurrent: function () { return currentRequest(token); },
          signal: controller.signal,
        });
      } catch (error) {
        result = STATIC_RESULTS.network;
      }
      if (!currentRequest(token)) return false;
      activeController = null;
      if (
        !result
        || typeof result !== 'object'
        || typeof result.kind !== 'string'
        || !result.kind
      ) {
        showError('invalid-response', product);
        return false;
      }
      if (result.kind === 'cancelled') {
        showPhase('form');
        return false;
      }
      if (result.kind === 'success') {
        if (typeof result.image !== 'string' || !result.image.trim()) {
          showError('invalid-response', product);
          return false;
        }
        showResult(result, product);
        return true;
      }
      showError(result.kind, product);
      return false;
    }

    listen(elements.search, 'input', function () {
      query = String(elements.search.value || '');
      page = 1;
      renderCards();
    });
    elements.categoryButtons.forEach(function (button) {
      listen(button, 'click', function () {
        category = String(button.dataset && button.dataset.category || 'all');
        page = 1;
        renderCards();
      });
    });
    elements.sizeButtons.forEach(function (button) {
      listen(button, 'click', function () {
        mannequin = normalizeCode(button.dataset && button.dataset.size);
        if (storage && typeof storage.setItem === 'function') {
          try { storage.setItem('kl_manequim', mannequin); } catch (error) { /* noop */ }
        }
        renderCards();
      });
    });
    [elements.clearSize, elements.unknownSize].forEach(function (button) {
      listen(button, 'click', function () {
        mannequin = '';
        if (storage && typeof storage.removeItem === 'function') {
          try { storage.removeItem('kl_manequim'); } catch (error) { /* noop */ }
        }
        renderCards();
      });
    });
    listen(elements.more, 'click', function () {
      page += 1;
      renderCards();
    });
    listen(elements.clearSelection, 'click', function () {
      if (!selectedCode) return;
      selectedCode = null;
      renderCards();
      onSelectionChange(null);
    });
    listen(elements.file, 'change', function () {
      resetTransient({ photo: false });
      if (previewUrl) revokeObjectUrl(previewUrl);
      previewUrl = '';
      selectedFile = elements.file.files && elements.file.files[0]
        ? elements.file.files[0]
        : null;
      if (selectedFile) {
        try {
          previewUrl = objectURL.create(selectedFile);
          objectUrls.add(previewUrl);
          elements.previewImage.src = previewUrl;
          elements.preview.hidden = false;
        } catch (error) {
          selectedFile = null;
          elements.file.value = '';
          removeSource(elements.previewImage);
          elements.preview.hidden = true;
        }
      } else {
        removeSource(elements.previewImage);
        elements.preview.hidden = true;
      }
      renderControls();
    });
    listen(elements.form, 'submit', function (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      submit();
    });
    [elements.again, elements.errorAgain].forEach(function (button) {
      listen(button, 'click', function () {
        resetTransient({ photo: false });
      });
    });
    listen(elements.closeButton, 'click', function () {
      onRequestClose();
    });
    listen(dialog, 'cancel', function (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      onRequestClose();
    });
    listen(dialog, 'click', function (event) {
      if (event && event.target === dialog) onRequestClose();
    });
    renderControls();

    return {
      open: open,
      update: update,
      close: close,
      destroy: destroy,
      isReady: function () { return ready; },
      getSnapshot: getSnapshot,
    };
  }

  return {
    DEFAULT_WORKER_URL: DEFAULT_WORKER_URL,
    filterEligibleProducts: filterEligibleProducts,
    filterProducts: filterProducts,
    fitFor: fitFor,
    createRequestGuard: createRequestGuard,
    createWorkerClient: createWorkerClient,
    resultWhatsAppHref: resultWhatsAppHref,
    shouldInterceptLink: shouldInterceptLink,
    create: create,
  };
}));
