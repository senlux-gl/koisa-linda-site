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

  function create(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('TryOn.create options must be an object.');
    }
    function noop() { return false; }
    return {
      open: noop,
      update: noop,
      close: noop,
      destroy: noop,
      isReady: function () { return false; },
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
