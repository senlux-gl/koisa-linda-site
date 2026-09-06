(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.init(root); });
    else api.init(root);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DAY = 24 * 60 * 60 * 1000;
  var KEY = 'kl_capture_v1';
  var API = 'https://n8n.janotattec.com.br/webhook/kl-interesse';
  var VERSION = '2026-09-06.capture.v1';
  var DDDS = /^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/;
  function normalizePhone(value) {
    var p = String(value || '').replace(/\D/g, '');
    if (p.length === 13 && p.slice(0,2) === '55') p = p.slice(2);
    if (!/^\d{2}9\d{8}$/.test(p) || !DDDS.test(p.slice(0,2)) || /^(\d)\1{8}$/.test(p.slice(2))) return null;
    return '55' + p;
  }
  function readState(storage) {
    try { var value = JSON.parse(storage.getItem(KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch (_) { return {}; }
  }
  function saveState(storage, state) { try { storage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function isSuppressed(storage, now) { return Number(readState(storage).until) > now; }
  function makePayload(input) {
    var context = input.context || {};
    return {
      request_id: input.requestId, telefone: normalizePhone(input.phone), session_id: input.sessionId,
      marketing_opt_in: input.marketing === true, consent_version: VERSION,
      source: context.source === 'favorites' ? 'favorites' : 'catalog', category: context.category || '',
      product_codes: (context.product_codes || []).slice(0,6), attribution: input.attribution || {}, website: input.website || ''
    };
  }
  function whatsappHref(token, marketing, destination) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw Error('Invalid confirmation');
    var message = 'Quero receber modelos da Koisa Linda.\nKL-MODELOS ' + token;
    if (marketing) message += '\nTambém quero receber novidades e dicas.';
    return 'https://wa.me/' + destination + '?text=' + encodeURIComponent(message);
  }
  function init(win) {
    var doc = win.document, section = doc.getElementById('kl-capture');
    if (!section || section.dataset.initialized) return;
    section.dataset.initialized = 'true';
    var form = doc.getElementById('kl-capture-form'), open = doc.getElementById('kl-capture-open');
    var close = doc.getElementById('kl-capture-close'), phone = doc.getElementById('kl-capture-phone');
    var marketing = doc.getElementById('kl-capture-marketing'), submit = doc.getElementById('kl-capture-submit');
    var result = doc.getElementById('kl-capture-result'), status = doc.getElementById('kl-capture-status');
    var continueLink = doc.getElementById('kl-capture-continue'), storage = null;
    try { storage = win.localStorage; } catch (_) {}
    var fallbackState = {}, state = readState(storage), busy = false, requestId = '', requestBody = '', popup = null;
    var statusBusy = false, pendingHref = '', fallbackSession = '';
    var contacts = win.KLCatalog && win.KLCatalog.Actions && win.KLCatalog.Actions.CONTACTS;
    function persist(next) { state = next; fallbackState = next; saveState(storage,next); }
    function currentState() { var stored = readState(storage); return stored.kind ? stored : fallbackState; }
    function context() {
      var app = win.KLCatalog && win.KLCatalog.App;
      if (app && app.getCaptureContext) return app.getCaptureContext();
      var category = section.dataset.captureCategory || '';
      if (['vestidos-noiva','vestidos-debutante','vestidos-madrinha','ternos','bolsas','calcados','acessorios'].indexOf(category) < 0) category = '';
      var params = new win.URLSearchParams(win.location.search || '');
      var requested = (params.get('un') || params.get('loja') || '').toLowerCase();
      if (requested === 'saofrancisco') requested = 'sf';
      var unit = ['sf','barra'].indexOf(requested) > -1 ? requested : section.dataset.captureUnit;
      return {source:'catalog',category:category,unit:unit === 'sf' ? 'sf' : 'barra',product_codes:[]};
    }
    function event(name, extra) {
      if (win.KLTracking && win.KLTracking.gaEvent) win.KLTracking.gaEvent(name,Object.assign({capture_surface:popup && popup.isOpen() ? 'popup' : 'catalog',capture_version:VERSION,capture_experience:'entry_popup_20260906'}, extra || {}));
    }
    function syncFloating() {
      var box = section.getBoundingClientRect();
      doc.body.classList.toggle('kl-capture-active', box.bottom > 0 && box.top < win.innerHeight && (!form.hidden || !result.hidden));
    }
    win.addEventListener('scroll',syncFloating,{passive:true});
    function showForm(trigger) {
      form.hidden = false; open.hidden = true; syncFloating(); open.setAttribute('aria-expanded','true'); close.hidden = false;
      if (trigger === 'page_open') event('capture_session_eligible');
      event('capture_invite_view',{trigger:trigger});
      if (trigger === 'manual') phone.focus({preventScroll:true});
    }
    function show(manual) {
      if (busy) return;
      if (popup) { popup.open(manual); return; }
      if (doc.querySelector('dialog[open]')) return;
      showForm('manual');
    }
    function hide() {
      if (busy) return;
      form.hidden = true; open.hidden = false; close.hidden = true; syncFloating(); open.setAttribute('aria-expanded','false');
      if (!['pending','confirmed'].includes(currentState().kind)) persist({kind:'dismissed',until:Date.now()+7*DAY});
      event('capture_invite_dismiss'); open.focus();
    }
    open.addEventListener('click',function () { show(true); });
    close.addEventListener('click',hide);
    async function post(path, body) {
      var controller = new win.AbortController(), timer = win.setTimeout(function () { controller.abort(); },15000);
      try {
        var response = await win.fetch(API + path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',signal:controller.signal});
        if (!response.ok) throw Error('request_failed');
        return await response.json();
      } finally { win.clearTimeout(timer); }
    }
    async function checkStatus() {
      var pending = currentState();
      if (pending.kind !== 'pending' || !pending.token || !pending.session || statusBusy) return;
      statusBusy = true;
      try {
        var response = await post('/status',{token:pending.token,session_id:pending.session});
        if (response.ok && response.status === 'confirmed') {
          persist({kind:'confirmed',until:Date.now()+180*DAY});
          form.hidden = true; open.hidden = false; close.hidden = true; syncFloating(); open.setAttribute('aria-expanded','false');
          result.hidden = false; continueLink.hidden = true;
          status.textContent = response.marketing_active ? 'WhatsApp confirmado. Sua escolha de receber novidades foi registrada.' : 'WhatsApp confirmado. Seu pedido de modelos foi registrado.';
          event('capture_contact_confirmed',{marketing_opt_in:response.marketing_active === true}); syncFloating();
        } else if (response.ok && ['expired','not_found'].includes(response.status)) {
          persist({kind:'dismissed',until:Date.now()+7*DAY}); pendingHref='';continueLink.hidden=true;result.hidden=false;status.textContent='Este pedido expirou. Toque em receber modelos para fazer um novo pedido.';syncFloating();
        }
      } catch (_) {} finally { statusBusy = false; }
    }
    win.addEventListener('focus',checkStatus);
    if (state.kind === 'pending') checkStatus();
    form.addEventListener('submit',async function (ev) {
      ev.preventDefault(); if (busy) return;
      phone.setCustomValidity(normalizePhone(phone.value) ? '' : 'Informe um celular com DDD, incluindo o número 9.');
      if (!form.reportValidity()) return;
      if (!/^(www\.)?koisalinda\.com\.br$/.test(win.location.hostname)) {
        result.hidden = false; continueLink.hidden = true; status.textContent = 'Prévia: nenhum cadastro ou mensagem foi enviado.'; return;
      }
      var tracking = win.KLTracking || {};
      if (!win.crypto || !win.crypto.randomUUID || !win.AbortController) { result.hidden=false;status.textContent='Atualize seu navegador para concluir o pedido.';return; }
      if (!fallbackSession) fallbackSession = 'kl_' + win.crypto.randomUUID();
      var session = tracking.getSessionId ? tracking.getSessionId() : fallbackSession;
      var chosen = context();
      var payload = makePayload({phone:phone.value,marketing:marketing.checked,sessionId:session,context:chosen,attribution:tracking.getAttribution ? tracking.getAttribution() : {},website:doc.getElementById('kl-capture-website').value});
      var fingerprint = JSON.stringify(payload);
      if (fingerprint !== requestBody) { requestId = win.crypto.randomUUID(); requestBody = fingerprint; }
      payload.request_id = requestId;
      busy = true; submit.disabled = true; submit.textContent = 'Preparando seu pedido…';
      result.hidden = false; continueLink.hidden = true; status.textContent = ''; syncFloating();
      try {
        var response = await post('',payload);
        if (!response.ok || response.status !== 'pending_confirmation' || !/^[a-f0-9]{32}$/.test(response.token || '')) {
          status.textContent = response.status === 'rate_limited' ? 'Já recebemos pedidos recentes para este número. Tente novamente mais tarde.' : 'Não conseguimos preparar seu pedido. Confira o número e tente novamente.';
          event('capture_request_error'); return;
        }
        if (!contacts) throw Error('contacts_unavailable');
        pendingHref = whatsappHref(response.token,payload.marketing_opt_in,contacts[chosen.unit === 'sf' ? 'sf' : 'barra']);
        continueLink.hidden = false;
        status.textContent = 'Falta só confirmar: abra o WhatsApp abaixo e envie a mensagem preparada pelo mesmo número que você informou. Depois do envio, a Koisa Linda responde com os links dos modelos.';
        persist({kind:'pending',token:response.token,session:session,marketing:payload.marketing_opt_in,unit:chosen.unit === 'sf' ? 'sf' : 'barra',until:Date.now()+7*DAY});
        form.hidden = true; open.hidden = false; close.hidden = true; syncFloating(); open.setAttribute('aria-expanded','false');
        phone.value = ''; marketing.checked = false; syncFloating();
        event('capture_request_pending',{marketing_opt_in:payload.marketing_opt_in});
        if (!popup || popup.isOpen()) continueLink.focus({preventScroll:true});
      } catch (_) { status.textContent = 'Não foi possível confirmar o cadastro agora. Tente novamente; nenhum envio de WhatsApp parte deste formulário.'; event('capture_request_error'); }
      finally { busy=false;submit.disabled=false;submit.textContent='Receber modelos no WhatsApp'; }
    });
    phone.addEventListener('input',function () { phone.setCustomValidity(''); });
    continueLink.addEventListener('click',function () { if (pendingHref) { event('capture_whatsapp_open'); win.open(pendingHref,'_blank','noopener,noreferrer'); } });
    if (state.kind === 'pending' && /^[a-f0-9]{32}$/.test(state.token || '') && contacts) {
      pendingHref = whatsappHref(state.token,state.marketing === true,contacts[state.unit === 'sf' ? 'sf' : 'barra']);
      result.hidden = false; continueLink.hidden = false; status.textContent = 'Seu pedido aguarda confirmação. Abra o WhatsApp e envie a mensagem preparada pelo mesmo número informado. O pedido vale por 24 horas.';
      syncFloating();
    }
    if (win.KLCapturePopup) {
      popup = win.KLCapturePopup.mount(win, section, {
        isSuppressed:function(){return busy || Number(currentState().until) > Date.now();},
        onOpen:showForm,
        onClose:function(){
          form.hidden=true;open.hidden=false;close.hidden=true;open.setAttribute('aria-expanded','false');
          event('capture_invite_dismiss',{capture_surface:'popup'});syncFloating();
        }
      });
    }
  }
  return {DAY:DAY,normalizePhone:normalizePhone,makePayload:makePayload,whatsappHref:whatsappHref,readState:readState,saveState:saveState,isSuppressed:isSuppressed,init:init};
}));
