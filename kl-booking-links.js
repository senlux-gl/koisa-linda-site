/* Preserve known journey context on same-origin booking links, never alter navigation controls. */
(function () {
  'use strict';
  function enrich(anchor) {
    if (!anchor || !anchor.getAttribute('href')) return;
    var target = new URL(anchor.getAttribute('href'), document.baseURI);
    if (target.origin !== location.origin || target.pathname !== '/agendar/' || target.hash) return;
    var current = new URL(location.href), data = document.body.dataset;
    var unit = current.searchParams.get('un');
    var occasion = data.klBookingOccasion || ({'vestidos-noiva':'noiva','vestidos-debutante':'debutante'})[current.searchParams.get('cat')];
    var product = (window.KL_DATA || []).find(function (p) { return p.k === (current.searchParams.get('p') || current.searchParams.get('codigo')); });
    if (product) {
      occasion = ({'vestidos-noiva':'noiva','vestidos-debutante':'debutante'})[product.c];
      unit = product.un;
    }
    if (!target.searchParams.has('ocasiao') && occasion) target.searchParams.set('ocasiao',occasion);
    if (!target.searchParams.has('un') && (unit === 'sf' || unit === 'barra')) target.searchParams.set('un',unit);
    if (!target.searchParams.has('modelo') && data.klBookingCode) target.searchParams.set('modelo',data.klBookingCode);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','gclid','fbclid'].forEach(function (key) {
      var value = current.searchParams.get(key);
      if (value && value.length <= 250 && !target.searchParams.has(key)) target.searchParams.set(key,value);
    });
    anchor.setAttribute('href',target.pathname+target.search);
  }
  function init() {
    document.querySelectorAll('a[href]').forEach(enrich);
    document.addEventListener('click',function (event) { enrich(event.target.closest && event.target.closest('a[href]')); },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}());
