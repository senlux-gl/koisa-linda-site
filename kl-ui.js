/* Lightweight, progressive enhancement: nothing starts hidden or needs a CDN. */
(function () {
  'use strict';
  var doc = document;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reduced.matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // A one-shot animation, only when entering from below; never hide content.
        if (!reduced.matches && entry.boundingClientRect.top > 80) {
          entry.target.classList.add('kl-reveal');
          entry.target.addEventListener('animationend', function () {
            entry.target.classList.remove('kl-reveal');
          }, { once: true });
        }
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.05 });
    doc.querySelectorAll('.sec-title,.col,.loja-card,.scene,.rc,.kl-campaign-card').forEach(function (el) { observer.observe(el); });
    reduced.addEventListener('change', function () {
      if (!reduced.matches) return;
      observer.disconnect();
      doc.querySelectorAll('.kl-reveal').forEach(function (el) { el.classList.remove('kl-reveal'); });
    });
  }
  var toggle = doc.querySelector('.mtog');
  var nav = doc.querySelector('.mnav');
  function closeMenu(restore) {
    doc.body.classList.remove('mopen');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menu'); }
    if (restore && toggle) toggle.focus();
  }
  if (toggle && nav) {
    if (toggle.hasAttribute('data-kl-menu')) toggle.addEventListener('click', function () {
      var open = doc.body.classList.toggle('mopen');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (!nav.id) nav.id = 'menu-mobile';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.addEventListener('click', function () {
      toggle.setAttribute('aria-label', doc.body.classList.contains('mopen') ? 'Fechar menu' : 'Abrir menu');
    });
    doc.addEventListener('keydown', function (event) { if (event.key === 'Escape' && doc.body.classList.contains('mopen')) closeMenu(true); });
    doc.addEventListener('click', function (event) { if (!event.target.closest('header')) closeMenu(false); });
    nav.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', function () { closeMenu(false); }); });
    window.matchMedia('(min-width:1101px)').addEventListener('change', function (event) { if (event.matches) closeMenu(false); });
  }
  doc.querySelectorAll('nav a.cur').forEach(function (link) { link.setAttribute('aria-current', 'page'); });
  // A fragment is an ID, never a CSS selector supplied by the address bar.
  function restoreAnchor() {
    if (!location.hash) return;
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    var target = doc.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  if (doc.readyState === 'complete') restoreAnchor();
  else window.addEventListener('load', restoreAnchor, { once: true });
}());
