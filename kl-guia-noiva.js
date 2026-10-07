/* Koisa Linda · Guia da Noiva (landing /guia-da-noiva/).
 * Usa a mesma porta de lead do site (n8n kl-agenda/lead, schema site_lead.v1) com a origem
 * marcada em source_detail e variant. Depois do registro confirmado: botão do PDF e convite
 * para marcar a prova pelo calendário que o site já tem (/agendar/prova/, via KLProfileHandoff).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.KLGuiaNoiva = api; api.init(root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var ENDPOINT = 'https://n8n.janotattec.com.br/webhook/kl-agenda/lead';
  var SOURCE_DETAIL = 'guia_da_noiva_20261007';
  var VARIANT = 'guia-noiva';
  var STORES = ['barra', 'saofrancisco'];
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid'];
  function clean(v, n) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, n); }
  /* Mesmo critério do formulário de perfil: celular brasileiro com DDD. */
  function phone(s) {
    s = String(s || '').replace(/\D/g, '');
    if (s.length === 13 && s.indexOf('55') === 0) s = s.slice(2);
    return /^[1-9][0-9]9\d{8}$/.test(s) && !/^([0-9])\1{8}$/.test(s.slice(2)) ? '+55' + s : null;
  }
  function mask(s) {
    var d = String(s || '').replace(/\D/g, '');
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    d = d.slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  function validDate(s, today) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var d = new Date(s + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= today;
  }
  function validate(v, today) {
    if (!/[A-Za-zÀ-ÿ]{2}/.test(clean(v.nome, 100))) return 'Informe seu nome.';
    if (!phone(v.telefone)) return 'Confira o WhatsApp com DDD, por exemplo (21) 99999-9999.';
    if (!v.data_indefinida && !validDate(v.data_evento, today)) return 'Informe a data do casamento ou marque que ainda estão definindo.';
    if (STORES.indexOf(v.loja) < 0) return 'Escolha a loja mais perto de você.';
    if (!v.consentimento) return 'Para receber o guia, aceite o contato pelo WhatsApp.';
    return '';
  }
  function notes(v) {
    return 'Origem: Guia da Noiva (pediu o PDF pelo site)' + (v.data_indefinida ? '\nData do casamento: a definir' : '');
  }
  function payload(v, ctx) {
    var t = ctx.attribution || { first: {}, last: {} }, last = t.last || {};
    var p = {
      schema_version: '2026-08-27.site_lead.v1',
      source: 'site',
      source_detail: SOURCE_DETAIL,
      variant: VARIANT,
      stage: 'lead_form_completed',
      nome: clean(v.nome, 100),
      telefone: phone(v.telefone),
      ocasiao: 'noiva',
      loja: v.loja,
      data_evento: v.data_indefinida ? '' : v.data_evento,
      preferencia: 'sem_preferencia',
      notas: notes(v),
      consentimento: v.consentimento === true,
      sobrenome_confirmacao: clean(v.sobrenome_confirmacao, 100),
      session_id: ctx.session,
      attribution: t,
      analytics: ctx.analytics || { consent: false, version: '2026-09-06.measurement.v1' },
      landing_page: ctx.path,
      page_path: ctx.path,
      referrer: ctx.referrer || '',
      user_agent: ctx.userAgent || '',
      created_at_client: new Date().toISOString()
    };
    UTM.forEach(function (k) { p[k] = last[k] || ''; });
    return p;
  }
  function accepted(d) { return !!d && d.ok === true && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(d.lead_id || ''); }
  function bookingUrl(loja, params, profileSaved) {
    var p = new URLSearchParams();
    UTM.forEach(function (k) { if (params.get(k)) p.set(k, params.get(k)); });
    p.set('ocasiao', 'noiva');
    p.set('un', loja === 'saofrancisco' ? 'sf' : 'barra');
    p.set('ui_source', 'guia_da_noiva');
    return (profileSaved ? '/agendar/prova/?' : '/agendar/?') + p.toString();
  }
  function pixel(win, kind, name, params, opts) {
    try {
      if (typeof win.fbq !== 'function') return;
      if (opts) win.fbq(kind, name, params, opts); else win.fbq(kind, name, params);
    } catch (e) {}
  }
  function ga(win, name, params) { try { var t = win.KLTracking; if (t && t.gaEvent) t.gaEvent(name, params); } catch (e) {} }

  function init(win) {
    var doc = win.document, form = doc.getElementById('gn-form');
    if (!form) return;
    var preview = !/^(www\.)?koisalinda\.com\.br$/.test(win.location.hostname);
    var params = new URLSearchParams(win.location.search), busy = false;
    var session = (win.crypto && win.crypto.randomUUID) ? win.crypto.randomUUID() : 'gn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    var tel = doc.getElementById('gn-telefone'), date = doc.getElementById('gn-data'), noDate = doc.getElementById('gn-sem-data');
    var dialog = doc.getElementById('gn-booking'), go = doc.getElementById('gn-booking-go');
    var state = { store: '', lead: '', dialogShown: false, timer: 0 };
    doc.getElementById('preview').hidden = !preview;
    date.min = today;
    var un = params.get('un') === 'sf' ? 'saofrancisco' : (params.get('un') || params.get('loja') || '');
    var preset = form.querySelector('[name="loja"][value="' + un + '"]');
    if (preset) preset.checked = true;
    tel.addEventListener('input', function () { var m = mask(tel.value); if (m !== tel.value) tel.value = m; });
    noDate.addEventListener('change', function () { date.disabled = noDate.checked; if (noDate.checked) date.value = ''; });

    function read() {
      var v = {};
      new FormData(form).forEach(function (val, key) { v[key] = val; });
      v.consentimento = !!form.elements.consentimento.checked;
      v.data_indefinida = !!noDate.checked;
      v.data_evento = date.value || '';
      return v;
    }
    function error(msg) { var e = doc.getElementById('gn-error'); e.textContent = msg; e.hidden = !msg; }
    function openBooking(trigger) {
      if (!dialog || state.dialogShown) return;
      state.dialogShown = true;
      win.clearTimeout(state.timer);
      pixel(win, 'trackCustom', 'KL_Guia_Booking_Offer', { store: state.store, trigger: trigger });
      if (typeof dialog.showModal === 'function') { try { dialog.showModal(); return; } catch (e) {} }
      dialog.setAttribute('open', '');
    }
    function showSuccess(v, leadId) {
      state.store = v.loja; state.lead = leadId || '';
      var saved = false;
      var bridge = win.KLProfileHandoff;
      if (leadId && bridge) {
        try {
          saved = bridge.save(bridge.storage(win), {
            rota: 'equipe', nome: v.nome, telefone: String(v.telefone || '').replace(/\D/g, ''), ocasiao: 'noiva', loja: v.loja,
            data_evento: v.data_evento, data_indefinida: v.data_indefinida, consentimento: true, measurement: false
          }, leadId, notes(v)) === true;
        } catch (e) { saved = false; }
      }
      go.href = bookingUrl(v.loja, params, saved);
      doc.getElementById('gn-booking-copy').textContent = 'Escolha o dia e o horário na loja ' + (v.loja === 'barra' ? 'da Barra da Tijuca' : 'de São Francisco, em Niterói') + '. A equipe acompanha você na escolha e na prova dos vestidos.';
      form.hidden = true;
      doc.getElementById('gn-success').hidden = false;
      doc.getElementById('gn-success-title').focus();
      state.timer = win.setTimeout(function () { openBooking('timer'); }, 7000);
    }
    doc.getElementById('gn-download').addEventListener('click', function () {
      pixel(win, 'trackCustom', 'KL_Guia_Download', { store: state.store, content_name: 'guia_da_noiva' });
      ga(win, 'KL_Guia_Download', { store: state.store });
      win.setTimeout(function () { openBooking('download'); }, 900);
    });
    doc.getElementById('gn-open-booking').addEventListener('click', function () { state.dialogShown = false; openBooking('link'); });
    go.addEventListener('click', function () {
      pixel(win, 'trackCustom', 'KL_Guia_Booking_Click', { store: state.store });
      ga(win, 'KL_Guia_Booking_Click', { store: state.store });
    });

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var v = read(), m = validate(v, today);
      error(m);
      if (m) return;
      if (v.sobrenome_confirmacao) return;
      busy = true;
      var button = doc.getElementById('gn-send');
      button.disabled = true; button.textContent = 'Enviando…';
      try {
        if (preview) { showSuccess(v, ''); return; }
        var track = win.KLTracking;
        var identity = track && track.getGoogleIdentity ? await track.getGoogleIdentity(false) : { consent: false, version: '2026-09-06.measurement.v1' };
        var attribution = track && track.getAttribution ? track.getAttribution() : { first: {}, last: {} };
        var controller = new AbortController(), timer = win.setTimeout(function () { controller.abort(); }, 15000), response, data;
        var referrer = ''; try { referrer = doc.referrer ? new URL(doc.referrer).origin : ''; } catch (e) {}
        try {
          response = await win.fetch(ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
            body: JSON.stringify(payload(v, { session: session, attribution: attribution, analytics: identity, path: win.location.pathname, referrer: referrer, userAgent: win.navigator.userAgent }))
          });
          data = await response.json();
        } finally { win.clearTimeout(timer); }
        if (!response.ok || !accepted(data)) throw Error('unconfirmed');
        var params2 = { content_name: 'guia_da_noiva', content_category: 'noiva', store: v.loja, has_event_date: v.data_indefinida ? 'no' : 'yes', duplicate: data.duplicate === true ? 'yes' : 'no' };
        pixel(win, 'track', 'Lead', { content_name: 'guia_da_noiva', content_category: 'noiva', store: v.loja }, { eventID: 'guia-' + data.lead_id });
        pixel(win, 'trackCustom', 'KL_Guia_Form_Submit', params2);
        ga(win, 'generate_lead', { content_name: 'guia_da_noiva', store: v.loja });
        ga(win, 'KL_Guia_Form_Submit', params2);
        showSuccess(v, data.lead_id);
      } catch (e) {
        error('Ainda não conseguimos registrar. Seus dados continuam aqui. Tente de novo ou fale com a loja pelo WhatsApp no rodapé.');
        pixel(win, 'trackCustom', 'KL_Guia_Form_Error', { reason: 'request_failed' });
      } finally {
        busy = false; button.disabled = false; button.textContent = 'Receber o Guia da Noiva';
      }
    });
  }
  return { phone: phone, mask: mask, validDate: validDate, validate: validate, payload: payload, accepted: accepted, bookingUrl: bookingUrl, init: init };
}));
