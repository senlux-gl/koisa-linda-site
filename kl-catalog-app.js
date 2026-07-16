(function (root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.App = api;
  }

  if (root && root.window === root && root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        api.init();
      }, { once: true });
    } else {
      api.init();
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var runtime = {
    initialized: false,
    phase: 'idle',
    productCount: 0,
    resultCount: 0,
    visibleCount: 0,
    hasMore: false,
    page: 1,
    pagingMode: 'none',
    validationErrors: 0,
  };
  var Core = null;
  var Actions = null;
  var Gallery = null;
  var products = [];
  var state = null;
  var currentDerived = null;
  var favorites = null;
  var gallery = null;
  var galleryProducts = [];
  var galleryOrigin = null;
  var galleryOriginCode = '';
  var historyController = null;
  var scrollLock = null;
  var pagingController = null;
  var filterRailController = null;
  var requestMoreHandler = null;
  var searchTimer = null;
  var filterAnnouncement = null;
  var activeFilterList = null;
  var pendingRestore = null;
  var firstGridMarked = false;
  var catalogLoadedTracked = false;
  var catalogErrorTracked = false;
  var galleryNavigateSource = '';
  var dom = null;

  function trackCatalog(name, context) {
    if (!root.KLTracking || typeof root.KLTracking.catalog !== 'function') return false;
    try {
      root.KLTracking.catalog(name, context || {});
      return true;
    } catch (error) {
      return false;
    }
  }

  function catalogContext(source, extra) {
    return Object.assign({
      category: state && state.category || null,
      unit: state && state.unit || null,
      resultCount: currentDerived ? currentDerived.products.length : 0,
      source: source,
    }, extra || {});
  }

  function markManual(node) {
    if (node && typeof node.setAttribute === 'function') {
      node.setAttribute('data-kl-track-manual', 'true');
    }
    return node;
  }

  function createLayerHistoryController(history, options) {
    options = options || {};
    if (!history || (typeof history !== 'object' && typeof history !== 'function')
        || !('state' in history) || typeof history.pushState !== 'function'
        || typeof history.replaceState !== 'function' || typeof history.back !== 'function') {
      throw new TypeError('history adapter is incomplete');
    }

    var layers = ['gallery', 'tryOn'];
    var origins = ['grid', 'menu', 'gallery'];
    var initialLayer = options.initialLayer == null ? null : options.initialLayer;
    if (initialLayer !== null && layers.indexOf(initialLayer) === -1) {
      throw new TypeError('layer must be gallery or tryOn');
    }

    function readState() {
      try {
        return history.state;
      } catch (error) {
        return null;
      }
    }

    function readMarker(historyState) {
      try {
        var marker = historyState && historyState.klCatalog;
        if (!marker || layers.indexOf(marker.layer) === -1
            || origins.indexOf(marker.origin) === -1) return null;
        return { layer: marker.layer, origin: marker.origin };
      } catch (error) {
        return null;
      }
    }

    function assertLayer(layer) {
      if (layers.indexOf(layer) === -1) {
        throw new TypeError('layer must be gallery or tryOn');
      }
    }

    function assertOrigin(origin) {
      if (origins.indexOf(origin) === -1) {
        throw new TypeError('origin must be grid, menu or gallery');
      }
    }

    function markerState(layer, origin) {
      var existing = readState();
      var next = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? Object.assign({}, existing) : {};
      next.klCatalog = { layer: layer, origin: origin };
      return next;
    }

    function cleanState() {
      var existing = readState();
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return existing;
      var next = Object.assign({}, existing);
      delete next.klCatalog;
      return next;
    }

    function sameMarker(left, right) {
      return Boolean(left && right && left.layer === right.layer && left.origin === right.origin);
    }

    var initialMarker = readMarker(readState());
    var currentLayer = initialLayer;
    var currentOrigin = initialMarker && initialMarker.layer === initialLayer
      ? initialMarker.origin : null;
    var ownedEntries = [];
    var ownedIndex = -1;
    var pendingBackIndex = null;

    return {
      openLayer: function (layer, url, origin) {
        assertLayer(layer);
        assertOrigin(origin);
        if (ownedIndex < 0) ownedEntries = [];
        else ownedEntries.splice(ownedIndex + 1);
        var marker = { layer: layer, origin: origin };
        history.pushState(markerState(layer, origin), '', url);
        ownedEntries.push(marker);
        ownedIndex = ownedEntries.length - 1;
        pendingBackIndex = null;
        currentLayer = layer;
        currentOrigin = origin;
      },
      replaceCurrent: function (url) {
        history.replaceState(readState(), '', url);
      },
      requestClose: function (layer, cleanUrl) {
        assertLayer(layer);
        var currentMarker = { layer: currentLayer, origin: currentOrigin };
        var owned = layer === currentLayer && ownedIndex >= 0
          && sameMarker(ownedEntries[ownedIndex], currentMarker);
        if (owned) {
          pendingBackIndex = ownedIndex - 1;
          history.back();
          return 'back';
        }
        history.replaceState(cleanState(), '', cleanUrl);
        currentLayer = null;
        currentOrigin = null;
        ownedIndex = -1;
        pendingBackIndex = null;
        return 'replace';
      },
      onPopState: function (historyState) {
        var marker = readMarker(historyState);
        currentLayer = marker ? marker.layer : null;
        currentOrigin = marker ? marker.origin : null;
        if (!marker) {
          ownedIndex = -1;
          pendingBackIndex = null;
          return;
        }

        if (pendingBackIndex !== null) {
          ownedIndex = pendingBackIndex >= 0
            && sameMarker(ownedEntries[pendingBackIndex], marker) ? pendingBackIndex : -1;
          pendingBackIndex = null;
          return;
        }

        var match = -1;
        for (var index = ownedEntries.length - 1; index >= 0; index -= 1) {
          if (sameMarker(ownedEntries[index], marker)) {
            match = index;
            break;
          }
        }
        ownedIndex = match;
      },
      currentLayer: function () {
        return currentLayer;
      },
      currentOrigin: function () {
        return currentOrigin;
      },
    };
  }

  function createDialogShell(options) {
    if (!options || !options.body || !options.body.classList
        || typeof options.body.classList.add !== 'function'
        || typeof options.body.classList.remove !== 'function'
        || !options.scrollLock || typeof options.scrollLock.lock !== 'function'
        || typeof options.scrollLock.unlock !== 'function') {
      throw new TypeError('dialog shell dependencies are incomplete');
    }
    var active = null;

    return {
      activate: function (name) {
        if (typeof name !== 'string' || !name.trim()) {
          throw new TypeError('dialog name is required');
        }
        if (active === name) return false;
        if (active === null) {
          options.body.classList.add('kl-dialog-open');
          options.scrollLock.lock();
        }
        active = name;
        return true;
      },
      clear: function (clearOptions) {
        if (active === null) return false;
        var restoreScroll = !clearOptions || clearOptions.restoreScroll !== false;
        active = null;
        options.body.classList.remove('kl-dialog-open');
        options.scrollLock.unlock({ restoreScroll: restoreScroll });
        return true;
      },
      current: function () {
        return active;
      },
    };
  }

  function classifyData(raw, validate, phase) {
    if (phase === 'loading') return 'loading';
    if (!Array.isArray(raw)) return 'data-error';
    if (typeof validate !== 'function') return 'data-error';
    var report;
    try {
      report = validate(raw);
    } catch (error) {
      return 'data-error';
    }
    if (!report || !report.ok) return 'data-error';
    return raw.length ? 'ready' : 'empty';
  }

  function finiteInteger(value, fallback, minimum) {
    var number;
    try {
      number = Number(value);
    } catch (error) {
      return fallback;
    }
    if (!Number.isFinite(number) || number < minimum) return fallback;
    return Math.floor(number);
  }

  function pageWindow(total, page, batchSize) {
    var safeTotal = finiteInteger(total, 0, 0);
    var safePage = finiteInteger(page, 1, 1);
    var safeBatch = finiteInteger(batchSize, 12, 1);
    var visible = Math.min(safeTotal, safePage * safeBatch);
    return { page: safePage, visible: visible, hasMore: visible < safeTotal };
  }

  function shouldShowFilterRail(entry, offset) {
    if (!entry || entry.isIntersecting || !entry.boundingClientRect) return false;
    var top = Number(entry.boundingClientRect.top);
    var threshold = Number(offset);
    return Number.isFinite(top) && Number.isFinite(threshold) && top <= threshold;
  }

  function createFilterRailController(options) {
    options = options || {};
    var rail = options.rail;
    var sentinel = options.sentinel;
    var observer = null;
    var offset = 71;

    if (options.header && typeof options.header.getBoundingClientRect === 'function') {
      try {
        var rect = options.header.getBoundingClientRect();
        var measured = Number(rect && rect.height);
        if (Number.isFinite(measured) && measured > 0) offset = measured;
      } catch (error) { /* fallback */ }
    }

    if (rail) rail.hidden = true;
    if (options.documentElement && options.documentElement.style
        && typeof options.documentElement.style.setProperty === 'function') {
      options.documentElement.style.setProperty('--catalog-header-offset', offset + 'px');
    }

    if (rail && sentinel && typeof options.observerFactory === 'function') {
      try {
        observer = options.observerFactory(function (entries) {
          Array.prototype.forEach.call(entries || [], function (entry) {
            if (entry && entry.target && entry.target !== sentinel) return;
            rail.hidden = !shouldShowFilterRail(entry, offset);
          });
        }, { rootMargin: '-' + offset + 'px 0px 0px 0px' });
        if (!observer || typeof observer.observe !== 'function') observer = null;
        else observer.observe(sentinel);
      } catch (error) {
        observer = null;
        rail.hidden = true;
      }
    }

    return {
      offset: offset,
      destroy: function () {
        if (observer && typeof observer.disconnect === 'function') observer.disconnect();
        observer = null;
      },
    };
  }

  function createPagingController(options) {
    if (!options || typeof options.onRequestMore !== 'function') {
      throw new TypeError('onRequestMore is required');
    }
    var observer = null;
    return {
      requestManual: function () {
        return options.onRequestMore('manual');
      },
      connect: function (sentinel) {
        if (typeof options.observerFactory !== 'function') return 'manual';
        observer = options.observerFactory(function (entries) {
          var intersects = Array.prototype.some.call(entries || [], function (entry) {
            return Boolean(entry && entry.isIntersecting);
          });
          if (intersects) options.onRequestMore('observer');
        });
        if (!observer || typeof observer.observe !== 'function') return 'manual';
        observer.observe(sentinel);
        return 'automatic';
      },
      destroy: function () {
        if (observer && typeof observer.disconnect === 'function') observer.disconnect();
        observer = null;
      },
    };
  }

  function createRequestMore(options) {
    if (!options || typeof options.commit !== 'function') {
      throw new TypeError('commit is required');
    }
    var readState = typeof options.getState === 'function'
      ? options.getState
      : typeof options.current === 'function' ? options.current : function () { return options.state; };
    var readTotal = typeof options.getTotal === 'function'
      ? options.getTotal
      : typeof options.total === 'function' ? options.total : function () { return options.total; };
    var batchSize = options.batchSize || options.batch || 12;

    return function (source) {
      var current = readState();
      if (!current) return false;
      var paging = pageWindow(readTotal(), current.page, batchSize);
      if (!paging.hasMore) return false;
      var next = Object.assign({}, current, {
        colors: (current.colors || []).slice(),
        sizes: (current.sizes || []).slice(),
        page: paging.page + 1,
      });
      options.commit(next, { source: source || 'manual', replaceHistory: true });
      return true;
    };
  }

  function createHistoryController(adapter, options) {
    options = options || {};
    if (!adapter || typeof adapter.getState !== 'function'
        || typeof adapter.pushState !== 'function'
        || typeof adapter.replaceState !== 'function'
        || typeof adapter.back !== 'function') {
      throw new TypeError('history adapter is incomplete');
    }
    var initialState = adapter.getState();
    var owned = !options.initialDeepLink && Boolean(
      initialState && initialState.klCatalog && initialState.klCatalog.gallery,
    );

    function markedState() {
      return Object.assign({}, adapter.getState() || {}, { klCatalog: { gallery: true } });
    }

    function cleanState() {
      var next = Object.assign({}, adapter.getState() || {});
      delete next.klCatalog;
      return next;
    }

    return {
      openFromGrid: function (url) {
        adapter.pushState(markedState(), '', url);
        owned = true;
      },
      replaceProduct: function (url) {
        adapter.replaceState(markedState(), '', url);
      },
      requestClose: function (cleanUrl) {
        var action = owned ? 'back' : 'replace';
        if (action === 'back') adapter.back();
        else adapter.replaceState(cleanState(), '', cleanUrl);
        owned = false;
        return action;
      },
      onPopState: function (nextState) {
        owned = Boolean(nextState && nextState.klCatalog && nextState.klCatalog.gallery);
      },
    };
  }

  function createPopStateHandler(options) {
    if (!options || !options.historyController
        || typeof options.readState !== 'function'
        || typeof options.derive !== 'function'
        || typeof options.render !== 'function'
        || typeof options.syncGallery !== 'function') {
      throw new TypeError('popstate options are incomplete');
    }
    return function (event) {
      options.historyController.onPopState(event && event.state);
      var derived = options.derive(options.readState());
      options.render(derived, { fromPopState: true });
      options.syncGallery(derived.state.openProduct || null);
      return derived;
    };
  }

  function createScrollLock(environment) {
    if (!environment || !environment.body || !environment.documentElement
        || !environment.window || typeof environment.getComputedStyle !== 'function') {
      throw new TypeError('scroll environment is incomplete');
    }
    var locked = false;
    var saved = null;
    var bodyKeys = ['position', 'top', 'left', 'right', 'width', 'paddingRight', 'overflow'];

    function bodySnapshot() {
      return bodyKeys.reduce(function (output, key) {
        output[key] = environment.body.style[key] || '';
        return output;
      }, {});
    }

    return {
      lock: function () {
        if (locked) return false;
        var y = Math.max(0, Number(environment.window.scrollY) || 0);
        var gap = Math.max(
          0,
          (Number(environment.window.innerWidth) || 0)
            - (Number(environment.documentElement.clientWidth) || 0),
        );
        var computed = environment.getComputedStyle(environment.body);
        var basePadding = parseFloat(computed && computed.paddingRight) || 0;
        saved = {
          y: y,
          body: bodySnapshot(),
          rootOverflow: environment.documentElement.style.overflow || '',
        };
        environment.body.style.position = 'fixed';
        environment.body.style.top = '-' + y + 'px';
        environment.body.style.left = '0';
        environment.body.style.right = '0';
        environment.body.style.width = '100%';
        environment.body.style.overflow = 'hidden';
        if (gap) environment.body.style.paddingRight = String(basePadding + gap) + 'px';
        environment.documentElement.style.overflow = 'hidden';
        locked = true;
        return true;
      },
      unlock: function (unlockOptions) {
        if (!locked) return false;
        bodyKeys.forEach(function (key) {
          environment.body.style[key] = saved.body[key];
        });
        environment.documentElement.style.overflow = saved.rootOverflow;
        var y = saved.y;
        saved = null;
        locked = false;
        if (!unlockOptions || unlockOptions.restoreScroll !== false) {
          environment.window.scrollTo(0, y);
        }
        return true;
      },
      isLocked: function () { return locked; },
    };
  }

  function gridImageFailurePolicy() {
    return { showPlaceholder: true, requestOriginal: false };
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function element(tagName, className, textValue) {
    var node = root.document.createElement(tagName);
    if (className) node.className = className;
    if (textValue != null) node.textContent = String(textValue);
    return node;
  }

  function collectDom() {
    return {
      app: root.document.getElementById('catalog-app'),
      activeFilters: root.document.getElementById('catalog-active-filters'),
      category: root.document.getElementById('catalog-category'),
      count: root.document.getElementById('catalog-count'),
      facets: root.document.getElementById('catalog-facets'),
      favoriteCount: root.document.getElementById('catalog-favorite-count'),
      filterPanel: root.document.getElementById('catalog-filters'),
      filterRail: root.document.getElementById('catalog-filter-rail'),
      filterRailAdjust: root.document.getElementById('catalog-adjust-filters'),
      filterRailCategory: root.document.getElementById('catalog-filter-rail-category'),
      filterRailCount: root.document.getElementById('catalog-filter-rail-count'),
      filterRailUnitButtons: Array.prototype.slice.call(
        root.document.querySelectorAll('#catalog-filter-rail-units [data-unit]'),
      ),
      filterSentinel: root.document.getElementById('catalog-filter-sentinel'),
      favoritesClose: root.document.querySelectorAll('[data-close-favorites]')[0] || null,
      favoritesContent: root.document.getElementById('favorites-content'),
      favoritesDialog: root.document.getElementById('catalog-favorites'),
      favoritesOpen: root.document.getElementById('catalog-open-favorites'),
      galleryDialog: root.document.getElementById('catalog-gallery'),
      galleryImage: root.document.getElementById('gallery-image'),
      grid: root.document.getElementById('catalog-grid'),
      header: root.document.querySelectorAll('header')[0] || null,
      loadMore: root.document.getElementById('catalog-load-more'),
      results: root.document.getElementById('catalog-results'),
      search: root.document.getElementById('catalog-search'),
      sentinel: root.document.getElementById('catalog-sentinel'),
      shortcuts: Array.prototype.slice.call(
        root.document.querySelectorAll('[data-shortcut-cat]'),
      ),
      status: root.document.getElementById('catalog-status'),
      title: root.document.getElementById('catalog-title'),
      unitButtons: Array.prototype.slice.call(
        root.document.querySelectorAll('#catalog-units [data-unit]'),
      ),
    };
  }

  function cloneState(source) {
    return Object.assign({}, source, {
      colors: (source && source.colors || []).slice(),
      sizes: (source && source.sizes || []).slice(),
    });
  }

  function urlFor(nextState) {
    var query = Core.serializeState(nextState);
    var pathname = root.location && root.location.pathname || 'catalogo.html';
    var hash = root.location && root.location.hash || '';
    return pathname + (query ? '?' + query : '') + hash;
  }

  function replaceCanonicalUrl() {
    if (!root.history || typeof root.history.replaceState !== 'function') return;
    root.history.replaceState(root.history.state, '', urlFor(state));
  }

  function locationQuery() {
    return String(root.location && root.location.search || '').replace(/^\?/, '');
  }

  function setPhase(phase) {
    runtime.phase = phase;
    if (dom && dom.results) {
      dom.results.setAttribute('aria-busy', phase === 'loading' ? 'true' : 'false');
    }
  }

  function updateFavoriteCount() {
    if (!dom || !dom.favoriteCount || !favorites) return;
    dom.favoriteCount.textContent = String(favorites.items().length);
  }

  function syncResultSummary(text) {
    var value = String(text == null ? '' : text);
    if (dom && dom.count) dom.count.textContent = value;
    if (dom && dom.filterRailCount) dom.filterRailCount.textContent = value;
    return value;
  }

  function syncFavoriteControls() {
    if (!favorites || !root.document || typeof root.document.querySelectorAll !== 'function') return;
    var controls = root.document.querySelectorAll('[data-favorite-code]');
    Array.prototype.forEach.call(controls, function (button) {
      var code = button.dataset && button.dataset.favoriteCode;
      var saved = favorites.has(code);
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      button.textContent = saved ? 'Peça salva' : 'Salvar peça';
    });
    updateFavoriteCount();
  }

  function toggleFavorite(code, source) {
    if (!favorites) return false;
    var saved = favorites.toggle(code);
    syncFavoriteControls();
    trackCatalog('KL_Favorite_Toggle', catalogContext(source || 'grid', {
      productCode: String(code || '').trim().toUpperCase(),
      favoriteCount: favorites.items().length,
    }));
    return saved;
  }

  function renderState(kind, title, message, retry) {
    clearNode(dom.status);
    clearNode(dom.grid);
    dom.loadMore.hidden = true;

    var wrapper = element('div', 'catalog-state catalog-state-' + kind);
    wrapper.appendChild(element('h2', '', title));
    wrapper.appendChild(element('p', '', message));

    var actions = element('div', 'catalog-state-actions');
    if (retry) {
      var button = markManual(element('button', '', 'Tentar novamente'));
      button.type = 'button';
      button.addEventListener('click', function () {
        if (root.location && typeof root.location.reload === 'function') {
          root.location.reload();
        }
      });
      actions.appendChild(button);
    }
    var units = markManual(element('a', '', 'Ver unidades'));
    units.href = 'unidades.html';
    actions.appendChild(units);
    wrapper.appendChild(actions);
    dom.grid.appendChild(wrapper);

    syncResultSummary(kind === 'data-error'
      ? 'Catálogo temporariamente indisponível'
      : 'Nenhuma peça disponível');
    setPhase(kind);
    runtime.resultCount = 0;
    runtime.visibleCount = 0;
    runtime.hasMore = false;
  }

  function aggregateDiagnostic(report) {
    var reasons = Object.create(null);
    var errors = report && Array.isArray(report.errors) ? report.errors : [];
    errors.forEach(function (error) {
      var reason = error && typeof error.reason === 'string' ? error.reason : 'unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return {
      errorCount: errors.length || 1,
      reasons: reasons,
    };
  }

  function renderDataError(report) {
    var diagnostic = aggregateDiagnostic(report);
    runtime.validationErrors = diagnostic.errorCount;
    if (root.console && typeof root.console.error === 'function') {
      root.console.error('[KLCatalog] validação da base falhou', diagnostic);
    }
    renderState(
      'data-error',
      'Não foi possível carregar o catálogo.',
      'Tente novamente ou escolha uma unidade para falar com a equipe.',
      true,
    );
    dispatchCatalogState('data-error');
    if (!catalogErrorTracked) {
      catalogErrorTracked = true;
      trackCatalog('KL_Catalog_Error', { source: 'data-source' });
    }
  }

  function createCard(product, index) {
    var article = element('article', 'catalog-card');
    article.dataset.code = product.k;
    article.dataset.index = String(index);

    var photo = element('a', 'catalog-card-photo');
    markManual(photo);
    photo.href = Core.productDetailUrl(product);
    photo.setAttribute('aria-label', 'Ver peça ' + product.k);

    var image = element('img');
    image.alt = (product.l || 'Peça') + ' ' + product.k;
    image.loading = 'lazy';
    image.decoding = 'async';
    var thumb = Core.thumbUrl(product);
    if (thumb) image.src = thumb;
    else article.classList.add('is-image-error');
    image.addEventListener('error', function () {
      var policy = gridImageFailurePolicy();
      image.removeAttribute('src');
      if (policy.showPlaceholder) article.classList.add('is-image-error');
    }, { once: true });
    photo.appendChild(image);

    var meta = element('div', 'catalog-card-meta');
    var titleLink = element('a', '', product.l || 'Peça');
    markManual(titleLink);
    titleLink.href = photo.href;
    var code = element('span');
    var unit = Core.unitOf(product);
    if (!unit) throw new TypeError('createCard requires a validated product');
    var unitLabels = { barra: 'Barra da Tijuca', sf: 'São Francisco' };
    code.textContent = product.k + ' · ' + unitLabels[unit];
    var favorite = element('button');
    markManual(favorite);
    favorite.type = 'button';
    favorite.dataset.favoriteCode = product.k;

    function syncFavorite() {
      var selected = favorites.has(product.k);
      favorite.setAttribute('aria-pressed', selected ? 'true' : 'false');
      favorite.textContent = selected ? 'Peça salva' : 'Salvar peça';
    }

    syncFavorite();
    favorite.addEventListener('click', function () {
      toggleFavorite(product.k, 'grid');
    });

    meta.appendChild(titleLink);
    meta.appendChild(code);
    meta.appendChild(favorite);
    article.appendChild(photo);
    article.appendChild(meta);
    return article;
  }

  function markFirstGrid() {
    if (firstGridMarked) return;
    firstGridMarked = true;
    if (root.performance && typeof root.performance.mark === 'function') {
      root.performance.mark('kl-catalog-first-grid');
    }
  }

  function syncShellState() {
    if (dom.category) dom.category.value = state.category || '';
    if (dom.search) dom.search.value = state.query || '';
    dom.unitButtons.concat(dom.filterRailUnitButtons).forEach(function (button) {
      var selected = (button.dataset.unit || null) === state.unit;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    if (dom.filterRailCategory) {
      var categoryLabel = 'Todas as categorias';
      if (state.category && dom.category) {
        var categoryOption = Array.prototype.find.call(
          dom.category.children || [],
          function (option) { return option.value === state.category; },
        );
        if (categoryOption) categoryLabel = categoryOption.textContent;
      }
      dom.filterRailCategory.textContent = categoryLabel;
    }
    dom.shortcuts.forEach(function (shortcut) {
      shortcut.setAttribute(
        'aria-pressed',
        shortcut.dataset.shortcutCat === state.category ? 'true' : 'false',
      );
    });
  }

  function ensureActiveFilterDom() {
    if (!dom.activeFilters || activeFilterList) return;
    activeFilterList = element('div', 'catalog-active-list');
    filterAnnouncement = element('p', 'catalog-filter-announcement');
    filterAnnouncement.setAttribute('role', 'status');
    filterAnnouncement.setAttribute('aria-live', 'polite');
    filterAnnouncement.setAttribute('aria-atomic', 'true');
    dom.activeFilters.appendChild(activeFilterList);
    dom.activeFilters.appendChild(filterAnnouncement);
  }

  function sortedFacetValues(counts) {
    return Object.keys(counts || {}).filter(function (value) {
      return counts[value] > 0;
    }).sort(function (left, right) {
      var leftNumber = /^\d+$/.test(left);
      var rightNumber = /^\d+$/.test(right);
      if (leftNumber && rightNumber) return Number(left) - Number(right);
      return left.localeCompare(right, 'pt-BR', { numeric: true });
    });
  }

  function toggleFacet(kind, value) {
    var key = kind === 'color' ? 'colors' : 'sizes';
    var values = (state[key] || []).slice();
    var index = values.indexOf(value);
    if (index > -1) values.splice(index, 1);
    else values.push(value);
    var patch = {};
    patch[key] = values;
    patchFilters(patch, kind);
  }

  function renderFacetGroup(label, kind, counts, selected) {
    var values = sortedFacetValues(counts);
    if (!values.length) return;
    var fieldset = element('fieldset', 'catalog-facet-group');
    fieldset.appendChild(element('legend', '', label));
    var options = element('div', 'catalog-facet-options');
    values.forEach(function (value) {
      var button = element('button', 'catalog-facet');
      markManual(button);
      button.type = 'button';
      button.dataset.facet = kind;
      button.dataset.value = value;
      button.setAttribute('aria-pressed', selected.indexOf(value) > -1 ? 'true' : 'false');
      button.appendChild(element('span', 'catalog-facet-value', value));
      button.appendChild(element('span', 'catalog-facet-count', counts[value]));
      button.addEventListener('click', function () { toggleFacet(kind, value); });
      options.appendChild(button);
    });
    fieldset.appendChild(options);
    dom.facets.appendChild(fieldset);
  }

  function renderFacets() {
    if (!dom.facets) return;
    clearNode(dom.facets);
    renderFacetGroup('Cor', 'color', currentDerived.facets.colors, state.colors);
    renderFacetGroup('Tamanho', 'size', currentDerived.facets.sizes, state.sizes);
  }

  function removeFilter(kind, value) {
    if (kind === 'query') return patchFilters({ query: '' }, 'chip');
    if (kind === 'category') return patchFilters({ category: null }, 'chip');
    if (kind === 'unit') return patchFilters({ unit: null }, 'chip');
    if (kind === 'color') return patchFilters({
      colors: state.colors.filter(function (item) { return item !== value; }),
    }, 'chip');
    if (kind === 'size') return patchFilters({
      sizes: state.sizes.filter(function (item) { return item !== value; }),
    }, 'chip');
    return false;
  }

  function appendChip(kind, value, label) {
    var button = element('button', 'catalog-chip', label);
    markManual(button);
    button.type = 'button';
    button.dataset.filter = kind;
    button.dataset.value = value || '';
    button.addEventListener('click', function () { removeFilter(kind, value); });
    activeFilterList.appendChild(button);
  }

  function renderActiveFilters() {
    ensureActiveFilterDom();
    if (!activeFilterList) return;
    clearNode(activeFilterList);
    if (state.query) appendChip('query', state.query, 'Busca: ' + state.query);
    if (state.category) appendChip('category', state.category, 'Categoria: ' + state.category);
    if (state.unit) appendChip('unit', state.unit, 'Unidade: ' + (state.unit === 'sf' ? 'São Francisco' : 'Barra'));
    state.colors.forEach(function (value) { appendChip('color', value, 'Cor: ' + value); });
    state.sizes.forEach(function (value) { appendChip('size', value, 'Tamanho: ' + value); });
    if (state.query || state.category || state.unit || state.colors.length || state.sizes.length) {
      var clear = element('button', 'catalog-clear-filters', 'Limpar refinamentos');
      markManual(clear);
      clear.type = 'button';
      clear.addEventListener('click', function () {
        patchFilters({ query: '', category: null, unit: null, colors: [], sizes: [] }, 'clear');
      });
      activeFilterList.appendChild(clear);
    }
  }

  function announceRemoved(requested, reconciled) {
    ensureActiveFilterDom();
    if (!filterAnnouncement) return;
    var removed = requested.colors.filter(function (value) {
      return reconciled.colors.indexOf(value) < 0;
    }).concat(requested.sizes.filter(function (value) {
      return reconciled.sizes.indexOf(value) < 0;
    }));
    if (!removed.length) return;
    var message = 'Refinamentos incompatíveis removidos: ' + removed.join(', ') + '.';
    if (filterAnnouncement.textContent !== message) filterAnnouncement.textContent = message;
  }

  function dispatchCatalogState(status) {
    var resolvedStatus = status || 'success';
    if ((resolvedStatus === 'success' && !currentDerived)
        || typeof root.dispatchEvent !== 'function'
        || typeof root.CustomEvent !== 'function') return;
    root.dispatchEvent(new root.CustomEvent('kl:catalog-state', {
      detail: {
        status: resolvedStatus,
        unit: state && state.unit || null,
        openProduct: state && state.openProduct || null,
        resultCount: currentDerived ? currentDerived.products.length : 0,
      },
    }));
  }

  function renderReady(options) {
    var append = Boolean(options && options.append);
    var paging = pageWindow(currentDerived.products.length, state.page, Core.BATCH_SIZE);
    var fragment = root.document.createDocumentFragment();

    clearNode(dom.status);
    syncShellState();
    renderFacets();
    renderActiveFilters();

    if (!currentDerived.products.length) {
      renderState(
        'no-results',
        'Nenhuma peça com estes refinamentos.',
        'Escolha outra categoria ou remova um filtro para continuar.',
        false,
      );
      syncResultSummary('0 peças');
      runtime.page = paging.page;
      return;
    }

    if (!append) clearNode(dom.grid);
    var start = append ? Math.min(runtime.visibleCount, paging.visible) : 0;
    currentDerived.products.slice(start, paging.visible).forEach(function (product, index) {
      fragment.appendChild(createCard(product, start + index));
    });
    dom.grid.appendChild(fragment);
    dom.loadMore.hidden = !paging.hasMore;
    syncResultSummary(paging.visible < currentDerived.products.length
      ? paging.visible + ' visíveis de ' + currentDerived.products.length + ' peças'
      : currentDerived.products.length + (currentDerived.products.length === 1 ? ' peça' : ' peças'));
    setPhase('ready');
    runtime.productCount = products.length;
    runtime.resultCount = currentDerived.products.length;
    runtime.visibleCount = paging.visible;
    runtime.hasMore = paging.hasMore;
    runtime.page = paging.page;
    updateFavoriteCount();
    markFirstGrid();
  }

  function renderDerived(options) {
    var derived = Core.derive(products, state);
    state = cloneState(derived.state);
    currentDerived = derived;
    galleryProducts.splice.apply(
      galleryProducts,
      [0, galleryProducts.length].concat(currentDerived.products),
    );
    if (Core.serializeState(state) !== locationQuery()) replaceCanonicalUrl();
    renderReady(options);
    dispatchCatalogState();
    restorePendingPosition();
    if (!catalogLoadedTracked && !(options && options.fromPopState)) {
      catalogLoadedTracked = true;
      trackCatalog('KL_Catalog_Loaded', catalogContext('bootstrap'));
      if (!currentDerived.products.length) {
        trackCatalog('KL_Catalog_Empty', catalogContext('filters'));
      }
    }
  }

  function commit(nextState, meta) {
    state = cloneState(nextState);
    if (!meta || meta.replaceHistory !== false) replaceCanonicalUrl();
    renderDerived({ append: Boolean(meta && (meta.source === 'observer' || meta.source === 'manual')) });
    if (meta && (meta.source === 'observer' || meta.source === 'manual')) {
      trackCatalog('KL_Catalog_Load_More', catalogContext(meta.source));
    }
  }

  function patchFilters(patch, source) {
    var previousCount = currentDerived ? currentDerived.products.length : 0;
    var requested = cloneState(Object.assign({}, state, patch || {}, {
      page: 1,
      openProduct: null,
    }));
    var reconciled = cloneState(Core.derive(products, requested).state);
    commit(reconciled, { source: 'filter', replaceHistory: true });
    announceRemoved(requested, reconciled);
    if (source) {
      trackCatalog('KL_Filter_Change', catalogContext(source));
    }
    if (previousCount > 0 && currentDerived && !currentDerived.products.length) {
      trackCatalog('KL_Catalog_Empty', catalogContext('filters'));
    }
    return true;
  }

  function requestMore(source) {
    if (!requestMoreHandler) return false;
    if (!requestMoreHandler(source)) return false;
    return true;
  }

  function setCategory(category, source) {
    var canonical = Core.CATEGORY_ORDER.indexOf(category) > -1 ? category : null;
    return patchFilters({ category: canonical }, source || 'category');
  }

  function setUnitFilter(rawUnit, source) {
    if (!state) return false;
    var canonical = Core.UNIT_IDS.indexOf(rawUnit) > -1 ? rawUnit : null;
    if (state.unit === canonical) return false;
    return patchFilters({ unit: canonical }, source || 'unit');
  }

  function trackSearch() {
    if (!state.query) return false;
    var telemetry = Core.buildSearchTelemetry(
      state.query,
      products,
      currentDerived.products.length,
      state,
    );
    trackCatalog('KL_Catalog_Search', {
      category: state.category,
      productCode: telemetry.product_code,
      queryHasProductCode: telemetry.query_has_product_code,
      queryLength: telemetry.query_length,
      resultCount: telemetry.result_count,
      source: 'catalog',
      unit: state.unit,
    });
    return true;
  }

  function connectFilterControls() {
    if (dom.category) {
      markManual(dom.category);
      dom.category.addEventListener('change', function () {
        setCategory(dom.category.value, 'category');
      });
    }
    dom.shortcuts.forEach(function (shortcut) {
      markManual(shortcut);
      shortcut.addEventListener('click', function () {
        setCategory(shortcut.dataset.shortcutCat || '', 'shortcut');
      });
    });
    dom.unitButtons.forEach(function (button) {
      markManual(button);
      button.addEventListener('click', function () {
        setUnitFilter(button.dataset.unit, 'unit');
      });
    });
    if (dom.search) {
      markManual(dom.search);
      dom.search.addEventListener('input', function () {
        if (searchTimer != null && typeof root.clearTimeout === 'function') {
          root.clearTimeout(searchTimer);
        }
        if (typeof root.setTimeout !== 'function') {
          patchFilters({ query: dom.search.value });
          trackSearch();
          return;
        }
        searchTimer = root.setTimeout(function () {
          searchTimer = null;
          patchFilters({ query: dom.search.value });
          trackSearch();
        }, 180);
      });
    }
  }

  function prefersReducedMotion() {
    if (typeof root.matchMedia !== 'function') return false;
    try {
      return Boolean(root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (error) {
      return false;
    }
  }

  function setupFilterRail() {
    if (!dom.filterRail) return false;
    var options = {
      rail: dom.filterRail,
      sentinel: dom.filterSentinel,
      header: dom.header,
      documentElement: root.document.documentElement,
    };
    if (typeof root.IntersectionObserver === 'function') {
      options.observerFactory = function (callback, observerOptions) {
        return new root.IntersectionObserver(callback, observerOptions);
      };
    }
    filterRailController = createFilterRailController(options);

    dom.filterRailUnitButtons.forEach(function (button) {
      markManual(button);
      button.addEventListener('click', function () {
        setUnitFilter(button.dataset.unit, 'filter-rail');
      });
    });
    if (dom.filterRailAdjust) {
      markManual(dom.filterRailAdjust);
      dom.filterRailAdjust.addEventListener('click', function () {
        if (dom.filterPanel && typeof dom.filterPanel.scrollIntoView === 'function') {
          dom.filterPanel.scrollIntoView({
            block: 'start',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
        }
        if (dom.category && typeof dom.category.focus === 'function') {
          dom.category.focus({ preventScroll: true });
        }
      });
    }
    return true;
  }

  function setupPaging() {
    requestMoreHandler = createRequestMore({
      getState: function () { return state; },
      getTotal: function () { return currentDerived ? currentDerived.products.length : 0; },
      batchSize: Core.BATCH_SIZE,
      commit: commit,
    });
    var options = { onRequestMore: requestMore };
    if (typeof root.IntersectionObserver === 'function') {
      options.observerFactory = function (callback) {
        return new root.IntersectionObserver(callback, { rootMargin: '320px 0px' });
      };
    }
    pagingController = createPagingController(options);
    markManual(dom.loadMore);
    dom.loadMore.addEventListener('click', function () {
      pagingController.requestManual();
    });
    runtime.pagingMode = pagingController.connect(dom.sentinel);
  }

  function sessionStorageSafe() {
    try {
      return root.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function restoreKey(sourceState) {
    var keyState = cloneState(sourceState);
    keyState.openProduct = null;
    var query = Core.serializeState(keyState);
    var pathname = root.location && root.location.pathname || 'catalogo.html';
    return 'kl:catalog-position:' + pathname + (query ? '?' + query : '');
  }

  function activeFocusCode() {
    var active = root.document && root.document.activeElement;
    while (active) {
      if (active.dataset && active.dataset.favoriteCode) return String(active.dataset.favoriteCode).trim().toUpperCase();
      if (active.dataset && active.dataset.code) return String(active.dataset.code).trim().toUpperCase();
      active = active.parentNode;
    }
    return '';
  }

  function savePosition() {
    var storage = sessionStorageSafe();
    if (!storage || !state) return;
    var y = Number(root.scrollY);
    if (!Number.isFinite(y)) y = 0;
    try {
      storage.setItem(restoreKey(state), JSON.stringify({
        y: y,
        focusCode: activeFocusCode(),
      }));
    } catch (error) {
      return;
    }
  }

  function readPendingRestore() {
    if (state.openProduct) return;
    var storage = sessionStorageSafe();
    if (!storage) return;
    var key = restoreKey(state);
    try {
      var value = storage.getItem(key);
      if (!value) return;
      var parsed = JSON.parse(value);
      if (!parsed || !Number.isFinite(Number(parsed.y))) return;
      pendingRestore = {
        key: key,
        storage: storage,
        y: Number(parsed.y),
        focusCode: String(parsed.focusCode || '').trim().toUpperCase(),
      };
    } catch (error) {
      pendingRestore = null;
    }
  }

  function allDescendants(node, output) {
    output = output || [];
    Array.prototype.forEach.call(node && node.children || [], function (child) {
      output.push(child);
      allDescendants(child, output);
    });
    return output;
  }

  function controlForCode(code) {
    var descendants = allDescendants(dom.grid, []);
    var favorite = descendants.find(function (node) {
      return node.dataset && String(node.dataset.favoriteCode || '').trim().toUpperCase() === code;
    });
    if (favorite) return favorite;
    var card = descendants.find(function (node) {
      return node.dataset && String(node.dataset.code || '').trim().toUpperCase() === code;
    });
    if (!card) return null;
    return allDescendants(card, []).find(function (node) {
      return node.tagName === 'A' || node.tagName === 'BUTTON';
    }) || null;
  }

  function focusCatalogTitle() {
    if (!dom.title || typeof dom.title.focus !== 'function') return;
    dom.title.setAttribute('tabindex', '-1');
    dom.title.addEventListener('blur', function () {
      dom.title.removeAttribute('tabindex');
    }, { once: true });
    dom.title.focus({ preventScroll: true });
  }

  function restorePendingPosition() {
    if (!pendingRestore || runtime.phase !== 'ready') return;
    var restore = pendingRestore;
    pendingRestore = null;
    try { restore.storage.removeItem(restore.key); } catch (error) { /* noop */ }
    if (typeof root.scrollTo === 'function') root.scrollTo(0, restore.y);
    var control = restore.focusCode ? controlForCode(restore.focusCode) : null;
    if (control && typeof control.focus === 'function') control.focus({ preventScroll: true });
    else focusCatalogTitle();
  }

  function galleryHistoryAdapter() {
    return {
      getState: function () { return root.history.state; },
      pushState: root.history.pushState.bind(root.history),
      replaceState: root.history.replaceState.bind(root.history),
      back: root.history.back.bind(root.history),
    };
  }

  function productForCode(code) {
    var normalized = String(code || '').trim().toUpperCase();
    return galleryProducts.find(function (product) {
      return String(product.k || '').trim().toUpperCase() === normalized;
    }) || null;
  }

  function materializedControl(code) {
    var card = allDescendants(dom.grid, []).find(function (node) {
      return node.dataset && String(node.dataset.code || '').trim().toUpperCase() === code;
    });
    if (!card) return null;
    return allDescendants(card, []).find(function (node) {
      return node.tagName === 'A';
    }) || null;
  }

  function restoreGalleryFocus() {
    if (!Gallery || typeof Gallery.focusReturnTarget !== 'function') return;
    var fallback = materializedControl(galleryOriginCode);
    var target = Gallery.focusReturnTarget(galleryOrigin, fallback, dom.title);
    galleryOrigin = null;
    galleryOriginCode = '';
    if (!target || typeof target.focus !== 'function') return;
    if (target === dom.title) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function syncGallery(code) {
    if (!gallery || !gallery.isReady()) return;
    if (code) {
      scrollLock.lock();
      gallery.open(code);
      return;
    }
    gallery.close();
    scrollLock.unlock();
    restoreGalleryFocus();
  }

  function openFromGrid(code, origin) {
    if (!gallery || !gallery.isReady() || !productForCode(code)) return false;
    galleryOrigin = origin || null;
    galleryOriginCode = String(code || '').trim().toUpperCase();
    var next = cloneState(Object.assign({}, state, { openProduct: galleryOriginCode }));
    historyController.openFromGrid(urlFor(next));
    state = next;
    scrollLock.lock();
    try {
      if (!gallery.open(galleryOriginCode)) throw new Error('gallery refused product');
    } catch (error) {
      scrollLock.unlock();
      historyController.requestClose(urlFor(Object.assign({}, state, { openProduct: null })));
      return false;
    }
    dispatchCatalogState();
    trackCatalog('KL_Product_Open', catalogContext('grid', {
      productCode: galleryOriginCode,
    }));
    return true;
  }

  function replaceGalleryProduct(code) {
    var product = productForCode(code);
    if (!product || !gallery || !gallery.isReady()) return false;
    var previousIndex = galleryProducts.findIndex(function (item) {
      return item.k === state.openProduct;
    });
    var nextIndex = galleryProducts.findIndex(function (item) {
      return item.k === product.k;
    });
    var navigationSource = galleryNavigateSource;
    galleryNavigateSource = '';
    if (navigationSource !== 'swipe' && navigationSource !== 'previous' && navigationSource !== 'next') {
      navigationSource = nextIndex < previousIndex ? 'previous' : 'next';
    }
    state = cloneState(Object.assign({}, state, { openProduct: product.k }));
    historyController.replaceProduct(urlFor(state));
    gallery.update(product.k);
    dispatchCatalogState();
    trackCatalog('KL_Product_Navigate', catalogContext(navigationSource, {
      productCode: product.k,
    }));
    return true;
  }

  function requestGalleryClose() {
    if (!historyController || !state) return false;
    var closingCode = String(state.openProduct || galleryOriginCode || '').trim().toUpperCase();
    if (!galleryOriginCode) galleryOriginCode = closingCode;
    var next = cloneState(Object.assign({}, state, { openProduct: null }));
    var action = historyController.requestClose(urlFor(next));
    if (action === 'replace') {
      state = next;
      if (currentDerived) currentDerived.state = state;
      gallery.close();
      scrollLock.unlock();
      restoreGalleryFocus();
      dispatchCatalogState();
    }
    return action;
  }

  function closestAnchor(node) {
    while (node && node !== dom.grid) {
      if (node.tagName === 'A') return node;
      node = node.parentNode;
    }
    return null;
  }

  function codeFromNode(node) {
    while (node && node !== dom.grid) {
      if (node.dataset && node.dataset.code) return node.dataset.code;
      node = node.parentNode;
    }
    return '';
  }

  function closeFavoritesDialog() {
    if (!dom.favoritesDialog || !dom.favoritesDialog.open) return false;
    dom.favoritesDialog.close();
    return true;
  }

  function favoriteItem(product) {
    var item = element('article', 'favorites-item');
    var image = element('img');
    image.alt = (product.l || 'Peça') + ' ' + product.k;
    image.loading = 'lazy';
    image.decoding = 'async';
    var thumbnail = Core.thumbUrl(product);
    if (thumbnail) image.src = thumbnail;
    image.addEventListener('error', function () {
      image.removeAttribute('src');
      item.classList.add('is-image-error');
    }, { once: true });
    var code = element('strong', '', product.k);
    var remove = element('button', '', 'Remover');
    markManual(remove);
    remove.type = 'button';
    remove.dataset.removeFavorite = product.k;
    remove.addEventListener('click', function () {
      toggleFavorite(product.k, 'favorites');
      renderFavorites('Peça ' + product.k + ' removida dos salvos.');
    });
    item.appendChild(image);
    item.appendChild(code);
    item.appendChild(remove);
    return item;
  }

  function favoriteGroup(unit, label, items) {
    var section = element('section', 'favorites-group');
    section.dataset.unit = unit;
    section.appendChild(element('h3', '', label));
    var list = element('div', 'favorites-list');
    items.forEach(function (product) { list.appendChild(favoriteItem(product)); });
    section.appendChild(list);

    var batches = Actions.buildFavoriteBatches(items, Actions.CONTACTS, 1800);
    if (batches.length) {
      var actions = element('div', 'favorites-batches');
      batches.forEach(function (batch) {
        var button = element(
          'button',
          'favorites-send',
          'Enviar lista ' + batch.index + ' de ' + batch.total + ' — ' + label,
        );
        markManual(button);
        button.type = 'button';
        button.addEventListener('click', function () {
          trackCatalog('KL_WhatsApp_Click', catalogContext('favorites', {
            favoriteCount: favorites.items().length,
            unit: unit,
          }));
          if (typeof root.open === 'function') root.open(batch.href, '_blank', 'noopener');
        });
        actions.appendChild(button);
      });
      section.appendChild(actions);
    }
    return section;
  }

  function renderFavorites(announcement) {
    if (!dom.favoritesContent || !favorites) return false;
    if (typeof dom.favoritesContent.replaceChildren === 'function') {
      dom.favoritesContent.replaceChildren();
    } else {
      clearNode(dom.favoritesContent);
    }
    var groups = favorites.groups();
    var validCount = groups.barra.length + groups.sf.length;

    if (!validCount) {
      var empty = element('div', 'favorites-empty');
      empty.appendChild(element('p', '', 'Você ainda não salvou nenhuma peça do catálogo.'));
      var back = element('a', '', 'Voltar ao catálogo');
      back.href = '#catalog-results';
      back.addEventListener('click', closeFavoritesDialog);
      empty.appendChild(back);
      dom.favoritesContent.appendChild(empty);
    }
    if (groups.barra.length) {
      dom.favoritesContent.appendChild(
        favoriteGroup('barra', 'Barra da Tijuca', groups.barra),
      );
    }
    if (groups.sf.length) {
      dom.favoritesContent.appendChild(
        favoriteGroup('sf', 'São Francisco', groups.sf),
      );
    }
    if (validCount) {
      dom.favoritesContent.appendChild(element(
        'p',
        'favorites-availability',
        'A disponibilidade será confirmada pela equipe de cada unidade.',
      ));
    }

    var orphans = favorites.orphans();
    if (orphans.length) {
      var legacy = element('section', 'favorites-legacy');
      legacy.appendChild(element(
        'p',
        '',
        orphans.length + (orphans.length === 1
          ? ' referência antiga não está mais no catálogo.'
          : ' referências antigas não estão mais no catálogo.'),
      ));
      var cleanup = element('button', '', 'Limpar referências antigas');
      cleanup.type = 'button';
      cleanup.addEventListener('click', function () {
        var removed = favorites.orphans().length;
        favorites.cleanupOrphans();
        syncFavoriteControls();
        renderFavorites(removed + (removed === 1
          ? ' referência antiga foi removida.'
          : ' referências antigas foram removidas.'));
      });
      legacy.appendChild(cleanup);
      dom.favoritesContent.appendChild(legacy);
    }

    var live = element('p', 'favorites-live', announcement || '');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    dom.favoritesContent.appendChild(live);
    return true;
  }

  function setupFavorites() {
    if (!dom.favoritesDialog || !dom.favoritesContent || !dom.favoritesOpen
        || !dom.favoritesClose || typeof dom.favoritesDialog.showModal !== 'function'
        || typeof dom.favoritesDialog.close !== 'function') return false;
    markManual(dom.favoritesOpen);
    dom.favoritesOpen.addEventListener('click', function () {
      renderFavorites();
      if (!dom.favoritesDialog.open) dom.favoritesDialog.showModal();
      trackCatalog('KL_Favorites_View', catalogContext('favorites', {
        favoriteCount: favorites.items().length,
      }));
    });
    dom.favoritesClose.addEventListener('click', closeFavoritesDialog);
    dom.favoritesDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeFavoritesDialog();
    });
    dom.favoritesDialog.addEventListener('click', function (event) {
      if (event.target === dom.favoritesDialog) closeFavoritesDialog();
    });
    dom.favoritesDialog.addEventListener('close', function () {
      if (dom.favoritesOpen && typeof dom.favoritesOpen.focus === 'function') {
        dom.favoritesOpen.focus({ preventScroll: true });
      }
    });
    return true;
  }

  function setupGallery() {
    if (!Gallery || typeof Gallery.create !== 'function' || !dom.galleryDialog || !dom.galleryImage
        || !root.history || typeof root.history.pushState !== 'function'
        || typeof root.history.back !== 'function' || typeof root.getComputedStyle !== 'function'
        || !root.document.body || !root.document.documentElement) return false;
    historyController = createHistoryController(
      galleryHistoryAdapter(),
      { initialDeepLink: Boolean(state.openProduct) },
    );
    scrollLock = createScrollLock({
      window: root,
      body: root.document.body,
      documentElement: root.document.documentElement,
      getComputedStyle: root.getComputedStyle.bind(root),
    });
    var galleryFavorite = dom.galleryDialog.querySelector('#gallery-favorite');
    var galleryWhatsapp = dom.galleryDialog.querySelector('#gallery-whatsapp');
    var galleryTryOn = dom.galleryDialog.querySelector('#gallery-try-on');
    var galleryPrevious = dom.galleryDialog.querySelector('.gallery-prev');
    var galleryNext = dom.galleryDialog.querySelector('.gallery-next');
    [galleryFavorite, galleryWhatsapp, galleryTryOn, galleryPrevious, galleryNext].forEach(markManual);
    if (galleryPrevious) galleryPrevious.addEventListener('click', function () {
      galleryNavigateSource = 'previous';
    }, true);
    if (galleryNext) galleryNext.addEventListener('click', function () {
      galleryNavigateSource = 'next';
    }, true);
    dom.galleryDialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') galleryNavigateSource = 'previous';
      if (event.key === 'ArrowRight') galleryNavigateSource = 'next';
    }, true);
    dom.galleryDialog.addEventListener('pointerup', function (event) {
      if (!event.pointerType || event.pointerType === 'touch') galleryNavigateSource = 'swipe';
    }, true);
    gallery = Gallery.create({
      dialog: dom.galleryDialog,
      image: dom.galleryImage,
      products: galleryProducts,
      core: Core,
      actions: Actions,
      onNavigate: replaceGalleryProduct,
      onRequestClose: requestGalleryClose,
      onFavorite: function (code) { toggleFavorite(code, 'gallery'); },
      isFavorite: function (code) { return favorites.has(code); },
      onTrack: function () {},
    });
    if (!gallery.isReady()) return false;
    if (galleryWhatsapp) galleryWhatsapp.addEventListener('click', function () {
      var product = productForCode(state.openProduct);
      if (!product) return;
      trackCatalog('KL_WhatsApp_Click', catalogContext('gallery', {
        productCode: product.k,
        favoriteCount: favorites.items().length,
        unit: Core.unitOf(product),
      }));
    });
    if (galleryTryOn) galleryTryOn.addEventListener('click', function () {
      var product = productForCode(state.openProduct);
      if (!product) return;
      trackCatalog('KL_Try_On_Click', catalogContext('gallery', {
        productCode: product.k,
      }));
    });
    dom.grid.addEventListener('click', function (event) {
      var anchor = closestAnchor(event.target);
      if (!anchor || !Gallery.shouldInterceptProductLink(event, gallery.isReady())) return;
      var code = codeFromNode(anchor);
      if (!productForCode(code)) return;
      event.preventDefault();
      openFromGrid(code, anchor);
    });
    if (state.openProduct) {
      scrollLock.lock();
      try {
        if (gallery.open(state.openProduct)) {
          trackCatalog('KL_Product_Open', catalogContext('deep-link', {
            productCode: state.openProduct,
          }));
        }
      }
      catch (error) { scrollLock.unlock(); }
    }
    return true;
  }

  function connectNavigationLifecycle() {
    if (typeof root.addEventListener !== 'function') return;
    var onPopState = historyController
      ? createPopStateHandler({
        historyController: historyController,
        readState: function () {
          return Core.readState(root.location && root.location.search || '', products);
        },
        derive: function (nextState) {
          state = cloneState(nextState);
          var derived = Core.derive(products, state);
          state = cloneState(derived.state);
          currentDerived = derived;
          galleryProducts.splice.apply(
            galleryProducts,
            [0, galleryProducts.length].concat(currentDerived.products),
          );
          return derived;
        },
        render: function (_derived, meta) {
          renderReady(meta);
          dispatchCatalogState();
          restorePendingPosition();
        },
        syncGallery: syncGallery,
      })
      : function () {
        if (searchTimer != null && typeof root.clearTimeout === 'function') root.clearTimeout(searchTimer);
        searchTimer = null;
        state = cloneState(Core.readState(root.location && root.location.search || '', products));
        renderDerived({ fromPopState: true });
      };
    root.addEventListener('popstate', onPopState);
    root.addEventListener('pagehide', function (event) {
      if (searchTimer != null && typeof root.clearTimeout === 'function') root.clearTimeout(searchTimer);
      searchTimer = null;
      savePosition();
      if (scrollLock) scrollLock.unlock({ restoreScroll: false });
      if ((!event || !event.persisted) && filterRailController) {
        filterRailController.destroy();
        filterRailController = null;
      }
    });
  }

  function init() {
    if (!root || !root.document) return getSnapshot();
    if (runtime.initialized) return getSnapshot();
    dom = collectDom();
    if (!dom.app || !dom.grid || !dom.results || !dom.status || !dom.count || !dom.loadMore) {
      return getSnapshot();
    }

    runtime.initialized = true;
    setPhase('loading');
    Core = root.KLCatalog && root.KLCatalog.Core;
    Actions = root.KLCatalog && root.KLCatalog.Actions;
    Gallery = root.KLCatalog && root.KLCatalog.Gallery;
    if (!Core || typeof Core.validateProducts !== 'function'
        || !Actions || typeof Actions.createFavorites !== 'function') {
      renderDataError({ errors: [{ reason: 'dependency-missing' }] });
      return getSnapshot();
    }

    var raw = root.KL_DATA;
    var report;
    try {
      report = Core.validateProducts(raw);
    } catch (error) {
      report = { ok: false, products: [], errors: [{ reason: 'validation-threw' }] };
    }
    var dataPhase = classifyData(raw, function () { return report; });
    if (dataPhase === 'data-error') {
      renderDataError(report);
      return getSnapshot();
    }

    products = report.products.slice();
    state = cloneState(Core.readState(root.location && root.location.search || '', products));
    var storage = null;
    try {
      storage = root.localStorage;
    } catch (error) {
      storage = null;
    }
    favorites = Actions.createFavorites(storage, products);
    runtime.productCount = products.length;
    updateFavoriteCount();

    if (dataPhase === 'empty') {
      renderState(
        'empty',
        'O catálogo está sendo preparado.',
        'Fale com uma de nossas unidades para conhecer as peças disponíveis.',
        false,
      );
      trackCatalog('KL_Catalog_Empty', { resultCount: 0, source: 'data' });
      return getSnapshot();
    }

    ensureActiveFilterDom();
    connectFilterControls();
    setupPaging();
    readPendingRestore();
    renderDerived();
    setupFilterRail();
    setupGallery();
    setupFavorites();
    connectNavigationLifecycle();
    return getSnapshot();
  }

  function getSnapshot() {
    return {
      initialized: Boolean(runtime.initialized),
      phase: runtime.phase,
      productCount: runtime.productCount,
      resultCount: runtime.resultCount,
      visibleCount: runtime.visibleCount,
      hasMore: Boolean(runtime.hasMore),
      page: runtime.page,
      pagingMode: runtime.pagingMode,
      validationErrors: runtime.validationErrors,
    };
  }

  return {
    classifyData: classifyData,
    createDialogShell: createDialogShell,
    createFilterRailController: createFilterRailController,
    createLayerHistoryController: createLayerHistoryController,
    pageWindow: pageWindow,
    createPagingController: createPagingController,
    createRequestMore: createRequestMore,
    createHistoryController: createHistoryController,
    createPopStateHandler: createPopStateHandler,
    createScrollLock: createScrollLock,
    gridImageFailurePolicy: gridImageFailurePolicy,
    init: init,
    getSnapshot: getSnapshot,
    shouldShowFilterRail: shouldShowFilterRail,
  };
}));
