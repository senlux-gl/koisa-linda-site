/* Koisa Linda — sticky CTA + lightweight helpers */
(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KLSiteEnhance = api;
  if (root && root.window === root && root.document) api.init(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CONTACTS = Object.freeze({
    barra: '5521966475383',
    sf: '5521970858787',
  });
  var CAMPAIGN_UNITS = Object.freeze({
    noivas: 'barra',
    debutantes: 'barra',
    madrinhas: 'sf',
    ternos: 'barra',
  });

  function unitOf(product) {
    return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
  }

  function pageLabel(page) {
    return {
      noivas: 'vestido de noiva',
      debutantes: 'vestido de debutante',
      madrinhas: 'vestido de madrinha/convidada',
      ternos: 'terno',
      peca: 'uma peça do catálogo',
      provar: 'uma peça do catálogo',
      catalogo: 'peças do catálogo',
    }[page] || 'um atendimento';
  }

  function whatsappHref(contact, page) {
    var message = 'Olá! Vim pelo site da Koisa Linda e quero ajuda com ' + pageLabel(page) + '.';
    return 'https://wa.me/' + contact + '?text=' + encodeURIComponent(message);
  }

  function resolveStickyCta(context, contacts) {
    context = context || {};
    contacts = contacts || CONTACTS;
    var page = String(context.page || 'index').toLowerCase();
    var unit = null;

    if (CAMPAIGN_UNITS[page]) {
      unit = CAMPAIGN_UNITS[page];
    } else if (page === 'catalogo') {
      if (context.status !== 'error' && context.status !== 'data-error') {
        unit = context.unit === 'barra' || context.unit === 'sf' ? context.unit : null;
      }
    } else if (page === 'peca' || page === 'provar') {
      unit = unitOf(context.product);
    }

    if (!unit || !contacts[unit]) {
      return { href: 'unidades.html', label: 'Escolher unidade' };
    }
    return {
      href: whatsappHref(contacts[unit], page),
      label: 'WhatsApp',
      unit: unit,
    };
  }

  function pageKind(location) {
    var pathname = location && location.pathname || '';
    var filename = pathname.split('/').pop() || 'index.html';
    return filename.toLowerCase().replace(/\.html$/, '') || 'index';
  }

  function catalogLink(page) {
    if (page === 'noivas') return 'catalogo.html?cat=vestidos-noiva';
    if (page === 'debutantes') return 'catalogo.html?cat=vestidos-debutante';
    if (page === 'madrinhas') return 'catalogo.html?cat=vestidos-madrinha';
    if (page === 'ternos') return 'catalogo.html?cat=ternos';
    return 'catalogo.html';
  }

  function queryValue(root, name) {
    try {
      return new root.URLSearchParams(root.location.search || '').get(name) || '';
    } catch (error) {
      return '';
    }
  }

  function productFromRuntime(root, page) {
    if (page !== 'peca' && page !== 'provar') return null;
    var namespace = root.KLCatalog || {};
    var core = namespace.Core;
    if (!core || typeof core.validateProducts !== 'function' || !Array.isArray(root.KL_DATA)) return null;
    var report;
    try { report = core.validateProducts(root.KL_DATA); }
    catch (error) { return null; }
    if (!report || !report.ok || !Array.isArray(report.products)) return null;
    var code = page === 'peca'
      ? (queryValue(root, 'codigo') || queryValue(root, 'p'))
      : queryValue(root, 'p');
    code = code.trim().toUpperCase();
    if (!code) return null;
    return report.products.find(function (product) {
      return String(product.k || '').trim().toUpperCase() === code;
    }) || null;
  }

  function initialContext(root) {
    var page = pageKind(root.location);
    var unit = page === 'catalogo' ? queryValue(root, 'un') : null;
    return {
      page: page,
      unit: unit === 'barra' || unit === 'sf' ? unit : null,
      product: productFromRuntime(root, page),
    };
  }

  function storageGet(root, key) {
    try { return root.sessionStorage && root.sessionStorage.getItem(key); }
    catch (error) { return null; }
  }

  function storageSet(root, key, value) {
    try {
      if (root.sessionStorage) root.sessionStorage.setItem(key, value);
    } catch (error) {
      // Closing the helper remains useful even when storage is unavailable.
    }
  }

  function mount(root) {
    if (storageGet(root, 'klStickyClosed') === '1') return;
    var document = root.document;
    var context = initialContext(root);
    var box = document.createElement('div');
    box.className = 'kl-sticky-cta';
    var label = document.createElement('span');
    label.className = 'kl-sticky-text';
    label.textContent = 'Agende sua prova';
    var catalog = document.createElement('a');
    catalog.className = 'kl-sticky-cat';
    catalog.href = catalogLink(context.page);
    catalog.textContent = 'Ver catálogo';
    var destination = document.createElement('a');
    destination.className = 'kl-sticky-wa';
    var close = document.createElement('button');
    close.className = 'kl-sticky-x';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '×';

    function updateDestination(patch) {
      context = Object.assign({}, context, patch || {});
      var resolved = resolveStickyCta(context, CONTACTS);
      destination.href = resolved.href;
      destination.textContent = resolved.label;
      if (/^https:\/\/wa\.me\//.test(resolved.href)) {
        destination.target = '_blank';
        destination.rel = 'noopener';
      } else {
        destination.removeAttribute('target');
        destination.removeAttribute('rel');
      }
    }

    updateDestination();
    box.appendChild(label);
    box.appendChild(catalog);
    box.appendChild(destination);
    box.appendChild(close);
    document.body.appendChild(box);

    var shown = false;
    function updateVisibility() {
      var y = root.scrollY || 0;
      if (!shown && y > 140) {
        box.classList.add('is-on');
        shown = true;
      }
    }
    root.addEventListener('scroll', updateVisibility, { passive: true });
    root.setTimeout(function () {
      box.classList.add('is-on');
      shown = true;
    }, 1400);
    close.onclick = function () {
      box.classList.remove('is-on');
      storageSet(root, 'klStickyClosed', '1');
    };
    box.addEventListener('click', function (event) {
      var target = event.target;
      var anchor = target && typeof target.closest === 'function' ? target.closest('a') : null;
      if (!anchor) return;
      try {
        if (typeof root.fbq === 'function') {
          root.fbq('trackCustom', 'KL_Sticky_CTA_Click', {
            cta_label: (anchor.textContent || '').trim(),
            page_path: root.location.pathname,
          });
        }
      } catch (error) {
        // Tracking must never block navigation.
      }
    });
    document.addEventListener('kl:catalog-state', function (event) {
      if (context.page !== 'catalogo') return;
      var detail = event.detail || {};
      updateDestination({ unit: detail.unit, status: detail.status });
    });
  }

  function init(root) {
    if (!root || !root.document || root.__KL_SITE_ENHANCE__) return;
    root.__KL_SITE_ENHANCE__ = true;
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () { mount(root); }, { once: true });
    } else {
      mount(root);
    }
  }

  return {
    CONTACTS: CONTACTS,
    initialContext: initialContext,
    resolveStickyCta: resolveStickyCta,
    init: init,
  };
}));
