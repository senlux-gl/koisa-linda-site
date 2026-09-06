(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KLScheduleContext = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function resolveReference(value, occasion, products) {
    var code = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(code) || !Array.isArray(products)) return '';
    var category = { noiva: 'vestidos-noiva', debutante: 'vestidos-debutante' }[occasion];
    if (!category) return '';
    var product = products.find(function (item) {
      return item && item.k === code && item.c === category && (item.un === 'barra' || item.un === 'sf');
    });
    return product ? code : '';
  }
  function orderNotes(reference, comment) {
    var prefix = reference ? 'Referência do catálogo: ' + reference + '.\n' : '';
    return prefix + String(comment || '').trim().slice(0, Math.max(0, 400 - prefix.length));
  }
  return { resolveReference: resolveReference, orderNotes: orderNotes };
}));
