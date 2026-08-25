/* Koisa Linda — Portal da Cliente no site público.
 *
 * O site é a porta da cliente; o sistema KL/Supabase é o motor por trás.
 * Esta camada não acessa dados internos da loja. Ela pede código por WhatsApp
 * e mostra somente o espelho seguro devolvido pela API pública do portal.
 */
(function () {
  'use strict';

  var API = window.KL_PORTAL_API || 'https://n8n.janotattec.com.br/webhook/kl-portal';
  var HOST_PRODUCAO = /(^|\.)koisalinda\.com\.br$/i.test(location.hostname);
  var MOSTRAR_PREVIA = !HOST_PRODUCAO || new URLSearchParams(location.search).get('previa') === '1';
  var etapa = 'telefone';
  var telefoneAtual = '';

  var demo = MOSTRAR_PREVIA ? {
    cliente: 'Cliente Koisa Linda',
    whatsapp: '(21) 99999-0000',
    loja: 'Barra da Tijuca',
    evento: 'Casamento · 12 set',
    pedido: 'Pedido KL-2048',
    status: 'Em ajuste no ateliê',
    proximo_passo: 'Prova final agendada',
    total: 'R$ 1.190,00',
    pago: 'R$ 600,00',
    saldo: 'R$ 590,00',
    whatsapp_loja: '5521966475383',
    timeline: [
      { rotulo: 'Pedido registrado', data: '20 ago', estado: 'done' },
      { rotulo: 'Primeira prova', data: '23 ago', estado: 'done' },
      { rotulo: 'Ateliê ajustando', data: 'em andamento', estado: 'now' },
      { rotulo: 'Prova final', data: '30 ago · 15h30', estado: '' },
      { rotulo: 'Retirada', data: 'a combinar', estado: '' },
    ],
    pecas: [
      { nome: 'Vestido festa marsala', tipo: 'Aluguel', tamanho: '40', cor: 'Marsala', valor: 'R$ 790,00', status: 'Ajuste de barra' },
      { nome: 'Cinto bordado', tipo: 'Acessório', tamanho: 'Único', cor: 'Dourado', valor: 'R$ 120,00', status: 'Separado' },
    ],
  } : null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function track(name, params) {
    try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {}
    try { if (window.fbq) window.fbq('trackCustom', name, params || {}); } catch (e) {}
  }
  function digitos(v) { return String(v || '').replace(/\D/g, '').slice(0, 13); }
  function mascaraTelefone(ev) {
    var d = digitos(ev.target.value).slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length > 10 ? 7 : 6) + '-' + d.slice(d.length > 10 ? 7 : 6);
    ev.target.value = out;
  }
  function msg(texto, erro) {
    var el = $('formMsg');
    if (!el) return;
    el.textContent = texto;
    el.style.color = erro ? '#9b4638' : '';
  }
  function botaoCarregando(carregando, texto) {
    var b = $('enviarCodigo');
    if (!b) return;
    b.disabled = !!carregando;
    if (texto) b.textContent = texto;
  }
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.ok === false) throw new Error(d.mensagem || ('http ' + r.status));
        return d;
      });
    });
  }
  function pedirCodigo() {
    telefoneAtual = digitos($('telefone').value);
    if (telefoneAtual.length < 10 || telefoneAtual.length > 13) {
      msg('Digite o WhatsApp com DDD para receber o código.', true);
      $('telefone').focus();
      return;
    }
    botaoCarregando(true, 'Enviando…');
    track('KL_Portal_Login_Start', { origem: 'site', etapa: 'telefone' });
    post('/entrar', { telefone: telefoneAtual, origem: 'site' })
      .then(function () {
        etapa = 'codigo';
        $('campoCodigo').hidden = false;
        $('codigo').focus();
        botaoCarregando(false, 'Confirmar código');
        msg('Enviamos o código para o WhatsApp informado. Digite aqui para ver seu atendimento.', false);
      })
      .catch(function (e) {
        botaoCarregando(false, 'Receber código');
        msg('Ainda não consegui conectar o portal ao atendimento. Se precisar agora, fale com a unidade pelo WhatsApp. Detalhe técnico: ' + e.message, true);
      });
  }
  function confirmarCodigo() {
    var codigo = digitos($('codigo').value).slice(0, 6);
    if (codigo.length < 4) {
      msg('Digite o código recebido no WhatsApp.', true);
      $('codigo').focus();
      return;
    }
    botaoCarregando(true, 'Confirmando…');
    post('/confirmar', { telefone: telefoneAtual, codigo: codigo, origem: 'site' })
      .then(function (d) {
        botaoCarregando(false, 'Atualizar');
        msg('Atendimento carregado com segurança.', false);
        render(d.portal || d.atendimento || d);
        track('KL_Portal_Login_Success', { origem: 'site' });
      })
      .catch(function (e) {
        botaoCarregando(false, 'Confirmar código');
        msg(e.message || 'Código inválido ou expirado. Confira e tente de novo.', true);
      });
  }
  function linkWhats(d) {
    var numero = d.whatsapp_loja || (String(d.loja || '').toLowerCase().indexOf('são') >= 0 ? '5521970858787' : '5521966475383');
    var texto = 'Olá! Estou acompanhando meu pedido pelo site da Koisa Linda e preciso falar com a loja.';
    if (d.pedido) texto += ' Pedido: ' + d.pedido + '.';
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
  }
  function render(d) {
    d = d || {};
    var timeline = Array.isArray(d.timeline) ? d.timeline : [];
    var pecas = Array.isArray(d.pecas) ? d.pecas : [];
    // Todos os campos que vêm da API ou da prévia passam por esc() antes de entrar no HTML.
    // A página é estática e não aceita HTML rico vindo do backend.
    $('portalResultado').innerHTML = '<h3>' + esc(d.pedido || 'Meu atendimento') + '</h3>' +
      '<p class="hint">' + esc(d.status || 'Atendimento encontrado') + '</p>' +
      '<div class="status">' +
      '<div class="pill"><strong>Próximo passo</strong><span>' + esc(d.proximo_passo || 'A combinar') + '</span></div>' +
      '<div class="pill"><strong>Total</strong><span>' + esc(d.total || '—') + '</span></div>' +
      '<div class="pill"><strong>Pago</strong><span>' + esc(d.pago || '—') + '</span></div>' +
      '<div class="pill"><strong>Saldo</strong><span>' + esc(d.saldo || '—') + '</span></div>' +
      '</div>' +
      '<div class="small"><b>Cliente:</b> ' + esc(d.cliente || '—') + ' · <b>Loja:</b> ' + esc(d.loja || '—') + ' · <b>Evento:</b> ' + esc(d.evento || '—') + '</div>' +
      '<h3 style="margin-top:24px">Linha do tempo</h3>' +
      '<div class="timeline">' + (timeline.length ? timeline.map(function (t) {
        return '<div class="mark ' + esc(t.estado || '') + '"><div class="dot"></div><div><b>' + esc(t.rotulo) + '</b><br><span>' + esc(t.data || '') + '</span></div></div>';
      }).join('') : '<div class="empty">Nenhuma etapa pública disponível ainda.</div>') + '</div>' +
      '<h3 style="margin-top:24px">Peças</h3>' +
      '<div class="pieces">' + (pecas.length ? pecas.map(function (p) {
        return '<div class="piece"><div><b>' + esc(p.nome) + '</b><small>' + esc([p.tipo, p.cor, p.tamanho].filter(Boolean).join(' · ')) + '</small></div><div><b>' + esc(p.valor || '') + '</b><small>' + esc(p.status || '') + '</small></div></div>';
      }).join('') : '<div class="empty">As peças aparecem aqui quando a loja vincular ao pedido.</div>') + '</div>' +
      '<div class="btns"><a class="btn primary" target="_blank" rel="noopener" href="' + linkWhats(d) + '">Falar com a loja</a><a class="btn" href="catalogo.html">Voltar ao catálogo</a></div>';
  }
  function init() {
    var form = $('portalForm');
    if (!form) return;
    var tel = $('telefone');
    if (tel) tel.addEventListener('input', mascaraTelefone);
    if (MOSTRAR_PREVIA && $('previaVisual')) {
      $('previaVisual').hidden = false;
      $('previaVisual').addEventListener('click', function () {
        render(demo);
        msg('Prévia visual carregada. No domínio oficial, a cliente entra por WhatsApp + código.', false);
        track('KL_Portal_Preview_Open', { origem: 'site' });
      });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (etapa === 'telefone') pedirCodigo();
      else confirmarCodigo();
    });
    track('KL_Portal_Open', { origem: 'site' });
  }
  init();
})();
