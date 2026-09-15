/* Catalog-only progressive enhancement: compact controls and image-only zoom. */
(function () {
  'use strict';
  function init() {
    var doc = document, gallery = doc.getElementById('catalog-gallery');
    if (!gallery) return;
    doc.body.classList.add('catalog-clean');
    var tools = doc.getElementById('catalog-filters');
    var primary = tools.querySelector('.catalog-primary-filters');
    var filters = doc.createElement('details');
    filters.className = 'catalog-extra-filters';
    filters.innerHTML = '<summary>Filtrar</summary><div class="catalog-filter-content"></div>';
    primary.appendChild(filters);
    var content = filters.lastElementChild;
    ['.catalog-search', '#catalog-units', '#catalog-facets'].forEach(function (selector) {
      var element = doc.querySelector(selector); if (element) content.appendChild(element);
    });
    var adjust = doc.getElementById('catalog-adjust-filters');
    if (adjust) adjust.addEventListener('click', function () { filters.open = true; });

    var footer = doc.createElement('nav');
    footer.className = 'catalog-clean-footer';
    footer.setAttribute('aria-label', 'Sua próxima etapa');
    footer.innerHTML = '<button type="button" class="catalog-selection">Minha seleção <span>0</span></button><a href="/agendar/?ui_source=catalog_clean">Agendar prova</a>';
    doc.body.appendChild(footer);
    footer.firstElementChild.addEventListener('click', function () { doc.getElementById('catalog-open-favorites').click(); });
    var count = doc.getElementById('catalog-favorite-count');
    function syncCount() { footer.querySelector('span').textContent = count.textContent; }
    new MutationObserver(syncCount).observe(count, {childList:true, subtree:true, characterData:true}); syncCount();
    function syncDestination(event) {
      var state = event.detail || {}, actions = window.KLCatalog && window.KLCatalog.Actions;
      var href = actions && actions.categoryScheduleHref(state.category, state.unit);
      var freeVisit = ['vestidos-madrinha','ternos','bolsas','calcados','acessorios'].indexOf(state.category) !== -1;
      footer.lastElementChild.href = href || (freeVisit ? '/agendar/#sem-hora-marcada' : '/agendar/?ui_source=catalog_clean');
      footer.lastElementChild.textContent = freeVisit ? 'Visitar a loja' : 'Agendar prova';
    }
    window.addEventListener('kl:catalog-state', syncDestination);
    var initial = new URLSearchParams(window.location.search);
    syncDestination({detail:{category:initial.get('cat'),unit:initial.get('un')}});

    var image = doc.getElementById('gallery-image'), opener = doc.getElementById('gallery-zoom-open');
    var zoom = doc.createElement('dialog');
    zoom.id = 'catalog-photo-zoom'; zoom.setAttribute('aria-label', 'Foto ampliada do vestido');
    zoom.innerHTML = '<div class="photo-zoom-stage"><img alt="" draggable="false"></div><div class="photo-zoom-tools"><button type="button" data-zoom="out" aria-label="Diminuir foto">−</button><button type="button" data-zoom="in" aria-label="Ampliar foto">+</button><button type="button" data-zoom="reset">Reajustar</button><button type="button" data-zoom="close" aria-label="Fechar foto ampliada">Fechar ×</button></div><p>Dois dedos para ampliar · arraste para ver os detalhes</p>';
    doc.body.appendChild(zoom);
    var stage = zoom.firstElementChild, photo = stage.firstElementChild;
    var scale = 1, x = 0, y = 0, points = new Map(), gesture = null, lastTap = 0, moved = false, focusBefore;
    function render() {
      scale = Math.max(1, Math.min(5, scale));
      var maxX = stage.clientWidth * (scale - 1) / 2, maxY = stage.clientHeight * (scale - 1) / 2;
      x = Math.max(-maxX, Math.min(maxX, x)); y = Math.max(-maxY, Math.min(maxY, y));
      photo.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
      zoom.dataset.scale = String(scale);
    }
    function reset() { scale = 1; x = y = 0; render(); }
    function open() {
      if (!image.getAttribute('src') || zoom.open) return;
      focusBefore = doc.activeElement; photo.src = image.currentSrc || image.src; photo.alt = image.alt;
      zoom.showModal(); reset(); zoom.querySelector('[data-zoom="close"]').focus();
    }
    opener.textContent = 'Toque para ampliar';
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', 'Ampliar foto da peça');
    image.setAttribute('aria-haspopup', 'dialog');
    image.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
    opener.addEventListener('click', open); image.addEventListener('click', open);
    zoom.addEventListener('close', function () { points.clear(); gesture = null; if (focusBefore && focusBefore.isConnected) focusBefore.focus({preventScroll:true}); });
    zoom.addEventListener('click', function (event) {
      var action = event.target.dataset.zoom; if (!action) return;
      if (action === 'close') zoom.close();
      else if (action === 'reset') reset();
      else { scale += action === 'in' ? 0.5 : -0.5; render(); }
    });
    function sample() {
      var p = Array.from(points.values());
      return p.length > 1 ? {x:(p[0].x+p[1].x)/2, y:(p[0].y+p[1].y)/2, distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)} : {x:p[0].x,y:p[0].y,distance:0};
    }
    function begin() { if (!points.size) { gesture = null; return; } gesture = Object.assign(sample(), {scale:scale, tx:x, ty:y}); }
    stage.addEventListener('pointerdown', function (event) {
      stage.setPointerCapture(event.pointerId); points.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if (points.size === 1) moved = false; else moved = true;
      begin();
    });
    stage.addEventListener('pointermove', function (event) {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId,{x:event.clientX,y:event.clientY}); var s = sample();
      if (Math.hypot(s.x-gesture.x,s.y-gesture.y)>5) moved = true;
      if (points.size > 1 && gesture.distance) scale = gesture.scale * s.distance / gesture.distance;
      x = gesture.tx + s.x - gesture.x; y = gesture.ty + s.y - gesture.y; render();
    });
    function end(event) {
      if (!points.has(event.pointerId)) return;
      if (event.type === 'pointerup' && points.size === 1 && !moved) {
        var now = Date.now(); if (now - lastTap < 300) { scale = scale > 1 ? 1 : 2.5; render(); lastTap = 0; } else lastTap = now;
      }
      points.delete(event.pointerId); begin();
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', function (event) { event.preventDefault(); scale += event.deltaY < 0 ? .2 : -.2; render(); }, {passive:false});
    window.addEventListener('resize', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
