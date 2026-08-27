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

  function scheduleOccasionFromCategory(category) {
    category = String(category || '').toLowerCase();
    if (category === 'vestidos-noiva') return 'noiva';
    if (category === 'vestidos-debutante') return 'debutante';
    return '';
  }

  function scheduleHrefFromOccasion(occasion, unit, source, product) {
    var href = 'agendar.html?ocasiao=' + encodeURIComponent(occasion) + '&ab=auto';
    if (unit === 'barra' || unit === 'sf') href += '&un=' + unit;
    if (source) href += '&utm_content=' + encodeURIComponent(source);
    if (product && product.k) href += '&modelo=' + encodeURIComponent(String(product.k).trim().slice(0, 24));
    return href;
  }

  // Páginas de visita livre: existem no CAMPAIGN_UNITS (o WhatsApp continua sendo
  // o destino), mas o convite é outro.
  var VISITA_LIVRE = Object.freeze({ madrinhas: true, ternos: true });

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
    if (page === 'index' || page === 'home') {
      return [{
        href: 'agendar.html?ab=auto&utm_content=home_sticky_schedule',
        label: 'Ver horários',
        kind: 'schedule',
      }];
    }
    if (PAGINAS_COM_AGENDA[page]) {
      return [{ href: agendaHref(page, context.unit), label: 'Escolher horário' }];
    }
    if (page === 'catalogo') {
      var occasion = scheduleOccasionFromCategory(context.category);
      if (occasion) {
        return [{
          href: scheduleHrefFromOccasion(occasion, context.unit, 'catalog_sticky_' + occasion, context.openProduct),
          label: context.unit === 'barra' || context.unit === 'sf' ? 'Ver horários' : 'Agendar prova',
          kind: 'schedule',
        }];
      }
    }
    if (page === 'peca' || page === 'provar') {
      var productOccasion = scheduleOccasionFromCategory(context.product && context.product.c);
      var productUnit = context.unit || unitOf(context.product);
      if (productOccasion) {
        return [{
          href: scheduleHrefFromOccasion(productOccasion, productUnit, page + '_sticky_' + productOccasion, context.product),
          label: productUnit ? 'Ver horários' : 'Agendar prova',
          kind: 'schedule',
        }];
      }
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
    var category = queryValue(root, 'cat');
    return {
      page: page,
      unit: unit === 'barra' || unit === 'sf' ? unit : null,
      category: category || null,
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

  var LARA_WEB_TOPICS = Object.freeze([
    {
      id: 'noiva',
      label: 'Sou noiva',
      answer: 'Para noiva, a prova é com hora marcada. A equipe separa os modelos antes de você chegar e o provador fica reservado para você.',
      primary: { label: 'Ver horários', href: 'agendar.html?ocasiao=noiva&ab=auto&utm_content=lara_web_noiva' },
      secondary: { label: 'Ver vestidos de noiva', href: 'catalogo.html?cat=vestidos-noiva&utm_content=lara_web_noiva' },
    },
    {
      id: 'debutante',
      label: 'Sou debutante',
      answer: 'Para debutante, também é melhor vir com hora marcada. Assim a consultora prepara a prova para vestidos de valsa, recepção e fotos.',
      primary: { label: 'Ver horários', href: 'agendar.html?ocasiao=debutante&ab=auto&utm_content=lara_web_debutante' },
      secondary: { label: 'Ver debutantes', href: 'catalogo.html?cat=vestidos-debutante&utm_content=lara_web_debutante' },
    },
    {
      id: 'festa',
      label: 'Madrinha ou festa',
      answer: 'Para madrinha, convidada, formanda e festa não precisa agendar. Você pode ver modelos no catálogo e passar na unidade dentro do horário de funcionamento.',
      primary: { label: 'Ver vestidos de festa', href: 'catalogo.html?cat=vestidos-madrinha&utm_content=lara_web_festa' },
      secondary: { label: 'Ver unidades', href: 'unidades.html?utm_content=lara_web_festa' },
    },
    {
      id: 'terno',
      label: 'Preciso de terno',
      answer: 'Para terno também é visita livre. Veja os modelos e escolha a unidade mais prática para provar dentro do horário de atendimento.',
      primary: { label: 'Ver ternos', href: 'catalogo.html?cat=ternos&utm_content=lara_web_terno' },
      secondary: { label: 'Ver unidades', href: 'unidades.html?utm_content=lara_web_terno' },
    },
    {
      id: 'unidades',
      label: 'Endereço e horário',
      answer: 'A Koisa Linda atende em São Francisco, Niterói, e na Barra da Tijuca, Shopping Downtown. Na página de unidades você vê endereço, horário e rotas.',
      primary: { label: 'Ver unidades', href: 'unidades.html?utm_content=lara_web_unidades' },
      secondary: { label: 'Agendar noiva/debutante', href: 'agendar.html?ab=auto&utm_content=lara_web_unidades' },
    },
    {
      id: 'disponibilidade',
      label: 'Disponibilidade de peça',
      answer: 'Disponibilidade de peça precisa ser confirmada com a loja, porque o acervo muda com provas e reservas. Se você viu um modelo, salve ou envie o código para a unidade.',
      primary: { label: 'Abrir catálogo', href: 'catalogo.html?utm_content=lara_web_disponibilidade' },
      secondary: { label: 'Falar com unidade', href: 'unidades.html?utm_content=lara_web_disponibilidade' },
    },
  ]);

  function trackLaraWeb(root, action, topic) {
    try {
      if (typeof root.fbq === 'function') root.fbq('trackCustom', 'KL_Lara_Web_' + action, { topic: topic || '', page_path: root.location.pathname });
    } catch (error) {}
    try {
      if (typeof root.gtag === 'function') root.gtag('event', 'lara_web_' + String(action || '').toLowerCase(), { topic: topic || '', page_path: root.location.pathname });
    } catch (error) {}
  }

  function mountLaraWeb(root) {
    var document = root.document;
    if (!document || document.querySelector('.kl-lara-web')) return;
    var shell = document.createElement('div');
    shell.className = 'kl-lara-web';
    shell.innerHTML = '<button class="kl-lara-launch" type="button" aria-expanded="false"><span>Precisa de ajuda?</span><b>Fale com a Lara</b></button>'
      + '<section class="kl-lara-panel" aria-label="Assistente Lara do site" hidden>'
      + '<div class="kl-lara-head"><div><span>Lara · assistente do site</span><b>Te ajudo a achar o caminho certo.</b></div><button type="button" class="kl-lara-close" aria-label="Fechar Lara">×</button></div>'
      + '<div class="kl-lara-body"><p class="kl-lara-msg">Escolha uma dúvida rápida. Eu te direciono para agenda, catálogo, unidade ou WhatsApp quando fizer sentido.</p><div class="kl-lara-options"></div><div class="kl-lara-answer" aria-live="polite"></div></div>'
      + '</section>';
    document.body.appendChild(shell);
    var launch = shell.querySelector('.kl-lara-launch');
    var panel = shell.querySelector('.kl-lara-panel');
    var close = shell.querySelector('.kl-lara-close');
    var options = shell.querySelector('.kl-lara-options');
    var answer = shell.querySelector('.kl-lara-answer');
    LARA_WEB_TOPICS.forEach(function (topic) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = topic.label;
      button.setAttribute('data-topic', topic.id);
      options.appendChild(button);
    });
    function setOpen(open) {
      panel.hidden = !open;
      launch.setAttribute('aria-expanded', open ? 'true' : 'false');
      shell.classList.toggle('is-open', open);
      if (document.body) document.body.classList.toggle('kl-lara-open', open);
      if (open) trackLaraWeb(root, 'Open', '');
    }
    launch.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); });
    options.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('button[data-topic]') : null;
      if (!button) return;
      var id = button.getAttribute('data-topic');
      var topic = LARA_WEB_TOPICS.find(function (item) { return item.id === id; });
      if (!topic) return;
      [].forEach.call(options.querySelectorAll('button'), function (btn) { btn.classList.toggle('is-selected', btn === button); });
      answer.innerHTML = '<p>' + topic.answer + '</p><div class="kl-lara-actions"><a class="kl-lara-primary" href="' + topic.primary.href + '">' + topic.primary.label + '</a><a class="kl-lara-secondary" href="' + topic.secondary.href + '">' + topic.secondary.label + '</a></div>';
      trackLaraWeb(root, 'Topic', id);
    });
    answer.addEventListener('click', function (event) {
      var anchor = event.target && event.target.closest ? event.target.closest('a') : null;
      if (!anchor) return;
      trackLaraWeb(root, 'CTA_Click', anchor.textContent || '');
    });
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
    // O rótulo segue a ocasião da página: em madrinha e terno, dizer "agende
    // sua prova" contradiz a própria faixa logo acima, que diz que não precisa
    // marcar. Visita livre convida a passar na loja, não a agendar.
    label.textContent = VISITA_LIVRE[context.page] ? 'Venha quando quiser' : 'Facilite sua prova';
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
      label.textContent = resolved.some(function (target) { return target.kind === 'schedule'; })
        ? 'Facilite sua prova'
        : (context.page === 'catalogo' ? 'Fale com a loja' : (VISITA_LIVRE[context.page] ? 'Venha quando quiser' : 'Agende sua prova'));
      // com duas lojas o "Ver catalogo" nao cabe na barra em 375px; e o rotulo
      // volta a aparecer no celular, senao ficam dois nomes de cidade sem contexto
      var isSchedule = resolved.some(function (target) { return target.kind === 'schedule'; });
      catalog.style.display = (context.page === 'catalogo' || (context.page === 'index' && isSchedule) || resolved.length > 1) ? 'none' : '';
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
    function revealAfterPx() {
      var hero = document.querySelector('.hero');
      var header = document.querySelector('header');
      var headerH = header ? header.getBoundingClientRect().height : 0;
      // Na home mobile a primeira dobra já tem CTA + Lara; sticky só entra
      // depois que a cliente sai do hero para não empilhar três CTAs.
      if (context.page === 'index' || context.page === 'home') {
        return hero ? Math.max(360, hero.offsetHeight - headerH - 24) : 520;
      }
      return 140;
    }
    function updateVisibility() {
      var y = root.scrollY || 0;
      if (!shown && y > revealAfterPx()) {
        box.classList.add('is-on');
        shown = true;
      }
    }
    root.addEventListener('scroll', updateVisibility, { passive: true });
    root.setTimeout(function () {
      updateVisibility();
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
      updateDestination({
        unit: detail.unit,
        status: detail.status,
        category: detail.category,
        openProduct: detail.openProduct,
      });
    });
  }

  function init(root) {
    if (!root || !root.document || root.__KL_SITE_ENHANCE__) return;
    root.__KL_SITE_ENHANCE__ = true;
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () { mount(root); mountLaraWeb(root); }, { once: true });
    } else {
      mount(root);
      mountLaraWeb(root);
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
