(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.Gallery = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shouldInterceptProductLink(event, ready) {
    return Boolean(
      ready
      && event
      && !event.defaultPrevented
      && event.button === 0
      && !event.metaKey
      && !event.ctrlKey
      && !event.shiftKey
      && !event.altKey
    );
  }

  function closeAction(context) {
    return context && context.ownedHistoryEntry
      ? 'back'
      : 'replace-without-product';
  }

  function neighborIndexes(index, length) {
    var values = [];
    if (
      Number.isInteger(index)
      && Number.isInteger(length)
      && length > 0
      && index >= 0
      && index < length
    ) {
      if (index > 0) values.push(index - 1);
      if (index + 1 < length) values.push(index + 1);
    }
    return values;
  }

  function createRequestGuard() {
    var token = 0;
    var currentCode = '';
    return {
      next: function (code) {
        currentCode = String(code || '');
        token += 1;
        return token;
      },
      isCurrent: function (candidate, code) {
        return candidate === token && String(code || '') === currentCode;
      },
    };
  }

  function keyboardAction(key) {
    return ({ ArrowLeft: 'previous', ArrowRight: 'next', Escape: 'close' })[key] || null;
  }

  function focusReturnTarget(origin, materializedCard, title) {
    return [origin, materializedCard, title].find(function (element) {
      return element && element.isConnected;
    }) || null;
  }

  function createImageCoordinator(options) {
    if (!options || typeof options.load !== 'function' || typeof options.display !== 'function') {
      throw new TypeError('image coordinator options are incomplete');
    }
    var guard = createRequestGuard();
    var cache = new Map();

    function request(url) {
      if (!cache.has(url)) {
        try {
          cache.set(url, Promise.resolve(options.load(url)));
        } catch (error) {
          cache.set(url, Promise.reject(error));
        }
      }
      return cache.get(url);
    }

    function show(products, index) {
      var product = Array.isArray(products) ? products[index] : null;
      if (!product || !product.k || !product.u) return Promise.resolve(false);
      var token = guard.next(product.k);
      return request(product.u).then(function () {
        if (!guard.isCurrent(token, product.k)) return false;
        options.display(product);
        neighborIndexes(index, products.length).forEach(function (neighbor) {
          request(products[neighbor].u).catch(function () {});
        });
        return true;
      }).catch(function () {
        if (guard.isCurrent(token, product.k) && typeof options.fail === 'function') {
          options.fail(product);
        }
        return false;
      });
    }

    return { show: show };
  }

  function create(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('Gallery.create options must be an object.');
    }

    function noop() { return false; }
    var inert = {
      open: noop,
      update: noop,
      close: noop,
      destroy: noop,
      isReady: function () { return false; },
    };
    var dialog = options.dialog;
    var image = options.image;
    var products = options.products;
    var core = options.core;
    var actions = options.actions;
    var callbackNames = [
      'onNavigate', 'onRequestClose', 'onFavorite', 'isFavorite', 'onTrack',
    ];
    if (!dialog || !image || !Array.isArray(products) || !core || !actions
        || typeof dialog.querySelector !== 'function'
        || callbackNames.some(function (name) { return typeof options[name] !== 'function'; })) {
      return inert;
    }

    var media = image.parentNode;
    var title = dialog.querySelector('#gallery-title');
    var code = dialog.querySelector('#gallery-code');
    var unit = dialog.querySelector('#gallery-unit');
    var specs = dialog.querySelector('#gallery-specs');
    var favorite = dialog.querySelector('#gallery-favorite');
    var whatsapp = dialog.querySelector('#gallery-whatsapp');
    var tryOn = dialog.querySelector('#gallery-try-on');
    var previous = dialog.querySelector('.gallery-prev');
    var next = dialog.querySelector('.gallery-next');
    var closeButton = dialog.querySelector('.gallery-close');
    if (!media || !title || !code || !unit || !specs || !favorite || !whatsapp
        || !tryOn || !previous || !next || !closeButton
        || typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') {
      return inert;
    }

    var documentRef = dialog.ownerDocument;
    var activeIndex = -1;
    var activeCode = '';
    var pointerStart = null;
    var listeners = [];

    function listen(target, type, handler) {
      target.addEventListener(type, handler);
      listeners.push([target, type, handler]);
    }

    function loadImage(url) {
      return new Promise(function (resolve, reject) {
        var ImageConstructor = typeof globalThis !== 'undefined' && globalThis.Image;
        if (typeof ImageConstructor !== 'function') {
          reject(new Error('Image API unavailable'));
          return;
        }
        var preload = new ImageConstructor();
        preload.onload = function () { resolve(url); };
        preload.onerror = function () { reject(new Error('image load failed')); };
        preload.src = url;
      });
    }

    var coordinator = createImageCoordinator({
      load: loadImage,
      display: function (product) {
        media.classList.remove('is-image-error');
        image.src = product.u;
      },
      fail: function (product) {
        media.classList.add('is-image-error');
        image.removeAttribute('src');
        image.alt = 'Foto indisponível — peça ' + product.k;
      },
    });

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function spec(label, value) {
      if (!value) return;
      var wrapper = documentRef.createElement('div');
      var term = documentRef.createElement('dt');
      var detail = documentRef.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      wrapper.appendChild(term);
      wrapper.appendChild(detail);
      specs.appendChild(wrapper);
    }

    function productAt(index) {
      return index >= 0 && index < products.length ? products[index] : null;
    }

    function indexFor(productCode) {
      var normalized = String(productCode || '').trim().toUpperCase();
      return products.findIndex(function (product) {
        return String(product.k || '').trim().toUpperCase() === normalized;
      });
    }

    function syncProduct(product) {
      activeCode = product.k;
      title.textContent = product.l || 'Peça';
      code.textContent = product.k;
      unit.textContent = core.unitOf(product) === 'sf' ? 'São Francisco' : 'Barra da Tijuca';
      clear(specs);
      spec('Categoria', product.l);
      spec('Cor', product.co);
      spec('Tamanho', product.t);
      var saved = Boolean(options.isFavorite(product.k));
      favorite.dataset.favoriteCode = product.k;
      favorite.setAttribute('aria-pressed', saved ? 'true' : 'false');
      favorite.textContent = saved ? 'Peça salva' : 'Salvar peça';
      whatsapp.href = actions.productWhatsAppHref(product, actions.CONTACTS);
      var tryOnHref = actions.tryOnHref(product);
      tryOn.hidden = !tryOnHref;
      if (tryOnHref) tryOn.href = tryOnHref;
      else tryOn.removeAttribute('href');
      previous.disabled = activeIndex <= 0;
      next.disabled = activeIndex >= products.length - 1;
      media.classList.remove('is-image-error');
      var thumbnail = core.thumbUrl(product);
      if (thumbnail) image.src = thumbnail;
      else image.removeAttribute('src');
      image.alt = (product.l || 'Peça') + ' ' + product.k;
      coordinator.show(products, activeIndex);
    }

    function update(productCode) {
      var index = indexFor(productCode);
      if (index < 0) return false;
      activeIndex = index;
      syncProduct(products[index]);
      return true;
    }

    function navigate(offset) {
      var product = productAt(activeIndex + offset);
      if (!product) return false;
      options.onNavigate(product.k);
      return true;
    }

    function open(productCode) {
      if (!update(productCode)) return false;
      if (!dialog.open) dialog.showModal();
      if (typeof closeButton.focus === 'function') closeButton.focus();
      return true;
    }

    function close() {
      if (dialog.open) dialog.close();
      return true;
    }

    function requestClose(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      options.onRequestClose();
    }

    listen(closeButton, 'click', requestClose);
    listen(dialog, 'cancel', requestClose);
    listen(dialog, 'click', function (event) {
      if (event.target === dialog) requestClose(event);
    });
    listen(previous, 'click', function () { navigate(-1); });
    listen(next, 'click', function () { navigate(1); });
    listen(favorite, 'click', function () {
      if (!activeCode) return;
      options.onFavorite(activeCode);
      update(activeCode);
    });
    listen(dialog, 'keydown', function (event) {
      var action = keyboardAction(event.key);
      if (action === 'previous' || action === 'next') {
        event.preventDefault();
        navigate(action === 'previous' ? -1 : 1);
      }
    });
    listen(dialog, 'pointerdown', function (event) {
      if (event.pointerType && event.pointerType !== 'touch') return;
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    listen(dialog, 'pointerup', function (event) {
      if (!pointerStart || (event.pointerId != null && event.pointerId !== pointerStart.id)) return;
      var dx = event.clientX - pointerStart.x;
      var dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
      navigate(dx < 0 ? 1 : -1);
    });

    return {
      open: open,
      update: update,
      close: close,
      destroy: function () {
        listeners.forEach(function (record) {
          record[0].removeEventListener(record[1], record[2]);
        });
        listeners = [];
        close();
        return true;
      },
      isReady: function () { return true; },
    };
  }

  return {
    shouldInterceptProductLink: shouldInterceptProductLink,
    closeAction: closeAction,
    neighborIndexes: neighborIndexes,
    createRequestGuard: createRequestGuard,
    keyboardAction: keyboardAction,
    focusReturnTarget: focusReturnTarget,
    createImageCoordinator: createImageCoordinator,
    create: create,
  };
}));
