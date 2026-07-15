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
  var products = [];
  var state = null;
  var favorites = null;
  var pagingController = null;
  var firstGridMarked = false;
  var dom = null;

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
      category: root.document.getElementById('catalog-category'),
      count: root.document.getElementById('catalog-count'),
      favoriteCount: root.document.getElementById('catalog-favorite-count'),
      grid: root.document.getElementById('catalog-grid'),
      loadMore: root.document.getElementById('catalog-load-more'),
      results: root.document.getElementById('catalog-results'),
      sentinel: root.document.getElementById('catalog-sentinel'),
      shortcuts: Array.prototype.slice.call(
        root.document.querySelectorAll('[data-shortcut-cat]'),
      ),
      status: root.document.getElementById('catalog-status'),
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

  function canonicalUrl(nextState) {
    var query = Core.serializeState(nextState);
    var pathname = root.location && root.location.pathname || 'catalogo.html';
    var hash = root.location && root.location.hash || '';
    return pathname + (query ? '?' + query : '') + hash;
  }

  function replaceCanonicalUrl() {
    if (!root.history || typeof root.history.replaceState !== 'function') return;
    root.history.replaceState(root.history.state || null, '', canonicalUrl(state));
  }

  function setPhase(phase) {
    runtime.phase = phase;
    if (dom && dom.results) {
      dom.results.setAttribute('aria-busy', phase === 'loading' ? 'true' : 'false');
    }
  }

  function updateFavoriteCount() {
    if (!dom || !dom.favoriteCount || !favorites) return;
    dom.favoriteCount.textContent = String(favorites.codes().length);
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
      var button = element('button', '', 'Tentar novamente');
      button.type = 'button';
      button.addEventListener('click', function () {
        if (root.location && typeof root.location.reload === 'function') {
          root.location.reload();
        }
      });
      actions.appendChild(button);
    }
    var units = element('a', '', 'Ver unidades');
    units.href = 'unidades.html';
    actions.appendChild(units);
    wrapper.appendChild(actions);
    dom.grid.appendChild(wrapper);

    dom.count.textContent = kind === 'data-error'
      ? 'Catálogo temporariamente indisponível'
      : 'Nenhuma peça disponível';
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
  }

  function createCard(product, index) {
    var article = element('article', 'catalog-card');
    article.dataset.code = product.k;
    article.dataset.index = String(index);

    var photo = element('a', 'catalog-card-photo');
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
    titleLink.href = photo.href;
    var code = element('span');
    var unit = Core.unitOf(product);
    if (!unit) throw new TypeError('createCard requires a validated product');
    var unitLabels = { barra: 'Barra da Tijuca', sf: 'São Francisco' };
    code.textContent = product.k + ' · ' + unitLabels[unit];
    var favorite = element('button');
    favorite.type = 'button';
    favorite.dataset.favoriteCode = product.k;

    function syncFavorite() {
      var selected = favorites.has(product.k);
      favorite.setAttribute('aria-pressed', selected ? 'true' : 'false');
      favorite.textContent = selected ? 'Peça salva' : 'Salvar peça';
    }

    syncFavorite();
    favorite.addEventListener('click', function () {
      favorites.toggle(product.k);
      syncFavorite();
      updateFavoriteCount();
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
    dom.unitButtons.forEach(function (button) {
      var selected = (button.dataset.unit || null) === state.unit;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function renderReady() {
    var derived = Core.derive(products, state);
    state = cloneState(derived.state);
    var paging = pageWindow(derived.products.length, state.page, Core.BATCH_SIZE);
    var fragment = root.document.createDocumentFragment();

    clearNode(dom.status);
    clearNode(dom.grid);
    syncShellState();

    if (!derived.products.length) {
      renderState(
        'no-results',
        'Nenhuma peça com estes refinamentos.',
        'Escolha outra categoria ou remova um filtro para continuar.',
        false,
      );
      runtime.page = paging.page;
      return;
    }

    derived.products.slice(0, paging.visible).forEach(function (product, index) {
      fragment.appendChild(createCard(product, index));
    });
    dom.grid.appendChild(fragment);
    dom.loadMore.hidden = !paging.hasMore;
    dom.count.textContent = paging.visible + ' de ' + derived.products.length + ' peças';
    setPhase('ready');
    runtime.productCount = products.length;
    runtime.resultCount = derived.products.length;
    runtime.visibleCount = paging.visible;
    runtime.hasMore = paging.hasMore;
    runtime.page = paging.page;
    updateFavoriteCount();
    markFirstGrid();
  }

  function requestMore(source) {
    if (runtime.phase !== 'ready') return false;
    var derived = Core.derive(products, state);
    var paging = pageWindow(derived.products.length, state.page, Core.BATCH_SIZE);
    if (!paging.hasMore) return false;
    state = cloneState(Object.assign({}, state, { page: state.page + 1 }));
    replaceCanonicalUrl();
    renderReady();
    return true;
  }

  function setCategory(category) {
    var canonical = Core.CATEGORY_ORDER.indexOf(category) > -1 ? category : null;
    state = cloneState(Object.assign({}, state, {
      category: canonical,
      page: 1,
      openProduct: null,
    }));
    replaceCanonicalUrl();
    renderReady();
  }

  function connectCategoryControls() {
    if (dom.category) {
      dom.category.addEventListener('change', function () {
        setCategory(dom.category.value);
      });
    }
    dom.shortcuts.forEach(function (shortcut) {
      shortcut.addEventListener('click', function () {
        setCategory(shortcut.dataset.shortcutCat || '');
      });
    });
  }

  function setupPaging() {
    var options = { onRequestMore: requestMore };
    if (typeof root.IntersectionObserver === 'function') {
      options.observerFactory = function (callback) {
        return new root.IntersectionObserver(callback, { rootMargin: '320px 0px' });
      };
    }
    pagingController = createPagingController(options);
    dom.loadMore.addEventListener('click', function () {
      pagingController.requestManual();
    });
    runtime.pagingMode = pagingController.connect(dom.sentinel);
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
      return getSnapshot();
    }

    connectCategoryControls();
    setupPaging();
    renderReady();
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
    pageWindow: pageWindow,
    createPagingController: createPagingController,
    gridImageFailurePolicy: gridImageFailurePolicy,
    init: init,
    getSnapshot: getSnapshot,
  };
}));
