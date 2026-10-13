/* Koisa Linda · /noivas/ e /debutantes/ · fluxo de 4 toques com 3 datas reais de prova (rascunho 12/10/2026).
 *
 * A ocasião vem do HTML: <div id="nf-fluxo" data-ocasiao="noiva|debutante">. Sem o atributo, é noiva.
 *
 * O que este arquivo faz:
 *  1. Quatro perguntas em botões (data do casamento, caminho, loja, estilo). Cada toque mostra
 *     o que fica "separado para você" e soma um item ao cartão.
 *  2. Ao escolher a loja, lê os horários REAIS da agenda da loja (mesma API do /agendar/) e diz
 *     quantos restam nos próximos 14 dias. Se a API falhar, a frase não aparece.
 *  3. No fim, mostra só 3 horários reais (o dia mais perto, um do meio e o mais longe, um
 *     horário em cada), pede nome e WhatsApp e envia o pedido pelo MESMO caminho do
 *     kl-agendar.js: POST /lead (cadastro com a origem da visita) e POST /pedido. Os eventos
 *     de pixel e GA4 usam os mesmos nomes e parâmetros do trackSchedule do kl-agendar.js, para
 *     KL_Schedule_Request_Success com ocasiao=noiva contar na conversão da campanha.
 *
 * Nada aqui inventa escassez: o número vem da agenda da loja e some quando a agenda não responde.
 * As respostas do fluxo vão para o campo `notas` do pedido (campo que a porta do site já aceita
 * e repassa à Lara como style_notes). A faixa de casamento não vai em `data_evento`, que só
 * aceita data exata.
 */
(function () {
  'use strict';

  var raiz = document.getElementById('nf-fluxo');
  if (!raiz) return;
  var corpo = raiz.querySelector('[data-nf-corpo]');
  if (!corpo) return;

  var API = 'https://n8n.janotattec.com.br/webhook/kl-agenda';
  var JANELA_DIAS = 14;
  var OCASIAO = raiz.getAttribute('data-ocasiao') === 'debutante' ? 'debutante' : 'noiva';
  var ROTA = OCASIAO === 'debutante' ? 'debutantes' : 'noivas';
  var DETALHE = OCASIAO === 'debutante' ? '15 anos' : 'vestido de noiva';

  var LOJAS = {
    saofrancisco: { un: 'sf', curto: 'São Francisco', nome: 'São Francisco', cidade: 'niteroi', whatsapp: '5521970858787' },
    barra: { un: 'barra', curto: 'Barra', nome: 'Barra da Tijuca', cidade: 'barra-da-tijuca', whatsapp: '5521966475383' }
  };

  var PERGUNTAS_NOIVA = [
    {
      id: 'data', titulo: 'Quando é o casamento?',
      opcoes: [
        ['3m', 'Até 3 meses', 'em até 3 meses'],
        ['6m', '3 a 6 meses', 'de 3 a 6 meses'],
        ['12m', '6 meses a 1 ano', 'de 6 meses a 1 ano'],
        ['12m_mais', 'Mais de 1 ano', 'daqui a mais de 1 ano'],
        ['sem_data', 'Sem data', 'ainda sem data']
      ]
    },
    {
      id: 'caminho', titulo: 'Como quer o vestido?',
      opcoes: [
        ['acervo', 'Do acervo', 'escolher um vestido do acervo'],
        ['desenhar', 'Desenhado pela Jussara', 'desenhar o meu vestido'],
        ['ajuda', 'Me ajude a decidir', 'ajuda para decidir entre acervo e desenho']
      ]
    },
    {
      id: 'loja', titulo: 'Qual loja?',
      opcoes: [
        ['saofrancisco', 'São Francisco, Niterói', 'São Francisco'],
        ['barra', 'Barra da Tijuca', 'Barra']
      ]
    },
    {
      id: 'estilo', titulo: 'Qual estilo?',
      opcoes: [
        ['princesa', 'Princesa', 'princesa'],
        ['sereia', 'Sereia', 'sereia'],
        ['corte-a', 'Corte A', 'corte A'],
        ['com-manga', 'Com manga', 'com manga'],
        ['renda', 'De renda', 'de renda'],
        ['minimalista', 'Minimalista', 'minimalista'],
        ['decote-v', 'Decote V', 'com decote V'],
        ['nao_sei', 'Ainda não sei', 'ainda não sei']
      ]
    }
  ];

  var PERGUNTAS_DEBUTANTE = [
    {
      id: 'data', titulo: 'Quando é a festa?',
      opcoes: [
        ['3m', 'Até 3 meses', 'em até 3 meses'],
        ['6m', '3 a 6 meses', 'de 3 a 6 meses'],
        ['12m', '6 meses a 1 ano', 'de 6 meses a 1 ano'],
        ['12m_mais', 'Mais de 1 ano', 'daqui a mais de 1 ano'],
        ['sem_data', 'Sem data', 'ainda sem data']
      ]
    },
    {
      id: 'vestidos', titulo: 'Quantos vestidos?',
      opcoes: [
        ['tres', 'Os três: entrada, valsa e dança', 'os três vestidos (entrada, valsa e dança)'],
        ['um', 'Só um', 'um vestido'],
        ['nao_sei', 'Ainda não sei', 'ainda não sabemos quantos vestidos']
      ]
    },
    {
      id: 'loja', titulo: 'Qual loja?',
      opcoes: [
        ['saofrancisco', 'São Francisco, Niterói', 'São Francisco'],
        ['barra', 'Barra da Tijuca', 'Barra']
      ]
    },
    {
      id: 'estilo', titulo: 'Qual estilo?',
      opcoes: [
        ['princesa', 'Princesa', 'princesa'],
        ['brilho', 'Com brilho', 'com brilho'],
        ['curto', 'Curto para dançar', 'curtos para dançar'],
        ['renda', 'Com renda', 'com renda'],
        ['nao_sei', 'Ainda não sei', 'ainda não sei']
      ]
    }
  ];
  var PERGUNTAS = OCASIAO === 'debutante' ? PERGUNTAS_DEBUTANTE : PERGUNTAS_NOIVA;

  var estado = {
    passo: 0,
    respostas: {},
    agenda: null,
    agendaFalhou: false,
    escolha: null,
    abertoEm: Date.now(),
    enviando: false,
    lead_id: '',
    leadSalvo: false,
    lead: { nome: '', telefone: '' }
  };

  /* ── utilidades ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function opcao(perguntaId, valor) {
    var p = PERGUNTAS.filter(function (x) { return x.id === perguntaId; })[0];
    return p ? p.opcoes.filter(function (o) { return o[0] === valor; })[0] : null;
  }
  function loja() { return LOJAS[estado.respostas.loja] || null; }
  function hora(h) { return String(h || '').replace(/^0/, '').replace(':', 'h'); }
  function qsParam(nome) {
    try { return new URLSearchParams(location.search).get(nome) || ''; } catch (e) { return ''; }
  }
  function hojeSP() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
      return p.year + '-' + p.month + '-' + p.day;
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }
  function diasEntre(a, b) {
    return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  }

  /* ── medição: mesmos nomes e parâmetros do trackSchedule do kl-agendar.js ─ */
  function measurementMode() {
    if (window.KLTracking && window.KLTracking.measurementMode) return window.KLTracking.measurementMode();
    return qsParam('utm_source') === 'qa' || qsParam('src') === 'qa' || qsParam('measurement_mode') === 'qa' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'qa' : 'live';
  }
  function requestReceipt(c, status) {
    if (window.KLTracking && window.KLTracking.receiptId) return window.KLTracking.receiptId('appointment', c, status);
    var id = String(c.appointment_id || '');
    return status >= 200 && status < 300 && /^(confirmed|pending_approval|pedido_registrado)$/.test(c.status || '') && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : '';
  }
  function trackSchedule(nome, extra, onceKey) {
    extra = extra || {};
    var l = estado.respostas.loja || undefined;
    var params = {
      measurement_mode: measurementMode(),
      funnel_sector: 'prova_agendada',
      schedule_experience: '20260906-prova-contexto',
      has_model_reference: 'no',
      schedule_variant: ROTA + '_fluxo_3_datas',
      variant: ROTA,
      loja: l,
      store: l,
      ocasiao: OCASIAO,
      step: String(estado.passo + 1),
      page_path: location.pathname || '/' + ROTA + '/'
    };
    Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && extra[k] !== '') params[k] = extra[k]; });
    if (window.KLTracking && window.KLTracking.measurementParams) params = window.KLTracking.measurementParams(nome, params);
    try {
      var key = onceKey ? nome + ':' + onceKey : '';
      window.__klScheduleSent = window.__klScheduleSent || {};
      if (key && window.__klScheduleSent[key]) return;
      if (key) window.__klScheduleSent[key] = true;
      window.__klScheduleEvents = window.__klScheduleEvents || [];
      window.__klScheduleEvents.push({ name: nome, params: params, ts: Date.now() });
      if (window.KLTracking && window.KLTracking.gaEvent) window.KLTracking.gaEvent(nome, params);
      else if (window.__klGA4Ready && typeof window.gtag === 'function') window.gtag('event', nome, params);
      else {
        window.__klGA4EventQueue = window.__klGA4EventQueue || [];
        if (window.__klGA4EventQueue.length < 100) window.__klGA4EventQueue.push({ name: nome, params: params });
      }
      if (params.measurement_mode !== 'qa' && typeof window.fbq === 'function') window.fbq('trackCustom', nome, params, params.event_id ? { eventID: params.event_id } : undefined);
    } catch (e) {}
  }
  function passoFluxo(step, valor) {
    trackSchedule(OCASIAO === 'debutante' ? 'KL_Debutantes_Flow_Step' : 'KL_Noivas_Flow_Step', { flow_step: step, value: valor || undefined });
  }
  function medirFluxo(action, step, choice) {
    trackSchedule('KL_Flow_' + action, { flow_action: action.toLowerCase(), flow_step: step, flow_choice: choice || undefined }, action === 'View' ? 'flowview:' + step : undefined);
  }

  /* Clique em qualquer botão de agendar da página (data-nf-agendar="origem"). */
  document.addEventListener('click', function (ev) {
    var alvo = ev.target && ev.target.closest ? ev.target.closest('[data-nf-agendar]') : null;
    if (!alvo) return;
    var un = alvo.getAttribute('data-nf-loja') || estado.respostas.loja || undefined;
    trackSchedule('KL_Schedule_Click', { ui_source: alvo.getAttribute('data-nf-agendar'), loja: un, store: un });
  }, true);

  /* ── origem e cadastro: cópia fiel do kl-agendar.js ─────────────────────── */
  function attributionDoLead() {
    if (window.KLTracking && typeof window.KLTracking.getAttribution === 'function') return window.KLTracking.getAttribution();
    var entry = { landing_path: location.pathname || '/' + ROTA + '/', captured_at: new Date().toISOString() };
    try { if (document.referrer) entry.referrer = new URL(document.referrer).origin; } catch (e) {}
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'fbclid'].forEach(function (key) {
      var value = qsParam(key);
      var click = key === 'gclid' || key === 'fbclid';
      if (!value || value.length > (click ? 512 : 120) || /[\x00-\x1f\x7f]/.test(value)) return;
      if (click) { if (/^[A-Za-z0-9._~-]+$/.test(value)) entry[key] = value; return; }
      if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) return;
      if (!(/^(utm_campaign|utm_content|utm_id)$/.test(key) && /^[A-Za-z0-9_.~-]+$/.test(value)) && /\+?\d[\d\s().-]{7,}\d/.test(value)) return;
      entry[key] = value;
    });
    return { first: entry, last: entry };
  }
  function origem() {
    try {
      var entry = attributionDoLead().last || {};
      var src = (entry.utm_source || '').toLowerCase();
      var campanha = entry.utm_campaign || '';
      var o = '';
      if (entry.gclid || /google|gbp/.test(src)) o = 'google';
      else if (entry.fbclid || /instagram|facebook|meta/.test(src) || src === 'ig') o = 'instagram';
      else {
        var ref = document.referrer ? new URL(document.referrer).hostname : '';
        if (/(^|\.)google\./.test(ref)) o = 'google';
        else if (/(^|\.)instagram\./.test(ref)) o = 'instagram';
      }
      if (o) sessionStorage.setItem('kl_origem', o);
      else o = sessionStorage.getItem('kl_origem') || 'direto';
      return campanha ? o + ':' + campanha : o;
    } catch (e) { return 'direto'; }
  }
  function sessionIdDaVisita() {
    if (window.KLTracking && window.KLTracking.getSessionId) return window.KLTracking.getSessionId();
    var id = window.__klScheduleSessionId || '';
    if (!id) { try { id = sessionStorage.getItem('kl_schedule_session_id') || ''; } catch (e) {} }
    if (!/^kl_[A-Za-z0-9_-]{6,80}$/.test(id)) id = 'kl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    window.__klScheduleSessionId = id;
    try { sessionStorage.setItem('kl_schedule_session_id', id); } catch (e) {}
    return id;
  }

  /* As respostas do fluxo, no mesmo formato curto "Rótulo: valor · Rótulo: valor" que o
   * kl-agendar.js usa para o perfil opcional. Vão no campo notas (até 400). */
  function notasDoFluxo() {
    var r = estado.respostas;
    var rotulos = OCASIAO === 'debutante'
      ? { data: 'Festa', vestidos: 'Vestidos', estilo: 'Estilo' }
      : { data: 'Casamento', caminho: 'Procura', estilo: 'Estilo' };
    var partes = [OCASIAO === 'debutante' ? 'Página de debutantes' : 'Página de noivas'];
    PERGUNTAS.forEach(function (p) {
      if (!rotulos[p.id]) return;
      var o = opcao(p.id, r[p.id]);
      if (o) partes.push(rotulos[p.id] + ': ' + o[2]);
    });
    return partes.join(' · ').slice(0, 400);
  }

  function leadPayload() {
    var attribution = attributionDoLead();
    var entry = attribution.last || {};
    return {
      schema_version: '2026-08-27.site_lead.v1',
      source: 'site',
      source_detail: ROTA + '_fluxo_3_datas',
      variant: ROTA,
      stage: 'lead_form_completed',
      nome: estado.lead.nome || '',
      telefone: estado.lead.telefone || '',
      ocasiao: OCASIAO,
      loja: estado.respostas.loja || 'saofrancisco',
      data_evento: '',
      preferencia: '',
      notas: notasDoFluxo(),
      consentimento: true,
      analytics: { consent: false, version: '2026-09-06.measurement.v1' },
      aberto_em: estado.abertoEm,
      sobrenome_confirmacao: '',
      attribution: attribution,
      landing_page: location.origin + (entry.landing_path || location.pathname),
      page_path: location.pathname || '/' + ROTA + '/',
      referrer: (function () { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch (e) { return ''; } })(),
      session_id: sessionIdDaVisita(),
      utm_source: entry.utm_source || '',
      utm_medium: entry.utm_medium || '',
      utm_campaign: entry.utm_campaign || '',
      utm_content: entry.utm_content || '',
      utm_term: entry.utm_term || '',
      utm_id: entry.utm_id || '',
      fbclid: entry.fbclid || '',
      gclid: entry.gclid || '',
      user_agent: navigator.userAgent || '',
      created_at_client: new Date().toISOString()
    };
  }

  function registrarLeadDoSite() {
    if (estado.lead_id && estado.leadSalvo) return Promise.resolve({ lead_id: estado.lead_id, cached: true });
    trackSchedule('KL_Lead_Form_Submit', { has_event_date: 'no', preference: 'none' }, 'leadsubmit:' + estado.lead.telefone);
    return fetch(API + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload())
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || !d || d.ok !== true || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(d.lead_id || ''))) throw new Error('invalid_receipt');
        return d;
      });
    }).then(function (d) {
      estado.lead_id = d.lead_id || '';
      estado.leadSalvo = !!estado.lead_id;
      try { if (estado.lead_id) sessionStorage.setItem('kl_site_lead_id', estado.lead_id); } catch (e) {}
      var newReceipt = !window.KLTracking || !window.KLTracking.firstReceipt || window.KLTracking.firstReceipt('lead', estado.lead_id);
      if (newReceipt) trackSchedule('KL_Lead_Form_Success', { duplicate: d.duplicate ? 'yes' : 'no', flow_step: 'cadastro', flow_action: 'receipt', event_id: 'lead:' + estado.lead_id }, 'leadsuccess:' + estado.lead_id);
      else trackSchedule('KL_Lead_Form_Reused', { duplicate: 'yes', flow_step: 'cadastro', flow_action: 'receipt' });
      return d;
    }).catch(function () {
      trackSchedule('KL_Lead_Form_Error', { reason: 'request_failed' });
      return null; // não trava a conversão
    });
  }

  function payloadPedido(nome, tel, honeypot) {
    return {
      nome: nome,
      telefone: tel,
      loja: estado.respostas.loja,
      ocasiao: OCASIAO,
      data: estado.escolha.data,
      hora: estado.escolha.hora,
      data_evento: '',
      notas: notasDoFluxo(),
      consentimento: true,
      aberto_em: estado.abertoEm,
      origem: origem(),
      experimento_agendamento: ROTA + '_fluxo_3_datas',
      variante_agendamento: ROTA,
      preferencia_atendimento: '',
      formulario_primeiro: false,
      lead_id: estado.lead_id || (function () { try { return sessionStorage.getItem('kl_site_lead_id') || ''; } catch (e) { return ''; } })(),
      sobrenome_confirmacao: honeypot || ''
    };
  }

  /* ── agenda real ─────────────────────────────────────────────────────────── */
  var consultas = {};
  function consultarAgenda(chaveLoja) {
    var existente = consultas[chaveLoja];
    if (existente && Date.now() - existente.em < 30000) return existente.promise;
    var entrada = { em: Date.now() };
    var limite = new Promise(function (_, rejeita) { setTimeout(function () { rejeita(new Error('tempo')); }, 12000); });
    entrada.promise = Promise.race([
      fetch(API + '/horarios?loja=' + encodeURIComponent(chaveLoja) + '&ocasiao=' + OCASIAO, { method: 'GET', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('agenda indisponível')); }),
      limite
    ]).then(function (d) {
      if (!d || d.ok !== true || !Array.isArray(d.dias)) throw new Error('agenda vazia');
      return d;
    }).catch(function (e) { if (consultas[chaveLoja] === entrada) delete consultas[chaveLoja]; throw e; });
    consultas[chaveLoja] = entrada;
    return entrada.promise;
  }

  /* Só os dias dos próximos 14, com horário livre. */
  function diasNaJanela(agenda) {
    var hoje = hojeSP();
    return (agenda && agenda.dias || []).filter(function (d) {
      var lista = d.horarios || [].concat(d.manha || [], d.tarde || []);
      var dist = diasEntre(hoje, d.data);
      return lista.length && dist >= 0 && dist <= JANELA_DIAS;
    });
  }
  function horariosDoDia(d) { return (d.horarios && d.horarios.length) ? d.horarios : [].concat(d.manha || [], d.tarde || []); }
  function contarHorarios(agenda) {
    return diasNaJanela(agenda).reduce(function (n, d) { return n + horariosDoDia(d).length; }, 0);
  }
  /* O dia mais perto, um do meio e o mais longe, dias diferentes. Os horários variam para
   * qualificar melhor: o mais perto no primeiro horário livre, o do meio à tarde e o mais
   * longe no último horário da manhã. Sem horário daquele período, usa o primeiro livre. Sempre real. */
  function primeiroDoPeriodo(d, periodo) {
    var lista = horariosDoDia(d);
    var filtro = lista.filter(function (h) { return periodo === 'tarde' ? h >= '12:00' : h < '12:00'; });
    // de manhã, o último horário da manhã: assim não repete o primeiro horário da data mais próxima
    if (periodo === 'manha') return filtro[filtro.length - 1] || lista[0];
    return filtro[0] || lista[0];
  }
  function tresDatas(agenda) {
    var dias = diasNaJanela(agenda);
    if (!dias.length) return [];
    var idx = [0, Math.floor((dias.length - 1) / 2), dias.length - 1];
    var periodos = ['primeiro', 'tarde', 'manha'];
    var vistos = {}, out = [];
    var rotulos = ['Mais próxima', 'No meio', 'Mais distante'];
    idx.forEach(function (i, k) {
      if (vistos[i]) return;
      vistos[i] = true;
      var d = dias[i];
      var h = periodos[k] === 'primeiro' ? horariosDoDia(d)[0] : primeiroDoPeriodo(d, periodos[k]);
      out.push({ data: d.data, hora: h, rotulo: d.rotulo || d.data, dia_semana: d.dia_semana || '', tipo: rotulos[k], opcao: ['proxima', 'meio', 'distante'][k] });
    });
    return out;
  }
  var LIMITE_NUMERO = 15;
  function fraseEscassez() {
    var l = loja();
    if (!l || !estado.agenda) return '';
    var dias = diasNaJanela(estado.agenda);
    if (!dias.length) return '';
    var frase = 'Próximo horário livre: ' + (dias[0].rotulo || dias[0].data) + ', ' + hora(horariosDoDia(dias[0])[0]) + '.';
    var n = contarHorarios(estado.agenda);
    if (n < LIMITE_NUMERO) frase += ' ' + (n === 1 ? 'Resta 1 horário' : 'Restam ' + n + ' horários') + ' em 14 dias.';
    return frase;
  }
  function buscarAgendaDaLoja() {
    var chave = estado.respostas.loja;
    estado.agenda = null; estado.agendaFalhou = false;
    return consultarAgenda(chave).then(function (d) {
      if (estado.respostas.loja !== chave) return;
      estado.agenda = d;
      trackSchedule('KL_Schedule_Slots_Loaded', { days_count: String(diasNaJanela(d).length) }, 'slots:' + chave + ':' + OCASIAO);
      atualizarEscassez();
    }).catch(function () {
      if (estado.respostas.loja !== chave) return;
      estado.agendaFalhou = true;
      trackSchedule('KL_Schedule_Slots_Error', {}, 'error:' + chave + ':' + OCASIAO);
      atualizarEscassez();
    });
  }
  function atualizarEscassez() {
    var frase = fraseEscassez();
    raiz.querySelectorAll('[data-nf-escassez]').forEach(function (n) {
      n.textContent = frase;
      n.hidden = !frase;
    });
    if (estado.passo === 4 && !estado.escolha) desenharFinal();
  }

  /* ── links ───────────────────────────────────────────────────────────────── */
  function linkEstilo() {
    var l = loja(), e = estado.respostas.estilo;
    if (!l || !e) return '';
    // Debutante não tem página de estilo no ar: vai para o catálogo de debutante da loja.
    if (OCASIAO === 'debutante') return '/catalogo/?cat=vestidos-debutante&un=' + l.un;
    if (e === 'nao_sei') return '/catalogo/?cat=vestidos-noiva&un=' + l.un;
    return '/noivas/' + e + '-' + l.cidade + '/';
  }
  function nomeEstilo() {
    var e = opcao('estilo', estado.respostas.estilo);
    return e ? e[2] : '';
  }
  function textoLinkEstilo() {
    var l = loja();
    if (!l) return '';
    if (OCASIAO === 'debutante') return 'Ver vestidos de debutante';
    return estado.respostas.estilo === 'nao_sei' ? 'Ver o acervo de noivas' : 'Ver vestidos ' + nomeEstilo();
  }
  function linkAgenda(origemUi) {
    var l = loja();
    return '/agendar/?ocasiao=' + OCASIAO + (l ? '&un=' + l.un : '') + '&ui_source=' + origemUi;
  }
  function linkWhats(texto) {
    var l = loja() || LOJAS.saofrancisco;
    return 'https://wa.me/' + l.whatsapp + '?text=' + encodeURIComponent(texto);
  }
  function mensagemWhats() {
    var r = estado.respostas;
    var d = opcao('data', r.data);
    if (OCASIAO === 'debutante') {
      var v = opcao('vestidos', r.vestidos);
      var t = 'Olá! Vim pela página de debutantes do site.';
      if (d) t += ' A festa é ' + d[2] + '.';
      if (v) t += ' Interesse: ' + v[2] + '.';
      if (r.estilo) t += ' Estilo: ' + nomeEstilo() + '.';
      return t;
    }
    var c = opcao('caminho', r.caminho);
    var txt = 'Olá! Sou noiva e vim pela página de noivas do site.';
    if (d) txt += ' Meu casamento é ' + d[2] + '.';
    if (c) txt += ' Quero ' + c[2] + '.';
    if (r.estilo) txt += ' Gosto do estilo ' + nomeEstilo() + '.';
    return txt;
  }

  /* ── ganhos de cada toque (copy aprovada, Q1 = sim) ──────────────────────── */
  function ganhos(id, valor) {
    var l = loja();
    if (OCASIAO === 'debutante') return ganhosDebutante(id, valor, l);
    if (id === 'data') {
      if (valor === '3m') return ['Acervo pronto: o caminho mais rápido.'];
      if (valor === 'sem_data') return ['Dá para provar antes de ter data.'];
      return ['A loja confere o vestido para a sua data.'];
    }
    if (id === 'caminho') {
      if (valor === 'acervo') return ['Ajuste no ateliê e provas incluídos.'];
      if (valor === 'desenhar') return ['Orçamento próprio, antes de contratar.'];
      return ['A consultora compara os dois com você.'];
    }
    if (id === 'loja' && l) return ['Consultora da loja, com hora marcada.'];
    if (id === 'estilo' && l && estado.respostas.caminho === 'desenhar') {
      return [valor === 'nao_sei' ? 'Leve suas referências para a Jussara.' : 'Leve referências ' + nomeEstilo() + ' para a Jussara.'];
    }
    return [];
  }
  /* Debutante: fala com a mãe e a filha, a menina no centro. Oferta de memory/lara/ofertas-ativas.json
   * (chave debutante, 12/10): 25% em cada um fechando os três; ajuste no ateliê e provas incluídos.
   * Acessórios e penteado saíram da página por decisão do Guilherme (12/10). Sem preço em reais nesta página (decisão do Guilherme). */
  function ganhosDebutante(id, valor, l) {
    if (id === 'data') {
      if (valor === '3m') return ['Acervo pronto: o caminho mais rápido.'];
      if (valor === 'sem_data') return ['Dá para provar antes de ter data.'];
      return ['A loja confere os vestidos para a data.'];
    }
    if (id === 'vestidos') {
      if (valor === 'tres') return ['25% em cada um dos três.'];
      if (valor === 'um') return ['Ajuste no ateliê e provas incluídos.'];
      return ['Fechando os três, 25% em cada um.'];
    }
    if (id === 'loja' && l) return ['Consultora da loja, com hora marcada.'];
    if (id === 'estilo') {
      if (valor === 'nao_sei') return ['A consultora ajuda vocês a escolher.'];
      return ['A consultora separa vestidos ' + nomeEstilo() + '.'];
    }
    return [];
  }
  function itemDebutante(id, r, l) {
    if (id === 'data' && r.data) return r.data === 'sem_data' ? 'Prova antes da data' : 'Data conferida';
    if (id === 'vestidos' && r.vestidos) {
      if (r.vestidos === 'tres') return '25% em cada vestido';
      if (r.vestidos === 'um') return 'Ajuste e provas incluídos';
      return '25% fechando os três';
    }
    if (id === 'loja' && l) return l.un === 'sf' ? 'Consultora em São Francisco' : 'Consultora na Barra';
    if (id === 'estilo' && r.estilo) return r.estilo === 'nao_sei' ? 'Estilo escolhido na prova' : 'Vestidos ' + nomeEstilo() + ' separados';
    return '';
  }
  function itemCartao(id) {
    var r = estado.respostas, l = loja();
    if (OCASIAO === 'debutante') return itemDebutante(id, r, l);
    if (id === 'data' && r.data) return r.data === 'sem_data' ? 'Prova antes da data' : 'Data conferida';
    if (id === 'caminho' && r.caminho) {
      if (r.caminho === 'acervo') return 'Ajuste e provas incluídos';
      if (r.caminho === 'desenhar') return 'Desenho da Jussara';
      return 'Consultora para decidir';
    }
    if (id === 'loja' && l) return l.un === 'sf' ? 'Consultora em São Francisco' : 'Consultora na Barra';
    if (id === 'estilo' && r.estilo && l) return r.estilo === 'nao_sei' ? 'Acervo de noivas separado' : 'Vestidos ' + nomeEstilo() + ' separados';
    return '';
  }
  function cartaoSeparado(titulo) {
    var itens = PERGUNTAS.map(function (p) { return itemCartao(p.id); }).filter(Boolean);
    if (!itens.length) return '';
    return '<aside class="nf-separado" aria-live="polite"><p class="nf-separado-t">' + esc(titulo || 'Separado para você') + '</p><ul>' +
      itens.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></aside>';
  }

  /* ── desenho das telas ───────────────────────────────────────────────────── */
  function progresso(i) {
    return '<div class="nf-progresso"><span>' + (i + 1) + ' de 4</span><div class="nf-barra" aria-hidden="true"><i style="transform:scaleX(' + ((i + 1) / 4) + ')"></i></div></div>';
  }
  function focar(sel) {
    var n = corpo.querySelector(sel);
    if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} }
  }
  function trazerParaVista() {
    var topo = raiz.getBoundingClientRect().top;
    if (topo < 0 || topo > window.innerHeight * 0.6) {
      var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + topo - 90, behavior: reduzido ? 'auto' : 'smooth' });
    }
  }

  function desenharPergunta(i) {
    estado.passo = i;
    var p = PERGUNTAS[i];
    medirFluxo('View', p.id);
    var atual = estado.respostas[p.id];
    var html = progresso(i) + '<h2 class="nf-pergunta" tabindex="-1">' + esc(p.titulo) + '</h2>' +
      '<div class="nf-opcoes' + (p.opcoes.length > 5 ? ' nf-opcoes-grade' : '') + '" role="group" aria-label="' + esc(p.titulo) + '">' +
      p.opcoes.map(function (o) {
        return '<button type="button" class="nf-op" data-kl-track-manual="true" data-nf-op="' + esc(o[0]) + '" aria-pressed="' + (atual === o[0] ? 'true' : 'false') + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>';
    if (atual) {
      var g = ganhos(p.id, atual);
      html += '<div class="nf-ganho" role="status">' + g.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
        (p.id === 'loja' ? '<p class="nf-escassez" data-nf-escassez' + (fraseEscassez() ? '' : ' hidden') + '>' + esc(fraseEscassez()) + '</p>' : '') +
        (p.id === 'estilo' && estado.respostas.caminho !== 'desenhar' ? '<p><a class="nf-link" href="' + esc(linkEstilo()) + '">' + esc(textoLinkEstilo()) + '</a></p>' : '') +
        '</div>' +
        '<div class="nf-acoes"><button type="button" class="nf-btn" data-kl-track-manual="true" data-nf-seguir>' + (i === 3 ? 'Ver horários' : 'Continuar') + '</button></div>';
    }
    if (i > 0) html += '<button type="button" class="nf-voltar" data-kl-track-manual="true" data-nf-voltar>Voltar</button>';
    if (i > 0) html += cartaoSeparado();
    corpo.innerHTML = html;

    corpo.querySelectorAll('[data-nf-op]').forEach(function (b) {
      b.addEventListener('click', function () {
        var valor = b.getAttribute('data-nf-op');
        var mudouLoja = p.id === 'loja' && estado.respostas.loja !== valor;
        estado.respostas[p.id] = valor;
        medirFluxo('Answer', p.id, valor);
        if (mudouLoja) { estado.escolha = null; }
        passoFluxo((i + 1) + '_' + p.id, valor);
        if (p.id === 'loja') {
          trackSchedule('KL_Schedule_Unit_Select', { field: 'loja', value: valor });
          if (mudouLoja || !estado.agenda) buscarAgendaDaLoja();
        }
        desenharPergunta(i);
        focar('[data-nf-seguir]');
      });
    });
    var seguir = corpo.querySelector('[data-nf-seguir]');
    if (seguir) seguir.addEventListener('click', function () {
      medirFluxo('Advance', p.id);
      if (i < 3) desenharPergunta(i + 1); else desenharFinal();
      focar('.nf-pergunta, .nf-final-t');
      trazerParaVista();
    });
    var voltar = corpo.querySelector('[data-nf-voltar]');
    if (voltar) voltar.addEventListener('click', function () { medirFluxo('Back', p.id); desenharPergunta(i - 1); focar('.nf-pergunta'); });
  }

  function desenharFinal() {
    estado.passo = 4;
    medirFluxo('View', 'horarios');
    estado.escolha = null;
    var l = loja();
    var datas = estado.agenda ? tresDatas(estado.agenda) : [];
    var esperando = !estado.agenda && !estado.agendaFalhou;
    // As datas vêm antes do cartão: no celular, o cartão de 4 itens empurrava os horários para fora da tela.
    var html = '<h2 class="nf-final-t" tabindex="-1">Escolha o horário da sua prova.</h2>';

    if (datas.length) {
      passoFluxo('5_datas_vistas', String(datas.length));
      html += '<div class="nf-datas-bloco"><p class="nf-datas-t">Loja ' + esc(l.nome) + '</p>' +
        '<div class="nf-datas">' + datas.map(function (d, k) {
          return '<button type="button" class="nf-data" data-kl-track-manual="true" data-nf-data="' + k + '" data-nf-agendar="' + ROTA + '_fluxo_data">' +
            '<span class="nf-data-tipo">' + esc(d.tipo) + '</span><span class="nf-data-dia">' + esc(d.rotulo) + '</span><span class="nf-data-hora">' + esc(hora(d.hora)) + '</span></button>';
        }).join('') + '</div>' +
        '<p class="nf-outros"><a href="' + esc(linkAgenda(ROTA + '_fluxo_outros_horarios')) + '" data-nf-agendar="' + ROTA + '_fluxo_outros_horarios">Ver outros horários</a></p></div>';
    } else if (esperando) {
      html += '<p class="nf-texto nf-carregando" role="status">Consultando a agenda da loja ' + esc(l.nome) + '…</p>';
    } else {
      html += '<div class="nf-acoes"><a class="nf-btn" href="' + esc(linkAgenda(ROTA + '_fluxo_prova')) + '" data-nf-agendar="' + ROTA + '_fluxo_prova">Marcar minha prova</a></div>';
    }

    html += '<div class="nf-alternativas">' +
      '<a class="nf-link" target="_blank" rel="noopener" href="' + esc(linkWhats(mensagemWhats())) + '">Prefere conversar? WhatsApp da loja</a>';
    if (estado.respostas.caminho === 'desenhar') {
      html += '<a class="nf-link" href="/agendar/perfil/?rota=jussara&amp;ocasiao=noiva&amp;un=' + l.un + '">Análise do vestido com a Jussara</a>' +
        '<small>Reservada com sinal; o valor vem antes.</small>';
    }
    html += '<a class="nf-link" href="' + esc(linkEstilo()) + '">' + esc(textoLinkEstilo()) + '</a></div>' +
      cartaoSeparado() +
      '<button type="button" class="nf-voltar" data-kl-track-manual="true" data-nf-voltar>Voltar</button>';
    corpo.innerHTML = html;

    corpo.querySelectorAll('[data-nf-data]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = datas[Number(b.getAttribute('data-nf-data'))];
        estado.escolha = d;
        medirFluxo('Answer', 'horarios', d.opcao);
        trackSchedule('KL_Schedule_Time_Select', { selected_day: d.data, period: d.hora < '12:00' ? 'manha' : 'tarde', date_option: d.opcao });
        passoFluxo('6_data_escolhida', d.data);
        desenharFormulario();
      });
    });
    corpo.querySelector('[data-nf-voltar]').addEventListener('click', function () { desenharPergunta(3); focar('.nf-pergunta'); });
  }

  function desenharFormulario() {
    var l = loja(), d = estado.escolha;
    medirFluxo('View', 'cadastro');
    trackSchedule('KL_Schedule_Form_Start', {}, 'form:' + estado.respostas.loja + ':' + OCASIAO + ':' + d.data + ':' + d.hora);
    passoFluxo('7_formulario');
    corpo.innerHTML = '<h2 class="nf-final-t" tabindex="-1">Quem a loja vai esperar?</h2>' +
      '<p class="nf-resumo"><b>' + esc(d.rotulo) + ', ' + esc(hora(d.hora)) + '</b> · ' + esc(l.nome) + '</p>' +
      '<form class="nf-form" novalidate>' +
      '<div class="nf-campo" data-c="nome"><label for="nf-nome">Nome</label><input id="nf-nome" type="text" autocomplete="name" maxlength="80" required></div>' +
      '<div class="nf-campo" data-c="tel"><label for="nf-tel">WhatsApp com DDD</label>' +
      '<input id="nf-tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(21) 90000-0000" required><small class="nf-erro">Confira o número com DDD.</small></div>' +
      '<label class="nf-mel" aria-hidden="true">Não preencha<input id="nf-mel" type="text" tabindex="-1" autocomplete="off"></label>' +
      '<label class="nf-aceite"><input id="nf-aceite" type="checkbox" required><span>Autorizo o uso do meu nome e WhatsApp para esta prova. <a href="/privacidade/" target="_blank" rel="noopener">Privacidade</a></span></label>' +
      '<small class="nf-erro" id="nf-erro-aceite">Marque o aceite para enviar.</small>' +
      '<div class="nf-acoes"><button type="submit" class="nf-btn" data-kl-track-manual="true" id="nf-enviar">Pedir este horário</button>' +
      '<button type="button" class="nf-voltar" data-kl-track-manual="true" data-nf-voltar>Trocar horário</button></div></form>';
    var tel = corpo.querySelector('#nf-tel');
    tel.addEventListener('input', function (ev) {
      var dg = ev.target.value.replace(/\D/g, '').slice(0, 11), s = dg;
      if (dg.length > 2) s = '(' + dg.slice(0, 2) + ') ' + dg.slice(2);
      if (dg.length > 7) s = '(' + dg.slice(0, 2) + ') ' + dg.slice(2, dg.length > 10 ? 7 : 6) + '-' + dg.slice(dg.length > 10 ? 7 : 6);
      ev.target.value = s;
    });
    corpo.querySelector('[data-nf-voltar]').addEventListener('click', function () { desenharFinal(); focar('.nf-final-t'); });
    corpo.querySelector('form').addEventListener('submit', enviar);
    ['#nf-nome', '#nf-tel'].forEach(function (selector) {
      corpo.querySelector(selector).addEventListener('input', function () {
        trackSchedule('KL_Flow_Input_Start', { flow_step: 'cadastro', flow_action: 'input_start' }, 'input-start');
      });
    });
    focar('#nf-nome');
  }

  function marcarErro(campo, tem) {
    var c = corpo.querySelector('[data-c="' + campo + '"]');
    if (c) c.classList.toggle('erro', !!tem);
  }

  function enviar(ev) {
    ev.preventDefault();
    if (estado.enviando) return;
    var nome = corpo.querySelector('#nf-nome').value.trim();
    var tel = corpo.querySelector('#nf-tel').value.replace(/\D/g, '');
    var aceite = corpo.querySelector('#nf-aceite').checked;
    var faltou = false;
    marcarErro('nome', nome.length < 2); if (nome.length < 2) faltou = true;
    marcarErro('tel', tel.length < 10 || tel.length > 11); if (tel.length < 10 || tel.length > 11) faltou = true;
    corpo.querySelector('#nf-erro-aceite').style.display = aceite ? 'none' : 'block';
    if (!aceite) faltou = true;
    if (faltou) {
      trackSchedule('KL_Flow_Validation_Error', { flow_step: 'cadastro', flow_action: 'validation_error', flow_choice: (nome.length < 2 ? 'nome_' : '') + (tel.length < 10 || tel.length > 11 ? 'telefone_' : '') + (!aceite ? 'aceite' : '') });
      var primeiro = corpo.querySelector('.nf-campo.erro input') || corpo.querySelector('#nf-aceite');
      if (primeiro) primeiro.focus();
      return;
    }
    var honeypot = corpo.querySelector('#nf-mel').value;
    var botao = corpo.querySelector('#nf-enviar');
    estado.lead = { nome: nome, telefone: tel };
    estado.leadSalvo = false;
    estado.enviando = true;
    botao.disabled = true; botao.textContent = 'Enviando…';
    // Igual ao kl-agendar.js: o cadastro com a origem sai antes do pedido, mas o pedido
    // não espera mais de 3 segundos por ele.
    var semEsperarDemais = new Promise(function (pronto) { setTimeout(function () { pronto(null); }, 3000); });
    Promise.race([registrarLeadDoSite(), semEsperarDemais]).then(function () {
      enviarPayload(payloadPedido(nome, tel, honeypot), botao, nome);
    });
  }

  function enviarPayload(payload, botao, nome) {
    var d = estado.escolha;
    trackSchedule('KL_Schedule_Request_Submit', { selected_day: d.data, selected_time: d.hora, form_first: 'no', has_profile: 'yes' });
    fetch(API + '/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
      .then(function (r) {
        estado.enviando = false;
        if (r.corpo && r.corpo.ok === true) {
          var receipt = requestReceipt(r.corpo, r.status);
          if (receipt) {
            var first = !window.KLTracking || !window.KLTracking.firstReceipt || window.KLTracking.firstReceipt('request', receipt);
            trackSchedule(first ? 'KL_Schedule_Request_Success' : 'KL_Schedule_Request_Reused', { status: String(r.status), appointment_status: r.corpo.status, duplicate: r.corpo.duplicado ? 'yes' : 'no', flow_step: 'pedido_recebido', flow_action: 'receipt', event_id: 'request:' + receipt });
          } else trackSchedule('KL_Schedule_Receipt_Unverified', { flow_step: 'pedido_recebido', flow_action: 'error' });
          return pronto(r.corpo);
        }
        if (r.status === 409) {
          delete consultas[estado.respostas.loja];
          trackSchedule('KL_Schedule_Request_Conflict', { status: String(r.status) });
          estado.agenda = null;
          buscarAgendaDaLoja();
          desenharFinal();
          return aviso((r.corpo && r.corpo.mensagem) || 'Esse horário acabou de ser reservado. Escolha outro.');
        }
        botao.disabled = false; botao.textContent = 'Pedir este horário';
        trackSchedule('KL_Schedule_Request_Error', { status: String(r.status) });
        aviso((r.corpo && r.corpo.mensagem) || 'Não consegui registrar agora. Tente de novo em instantes.');
      })
      .catch(function () {
        estado.enviando = false;
        trackSchedule('KL_Schedule_Request_Network_Error', {});
        falhaNoEnvio(nome);
      });
  }

  function aviso(msg) {
    var caixa = document.createElement('div');
    caixa.className = 'nf-aviso';
    caixa.setAttribute('role', 'alert');
    caixa.textContent = msg;
    corpo.insertBefore(caixa, corpo.firstChild);
  }

  function quandoTexto() {
    var d = estado.escolha;
    return d ? d.rotulo + ', ' + hora(d.hora) : '';
  }

  function falhaNoEnvio(nome) {
    var l = loja();
    var quando = quandoTexto();
    corpo.innerHTML = '<h2 class="nf-final-t" tabindex="-1">Quase lá</h2>' +
      '<p class="nf-texto">O pedido não saiu. Mande pelo WhatsApp, já com o horário.</p>' +
      '<div class="nf-acoes"><a class="nf-btn" target="_blank" rel="noopener" href="' +
      esc(linkWhats('Olá! Sou ' + nome + '. Vim pela página de ' + ROTA + ' do site e quero agendar uma prova de ' + DETALHE + ' na unidade ' + l.nome + ' em ' + quando + '. ' + notasDoFluxo() + '.')) +
      '">Enviar pelo WhatsApp</a></div>';
    focar('.nf-final-t');
  }

  /* Tela de sucesso: mesmo comportamento do pronto() do kl-agendar.js. */
  function pronto(c) {
    var l = loja();
    var status = String(c.status || '').toLowerCase();
    var confirmado = status === 'confirmed';
    var quando = c.quando || quandoTexto();
    var duvida = confirmado
      ? 'Olá! Acabei de confirmar uma prova pelo site da Koisa Linda para ' + quando + ' na unidade ' + l.nome + '. Tenho uma dúvida antes de ir.'
      : 'Olá! Acabei de pedir um horário de prova pelo site da Koisa Linda para ' + quando + ' na unidade ' + l.nome + '. Tenho uma dúvida sobre o agendamento.';
    passoFluxo('8_pedido_enviado', confirmado ? 'confirmed' : 'pending_approval');
    corpo.innerHTML = '<div class="nf-pronto">' +
      '<div class="nf-selo" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h2 class="nf-final-t" tabindex="-1">' + esc(confirmado ? 'Prova confirmada.' : 'Pedido enviado.') + '</h2>' +
      '<p class="nf-quando">' + esc(quando) + ' · ' + esc(l.nome) + '</p>' +
      '<p class="nf-texto">' + (confirmado ? 'A loja espera você e já tem as suas respostas.' : 'A loja confirma pelo WhatsApp, já com as suas respostas.') + '</p>' +
      '<div class="nf-acoes"><a class="nf-btn" href="' + esc(linkEstilo()) + '">' + esc(textoLinkEstilo()) + '</a>' +
      '<a class="nf-btn nf-btn-leve" target="_blank" rel="noopener" href="' + esc(linkWhats(duvida)) + '">Dúvidas no WhatsApp</a></div></div>';
    var fichaUrl = String(c.ficha_url || '');
    if (confirmado && OCASIAO === 'noiva' && /^https:\/\/koisalinda\.com\.br\/noivas\/sua-prova\/#[a-f0-9]{64}$/.test(fichaUrl)) {
      var ficha = document.createElement('p');
      ficha.className = 'nf-texto';
      ficha.innerHTML = '<a class="nf-link" rel="noreferrer" referrerpolicy="no-referrer">Preparar minha prova (opcional)</a>';
      ficha.querySelector('a').href = fichaUrl;
      corpo.querySelector('.nf-pronto').appendChild(ficha);
    }
    focar('.nf-final-t');
    trazerParaVista();

    var appointmentId = String(c.appointment_id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) return;
    var eventKey = status + ':' + appointmentId;
    var sent = window.__klAppointmentEvents || [];
    try {
      var stored = sessionStorage.getItem('kl_appointment_events');
      if (stored) sent = sent.concat(JSON.parse(stored));
    } catch (e) {}
    if (!Array.isArray(sent)) sent = [];
    if (sent.indexOf(eventKey) > -1) return;
    if (confirmado) {
      try { if (measurementMode() !== 'qa' && typeof window.fbq === 'function') window.fbq('track', 'Schedule', { content_category: OCASIAO }, { eventID: appointmentId }); } catch (e) {}
      trackSchedule('agendamento_site', { appointment_status: 'confirmed' }, eventKey);
    } else if (status === 'pending_approval' || status === 'pedido_registrado') {
      trackSchedule('KL_Schedule_Pending_Approval', { appointment_status: 'pending_approval' }, eventKey);
    } else return;
    sent.push(eventKey);
    window.__klAppointmentEvents = sent.slice(-100);
    try { sessionStorage.setItem('kl_appointment_events', JSON.stringify(window.__klAppointmentEvents)); } catch (e) {}
  }

  /* "Responder as 4 perguntas", no fim da página: volta ao fluxo. */
  document.querySelectorAll('[data-nf-ir-fluxo]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      trackSchedule(OCASIAO === 'debutante' ? 'KL_Debutantes_Flow_Return' : 'KL_Noivas_Flow_Return', { ui_source: a.getAttribute('data-nf-ir-fluxo') });
      raiz.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { focar('.nf-pergunta, .nf-final-t'); }, 400);
    });
  });

  raiz.classList.add('nf-pronto-js');
  desenharPergunta(0);
}());
