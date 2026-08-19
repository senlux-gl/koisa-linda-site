/* Koisa Linda — deep site tracking
 * Safe Meta Pixel instrumentation. No raw phone/user text/search terms are sent.
 * Events are custom-prefixed with KL_ to avoid changing campaign optimization by accident.
 */
(function () {
  'use strict';

  var VERSION = '20260819-origem-v1';
  var GA4_ID = 'G-D6HYW29TS4';
  var PIXEL_READY_TIMEOUT = 8000;
  var SCROLL_DEPTHS = [25, 50, 75, 90];
  var sentScroll = {};
  var sentOnce = {};
  var recentEvents = {};
  var searchTimer = null;
  var CATALOG_CATEGORIES = ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha', 'ternos', 'bolsas', 'calcados', 'acessorios'];
  var CATALOG_UNITS = ['barra', 'sf'];
  var CATALOG_SOURCES = ['bootstrap', 'data-source', 'catalog', 'manual', 'observer', 'grid', 'deep-link', 'previous', 'next', 'swipe', 'gallery', 'favorites', 'data', 'filters', 'category', 'unit', 'color', 'size', 'shortcut', 'chip', 'clear'];

  function now() { return Date.now ? Date.now() : new Date().getTime(); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clean(s, max) {
    s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    // Prevent accidental PII leaks in labels/text snippets.
    s = s.replace(/\+?\d[\d\s().-]{7,}\d/g, '[num]');
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]');
    return s.slice(0, max || 80);
  }
  function codeFromText(s) {
    s = String(s || '').toUpperCase();
    var m = s.match(/\b([A-Z]{2,4}-\d{2,4})\b/) || s.match(/PE[ÇC]A\s+([A-Z0-9][A-Z0-9-]{2,11})/i);
    return m ? m[1].toUpperCase() : '';
  }
  function safePathFromUrl(url) {
    try {
      var u = new URL(url, location.href);
      return u.hostname + u.pathname;
    } catch (e) { return ''; }
  }
  function getStoreFromHref(href) {
    var h = String(href || '');
    if (h.indexOf('5521970858787') > -1) return 'sao_francisco';
    if (h.indexOf('5521966475383') > -1) return 'barra';
    return '';
  }
  function enumValue(value, allowedValues) {
    value = String(value || '');
    return allowedValues.indexOf(value) > -1 ? value : '';
  }
  function safeCount(value, max) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : undefined;
  }
  function activeFilter(kind) {
    var el;
    if (kind === 'unit') {
      el = qs('#catalog-units [data-unit][aria-pressed="true"]') || qs('#units .upill.active');
    } else {
      el = qs('#catalog-category') || qs('#cats .pill.active');
    }
    if (!el) return '';
    if (kind === 'unit') return el.getAttribute('data-unit') || el.getAttribute('data-un') || '';
    return el.value || el.getAttribute('data-cat') || '';
  }
  function visibleResultCount() {
    var t = qs('#catalog-count') || qs('#count');
    if (!t) return null;
    var m = (t.textContent || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function inferredProduct(code, el) {
    if (!code) return null;
    var unit = activeFilter('unit');
    if (!unit || unit === 'all') {
      var href = '';
      try {
        var a = el && el.closest ? (el.closest('a[href]') || (el.closest('.card') && el.closest('.card').querySelector('a[href*="wa.me"]'))) : null;
        href = a ? a.getAttribute('href') : '';
      } catch (e) {}
      unit = getStoreFromHref(href) || '';
    }
    return { k: clean(code, 24), c: clean(activeFilter('cat') || '', 40), un: clean(unit, 24), t: '', co: '', l: '' };
  }
  function getProductByCode(code) {
    try {
      if (!code) return null;
      if (!window.KL_DATA || !Array.isArray(window.KL_DATA)) return inferredProduct(code);
      return window.KL_DATA.find(function (d) { return String(d.k || '').toUpperCase() === String(code).toUpperCase(); }) || inferredProduct(code);
    } catch (e) { return inferredProduct(code); }
  }
  function getProductFromElement(el) {
    try {
      var card = el && el.closest ? el.closest('.catalog-card, .card') : null;
      var code = card && card.getAttribute ? card.getAttribute('data-code') || '' : '';
      if (!code) code = codeFromText((card && card.textContent) || (el && el.textContent) || '');
      if (!code && card) {
        var wa = card.querySelector('a[href*="wa.me"]');
        code = codeFromText(wa ? decodeURIComponent(wa.getAttribute('href') || '') : '');
      }
      return getProductByCode(code) || inferredProduct(code, el);
    } catch (e) { return null; }
  }
  function productParams(d) {
    if (!d) return {};
    var unit = enumValue(d.un, CATALOG_UNITS);
    return {
      product_code: clean(d.k, 24),
      content_name: clean(d.k, 24),
      content_category: clean(d.c, 40),
      category_label: clean(d.l, 50),
      unidade: unit,
      tamanho: clean(d.t, 24),
      cor: clean(d.co || '', 32)
    };
  }
  function baseParams(extra) {
    var p = {
      tracking_version: VERSION,
      page_path: location.pathname || '/',
      page_title: clean(document.title, 100),
      page_type: pageType(),
      referrer_domain: (function () { try { return document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { return ''; } })(),
      viewport: (window.innerWidth || 0) + 'x' + (window.innerHeight || 0),
      catalog_category: enumValue(activeFilter('cat'), CATALOG_CATEGORIES),
      catalog_unit: enumValue(activeFilter('unit'), CATALOG_UNITS)
    };
    var utm = getPersistedAttribution();
    Object.keys(utm).forEach(function (k) { p[k] = utm[k]; });
    if (extra) Object.keys(extra).forEach(function (k) {
      if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') p[k] = extra[k];
    });
    return p;
  }
  function pageType() {
    var p = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'home';
    if (p === 'index') return 'home';
    return p;
  }
  function getPersistedAttribution() {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    var out = {};
    try {
      var sp = new URLSearchParams(location.search);
      var changed = false;
      keys.forEach(function (k) {
        var v = sp.get(k);
        if (v) { sessionStorage.setItem('kl_' + k, clean(v, 120)); changed = true; }
      });
      if (changed) sessionStorage.setItem('kl_landing_path', clean(location.pathname, 160));
      keys.forEach(function (k) {
        var v = sessionStorage.getItem('kl_' + k);
        if (v) out[k] = k === 'fbclid' || k === 'gclid' ? 'present' : clean(v, 120);
      });
      var lp = sessionStorage.getItem('kl_landing_path');
      if (lp) {
        var cleanLanding = clean(String(lp).split(/[?#]/)[0], 160);
        if (cleanLanding !== lp) sessionStorage.setItem('kl_landing_path', cleanLanding);
        if (cleanLanding) out.landing_path = cleanLanding;
      }
    } catch (e) {}
    return out;
  }
  function track(name, params, opts) {
    params = baseParams(params || {});
    if (opts && opts.onceKey) {
      if (sentOnce[opts.onceKey]) return;
      sentOnce[opts.onceKey] = true;
    }
    try {
      var recentKey = name + ':' + JSON.stringify(params);
      var t = now();
      if (recentEvents[recentKey] && t - recentEvents[recentKey] < 500) return;
      recentEvents[recentKey] = t;
    } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch (e) {}
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', name, params);
      if (window.__KL_TRACKING_DEBUG__) {
        window.__klTrackingEvents = window.__klTrackingEvents || [];
        window.__klTrackingEvents.push({ name: name, params: params, ts: now() });
      }
    } else {
      window.__klTrackingQueue = window.__klTrackingQueue || [];
      window.__klTrackingQueue.push({ name: name, params: params, ts: now() });
    }
  }
  /* Evento PADRÃO do Pixel (não KL_*). Os KL_* são diagnóstico e o Meta não otimiza por eles;
   * as campanhas de conversão usam custom_event_type LEAD, então sem este disparo o leilão
   * fica sem sinal nenhum de conversão. Dedupe por href+janela de 3s, igual ao KL_WhatsApp_Click,
   * pra um clique nunca contar duas vezes. */
  function standard(name, params, onceKey) {
    if (typeof window.fbq !== 'function') return;
    if (onceKey) {
      if (sentOnce['std:' + onceKey]) return;
      sentOnce['std:' + onceKey] = true;
    }
    try { window.fbq('track', name, params || {}); } catch (e) {}
  }
  function catalog(eventName, context) {
    context = context || {};
    var allowed = {
      KL_Catalog_Loaded: true,
      KL_Catalog_Error: true,
      KL_Catalog_Search: true,
      KL_Filter_Change: true,
      KL_Catalog_Load_More: true,
      KL_Product_Open: true,
      KL_Product_Navigate: true,
      KL_Favorite_Toggle: true,
      KL_Favorites_View: true,
      KL_WhatsApp_Click: true,
      KL_Try_On_Click: true,
      KL_Catalog_Empty: true,
    };
    if (!allowed[eventName]) return;
    var product = context.productCode ? getProductByCode(context.productCode) : null;
    var params = Object.assign({}, productParams(product), {
      result_count: safeCount(context.resultCount, 100000),
      catalog_category: enumValue(context.category, CATALOG_CATEGORIES),
      catalog_unit: enumValue(context.unit, CATALOG_UNITS),
      query_length: safeCount(context.queryLength, 80),
      query_has_product_code: context.queryHasProductCode === 'yes' ? 'yes' : 'no',
      favorite_count: safeCount(context.favoriteCount, 10000),
      source: enumValue(context.source, CATALOG_SOURCES),
    });
    if (eventName === 'KL_Catalog_Search' && context.productCode && product) {
      params.product_code = clean(product.k, 24);
    }
    track(eventName, params);
  }
  function flushQueueWhenReady() {
    var start = now();
    (function wait() {
      if (typeof window.fbq === 'function') {
        var q = window.__klTrackingQueue || [];
        window.__klTrackingQueue = [];
        q.forEach(function (e) { window.fbq('trackCustom', e.name, e.params); });
        hookFbqForExistingEvents();
        return;
      }
      if (now() - start < PIXEL_READY_TIMEOUT) setTimeout(wait, 200);
    })();
  }
  function hookFbqForExistingEvents() {
    if (window.__klFbqHooked || typeof window.fbq !== 'function') return;
    var original = window.fbq;
    function wrapped() {
      var args = Array.prototype.slice.call(arguments);
      var ret = original.apply(window, args);
      try {
        if (args[0] === 'track' && args[1] === 'ViewContent') {
          var p = args[2] || {};
          var code = clean(p.content_name || '', 24);
          var d = getProductByCode(code);
          original('trackCustom', 'KL_Product_View', baseParams(Object.assign({ source_event: 'ViewContent' }, productParams(d), {
            product_code: code || (d && d.k) || '',
            content_category: clean(p.content_category || (d && d.c) || '', 40)
          })));
        }
      } catch (e) {}
      return ret;
    }
    for (var k in original) { try { wrapped[k] = original[k]; } catch (e) {} }
    window.fbq = wrapped;
    window.__klFbqHooked = true;
  }
  function onClick(e) {
    var manual = e.target && e.target.closest
      ? e.target.closest('[data-kl-track-manual="true"]') : null;
    if (manual) return;
    var a = e.target.closest && e.target.closest('a[href]');
    var btn = e.target.closest && e.target.closest('button, .pill, .sw, .szchip, .cbtn, .lb-cta, .lb-try, .fab');
    var target = a || btn;
    if (!target) return;
    var href = a ? (a.getAttribute('href') || '') : '';
    var text = clean(target.getAttribute('aria-label') || target.textContent || '', 70);
    var cls = clean(target.className || '', 80);

    if (a) {
      var isWa = /wa\.me|whatsapp\.com/i.test(href);
      var isExternal = false;
      try { isExternal = new URL(href, location.href).hostname !== location.hostname && !isWa; } catch (err) {}
      var linkParams = {
        link_text: text,
        link_domain_path: safePathFromUrl(href),
        destination_path: (function () { try { var u = new URL(href, location.href); return u.pathname + (u.search ? '?has_query=1' : ''); } catch (e2) { return ''; } })()
      };
      if (href.indexOf('catalogo.html') > -1) linkParams.destination_category = (new URL(href, location.href).searchParams.get('cat') || '');
      if (isWa) {
        var decoded = '';
        try { decoded = decodeURIComponent(href); } catch (e3) { decoded = href; }
        var code = codeFromText(decoded);
        var d = getProductByCode(code) || getProductFromElement(target);
        var waOnce = 'wa:' + href + ':' + Math.floor(now() / 3000);
        track('KL_WhatsApp_Click', Object.assign(linkParams, productParams(d), {
          store: getStoreFromHref(href),
          product_code: code || (d && d.k) || '',
          has_prefill: /[?&]text=/.test(href) ? 'yes' : 'no'
        }), { onceKey: waOnce });
        standard('Lead', {
          content_name: code || (d && d.k) || text || 'whatsapp',
          content_category: code ? 'peca' : 'contato'
        }, waOnce);
        /* Intenção declarada no prefill do WhatsApp. É INTENÇÃO de agendar (clique no
         * botão), não agendamento confirmado — esse vive na conversa com a Lara/CRM. */
        var waText = String(decoded || '').toLowerCase();
        var waIntent = /agendar (uma )?prova/.test(waText) ? 'prova'
          : (/agendar (uma )?visita|visita/.test(waText) ? 'visita'
            : (/encontrar a loja|downtown/.test(waText) ? 'como_chegar' : 'geral'));
        if (waIntent === 'prova' || waIntent === 'visita') {
          track('KL_Schedule_Intent', {
            store: getStoreFromHref(href),
            intent: waIntent
          }, { onceKey: 'sched:' + waOnce });
        }
        /* Conversão nativa do Google Ads roteada por loja — cada campanha de unidade
         * otimiza pela conversão da própria praça. Inerte enquanto kl-ga.js não tiver IDs. */
        try {
          var klAds = window.KL_ADS;
          var waLabel = klAds && klAds.label ? klAds.label[getStoreFromHref(href)] : '';
          if (klAds && klAds.id && waLabel && typeof window.gtag === 'function') {
            window.gtag('event', 'conversion', { send_to: klAds.id + '/' + waLabel });
          }
        } catch (e4) {}
        return;
      }
      track('KL_CTA_Click', linkParams);
      if (isExternal) track('KL_Outbound_Click', linkParams);
      return;
    }

    var params = { element_text: text, element_class: cls };
    if (target.matches && target.matches('[data-cat]')) {
      params.filter_type = 'category'; params.filter_value = clean(target.getAttribute('data-cat'), 40);
      track('KL_Filter_Change', params);
    } else if (target.matches && target.matches('[data-un]')) {
      params.filter_type = 'unit'; params.filter_value = clean(target.getAttribute('data-un'), 40);
      track('KL_Filter_Change', params);
    } else if (target.matches && target.matches('[data-co]')) {
      params.filter_type = 'color'; params.filter_value = clean(target.getAttribute('data-co'), 40);
      track('KL_Filter_Change', params);
    } else if (target.matches && target.matches('[data-sz]')) {
      params.filter_type = 'size'; params.filter_value = clean(target.getAttribute('data-sz'), 40);
      track('KL_Filter_Change', params);
    } else {
      track('KL_UI_Click', params);
    }
  }
  function onProductOpenClick(e) {
    var ph = e.target.closest && e.target.closest('.ph');
    if (!ph) return;
    var d = getProductFromElement(ph);
    if (d) track('KL_Product_Open_Click', productParams(d));
  }
  function bindSearch() {
    var input = qs('#catalog-search') || qs('#q');
    if (!input || input.getAttribute('data-kl-track-manual') === 'true') return;
    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var v = String(input.value || '').trim();
        if (!v) return;
        var code = codeFromText(v);
        track('KL_Catalog_Search', {
          query_length: String(v.length),
          query_has_product_code: code ? 'yes' : 'no',
          product_code: code,
          result_count: visibleResultCount(),
          catalog_category: activeFilter('cat'),
          catalog_unit: activeFilter('unit')
        });
      }, 900);
    });
  }
  function bindScrollDepth() {
    function check() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      var pct = Math.round(((window.scrollY || doc.scrollTop || 0) / max) * 100);
      SCROLL_DEPTHS.forEach(function (d) {
        if (pct >= d && !sentScroll[d]) {
          sentScroll[d] = true;
          track('KL_Scroll_Depth', { scroll_depth: String(d) }, { onceKey: 'scroll:' + pageType() + ':' + d });
        }
      });
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; check(); });
    }, { passive: true });
    setTimeout(check, 1200);
  }
  function bindVisibility() {
    var start = now();
    var sent30 = false;
    setInterval(function () {
      if (!sent30 && document.visibilityState === 'visible' && now() - start > 30000) {
        sent30 = true;
        track('KL_Engaged_30s', { seconds: '30' }, { onceKey: 'engaged30:' + pageType() });
      }
    }, 3000);
  }
  function bindCatalogFilterPatches() {
    // Existing inline code already changes filters. This observes result count changes after filter/search actions.
    if (qs('#catalog-app') || (window.KLCatalog && window.KLCatalog.App)) return;
    var count = qs('#catalog-count') || qs('#count');
    if (!count || !('MutationObserver' in window)) return;
    var last = count.textContent;
    new MutationObserver(function () {
      var cur = count.textContent;
      if (cur === last) return;
      last = cur;
      track('KL_Catalog_Result_Update', {
        result_count: visibleResultCount(),
        catalog_category: activeFilter('cat'),
        catalog_unit: activeFilter('unit')
      });
    }).observe(count, { childList: true, characterData: true, subtree: true });
  }
  function bootstrapGA4() {
    if (window.__klGA4Ready) return;
    window.__klGA4Ready = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    (document.head || document.documentElement).appendChild(g);
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  /* ── Carimbo de origem no WhatsApp ──────────────────────────────────────────
   * A conversa com a Lara é o único lugar onde a origem da cliente ainda existe:
   * o CRM não guarda gclid nem utm. Então a origem viaja junto no texto do link,
   * numa frase curta que a cliente lê antes de enviar. Sem isso, quem vem do
   * Google e quem vem do Instagram chegam idênticos — e 21% dos leads da casa
   * abrem a conversa só com "oi", sem ninguém saber de onde vieram.
   * Não inventa mensagem: só acrescenta em link que JÁ tem text=. */
  var ORIGEM_SUFIXO = {
    google: 'Cheguei pelo Google.',
    instagram: 'Cheguei pelo Instagram.'
  };
  function origemDaVisita() {
    var o = '';
    try {
      /* A URL atual manda: se a cliente voltou por outro canal, é esse que a
       * trouxe agora. O guardado só vale quando a URL não diz nada — mesma
       * regra que o bloco de utm logo acima já usa. */
      var sp = new URLSearchParams(location.search);
      var src = (sp.get('utm_source') || '').toLowerCase();
      if (sp.get('gclid') || /google|gbp/.test(src)) o = 'google';
      else if (sp.get('fbclid') || /instagram|facebook|meta/.test(src) || src === 'ig') o = 'instagram';
      else {
        var ref = document.referrer ? new URL(document.referrer).hostname : '';
        if (/(^|\.)google\./.test(ref)) o = 'google';
        else if (/(^|\.)instagram\./.test(ref)) o = 'instagram';
      }
      if (o) sessionStorage.setItem('kl_origem', o);
      else o = sessionStorage.getItem('kl_origem') || '';
    } catch (e) {}
    return o;
  }
  function carimbaHref(href, sufixo) {
    if (!href || href.indexOf('text=') < 0) return href;
    if (!/wa\.me|whatsapp\.com/i.test(href)) return href;
    var atual;
    try { atual = decodeURIComponent(href.split('text=')[1].split('&')[0].replace(/\+/g, ' ')); }
    catch (e) { return href; }
    if (atual.indexOf('Cheguei pelo') > -1) return href;
    return href.replace(/text=[^&]*/, 'text=' + encodeURIComponent(atual.replace(/\s+$/, '') + ' ' + sufixo));
  }
  function carimbaUm(a) {
    var sufixo = ORIGEM_SUFIXO[origemDaVisita()];
    if (!sufixo || !a) return;
    var antes = a.getAttribute('href');
    var depois = carimbaHref(antes, sufixo);
    if (depois && depois !== antes) a.setAttribute('href', depois);
  }
  function carimbaLinksWhatsApp() {
    if (!ORIGEM_SUFIXO[origemDaVisita()]) return;
    qsa('a[href*="wa.me"], a[href*="whatsapp.com"]').forEach(carimbaUm);
  }
  /* Rede de segurança: o catálogo monta os links por JS depois do load, e o
   * capture roda antes da navegação — então pega o que o passe inicial não viu. */
  function onClickCarimbo(ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href*="wa.me"], a[href*="whatsapp.com"]') : null;
    if (a) carimbaUm(a);
  }

  function init() {
    bootstrapGA4();
    getPersistedAttribution();
    flushQueueWhenReady();
    carimbaLinksWhatsApp();
    document.addEventListener('click', onClickCarimbo, true);
    document.addEventListener('click', onProductOpenClick, true);
    document.addEventListener('click', onClick, true);
    bindSearch();
    bindScrollDepth();
    bindVisibility();
    bindCatalogFilterPatches();
    track('KL_Page_Context', { url_has_query: location.search ? 'yes' : 'no' }, { onceKey: 'page:' + location.href });
  }
  window.KLTracking = Object.freeze({ catalog: catalog });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
