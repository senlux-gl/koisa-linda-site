/* Koisa Linda — escolha de horário da prova de noiva e debutante.
 *
 * Três passos: ocasião e unidade → dia e horário → quem é você.
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
  };

  var cartao = document.getElementById('cartao');
  var trilha = document.getElementById('trilha');
  var rotuloPasso = document.getElementById('rotuloPasso');

  var ROTULOS = ['', 'Passo 1 de 3 · Ocasião e unidade', 'Passo 2 de 3 · Dia e horário', 'Passo 3 de 3 · Seus dados', 'Pronto'];

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
      var v = (sp.get('variant') || sp.get('ab') || '').toLowerCase();
      if (v === '1') v = 'a';
      if (v === '2') v = 'b';
      if (v !== 'a' && v !== 'b') v = sessionStorage.getItem('kl_schedule_variant') || '';
      if (v !== 'a' && v !== 'b') {
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
    return estado.variante === 'b' ? 'horarios_disponiveis' : 'agendar_prova';
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
    if (estado.variante === 'b') {
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
    rotuloPasso.textContent = ROTULOS[Math.min(estado.passo, 4)];
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

  /* ── passo 1 ─────────────────────────────────────────────────────────────── */
  function passo1() {
    var titulo = estado.variante === 'b' ? 'Qual prova você quer reservar?' : 'Para quem é a prova?';
    var sub = estado.variante === 'b'
      ? 'Primeiro diga a ocasião e a unidade. Depois o site mostra horários reais para você pedir a reserva.'
      : 'A prova com hora marcada é de noiva e de debutante — são as duas em que a equipe separa os modelos antes e reserva o provador.';
    var html = '<h2>' + titulo + '</h2>' +
      '<p class="sub">' + sub + '</p>' +
      '<div class="ab-plan" aria-label="Como funciona"><span>1 · escolha ocasião e loja</span><span>2 · veja horários reais</span><span>3 · receba confirmação no WhatsApp</span></div>' +
      '<span class="rotulo">Ocasião</span><div class="escolhas">';
    Object.keys(OCASIOES).forEach(function (k) {
      html += '<button type="button" class="escolha" data-campo="ocasiao" data-valor="' + k + '" ' +
        'aria-pressed="' + (estado.ocasiao === k ? 'true' : 'false') + '">' +
        OCASIOES[k].nome + '<small>' + OCASIOES[k].detalhe + '</small></button>';
    });
    html += '</div><span class="rotulo">Unidade</span><div class="escolhas">';
    Object.keys(LOJAS).forEach(function (k) {
      html += '<button type="button" class="escolha" data-campo="loja" data-valor="' + k + '" ' +
        'aria-pressed="' + (estado.loja === k ? 'true' : 'false') + '">' +
        LOJAS[k].nome + '<small>' + LOJAS[k].detalhe + '</small></button>';
    });
    html += '</div><div class="unit-proofs">' + textoUnidade('saofrancisco') + textoUnidade('barra') + '</div>' +
      '<div class="aviso">É <b>madrinha, convidada, formanda, mãe da noiva ou terno</b>? Não precisa marcar horário: ' +
      '<a href="#sem-hora-marcada">é só chegar na loja</a> dentro do horário de funcionamento.</div>' +
      '<div class="acoes"><button type="button" class="btn forte" id="ir2"' +
      (estado.ocasiao && estado.loja ? '' : ' disabled') + '>' + (estado.variante === 'b' ? 'Ver horários disponíveis' : 'Ver horários') + '</button></div>';
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
    if (ir2) ir2.addEventListener('click', function () { trackSchedule('KL_Schedule_Start', {}, 'start:' + estado.ocasiao + ':' + estado.loja); ir(2); });
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

  function desenharDias() {
    var html = '<h2>Quando fica bom para você?</h2>' + resumo() +
      '<span class="rotulo">Escolha o dia</span><div class="fita" id="fita">';
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
      '<button type="button" class="btn forte" id="ir3"' + (estado.hora ? '' : ' disabled') + '>Continuar</button>' +
      '</div>';
    cartao.innerHTML = html;

    cartao.querySelectorAll('.dia').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.data = b.getAttribute('data-data');
        estado.hora = '';
        desenharDias();
      });
    });
    document.getElementById('voltar1').addEventListener('click', function () { ir(1); });
    var ir3 = document.getElementById('ir3');
    ir3.addEventListener('click', function () { if (estado.hora) ir(3); });

    if (estado.data) desenharHoras();
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
      '<form id="form" novalidate>' +
      '<div class="campo" id="c-nome"><label for="nome">Seu nome</label>' +
      '<input id="nome" name="nome" type="text" autocomplete="name" maxlength="80" required>' +
      '<span class="mini">Escreva seu nome para a equipe saber quem esperar.</span></div>' +

      '<div class="campo" id="c-tel"><label for="telefone">WhatsApp com DDD' +
      '<span class="dica">É por ele que a loja confirma o seu horário.</span></label>' +
      '<input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(21) 90000-0000" required>' +
      '<span class="mini">Confira o número com DDD.</span></div>' +

      '<div class="campo"><label for="evento">' + rotuloEvento +
      '<span class="dica">Se já tiver. É ela que diz se dá tempo de fazer sob medida.</span></label>' +
      '<input id="evento" name="evento" type="date"></div>' +

      '<div class="campo"><label for="notas">O que você procura' +
      '<span class="dica">Opcional. Ajuda a equipe a separar os modelos antes de você chegar.</span></label>' +
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

    var botao = document.getElementById('enviar');
    estado.enviando = true;
    botao.disabled = true;
    botao.textContent = 'Enviando…';

    trackSchedule('KL_Schedule_Request_Submit', { selected_day: estado.data, selected_time: estado.hora });

    fetch(API + '/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome,
        telefone: tel,
        loja: estado.loja,
        ocasiao: estado.ocasiao,
        data: estado.data,
        hora: estado.hora,
        data_evento: document.getElementById('evento').value || '',
        notas: document.getElementById('notas').value.trim(),
        consentimento: true,
        aberto_em: estado.abertoEm,
        origem: origem(),
        experimento_agendamento: nomeVariante(),
        variante_agendamento: estado.variante || 'a',
        sobrenome_confirmacao: document.getElementById('mel').value,
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, corpo: d }; }); })
      .then(function (r) {
        estado.enviando = false;
        if (r.corpo && r.corpo.ok === true) { trackSchedule('KL_Schedule_Request_Success', { status: String(r.status) }); return pronto(r.corpo); }
        if (r.status === 409) { trackSchedule('KL_Schedule_Request_Conflict', { status: String(r.status) }); alerta(r.corpo.mensagem); return ir(2); }
        botao.disabled = false;
        botao.textContent = 'Pedir este horário';
        trackSchedule('KL_Schedule_Request_Error', { status: String(r.status) });
        alerta((r.corpo && r.corpo.mensagem) || 'Não consegui registrar agora. Tente de novo em instantes.');
      })
      .catch(function () {
        estado.enviando = false;
        trackSchedule('KL_Schedule_Request_Network_Error', {});
        falhaNoEnvio(nome);
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
    cartao.innerHTML = '<div class="pronto">' +
      '<div class="selo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h2>' + esc(corpo.titulo || 'Pedido enviado para a loja') + '</h2>' +
      '<p class="quando">' + esc(corpo.quando || '') + '</p>' +
      '<p>' + esc(corpo.mensagem || '') + '</p>' +
      '<p>Fique de olho no WhatsApp <b>' + esc(loja.nome) + '</b>: é por lá que a equipe confirma.</p>' +
      '<div class="acoes" style="justify-content:center">' +
      '<a class="btn forte" href="catalogo.html?cat=' +
      (estado.ocasiao === 'noiva' ? 'vestidos-noiva' : 'vestidos-debutante') + '">Ver o catálogo</a></div>' +
      '</div>';
    estado.passo = 4;
    marcarTrilha();
    try {
      if (window.fbq) window.fbq('track', 'Schedule', { content_category: estado.ocasiao });
      if (window.gtag) window.gtag('event', 'agendamento_site', { loja: estado.loja, ocasiao: estado.ocasiao });
    } catch (e) {}
  }

  function desenhar() {
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
    if (estado.ocasiao && estado.loja) estado.passo = 2;
  }

  pularOQueJaSeSabe();
  trackSchedule('KL_Schedule_Experiment_View', { url_has_store: estado.loja ? 'yes' : 'no', url_has_occasion: estado.ocasiao ? 'yes' : 'no' }, 'view:' + location.href);
  desenhar();
  marcarTrilha();
})();
