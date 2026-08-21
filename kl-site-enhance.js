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

  // As duas ocasiões com hora marcada têm uma página própria de escolha de horário
  // (agendar.html, no ar em 21/08/2026). Nelas o sticky diz "Agende sua prova" e
  // agora leva de fato para a agenda, em vez de abrir o WhatsApp — eram dois
  // caminhos com o mesmo nome. Madrinha e terno seguem no WhatsApp de propósito:
  // são visita livre, não têm agenda, e madrinhas.html é o braço do teste de porta.
  var PAGINAS_COM_AGENDA = Object.freeze({
    noivas: 'noiva',
    debutantes: 'debutante',
  });

  function agendaHref(page, unit) {
    var href = 'agendar.html?ocasiao=' + PAGINAS_COM_AGENDA[page];
    // a loja que a cliente já trouxe no ?un= viaja junto e ela cai direto no calendário
    return unit === 'barra' || unit === 'sf' ? href + '&un=' + unit : href;
  }

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

  var UNIT_NAMES = Object.freeze({
    barra: 'Barra da Tijuca (Shopping Downtown)',
    sf: 'São Francisco (Niterói)',
  });
  var UNIT_SHORT = Object.freeze({ barra: 'Barra', sf: 'Niterói' });

  function whatsappHrefUnit(contact, page, unit) {
    var message = 'Olá! Vim pelo site da Koisa Linda e quero ajuda com ' + pageLabel(page) +
      ' na unidade ' + UNIT_NAMES[unit] + '.';
    return 'https://wa.me/' + contact + '?text=' + encodeURIComponent(message);
  }

  // Numa pagina de vertical a OCASIAO esta clara e a LOJA nao. Quem escolhe a loja e a
  // cliente (decisao 17/08/2026): antes daqui saia uma unidade fixa por campanha e uma
  // noiva de Niteroi caia no WhatsApp da Barra. A ocasiao continua no prefill.
  function resolveStickyTargets(context, contacts) {
    context = context || {};
    contacts = contacts || CONTACTS;
    var page = String(context.page || 'index').toLowerCase();
    if (PAGINAS_COM_AGENDA[page]) {
      return [{ href: agendaHref(page, context.unit), label: 'Escolher horário' }];
    }
    if (CAMPAIGN_UNITS[page]) {
      return ['sf', 'barra'].map(function (unit) {
        return {
          href: whatsappHrefUnit(contacts[unit], page, unit),
          label: UNIT_SHORT[unit],
          unit: unit,
        };
      });
    }
    return [resolveStickyCta(context, contacts)];
  }

  function resolveStickyCta(context, contacts) {
    context = context || {};
    contacts = contacts || CONTACTS;
    var page = String(context.page || 'index').toLowerCase();
    var unit = null;

    if (page === 'catalogo') {
      /* catálogo mantém a guarda: com dado quebrado NÃO se presume loja. */
      if (context.status !== 'error' && context.status !== 'data-error') {
        unit = context.unit === 'barra' || context.unit === 'sf' ? context.unit : null;
      }
    } else if (context.unit === 'barra' || context.unit === 'sf') {
      unit = context.unit;
    } else if (CAMPAIGN_UNITS[page]) {
      unit = CAMPAIGN_UNITS[page];
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
    /* ?un= vale em qualquer página, não só no catálogo: quem manda tráfego pago já
       sabe a loja, e sem isso madrinhas.html joga a cliente da Barra no WhatsApp
       de São Francisco (CAMPAIGN_UNITS.madrinhas = 'sf'). */
    var unit = queryValue(root, 'un');
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
    // unidades.html JA e o seletor de unidade: ali o sticky viraria um botao
    // "Escolher unidade" apontando para a propria pagina, cobrindo os CTAs dos cards.
    if (context.page === 'unidades') return;
    var box = document.createElement('div');
    box.className = 'kl-sticky-cta';
    var label = document.createElement('span');
    label.className = 'kl-sticky-text';
    label.textContent = 'Agende sua prova';
    var catalog = document.createElement('a');
    catalog.className = 'kl-sticky-cat';
    catalog.href = catalogLink(context.page);
    catalog.textContent = 'Ver catálogo';
    var destinations = [];
    var close = document.createElement('button');
    close.className = 'kl-sticky-x';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '×';

    function updateDestination(patch) {
      context = Object.assign({}, context, patch || {});
      var resolved = resolveStickyTargets(context, CONTACTS);
      // com duas lojas o "Ver catalogo" nao cabe na barra em 375px; e o rotulo
      // volta a aparecer no celular, senao ficam dois nomes de cidade sem contexto
      catalog.style.display = resolved.length > 1 ? 'none' : '';
      box.classList.toggle('kl-sticky-multi', resolved.length > 1);
      while (destinations.length > resolved.length) {
        var extra = destinations.pop();
        if (extra.parentNode) extra.parentNode.removeChild(extra);
      }
      resolved.forEach(function (target, index) {
        var anchor = destinations[index];
        if (!anchor) {
          anchor = document.createElement('a');
          anchor.className = 'kl-sticky-wa';
          destinations[index] = anchor;
          box.insertBefore(anchor, close);
        }
        anchor.href = target.href;
        anchor.textContent = target.label;
        if (/^https:\/\/wa\.me\//.test(target.href)) {
          anchor.target = '_blank';
          anchor.rel = 'noopener';
        } else {
          anchor.removeAttribute('target');
          anchor.removeAttribute('rel');
        }
      });
    }

    box.appendChild(label);
    box.appendChild(catalog);
    box.appendChild(close);
    updateDestination();
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
    resolveStickyTargets: resolveStickyTargets,
    init: init,
  };
}));
