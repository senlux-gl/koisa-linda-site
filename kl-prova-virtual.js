/* Dedicated entry, using the existing simulation controller and worker contract. */
(function () {
  'use strict';
  var root = window;
  var start = document.getElementById('virtual-start');
  var status = document.getElementById('virtual-status');
  var dialog = document.getElementById('catalog-tryon');
  var api = root.KLCatalog || {};
  var controller;
  var returnFocus = start;
  function query() { return new URL(root.location.href); }
  function selected() {
    var params = query().searchParams;
    return String(params.get('p') || params.get('codigo') || params.get('modelo') || '').trim().toUpperCase();
  }
  function updateCode(code) {
    var url = query();
    ['prova','codigo','modelo'].forEach(function (key) { url.searchParams.delete(key); });
    if (code) url.searchParams.set('p', code); else url.searchParams.delete('p');
    root.history.replaceState(root.history.state, '', url.pathname + url.search + url.hash);
  }
  function close() {
    if (!controller) return;
    controller.close();
    document.body.classList.remove('kl-virtual-open');
    updateCode(null);
    if (returnFocus) returnFocus.focus({preventScroll:true});
  }
  function open() {
    if (!controller) return false;
    var code = selected();
    var valid = (root.KL_DATA || []).some(function (p) { return p.k === code && api.Actions.isTryOnEligible(p); });
    if (code && !valid) status.textContent = 'Esse código não está disponível para simulação. Escolha outro vestido ou consulte a equipe da loja.';
    if (code && !valid) updateCode(null);
    if (code && valid) updateCode(code);
    returnFocus = document.activeElement || start;
    controller.open(valid ? code : null);
    document.body.classList.add('kl-virtual-open');
    return true;
  }
  try {
    if (!api.TryOn || !Array.isArray(root.KL_DATA)) throw new Error('unavailable');
    var elements = {
      title: document.getElementById('tryon-title'),
      closeButton: document.getElementById('tryon-close'),
      sizes: document.getElementById('tryon-sizes'),
      unknownSize: document.getElementById('tryon-unknown-size'),
      clearSize: document.getElementById('tryon-clear-size'),
      categories: document.getElementById('tryon-categories'),
      search: document.getElementById('tryon-search'),
      dresses: document.getElementById('tryon-dresses'),
      noResults: document.getElementById('tryon-no-results'),
      more: document.getElementById('tryon-more'),
      clearSelection: document.getElementById('tryon-clear-selection'),
      file: document.getElementById('tryon-file'),
      preview: document.getElementById('tryon-preview'),
      previewImage: document.getElementById('tryon-preview-image'),
      submit: document.getElementById('tryon-submit'),
      form: document.getElementById('tryon-form'),
      loading: document.getElementById('tryon-loading'),
      result: document.getElementById('tryon-result'),
      resultImage: document.getElementById('tryon-result-image'),
      remaining: document.getElementById('tryon-remaining'),
      again: document.getElementById('tryon-again'),
      error: document.getElementById('tryon-error'),
      errorMessage: document.getElementById('tryon-error-message'),
      errorAgain: document.getElementById('tryon-error-again'),
      whatsapp: document.getElementById('tryon-whatsapp'),
      errorWhatsapp: document.getElementById('tryon-error-whatsapp'),
      sizeButtons: Array.prototype.slice.call(
        document.querySelectorAll('#tryon-sizes [data-size]'),
      ),
      categoryButtons: Array.prototype.slice.call(
        document.querySelectorAll('#tryon-categories [data-category]'),
      ),
    };
    var storage;
    try { storage = root.localStorage; } catch (_) { storage = null; }
    controller = api.TryOn.create({
      dialog:dialog, document:document, elements:elements,
      products:root.KL_DATA, core:api.Core, actions:api.Actions, storage:storage,
      workerClient:api.TryOn.createWorkerClient({
        fetch:root.fetch.bind(root), now:Date.now,
        wait:function(ms) { return new Promise(function(resolve) { root.setTimeout(resolve, ms); }); },
        setTimer:root.setTimeout.bind(root), clearTimer:root.clearTimeout.bind(root),
        AbortController:root.AbortController, workerUrl:api.TryOn.DEFAULT_WORKER_URL
      }),
      readFile:function(file) { return new Promise(function(resolve,reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = reader.onabort = function() { reject(new Error('file unavailable')); };
        reader.readAsDataURL(file);
      }); },
      AbortController:root.AbortController,
      objectURL:{create:root.URL.createObjectURL.bind(root.URL),revoke:root.URL.revokeObjectURL.bind(root.URL)},
      onSelectionChange:updateCode, onRequestClose:close
    });
    start.addEventListener('click', function(event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (open()) event.preventDefault();
    });
    root.addEventListener('pagehide', function() { controller.close(); document.body.classList.remove('kl-virtual-open'); });
    root.addEventListener('popstate', function() { if (selected()) open(); else close(); });
    if (selected()) open();
  } catch (_) {
    status.textContent = 'A simulação não carregou neste navegador. Você pode conhecer os modelos no catálogo e consultar a loja.';
    start.textContent = 'Conhecer os vestidos no catálogo';
    start.href = '/catalogo/';
  }
}());
