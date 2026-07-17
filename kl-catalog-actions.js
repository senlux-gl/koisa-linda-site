(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.Actions = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CONTACTS = Object.freeze({
    barra: '5521966475383',
    sf: '5521970858787',
  });
  var FAVORITES_KEY = 'kl-favoritos-v1';
  var MAX_WHATSAPP_HREF_LENGTH = 1800;
  var TRY_ON_CATEGORIES = Object.freeze([
    'vestidos-noiva',
    'vestidos-madrinha',
    'vestidos-debutante',
  ]);

  function normalizeCode(value) {
    return String(value == null ? '' : value).trim().toUpperCase();
  }

  function unitOf(product) {
    return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
  }

  function isTryOnEligible(product) {
    return Boolean(product && TRY_ON_CATEGORIES.indexOf(product.c) > -1);
  }

  function tryOnHref(product) {
    var code = normalizeCode(product && product.k);
    return isTryOnEligible(product) && code
      ? 'catalogo.html?prova=1&p=' + encodeURIComponent(code)
      : null;
  }

  function productMessage(product) {
    return 'Olá! Tenho interesse na peça ' + normalizeCode(product && product.k)
      + '. Você consegue confirmar a disponibilidade e me ajudar a agendar uma prova?';
  }

  function whatsappHref(contact, message) {
    return 'https://wa.me/' + contact + '?text=' + encodeURIComponent(message);
  }

  function productWhatsAppHref(product, contacts) {
    contacts = contacts || CONTACTS;
    var unit = unitOf(product);
    return unit && contacts[unit]
      ? whatsappHref(contacts[unit], productMessage(product))
      : 'unidades.html';
  }

  function createFavorites(storage, products) {
    var productByCode = new Map();
    (Array.isArray(products) ? products : []).forEach(function (product) {
      var code = normalizeCode(product && product.k);
      if (code) productByCode.set(code, product);
    });

    var stored = [];
    try {
      var parsed = JSON.parse(storage && typeof storage.getItem === 'function'
        ? storage.getItem(FAVORITES_KEY) || '[]'
        : '[]');
      if (Array.isArray(parsed)) stored = parsed;
    } catch (error) {
      stored = [];
    }

    var selected = new Set();
    stored.forEach(function (value) {
      var code = normalizeCode(value);
      if (code) selected.add(code);
    });

    function codes() {
      return Array.from(selected).sort(function (left, right) {
        return left.localeCompare(right, 'pt-BR');
      });
    }

    function items() {
      return codes().map(function (code) {
        return productByCode.get(code);
      }).filter(Boolean);
    }

    function orphans() {
      return codes().filter(function (code) {
        return !productByCode.has(code);
      });
    }

    function has(code) {
      return selected.has(normalizeCode(code));
    }

    function persist() {
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(FAVORITES_KEY, JSON.stringify(codes()));
        }
      } catch (error) {
        // Storage is optional; the in-memory state remains authoritative for this session.
      }
    }

    function toggle(code) {
      var normalized = normalizeCode(code);
      if (!normalized) return false;
      if (selected.has(normalized)) selected.delete(normalized);
      else selected.add(normalized);
      persist();
      return selected.has(normalized);
    }

    function cleanupOrphans() {
      orphans().forEach(function (code) {
        selected.delete(code);
      });
      persist();
      return codes();
    }

    function clear() {
      selected.clear();
      try {
        if (storage && typeof storage.removeItem === 'function') {
          storage.removeItem(FAVORITES_KEY);
        } else if (storage && typeof storage.setItem === 'function') {
          storage.setItem(FAVORITES_KEY, '[]');
        }
      } catch (error) {
        // Clearing storage is best-effort; memory is already clear.
      }
    }

    function groups() {
      return items().reduce(function (grouped, product) {
        var unit = unitOf(product);
        if (unit) grouped[unit].push(product);
        return grouped;
      }, { barra: [], sf: [] });
    }

    return {
      cleanupOrphans: cleanupOrphans,
      clear: clear,
      codes: codes,
      groups: groups,
      has: has,
      items: items,
      orphans: orphans,
      toggle: toggle,
    };
  }

  function favoriteMessage(items) {
    return 'Olá! Separei estas peças no catálogo da Koisa Linda:\n'
      + items.map(function (product) {
        return '- ' + normalizeCode(product && product.k);
      }).join('\n')
      + '\nVocê consegue confirmar a disponibilidade e me ajudar a agendar uma prova?';
  }

  function buildFavoriteBatches(products, contacts, maxLength) {
    contacts = contacts || CONTACTS;
    var requestedLimit;
    try {
      requestedLimit = Number(maxLength);
    } catch (error) {
      requestedLimit = Number.NaN;
    }
    var limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_WHATSAPP_HREF_LENGTH)
      : MAX_WHATSAPP_HREF_LENGTH;
    var sorted = (Array.isArray(products) ? products : []).filter(function (product) {
      var unit = unitOf(product);
      return unit && contacts[unit];
    }).slice().sort(function (left, right) {
      return unitOf(left).localeCompare(unitOf(right), 'pt-BR')
        || normalizeCode(left.k).localeCompare(normalizeCode(right.k), 'pt-BR');
    });

    sorted.forEach(function (product) {
      var singleHref = whatsappHref(unitOf(product) && contacts[unitOf(product)], favoriteMessage([product]));
      if (singleHref.length > limit) {
        throw new RangeError('Uma peça excede o limite seguro do link de WhatsApp.');
      }
    });

    var pending = [];
    var batches = [];
    var currentUnit = null;

    function closeBatch() {
      if (!pending.length) return;
      batches.push({
        unit: currentUnit,
        items: pending.slice(),
        href: whatsappHref(contacts[currentUnit], favoriteMessage(pending)),
      });
      pending = [];
    }

    sorted.forEach(function (product) {
      var unit = unitOf(product);
      if (currentUnit && unit !== currentUnit) closeBatch();
      currentUnit = unit;
      var candidate = pending.concat(product);
      var candidateHref = whatsappHref(contacts[unit], favoriteMessage(candidate));
      if (pending.length && candidateHref.length > limit) {
        closeBatch();
        currentUnit = unit;
        pending = [product];
      } else {
        pending = candidate;
      }
    });
    closeBatch();

    var totals = batches.reduce(function (counts, batch) {
      counts[batch.unit] = (counts[batch.unit] || 0) + 1;
      return counts;
    }, {});
    var indexes = {};

    return batches.map(function (batch) {
      indexes[batch.unit] = (indexes[batch.unit] || 0) + 1;
      return {
        unit: batch.unit,
        index: indexes[batch.unit], // 1-based within each unit.
        total: totals[batch.unit],
        items: batch.items,
        href: batch.href,
      };
    });
  }

  function resolveSharedCta(context, contacts) {
    contacts = contacts || CONTACTS;
    if (!context || context.status === 'error') {
      return { href: 'unidades.html', label: 'Escolher unidade' };
    }
    var unit = context.product ? unitOf(context.product) : context.unit;
    if (!unit || !contacts[unit]) {
      return { href: 'unidades.html', label: 'Escolher unidade' };
    }
    return {
      href: whatsappHref(
        contacts[unit],
        context.product
          ? productMessage(context.product)
          : 'Olá! Vim pelo catálogo da Koisa Linda e quero ajuda para agendar uma prova.',
      ),
      label: 'WhatsApp',
    };
  }

  return {
    CONTACTS: CONTACTS,
    FAVORITES_KEY: FAVORITES_KEY,
    TRY_ON_CATEGORIES: TRY_ON_CATEGORIES,
    buildFavoriteBatches: buildFavoriteBatches,
    createFavorites: createFavorites,
    isTryOnEligible: isTryOnEligible,
    productMessage: productMessage,
    productWhatsAppHref: productWhatsAppHref,
    resolveSharedCta: resolveSharedCta,
    tryOnHref: tryOnHref,
    unitOf: unitOf,
    whatsappHref: whatsappHref,
  };
}));
