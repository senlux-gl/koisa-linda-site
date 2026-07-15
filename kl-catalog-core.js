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
    var rawPage = parseInt(params.get('pg') || '1', 10);

    return {
      query: String(params.get('q') || '').trim().slice(0, 80),
      category: rawCategory && rawCategory !== 'all' && categories.has(rawCategory) ? rawCategory : null,
      unit: UNIT_IDS.indexOf(rawUnit) > -1 ? rawUnit : null,
      colors: uniqueSorted(values(params, 'co').filter(function (value) { return colors.has(value); })),
      sizes: uniqueSorted(values(params, 'tam').filter(function (value) { return sizes.has(value); })),
      page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
      openProduct: codes.has(rawProduct) ? rawProduct : null,
    };
  }

  function serializeState(state) {
    var params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.category) params.set('cat', state.category);
    if (state.unit) params.set('un', state.unit);
    uniqueSorted(state.colors || []).forEach(function (value) { params.append('co', value); });
    uniqueSorted(state.sizes || []).forEach(function (value) { params.append('tam', value); });
    if (state.openProduct) params.set('p', String(state.openProduct).toUpperCase());
    if ((state.page || 1) > 1) params.set('pg', String(state.page));
    return params.toString();
  }

  return {
    BATCH_SIZE: BATCH_SIZE,
    UNIT_IDS: UNIT_IDS.slice(),
    readState: readState,
    serializeState: serializeState,
  };
}));
