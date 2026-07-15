(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.Core = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UNIT_IDS = ['barra', 'sf'];
  var BATCH_SIZE = 12;
  var CATEGORY_ORDER = ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha', 'ternos', 'bolsas', 'calcados', 'acessorios'];

  function fold(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function unitOf(product) {
    return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
  }

  function validateProducts(raw) {
    var errors = [];
    var seen = new Set();
    if (!Array.isArray(raw)) return { ok: false, products: [], errors: [{ reason: 'not-array' }] };
    raw.forEach(function (product, index) {
      if (!product || typeof product !== 'object') {
        errors.push({ index: index, reason: 'not-object' });
        return;
      }
      ['c', 'l', 'k', 'un', 't', 'u'].forEach(function (field) {
        if (typeof product[field] !== 'string' || !product[field].trim()) {
          errors.push({ index: index, reason: 'missing-field', field: field });
        }
      });
      if (unitOf(product) === null) errors.push({ index: index, reason: 'invalid-unit' });
      var code = String(product.k || '').trim().toUpperCase();
      if (code && seen.has(code)) errors.push({ index: index, reason: 'duplicate-code', code: code });
      if (code) seen.add(code);
    });
    return { ok: errors.length === 0, products: errors.length ? [] : raw.slice(), errors: errors };
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });
  }

  function values(params, key) {
    return params.getAll(key).reduce(function (out, value) {
      return out.concat(String(value || '').split(','));
    }, []).map(function (value) {
      return value.trim();
    }).filter(Boolean);
  }

  function readState(search, products) {
    var params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
    var categories = new Set(products.map(function (p) { return p.c; }));
    var colors = new Set(products.map(function (p) { return p.co; }).filter(Boolean));
    var sizes = new Set(products.map(function (p) { return p.t; }).filter(Boolean));
    var codes = new Set(products.map(function (p) { return String(p.k).toUpperCase(); }));
    var rawCategory = params.get('cat');
    var rawUnit = params.get('un');
    var rawProduct = String(params.get('p') || '').toUpperCase();
    var rawPage = params.get('pg') || '1';
    var page = Number(rawPage);

    return {
      query: String(params.get('q') || '').trim().slice(0, 80),
      category: rawCategory && rawCategory !== 'all' && categories.has(rawCategory) ? rawCategory : null,
      unit: UNIT_IDS.indexOf(rawUnit) > -1 ? rawUnit : null,
      colors: uniqueSorted(values(params, 'co').filter(function (value) { return colors.has(value); })),
      sizes: uniqueSorted(values(params, 'tam').filter(function (value) { return sizes.has(value); })),
      page: /^\d+$/.test(rawPage) && Number.isInteger(page) && page >= 1 ? page : 1,
      openProduct: codes.has(rawProduct) ? rawProduct : null,
    };
  }

  function serializeState(state) {
    var params = new URLSearchParams();
    if (state.category) params.set('cat', state.category);
    if (state.unit) params.set('un', state.unit);
    if (state.query) params.set('q', state.query);
    uniqueSorted(state.colors || []).forEach(function (value) { params.append('co', value); });
    uniqueSorted(state.sizes || []).forEach(function (value) { params.append('tam', value); });
    if ((state.page || 1) > 1) params.set('pg', String(state.page));
    if (state.openProduct) params.set('p', String(state.openProduct).toUpperCase());
    return params.toString();
  }

  function matchesTerm(product, query) {
    if (!query) return true;
    var haystack = [product.k, product.c, product.l, product.co, product.t].map(fold).join(' ');
    return haystack.indexOf(fold(query)) > -1;
  }

  function filterProducts(products, state, omit) {
    omit = omit || '';
    return products.filter(function (product) {
      if (state.category && product.c !== state.category) return false;
      if (state.unit && unitOf(product) !== state.unit) return false;
      if (!matchesTerm(product, state.query)) return false;
      if (omit !== 'colors' && state.colors.length && (!product.co || state.colors.indexOf(product.co) < 0)) return false;
      if (omit !== 'sizes' && state.sizes.length && state.sizes.indexOf(product.t) < 0) return false;
      return true;
    });
  }

  function counts(products, key) {
    return products.reduce(function (out, product) {
      var value = key === 'unit' ? unitOf(product) : product[key];
      if (value) out[value] = (out[value] || 0) + 1;
      return out;
    }, {});
  }

  function reconcile(products, state) {
    var next = Object.assign({}, state, {
      colors: (state.colors || []).slice(),
      sizes: (state.sizes || []).slice(),
    });
    var base = filterProducts(products, Object.assign({}, next, { colors: [], sizes: [] }));
    var validColors = new Set(base.map(function (product) { return product.co; }).filter(Boolean));
    next.colors = next.colors.filter(function (value) { return validColors.has(value); });
    var validSizes = new Set(filterProducts(base, Object.assign({}, next, { sizes: [] }), 'sizes').map(function (product) {
      return product.t;
    }).filter(Boolean));
    next.sizes = next.sizes.filter(function (value) { return validSizes.has(value); });
    var compatibleColors = new Set(filterProducts(base, Object.assign({}, next, { colors: [] }), 'colors').map(function (product) {
      return product.co;
    }).filter(Boolean));
    next.colors = next.colors.filter(function (value) { return compatibleColors.has(value); });
    return next;
  }

  function interleave(products) {
    var buckets = new Map();
    products.forEach(function (product) {
      var key = product.c + '|' + unitOf(product);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(product);
    });
    var categories = CATEGORY_ORDER.slice();
    Array.from(new Set(products.map(function (product) { return product.c; }))).sort().forEach(function (category) {
      if (categories.indexOf(category) < 0) categories.push(category);
    });
    var nextUnit = {};
    var output = [];
    var remaining = true;
    while (remaining) {
      remaining = false;
      categories.forEach(function (category) {
        var preferred = nextUnit[category] === 'sf' ? ['sf', 'barra'] : ['barra', 'sf'];
        var used = preferred.find(function (unit) {
          var bucket = buckets.get(category + '|' + unit);
          return bucket && bucket.length;
        });
        if (!used) return;
        output.push(buckets.get(category + '|' + used).shift());
        nextUnit[category] = used === 'barra' ? 'sf' : 'barra';
        remaining = true;
      });
    }
    return output;
  }

  function resolveOpenProduct(products, state, batchSize) {
    var next = Object.assign({}, state);
    if (!next.openProduct) return next;
    var index = products.findIndex(function (product) {
      return String(product.k).toUpperCase() === next.openProduct;
    });
    if (index < 0) {
      next.openProduct = null;
      return next;
    }
    next.page = Math.max(next.page || 1, Math.ceil((index + 1) / (batchSize || BATCH_SIZE)));
    return next;
  }

  function derive(products, state) {
    var next = reconcile(products, state);
    var filtered = filterProducts(products, next);
    var ordered = interleave(filtered);
    next = resolveOpenProduct(ordered, next, BATCH_SIZE);
    return {
      state: next,
      products: ordered,
      visibleProducts: ordered.slice(0, next.page * BATCH_SIZE),
      facets: {
        colors: counts(filterProducts(products, next, 'colors'), 'co'),
        sizes: counts(filterProducts(products, next, 'sizes'), 't'),
      },
      categoryCounts: counts(products, 'c'),
      unitCounts: counts(products, 'unit'),
    };
  }

  function thumbUrl(product) {
    var raw = String(product && product.u || '');
    var parts = raw.split('?');
    if (!/\.jpg$/i.test(parts[0])) return '';
    return parts[0].replace(/\.jpg$/i, '-thumb.jpg') + (parts[1] ? '?' + parts.slice(1).join('?') : '');
  }

  function productDetailUrl(product) {
    return 'peca.html?codigo=' + encodeURIComponent(product.k);
  }

  function buildSearchTelemetry(term, products, resultCount, state) {
    var raw = String(term || '');
    var normalized = fold(raw);
    var product = products.find(function (item) { return normalized === fold(item.k); });
    return {
      query_length: raw.length,
      query_has_product_code: product ? 'yes' : 'no',
      product_code: product ? product.k : '',
      result_count: resultCount,
      catalog_category: state.category || '',
      catalog_unit: state.unit || '',
    };
  }

  return {
    BATCH_SIZE: BATCH_SIZE,
    CATEGORY_ORDER: CATEGORY_ORDER.slice(),
    UNIT_IDS: UNIT_IDS.slice(),
    buildSearchTelemetry: buildSearchTelemetry,
    derive: derive,
    filterProducts: filterProducts,
    interleave: interleave,
    productDetailUrl: productDetailUrl,
    readState: readState,
    resolveOpenProduct: resolveOpenProduct,
    serializeState: serializeState,
    thumbUrl: thumbUrl,
    unitOf: unitOf,
    validateProducts: validateProducts,
  };
}));
