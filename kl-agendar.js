/* Koisa Linda — escolha de horário da prova de noiva e debutante.
 *
 * Fluxos A/B: ocasião e unidade → dia e horário → quem é você.
 * Variante D: seus dados → ocasião/unidade → dia/horário → envio.
 *
 * A agenda vem da loja de verdade: os horários oferecidos aqui já descontam o
 * que está no calendário da unidade e o que está esperando confirmação no CRM.
 * O que esta tela NUNCA faz é prometer horário confirmado — quem confirma é a
 * equipe da loja, e dizer o contrário quebraria a promessa em mais de um terço
 * dos casos.
 *
 * Se a agenda não responder, a cliente não fica sem caminho: o WhatsApp da
 * unidade escolhida aparece com a mensagem já escrita.
 */
(function () {
  'use strict';

  var API = 'https://n8n.janotattec.com.br/webhook/kl-agenda';

  var LOJAS = {
    barra: {
      nome: 'Barra da Tijuca',
      detalhe: 'Shopping Downtown',
      whatsapp: '5521966475383',
      horario: 'Segunda a sábado, 9h às 19h',
    },
    saofrancisco: {
      nome: 'São Francisco',
      detalhe: 'Niterói',
      whatsapp: '5521970858787',
      horario: 'Seg a sex, 9h às 18h · Sáb, 9h às 14h',
    },
  };
  var OCASIOES = {
    noiva: { nome: 'Noiva', detalhe: 'vestido de noiva' },
    debutante: { nome: 'Debutante', detalhe: '15 anos' },
  };

  var estado = {
    passo: 1,
    ocasiao: '',
    loja: '',
    data: '',
    hora: '',
    dias: [],
    abertoEm: Date.now(),
    enviando: false,
    variante: '',
    lead: { nome: '', telefone: '', data_evento: '', notas: '', preferencia: '' },
    lead_id: '',
    leadSalvo: false,
  };

  var cartao = document.getElementById('cartao');
  var trilha = document.getElementById('trilha');
  var rotuloPasso = document.getElementById('rotuloPasso');

  var ROTULOS = ['', 'Passo 1 de 3 · Ocasião e unidade', 'Passo 2 de 3 · Dia e horário', 'Passo 3 de 3 · Seus dados', 'Pronto'];
  var ROTULOS_D = ['', 'Passo 1 de 3 · Seus dados', 'Passo 2 de 3 · Ocasião e unidade', 'Passo 3 de 3 · Dia e horário', 'Pronto'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* A mesma leitura de origem que o kl-tracking.js usa nos links de WhatsApp,
   * para o pedido feito aqui contar na mesma régua dos que chegam por lá. */
  function origem() {
    try {
      var sp = new URLSearchParams(location.search);
      var src = (sp.get('utm_source') || '').toLowerCase();
      var campanha = sp.get('utm_campaign') || '';
      var o = '';
      if (sp.get('gclid') || /google|gbp/.test(src)) o = 'google';
      else if (sp.get('fbclid') || /instagram|facebook|meta/.test(src) || src === 'ig') o = 'instagram';
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

  function varianteDaVisita() {
    try {
      var sp = new URLSearchParams(location.search);
      var fluxo = (sp.get('fluxo') || sp.get('flow') || '').toLowerCase();
      var v = (sp.get('variant') || sp.get('ab') || '').toLowerCase();
      if (fluxo === 'formulario' || fluxo === 'formulário' || fluxo === 'dados') v = 'd';
      if (v === '1') v = 'a';
      if (v === '2') v = 'b';
      if (v !== 'a' && v !== 'b' && v !== 'd') v = sessionStorage.getItem('kl_schedule_variant') || '';
      if (v !== 'a' && v !== 'b' && v !== 'd') {
        var key = String(navigator.userAgent || '') + '|' + String(screen.width || '') + '|' + String(new Date().getDate());
        var sum = 0;
        for (var i = 0; i < key.length; i++) sum = (sum + key.charCodeAt(i)) % 997;
        v = sum % 2 ? 'b' : 'a';
      }
      sessionStorage.setItem('kl_schedule_variant', v);
      return v;
    } catch (e) { return 'a'; }
  }

  function normalizarLoja(loja) {
    if (loja === 'sf' || loja === 'niteroi' || loja === 'sao-francisco') return 'saofrancisco';
    return loja;
  }

  function nomeVariante() {
    return estado.variante === 'd' ? 'formulario_primeiro' : (estado.variante === 'b' ? 'horarios_disponiveis' : 'agendar_prova');
  }

  function qsParam(nome) {
    try { return new URLSearchParams(location.search).get(nome) || ''; } catch (e) { return ''; }
  }

  /* O cadastro com a origem da visita. Ele nasceu preso à variante D e, por
   * isso, `site_leads` ficava vazia justamente no fluxo que todo o tráfego pago
   * usa — a porta parecia morta mesmo quando agendava. Vale para as duas. */
  function leadPayloadD(stage) {
    return {
      schema_version: '2026-08-27.site_lead.v1',
      source: 'site',
      source_detail: estado.variante === 'd' ? 'agendamento_formulario_d' : 'agendamento_agenda_primeiro',
      variant: estado.variante || 'a',
      stage: stage || 'lead_form_completed',
      nome: estado.lead.nome || '',
      telefone: estado.lead.telefone || '',
      ocasiao: estado.ocasiao || 'noiva',
      loja: estado.loja || 'saofrancisco',
      data_evento: estado.lead.data_evento || '',
      preferencia: estado.lead.preferencia || '',
      notas: estado.lead.notas || '',
      consentimento: true,
      aberto_em: estado.abertoEm,
      sobrenome_confirmacao: '',
      landing_page: location.href,
      page_path: location.pathname || '/agendar.html',
      referrer: document.referrer || '',
      session_id: (function () {
        try {
          var k = 'kl_schedule_session_id';
          var v = sessionStorage.getItem(k);
          if (!v) { v = 'kl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(k, v); }
          return v;
        } catch (e) { return ''; }
      })(),
      utm_source: qsParam('utm_source'),
      utm_medium: qsParam('utm_medium'),
      utm_campaign: qsParam('utm_campaign'),
      utm_content: qsParam('utm_content'),
      utm_term: qsParam('utm_term'),
      fbclid: qsParam('fbclid'),
      gclid: qsParam('gclid'),
      user_agent: navigator.userAgent || '',
      created_at_client: new Date().toISOString()
    };
  }

  function registrarLeadDoSite() {
    if (!leadValido()) return Promise.resolve(null);
    if (estado.lead_id && estado.leadSalvo) return Promise.resolve({ lead_id: estado.lead_id, cached: true });
    trackSchedule('KL_Lead_Form_Submit', { has_event_date: estado.lead.data_evento ? 'yes' : 'no', preference: estado.lead.preferencia || 'none' }, 'leadsubmit:' + estado.lead.telefone);
    return fetch(API + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayloadD('lead_form_completed'))
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok || !d || d.ok !== true) throw new Error((d && d.reason) || ('http ' + r.status)); return d; });
    }).then(function (d) {
      estado.lead_id = d.lead_id || '';
      estado.leadSalvo = !!estado.lead_id;
      try { if (estado.lead_id) sessionStorage.setItem('kl_site_lead_id', estado.lead_id); } catch (e) {}
      trackSchedule('KL_Lead_Form_Success', { duplicate: d.duplicate ? 'yes' : 'no' }, 'leadsuccess:' + estado.lead_id);
      return d;
    }).catch(function (err) {
      trackSchedule('KL_Lead_Form_Error', { reason: String(err && err.message || 'erro').slice(0, 80) });
      return null; // não trava a conversão: a cliente continua para escolher horário
    });
  }

  function trackSchedule(nome, extra, onceKey) {
    extra = extra || {};
    var params = {
      schedule_variant: nomeVariante(),
      variant: estado.variante || 'a',
      loja: estado.loja || undefined,
      store: estado.loja || undefined,
      ocasiao: estado.ocasiao || undefined,
      step: String(estado.passo || 1),
      page_path: location.pathname || '/agendar.html'
    };
    Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && extra[k] !== '') params[k] = extra[k]; });
    try {
      var key = onceKey ? nome + ':' + onceKey : '';
      window.__klScheduleSent = window.__klScheduleSent || {};
      if (key && window.__klScheduleSent[key]) return;
      if (key) window.__klScheduleSent[key] = true;
      window.__klScheduleEvents = window.__klScheduleEvents || [];
      window.__klScheduleEvents.push({ name: nome, params: params, ts: Date.now() });
      if (typeof window.gtag === 'function') window.gtag('event', nome, params);
      if (typeof window.fbq === 'function') window.fbq('trackCustom', nome, params);
    } catch (e) {}
  }

  function aplicarCopyVariante() {
    var eyebrow = document.getElementById('scheduleEyebrow');
    var title = document.getElementById('scheduleTitle');
    var desc = document.getElementById('scheduleDesc');
    if (!title || !desc) return;
    if (estado.variante === 'd') {
      if (eyebrow) eyebrow.textContent = 'Pré-agendamento com cuidado';
      title.textContent = 'Sua história chega antes de você.';
      desc.textContent = 'Conte seu momento, escolha a unidade e o melhor horário. A equipe recebe suas informações antes da prova para preparar cada detalhe com cuidado.';
    } else if (estado.variante === 'b') {
      if (eyebrow) eyebrow.textContent = 'Horários disponíveis por unidade';
      title.textContent = 'Veja o melhor horário para sua prova';
      desc.textContent = 'Escolha Barra ou São Francisco, veja dias disponíveis e peça a reserva pelo site. A equipe confirma tudo pelo WhatsApp da unidade.';
    } else {
      if (eyebrow) eyebrow.textContent = 'Prova com hora marcada';
      title.textContent = 'Escolha o seu horário';
      desc.textContent = 'Noiva e debutante são atendidas com hora marcada: a equipe separa os modelos antes de você chegar e o provador fica reservado para você.';
    }
    document.body.setAttribute('data-schedule-variant', estado.variante || 'a');
  }

  function textoUnidade(k) {
    if (k === 'saofrancisco') return '<div class="unit-proof"><b>São Francisco · Niterói</b><span>Agenda com alta demanda para noivas e debutantes. Seu horário fica reservado; pode haver pequeno tempo de espera porque cada prova recebe atenção individual.</span></div>';
    return '<div class="unit-proof"><b>Barra da Tijuca · Downtown</b><span>Prova no Shopping Downtown, com acesso fácil ao catálogo da Barra e rota direta para a equipe da unidade.</span></div>';
  }

  function marcarTrilha() {
    var barras = trilha.querySelectorAll('.p');
    for (var i = 0; i < barras.length; i++) {
      var n = Number(barras[i].getAttribute('data-p'));
      barras[i].className = 'p' + (n < estado.passo ? ' feito' : n === estado.passo ? ' agora' : '');
    }
    rotuloPasso.textContent = (estado.variante === 'd' ? ROTULOS_D : ROTULOS)[Math.min(estado.passo, 4)];
    document.body.setAttribute('data-passo', String(estado.passo));
    trilha.style.display = estado.passo > 3 ? 'none' : '';
    rotuloPasso.style.display = estado.passo > 3 ? 'none' : '';
  }

  function ir(passo) {
    estado.passo = passo;
    desenhar();
    marcarTrilha();
    // Leva o foco para o título do passo: quem navega por teclado ou leitor de
    // tela precisa saber que a tela mudou.
    var h = cartao.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    var topo = cartao.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
  }

  function linkWhats(texto) {
    var loja = LOJAS[estado.loja] || LOJAS.barra;
    return 'https://wa.me/' + loja.whatsapp + '?text=' + encodeURIComponent(texto);
  }

  function resumo() {
    if (!estado.ocasiao || !estado.loja) return '';
    var partes = OCASIOES[estado.ocasiao].nome + ' · ' + LOJAS[estado.loja].nome;
    if (estado.data && estado.hora) {
      var d = estado.dias.filter(function (x) { return x.data === estado.data; })[0];
      if (d) partes += ' · <b>' + esc(d.rotulo) + ', ' + esc(estado.hora.replace(':', 'h')) + '</b>';
    }
    return '<div class="resumo">' + partes + '</div>';
  }


  function valor(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function leadValido() {
    var nome = estado.lead.nome || '';
    var tel = (estado.lead.telefone || '').replace(/\D/g, '');
    return nome.length >= 2 && tel.length >= 10 && tel.length <= 11;
  }

  function passoLeadD() {
    trackSchedule('KL_Lead_Form_Start', { source_detail: 'formulario_primeiro' }, 'leadstart:' + nomeVariante());
    cartao.innerHTML = '<h2>Antes da prova, queremos conhecer seu momento</h2>' +
      '<p class="sub">Não é burocracia. É para que sua experiência comece com a loja já sabendo sua ocasião, sua data e o que você procura.</p>' +
      '<form id="lead-d" novalidate>' +
      '<div class="campo" id="c-nome"><label for="nome">Seu nome</label>' +
      '<input id="nome" name="nome" type="text" autocomplete="name" maxlength="80" required value="' + esc(estado.lead.nome) + '">' +
      '<span class="mini">Para a equipe saber quem esperar.</span></div>' +
      '<div class="campo" id="c-tel"><label for="telefone">WhatsApp com DDD<span class="dica">É por ele que a loja confirma o seu horário.</span></label>' +
      '<input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(21) 90000-0000" required value="' + esc(estado.lead.telefone) + '">' +
      '<span class="mini">Confira o número com DDD.</span></div>' +
      '<div class="campo"><label for="evento">Data do evento<span class="dica">Se já tiver. Ajuda a entender urgência e preparação.</span></label>' +
      '<input id="evento" name="evento" type="date" value="' + esc(estado.lead.data_evento) + '"></div>' +
      '<div class="campo"><label for="preferencia">Preferência de atendimento<span class="dica">Opcional, para orientar a equipe.</span></label>' +
      '<select id="preferencia" name="preferencia">' +
      '<option value="">Escolha se quiser</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="sabado">Sábado</option><option value="primeira_data">Primeira data disponível</option></select></div>' +
      '<div class="campo"><label for="notas">O que você procura<span class="dica">Modelo, estilo, tamanho, referência ou dúvida.</span></label>' +
      '<textarea id="notas" name="notas" maxlength="400" placeholder="Ex.: noiva com manga, debutante azul, renda, sereia…">' + esc(estado.lead.notas) + '</textarea></div>' +
      '<label class="mel" aria-hidden="true">Não preencha<input id="mel" name="sobrenome_confirmacao" type="text" tabindex="-1" autocomplete="off"></label>' +
      '<div class="aceite"><input id="aceite" type="checkbox" required><span>Autorizo a Koisa Linda a usar meu nome e WhatsApp para confirmar e organizar esta prova. <a href="privacidade.html" target="_blank" rel="noopener">Como cuidamos dos seus dados</a>.</span></div>' +
      '<span class="mini" id="mini-aceite" style="margin:-14px 0 16px;display:none">Precisamos do seu aceite para continuar.</span>' +
      '<div class="acoes"><button type="submit" class="btn forte" id="ir-dados">Contar meu momento e escolher horário</button></div>' +
      '</form>';
    var pref = document.getElementById('preferencia');
    if (pref) pref.value = estado.lead.preferencia || '';
    document.getElementById('telefone').addEventListener('input', mascaraTelefone);
    document.getElementById('lead-d').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = valor('nome');
      var tel = document.getElementById('telefone').value.replace(/\D/g, '');
      var aceite = document.getElementById('aceite').checked;
      var faltou = false;
      marcarErro('c-nome', nome.length < 2); if (nome.length < 2) faltou = true;
      marcarErro('c-tel', tel.length < 10 || tel.length > 11); if (tel.length < 10 || tel.length > 11) faltou = true;
      document.getElementById('mini-aceite').style.display = aceite ? 'none' : 'block';
      if (!aceite) faltou = true;
      if (faltou) return;
      estado.lead = { nome: nome, telefone: tel, data_evento: valor('evento'), notas: valor('notas'), preferencia: valor('preferencia') };
      estado.leadSalvo = false;
      var btn = document.getElementById('ir-dados');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      registrarLeadDoSite().then(function () { ir(2); });
    });
  }

  /* ── passo 1 ─────────────────────────────────────────────────────────────── */
  function passo1() {
    var titulo = estado.variante === 'd' ? 'Agora escolha a prova e a unidade' : (estado.variante === 'b' ? 'Qual prova você quer reservar?' : 'Para quem é a prova?');
    var sub = estado.variante === 'd'
      ? 'Com seus dados já preenchidos, escolha onde você quer provar. Depois mostramos horários reais para pedir a reserva.'
      : (estado.variante === 'b'
        ? 'Primeiro diga a ocasião e a unidade. Depois o site mostra horários reais para você pedir a reserva.'
        : 'Noiva e debutante provam com hora marcada. Escolha as duas coisas abaixo e a agenda real da loja aparece na hora.');
    var html = '<h2>' + titulo + '</h2>' +
      '<p class="sub">' + sub + '</p>' +
      '<div class="ab-plan" aria-label="Como funciona">' + (estado.variante === 'd' ? '<span>1 · seus dados</span><span>2 · escolha a prova</span><span>3 · peça o horário</span>' : '<span>1 · escolha ocasião e loja</span><span>2 · veja horários reais</span><span>3 · receba confirmação no WhatsApp</span>') + '</div>' +
      '<div class="grupos"><div class="grupo"><span class="rotulo">Ocasião</span><div class="escolhas">';
    Object.keys(OCASIOES).forEach(function (k) {
      html += '<button type="button" class="escolha" data-campo="ocasiao" data-valor="' + k + '" ' +
        'aria-pressed="' + (estado.ocasiao === k ? 'true' : 'false') + '">' +
        OCASIOES[k].nome + '<small>' + OCASIOES[k].detalhe + '</small></button>';
    });
    html += '</div></div><div class="grupo"><span class="rotulo">Unidade</span><div class="escolhas">';
    Object.keys(LOJAS).forEach(function (k) {
      html += '<button type="button" class="escolha" data-campo="loja" data-valor="' + k + '" ' +
        'aria-pressed="' + (estado.loja === k ? 'true' : 'false') + '">' +
        LOJAS[k].nome + '<small>' + LOJAS[k].detalhe + '</small></button>';
    });
    // O aviso de visita livre vem DEPOIS do botão: ele é para quem não se
    // reconheceu nas duas ocasiões acima, e no meio do caminho só empurrava a
    // ação para fora da primeira tela.
    html += '</div></div></div><div class="acoes"><button type="button" class="btn forte" id="ir2"' +
      (estado.ocasiao && estado.loja ? '' : ' disabled') + '>' + (estado.variante === 'b' ? 'Ver horários disponíveis' : 'Ver horários') + '</button></div>' +
      '<div class="aviso">É <b>madrinha, convidada, formanda, mãe da noiva ou terno</b>? Não precisa marcar horário: ' +
      '<a href="#sem-hora-marcada">é só chegar na loja</a> dentro do horário de funcionamento.</div>';
    cartao.innerHTML = html;

    cartao.querySelectorAll('.escolha').forEach(function (b) {
      b.addEventListener('click', function () {
        var campo = b.getAttribute('data-campo');
        estado[campo] = b.getAttribute('data-valor');
        estado.data = ''; estado.hora = '';   // trocar de loja muda a agenda
        trackSchedule(campo === 'loja' ? 'KL_Schedule_Unit_Select' : 'KL_Schedule_Occasion_Select', { field: campo, value: estado[campo] });
        passo1();
      });
    });
    var ir2 = document.getElementById('ir2');
    if (ir2) ir2.addEventListener('click', function () { trackSchedule('KL_Schedule_Start', {}, 'start:' + estado.ocasiao + ':' + estado.loja); ir(estado.variante === 'd' ? 3 : 2); });
  }

  /* ── passo 2 ─────────────────────────────────────────────────────────────── */
  function passo2() {
    cartao.innerHTML = '<h2>Quando fica bom para você?</h2>' + resumo() +
      '<p class="sub" id="carregando">Consultando a agenda de ' + esc(LOJAS[estado.loja].nome) + '…</p>';
    buscarHorarios();
  }

  function buscarHorarios() {
    var url = API + '/horarios?loja=' + encodeURIComponent(estado.loja) +
      '&ocasiao=' + encodeURIComponent(estado.ocasiao);

    var expirou = setTimeout(function () { desenharFalhaAgenda(); }, 12000);

    fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)); })
      .then(function (d) {
        clearTimeout(expirou);
        if (!d || d.ok !== true || !Array.isArray(d.dias) || !d.dias.length) return desenharAgendaVazia();
        estado.dias = d.dias;
        trackSchedule('KL_Schedule_Slots_Loaded', { days_count: String(d.dias.length) }, 'slots:' + estado.loja + ':' + estado.ocasiao);
        // Já abre com o primeiro dia escolhido: a tela mostra horário de verdade
        // logo de cara, em vez de um calendário mudo e um botão apagado.
        if (!estado.data) estado.data = d.dias[0].data;
        desenharDias();
      })
      .catch(function () { clearTimeout(expirou); desenharFalhaAgenda(); });
  }


  function ehSabado(d) {
    return /^s[áa]b/i.test(String((d && d.dia_semana) || ''));
  }

  function outraLoja() {
    return estado.loja === 'barra' ? 'saofrancisco' : 'barra';
  }

  /* O sábado é o dia que a prova de noiva e debutante procura — e o primeiro a
   * lotar. Numa fita que mostra menos de quatro dias por vez, o próximo sábado
   * livre pode estar na décima primeira posição: quem não arrasta até lá conclui
   * que a loja não tem sábado nenhum e vai embora. Estes atalhos põem o sábado
   * na frente, e quando não existe sábado aqui a gente pergunta pela outra loja
   * em vez de deixar a cliente no vazio. */
  function atalhosDeDia() {
    var sabados = estado.dias.filter(ehSabado).slice(0, 2);
    if (!sabados.length) {
      return '<div class="atalhos" id="sabado-alerta"><span class="sem-sab">Sem sábado livre por aqui nas próximas semanas.</span></div>';
    }
    var html = '<div class="atalhos"><span class="atalho-lbl">Ir para</span>';
    sabados.forEach(function (d) {
      html += '<button type="button" class="atalho" data-ir="' + d.data + '">sábado ' +
        esc(d.dia) + ' ' + esc(String(d.mes || '').toLowerCase()) + '</button>';
    });
    return html + '</div>';
  }

  function ofereceSabadoDaOutraLoja() {
    var alvo = document.getElementById('sabado-alerta');
    if (!alvo || estado.dias.filter(ehSabado).length) return;
    var outra = outraLoja();
    fetch(API + '/horarios?loja=' + encodeURIComponent(outra) + '&ocasiao=' + encodeURIComponent(estado.ocasiao), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.dias)) return;
        var sab = d.dias.filter(ehSabado)[0];
        if (!sab) return;
        var atual = document.getElementById('sabado-alerta');
        if (!atual) return;
        atual.innerHTML = '<span class="sem-sab">Sem sábado livre em ' + esc(LOJAS[estado.loja].nome) + '.</span>' +
          '<button type="button" class="atalho troca" id="ir-outra-loja">' +
          esc(LOJAS[outra].nome) + ' tem sábado ' + esc(sab.dia) + ' ' + esc(String(sab.mes || '').toLowerCase()) + '</button>';
        document.getElementById('ir-outra-loja').addEventListener('click', function () {
          trackSchedule('KL_Schedule_Saturday_Switch', { from_store: estado.loja, to_store: outra, target_day: sab.data });
          estado.loja = outra; estado.data = sab.data; estado.hora = '';
          passo2();
        });
      })
      .catch(function () {});
  }

  /* A fita é redesenhada a cada clique. Sem isto ela volta para o primeiro dia
   * e some com o dia que a cliente acabou de escolher. */
  function centralizarDiaEscolhido() {
    var fita = document.getElementById('fita');
    var sel = fita && fita.querySelector('.dia[aria-pressed="true"]');
    if (!fita || !sel) return;
    var alvo = sel.offsetLeft - (fita.clientWidth / 2) + (sel.offsetWidth / 2);
    fita.scrollLeft = Math.max(0, alvo);
  }

  function desenharDias() {
    var html = '<h2>Quando fica bom para você?</h2>' + resumo() +
      '<span class="rotulo">Escolha o dia</span>' + atalhosDeDia() + '<div class="fita" id="fita">';
    estado.dias.forEach(function (d) {
      html += '<button type="button" class="dia" data-data="' + d.data + '" ' +
        'aria-pressed="' + (estado.data === d.data ? 'true' : 'false') + '" ' +
        'aria-label="' + esc(d.rotulo) + '">' +
        '<span class="s">' + esc(d.dia_semana.slice(0, 3)) + '</span>' +
        '<span class="n">' + esc(d.dia) + '</span>' +
        '<span class="m">' + esc(d.mes) + '</span></button>';
    });
    html += '</div><div id="horarios"></div>' +
      '<div class="acoes">' +
      '<button type="button" class="btn leve" id="voltar1">Voltar</button>' +
      '<button type="button" class="btn forte" id="ir3"' + (estado.hora ? '' : ' disabled') + '>' + (estado.variante === 'd' ? 'Pedir este horário' : 'Continuar') + '</button>' +
      '</div>';
    cartao.innerHTML = html;

    cartao.querySelectorAll('.dia').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.data = b.getAttribute('data-data');
        estado.hora = '';
        desenharDias();
      });
    });
    cartao.querySelectorAll('.atalho[data-ir]').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.data = b.getAttribute('data-ir');
        estado.hora = '';
        trackSchedule('KL_Schedule_Saturday_Shortcut', { selected_day: estado.data });
        desenharDias();
      });
    });
    document.getElementById('voltar1').addEventListener('click', function () { ir(estado.variante === 'd' ? 2 : 1); });
    var ir3 = document.getElementById('ir3');
    ir3.addEventListener('click', function () { if (!estado.hora) return; if (estado.variante === 'd') return enviarLeadD(); ir(3); });

    if (estado.data) desenharHoras();
    centralizarDiaEscolhido();
    ofereceSabadoDaOutraLoja();
  }

  function desenharHoras() {
    var dia = estado.dias.filter(function (d) { return d.data === estado.data; })[0];
    var alvo = document.getElementById('horarios');
    if (!dia || !alvo) return;

    var html = '';
    [['manha', 'Manhã'], ['tarde', 'Tarde']].forEach(function (par) {
      var lista = dia[par[0]] || [];
      if (!lista.length) return;
      html += '<p class="periodo">' + par[1] + '</p><div class="horas">';
      lista.forEach(function (h) {
        html += '<button type="button" class="hora" data-hora="' + h + '" ' +
          'aria-pressed="' + (estado.hora === h ? 'true' : 'false') + '">' + esc(h.replace(':', 'h')) + '</button>';
      });
      html += '</div>';
    });
    alvo.innerHTML = html;

    alvo.querySelectorAll('.hora').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.hora = b.getAttribute('data-hora');
        trackSchedule('KL_Schedule_Time_Select', { selected_day: estado.data, period: estado.hora < '12:00' ? 'manha' : 'tarde' });
        desenharDias();
        var seguir = document.getElementById('ir3');
        if (seguir) seguir.focus({ preventScroll: true });
      });
    });
  }

  function desenharAgendaVazia() {
    trackSchedule('KL_Schedule_Slots_Empty', {}, 'empty:' + estado.loja + ':' + estado.ocasiao);
    cartao.innerHTML = '<h2>Sem horário livre por aqui</h2>' + resumo() +
      '<p class="vazio">A agenda das próximas três semanas nesta unidade está cheia. A equipe consegue encaixar você — chame no WhatsApp que elas veem a primeira data possível.</p>' +
      '<div class="acoes"><button type="button" class="btn leve" id="voltar1">Trocar de unidade</button>' +
      '<a class="btn forte" target="_blank" rel="noopener" href="' +
      linkWhats('Olá! Vim pelo site e quero agendar uma prova de ' + OCASIOES[estado.ocasiao].detalhe +
        ' na unidade ' + LOJAS[estado.loja].nome + '.') + '">Falar com a loja</a></div>';
    document.getElementById('voltar1').addEventListener('click', function () { ir(1); });
  }

  function desenharFalhaAgenda() {
    trackSchedule('KL_Schedule_Slots_Error', {}, 'error:' + estado.loja + ':' + estado.ocasiao);
    cartao.innerHTML = '<h2>Não consegui abrir a agenda</h2>' + resumo() +
      '<p class="vazio">A agenda não respondeu agora. Isso é problema nosso, não seu — e a loja marca com você pelo WhatsApp na mesma hora.</p>' +
      '<div class="acoes"><button type="button" class="btn leve" id="tentar">Tentar de novo</button>' +
      '<a class="btn forte" target="_blank" rel="noopener" href="' +
      linkWhats('Olá! Vim pelo site e quero agendar uma prova de ' + OCASIOES[estado.ocasiao].detalhe +
        ' na unidade ' + LOJAS[estado.loja].nome + '.') + '">Marcar pelo WhatsApp</a></div>';
    document.getElementById('tentar').addEventListener('click', passo2);
  }

  /* ── passo 3 ─────────────────────────────────────────────────────────────── */
  function passo3() {
    trackSchedule('KL_Schedule_Form_Start', {}, 'form:' + estado.loja + ':' + estado.ocasiao + ':' + estado.data + ':' + estado.hora);
    var ocasiao = OCASIOES[estado.ocasiao];
    var rotuloEvento = estado.ocasiao === 'noiva' ? 'Data do casamento' : 'Data da festa';

    cartao.innerHTML = '<h2>Só falta saber quem esperar</h2>' + resumo() +
      '<p class="sub">Este horário fica reservado para o seu pedido. A equipe de ' +
      esc(LOJAS[estado.loja].nome) + ' confirma com você pelo WhatsApp.</p>' +
      '<form id="form" novalidate>' +
      '<div class="campo" id="c-nome"><label for="nome">Seu nome</label>' +
      '<input id="nome" name="nome" type="text" autocomplete="name" maxlength="80" required></div>' +

      '<div class="campo" id="c-tel"><label for="telefone">WhatsApp com DDD' +
      '<span class="dica">É por ele que a loja confirma o seu horário.</span></label>' +
      '<input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(21) 90000-0000" required>' +
      '<span class="mini">Confira o número com DDD.</span></div>' +

      '<div class="campo"><label for="evento">' + rotuloEvento +
      '<span class="dica">Opcional — diz se dá tempo de ajustar sob medida.</span></label>' +
      '<input id="evento" name="evento" type="date"></div>' +

      '<div class="campo"><label for="notas">O que você procura' +
      '<span class="dica">Opcional — a equipe já separa os modelos.</span></label>' +
      '<textarea id="notas" name="notas" maxlength="400" placeholder="Ex.: renda, corte sereia, manga comprida"></textarea></div>' +

      '<label class="mel" aria-hidden="true">Não preencha<input id="mel" name="sobrenome_confirmacao" type="text" tabindex="-1" autocomplete="off"></label>' +

      '<div class="aceite"><input id="aceite" type="checkbox" required>' +
      '<span>Autorizo a Koisa Linda a usar meu nome e WhatsApp para confirmar e organizar esta prova. ' +
      '<a href="privacidade.html" target="_blank" rel="noopener">Como cuidamos dos seus dados</a>.</span></div>' +
      '<span class="mini" id="mini-aceite" style="margin:-14px 0 16px">Precisamos do seu aceite para registrar a prova.</span>' +

      '<div class="acoes"><button type="button" class="btn leve" id="voltar2">Voltar</button>' +
      '<button type="submit" class="btn forte" id="enviar">Pedir este horário</button></div>' +
      '</form>';

    document.getElementById('mini-aceite').style.display = 'none';
    document.getElementById('voltar2').addEventListener('click', function () { ir(2); });
    document.getElementById('form').addEventListener('submit', enviar);
    document.getElementById('telefone').addEventListener('input', mascaraTelefone);
  }

  function mascaraTelefone(ev) {
    var d = ev.target.value.replace(/\D/g, '').slice(0, 11);
    var saida = d;
    if (d.length > 2) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length > 10 ? 7 : 6) + '-' + d.slice(d.length > 10 ? 7 : 6);
    ev.target.value = saida;
  }

  function marcarErro(id, tem) {
    var c = document.getElementById(id);
    if (c) c.className = 'campo' + (tem ? ' erro' : '');
  }

  function payloadPedido(nome, tel, dataEvento, notas, extras) {
    extras = extras || {};
    return {
      nome: nome,
      telefone: tel,
      loja: estado.loja,
      ocasiao: estado.ocasiao,
      data: estado.data,
      hora: estado.hora,
      data_evento: dataEvento || '',
      notas: notas || '',
      consentimento: true,
      aberto_em: estado.abertoEm,
      origem: origem(),
      experimento_agendamento: nomeVariante(),
      variante_agendamento: estado.variante || 'a',
      preferencia_atendimento: extras.preferencia || '',
      formulario_primeiro: estado.variante === 'd',
      lead_id: estado.lead_id || (function(){ try { return sessionStorage.getItem('kl_site_lead_id') || ''; } catch(e) { return ''; } })(),
      sobrenome_confirmacao: extras.honeypot || '',
    };
  }

  function enviarPayload(payload, botao, nomeFallback) {
    estado.enviando = true;
    if (botao) { botao.disabled = true; botao.textContent = 'Enviando…'; }
    trackSchedule('KL_Schedule_Request_Submit', { selected_day: estado.data, selected_time: estado.hora, form_first: estado.variante === 'd' ? 'yes' : 'no' });
    fetch(API + '/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, corpo: d }; }); })
      .then(function (r) {
        estado.enviando = false;
        if (r.corpo && r.corpo.ok === true) { trackSchedule('KL_Schedule_Request_Success', { status: String(r.status) }); return pronto(r.corpo); }
        if (r.status === 409) { trackSchedule('KL_Schedule_Request_Conflict', { status: String(r.status) }); alerta(r.corpo.mensagem); return ir(estado.variante === 'd' ? 3 : 2); }
        if (botao) { botao.disabled = false; botao.textContent = estado.variante === 'd' ? 'Pedir este horário' : 'Pedir este horário'; }
        trackSchedule('KL_Schedule_Request_Error', { status: String(r.status) });
        alerta((r.corpo && r.corpo.mensagem) || 'Não consegui registrar agora. Tente de novo em instantes.');
      })
      .catch(function () {
        estado.enviando = false;
        trackSchedule('KL_Schedule_Request_Network_Error', {});
        falhaNoEnvio(nomeFallback || payload.nome || '');
      });
  }

  function enviarLeadD() {
    if (estado.enviando || !leadValido()) return ir(1);
    var botao = document.getElementById('ir3');
    enviarPayload(payloadPedido(estado.lead.nome, estado.lead.telefone, estado.lead.data_evento, estado.lead.notas, { preferencia: estado.lead.preferencia }), botao, estado.lead.nome);
  }

  function enviar(ev) {
    ev.preventDefault();
    if (estado.enviando) return;

    var nome = document.getElementById('nome').value.trim();
    var tel = document.getElementById('telefone').value.replace(/\D/g, '');
    var aceite = document.getElementById('aceite').checked;

    var faltou = false;
    marcarErro('c-nome', nome.length < 2); if (nome.length < 2) faltou = true;
    marcarErro('c-tel', tel.length < 10 || tel.length > 11); if (tel.length < 10 || tel.length > 11) faltou = true;
    document.getElementById('mini-aceite').style.display = aceite ? 'none' : 'block';
    if (!aceite) faltou = true;
    if (faltou) {
      var primeiro = cartao.querySelector('.campo.erro input') || document.getElementById('aceite');
      if (primeiro) primeiro.focus();
      return;
    }

    var dataEvento = document.getElementById('evento').value || '';
    var notas = document.getElementById('notas').value.trim();
    var honeypot = document.getElementById('mel').value;
    var botao = document.getElementById('enviar');

    // Grava o cadastro com utm/fbclid/gclid antes do pedido, para o agendamento
    // poder ser ligado ao anúncio que o pagou. O pedido é o que importa: se o
    // cadastro falhar ou demorar, ele sai assim mesmo.
    estado.lead = { nome: nome, telefone: tel, data_evento: dataEvento, notas: notas, preferencia: '' };
    if (botao) { botao.disabled = true; botao.textContent = 'Enviando…'; }
    var semEsperarDemais = new Promise(function (pronto) { setTimeout(function () { pronto(null); }, 3000); });
    Promise.race([registrarLeadDoSite(), semEsperarDemais]).then(function () {
      enviarPayload(payloadPedido(nome, tel, dataEvento, notas, { honeypot: honeypot }), botao, nome);
    });
  }

  function alerta(msg) {
    var caixa = document.createElement('div');
    caixa.className = 'aviso';
    caixa.setAttribute('role', 'alert');
    caixa.textContent = msg;
    var form = document.getElementById('form');
    if (form) form.insertBefore(caixa, form.firstChild);
    caixa.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* Perder o pedido depois de a cliente preencher tudo é o pior desfecho
   * possível: o WhatsApp sai com o horário que ela escolheu já escrito. */
  function falhaNoEnvio(nome) {
    var dia = estado.dias.filter(function (d) { return d.data === estado.data; })[0];
    var quando = dia ? dia.rotulo + ', ' + estado.hora.replace(':', 'h') : estado.data + ' ' + estado.hora;
    cartao.innerHTML = '<h2>Quase lá</h2>' +
      '<p class="sub">Não consegui enviar seu pedido para a loja. Seus dados não se perderam — é só tocar no botão que a mensagem vai pronta, com o horário que você escolheu.</p>' +
      '<div class="resumo">' + esc(quando) + ' · ' + esc(LOJAS[estado.loja].nome) + '</div>' +
      '<div class="acoes"><a class="btn forte" target="_blank" rel="noopener" href="' +
      linkWhats('Olá! Sou ' + nome + '. Vim pelo site e quero agendar uma prova de ' +
        OCASIOES[estado.ocasiao].detalhe + ' na unidade ' + LOJAS[estado.loja].nome +
        ' em ' + quando + '.') + '">Enviar pelo WhatsApp</a></div>';
    estado.passo = 4;
    marcarTrilha();
  }

  function pronto(corpo) {
    var loja = LOJAS[estado.loja];
    var status = String(corpo.status || '').toLowerCase();
    var quando = corpo.quando || (function () {
      var dia = estado.dias.filter(function (d) { return d.data === estado.data; })[0];
      return dia ? dia.rotulo + ', ' + estado.hora.replace(':', 'h') : estado.data + ' ' + estado.hora;
    })();
    var textoDuvida = status === 'confirmed'
      ? 'Olá! Acabei de confirmar uma prova pelo site da Koisa Linda para ' + quando + ' na unidade ' + loja.nome + '. Tenho uma dúvida antes de ir.'
      : 'Olá! Acabei de pedir um horário de prova pelo site da Koisa Linda para ' + quando + ' na unidade ' + loja.nome + '. Tenho uma dúvida sobre o agendamento.';
    cartao.innerHTML = '<div class="pronto">' +
      '<div class="selo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h2>' + esc(corpo.titulo || 'Pedido enviado para a loja') + '</h2>' +
      '<p class="quando">' + esc(quando || '') + '</p>' +
      '<p>' + esc(corpo.mensagem || '') + '</p>' +
      '<p>Fique de olho no WhatsApp <b>' + esc(loja.nome) + '</b>: é por lá que a equipe confirma e tira qualquer dúvida antes da prova.</p>' +
      '<div class="acoes" style="justify-content:center">' +
      '<a class="btn forte" href="catalogo.html?cat=' +
      (estado.ocasiao === 'noiva' ? 'vestidos-noiva' : 'vestidos-debutante') + '">Ver o catálogo</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + linkWhats(textoDuvida) + '">Tirar dúvidas pelo WhatsApp</a></div>' +
      '</div>';
    estado.passo = 4;
    marcarTrilha();
    try {
      if (window.fbq) window.fbq('track', 'Schedule', { content_category: estado.ocasiao });
      if (window.gtag) window.gtag('event', 'agendamento_site', { loja: estado.loja, ocasiao: estado.ocasiao });
    } catch (e) {}
  }

  function desenhar() {
    if (estado.variante === 'd') {
      if (estado.passo === 1) return passoLeadD();
      if (estado.passo === 2) return passo1();
      if (estado.passo === 3) return passo2();
    }
    if (estado.passo === 1) return passo1();
    if (estado.passo === 2) return passo2();
    if (estado.passo === 3) return passo3();
  }

  /* A cliente pode chegar de um anúncio ou de uma página de vertical já com a
   * ocasião e a loja decididas — nesse caso ela cai direto no calendário. */
  function pularOQueJaSeSabe() {
    estado.variante = varianteDaVisita();
    aplicarCopyVariante();
    var sp = new URLSearchParams(location.search);
    var oc = (sp.get('ocasiao') || sp.get('oc') || '').toLowerCase();
    if (OCASIOES[oc]) estado.ocasiao = oc;
    var un = (sp.get('un') || sp.get('loja') || '').toLowerCase();
    un = normalizarLoja(un);
    if (LOJAS[un]) estado.loja = un;
    if (estado.ocasiao && estado.loja && estado.variante !== 'd') {
      estado.passo = 2;
    }
  }

  pularOQueJaSeSabe();
  trackSchedule('KL_Schedule_Experiment_View', { url_has_store: estado.loja ? 'yes' : 'no', url_has_occasion: estado.ocasiao ? 'yes' : 'no' }, 'view:' + location.href);
  desenhar();
  marcarTrilha();
})();
