/* kl-portal.js — a área da cliente
 *
 * A cliente entra com o telefone, recebe um código no WhatsApp e vê o que é
 * dela: os pedidos, as peças, o ajuste no ateliê e as provas marcadas.
 *
 * O que este arquivo NÃO faz, de propósito:
 *
 *   · não filtra dado de ninguém. O recorte é do banco, por RLS. Se um dia
 *     alguém apontar este script para outro id, o banco devolve vazio — e é
 *     assim que tem que ser. Trava que mora no navegador não é trava.
 *   · não guarda o código, nem o telefone, nem nada além da sessão que o
 *     próprio Supabase administra.
 *
 * A configuração (URL e chave publicável) vem de kl-portal-config.js, que fica
 * fora do git: assim a página não carrega chave de produção enquanto isto
 * estiver em desenvolvimento.
 */
(function () {
  'use strict'

  var cfg = window.KL_PORTAL_CONFIG
  var $ = function (id) { return document.getElementById(id) }

  if (!cfg || !cfg.url || !cfg.chave) {
    mostrarRecado('Esta área ainda não está configurada. Fale com a loja.', true)
    $('pedir').disabled = true
    return
  }

  var sb = window.supabase.createClient(cfg.url, cfg.chave)
  var telefoneEmUso = null

  /* --- utilidades ------------------------------------------------------- */

  function mostrarRecado(texto, ruim) {
    var r = $('recado')
    if (!r) return
    r.textContent = texto
    r.className = 'recado' + (ruim ? ' ruim' : '')
  }

  function limparRecado() {
    var r = $('recado')
    if (r) r.className = 'recado oculto'
  }

  function dinheiro(v) {
    var n = Number(v || 0)
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function data(v) {
    if (!v) return null
    // Data pura (aaaa-mm-dd) não tem fuso: montar na mão evita o clássico
    // "aparece um dia antes" de quem está a oeste de Greenwich.
    var p = String(v).slice(0, 10).split('-')
    if (p.length !== 3) return null
    return p[2] + '/' + p[1] + '/' + p[0]
  }

  function dataHora(v) {
    if (!v) return null
    return new Date(v).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function texto(pai, tag, classe, conteudo) {
    var e = document.createElement(tag)
    if (classe) e.className = classe
    if (conteudo != null) e.textContent = conteudo
    pai.appendChild(e)
    return e
  }

  /* --- entrada ---------------------------------------------------------- */

  function chamar(funcao, corpo) {
    return fetch(cfg.url + '/functions/v1/' + funcao, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.chave },
      body: JSON.stringify(corpo),
    }).then(function (r) { return r.json() })
  }

  $('pedir').addEventListener('click', function () {
    var tel = $('telefone').value.trim()
    if (!tel) return
    limparRecado()
    this.disabled = true
    this.textContent = 'Enviando…'
    var botao = this

    chamar('portal-entrar', { telefone: tel })
      .then(function (r) {
        botao.disabled = false
        botao.textContent = 'Receber código'
        if (!r.ok) return mostrarRecado(r.mensagem || 'Não consegui agora.', true)
        telefoneEmUso = tel
        $('passo-telefone').className = 'oculto'
        $('passo-codigo').className = ''
        mostrarRecado(r.mensagem, false)
        $('codigo').focus()
      })
      .catch(function () {
        botao.disabled = false
        botao.textContent = 'Receber código'
        mostrarRecado('Sem conexão. Tente de novo.', true)
      })
  })

  $('trocar').addEventListener('click', function () {
    limparRecado()
    $('passo-codigo').className = 'oculto'
    $('passo-telefone').className = ''
    $('codigo').value = ''
    $('telefone').focus()
  })

  $('confirmar').addEventListener('click', entrar)
  $('codigo').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') entrar()
  })
  $('telefone').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('pedir').click()
  })

  function entrar() {
    var codigo = $('codigo').value.replace(/\D/g, '')
    if (codigo.length !== 6) return mostrarRecado('O código tem 6 números.', true)
    limparRecado()
    var botao = $('confirmar')
    botao.disabled = true
    botao.textContent = 'Entrando…'

    chamar('portal-confirmar', { telefone: telefoneEmUso, codigo: codigo })
      .then(function (r) {
        if (!r.ok || !r.token_hash) {
          botao.disabled = false
          botao.textContent = 'Entrar'
          return mostrarRecado(r.mensagem || 'Código inválido ou expirado.', true)
        }
        // Quem emite a sessão é o auth do Supabase, não a nossa função.
        return sb.auth
          .verifyOtp({ token_hash: r.token_hash, type: 'magiclink' })
          .then(function (res) {
            botao.disabled = false
            botao.textContent = 'Entrar'
            if (res.error) return mostrarRecado('Não consegui entrar. Peça um novo código.', true)
            abrirConta(r.nome)
          })
      })
      .catch(function () {
        botao.disabled = false
        botao.textContent = 'Entrar'
        mostrarRecado('Sem conexão. Tente de novo.', true)
      })
  }

  $('sair').addEventListener('click', function () {
    sb.auth.signOut().then(function () { location.reload() })
  })

  /* --- a conta ---------------------------------------------------------- */

  function abrirConta(nome) {
    $('tela-entrada').className = 'oculto'
    $('tela-conta').className = ''
    $('sair').className = 'sair'
    if (nome) {
      $('saudacao').textContent = 'Oi, ' + nome
    } else {
      // Sessão restaurada: o nome não veio da função de entrada. Buscar em
      // customers é seguro — a RLS só devolve a linha dela.
      sb.from('customers').select('name').limit(1).then(function (r) {
        var n = r.data && r.data[0] && r.data[0].name
        if (n) $('saudacao').textContent = 'Oi, ' + n.trim().split(/\s+/)[0]
      })
    }

    Promise.all([
      sb.from('v_portal_pedido').select('*').order('data_pedido', { ascending: false }),
      sb.from('v_portal_peca').select('*'),
      sb.from('appointments').select('id, starts_at, status, store_id')
        .order('starts_at', { ascending: false }).limit(12),
    ]).then(function (r) {
      var pedidos = r[0].data || []
      var pecas = r[1].data || []
      var provas = r[2].data || []
      desenharPedidos(pedidos, pecas)
      desenharProvas(provas)
      $('resumo').textContent = pedidos.length
        ? 'Você tem ' + pedidos.length + (pedidos.length === 1 ? ' pedido' : ' pedidos') + ' com a gente.'
        : 'Assim que você fechar um pedido na loja, ele aparece aqui.'
    })
  }

  function desenharPedidos(pedidos, pecas) {
    var alvo = $('pedidos')
    alvo.innerHTML = ''
    if (!pedidos.length) {
      texto(alvo, 'div', 'cartao vazio',
        'Nenhum pedido ainda. Quando você escolher sua peça na loja, ela aparece aqui.')
      return
    }

    pedidos.forEach(function (p) {
      var c = document.createElement('div')
      c.className = 'pedido'

      var l1 = texto(c, 'div', 'linha1')
      // A cliente não pensa em número de pedido — pensa na data dela. O número
      // aparece quando existe (é o que a loja pergunta ao telefone); sem ele, o
      // evento é o que identifica: "o meu de dezembro".
      texto(l1, 'span', 'num',
        p.numero ? 'Pedido ' + p.numero
          : p.data_evento ? 'Para ' + data(p.data_evento)
          : 'Pedido de ' + data(p.data_pedido))
      texto(l1, 'span', 'selo', p.operacao === 'venda' ? 'compra' : 'aluguel')
      if (p.loja) texto(l1, 'span', 'selo', p.loja.replace('Koisa Linda ', ''))
      if (Number(p.atelie_aberto) > 0) {
        texto(l1, 'span', 'selo alerta',
          p.atelie_aberto === 1 ? '1 ajuste no ateliê' : p.atelie_aberto + ' ajustes no ateliê')
      } else {
        texto(l1, 'span', 'selo ok', 'ajustes prontos')
      }

      var d = texto(c, 'div', 'dados')
      campo(d, 'Fechado em', data(p.data_pedido))
      if (p.numero) campo(d, 'Seu evento', data(p.data_evento))
      campo(d, 'Retirada', data(p.retirada))
      campo(d, 'Devolução', data(p.devolucao))
      campo(d, 'Total', dinheiro(p.valor_total))
      // Decidir só pelo saldo dizia "Falta pagar" em pedido cancelado e em
      // orçamento. A view já zera o cancelado; aqui o rótulo diz o que é.
      if (p.situacao === 'cancelado' || p.situacao === 'perdido') {
        campo(d, 'Situação', 'pedido cancelado — nada a pagar')
      } else if (p.situacao === 'orcamento') {
        campo(d, 'Orçamento', 'proposta em aberto, ainda não é pedido')
      } else {
        campo(d, Number(p.saldo_aberto) > 0 ? 'Falta pagar' : 'Pago',
              Number(p.saldo_aberto) > 0 ? dinheiro(p.saldo_aberto) : 'tudo certo')
      }

      var minhas = pecas.filter(function (x) { return x.pedido_id === p.id })
      if (minhas.length) {
        var ul = texto(c, 'ul', 'pecas')
        minhas.forEach(function (x) {
          var li = texto(ul, 'li')
          texto(li, 'span', null, x.nome || 'peça')
          var det = [x.cor, x.tamanho].filter(Boolean).join(' · ')
          if (det) texto(li, 'span', 'det', det)
          if (Number(x.ajustes_abertos) > 0) {
            texto(li, 'span', 'selo alerta',
              x.prazo_atelie ? 'pronto em ' + data(x.prazo_atelie) : 'no ateliê')
          }
        })
      }

      alvo.appendChild(c)
    })
  }

  function campo(pai, rotulo, valor) {
    if (!valor) return
    var d = texto(pai, 'div')
    texto(d, 'span', null, rotulo)
    texto(d, 'strong', null, valor)
  }

  function desenharProvas(provas) {
    var alvo = $('provas')
    alvo.innerHTML = ''
    if (!provas.length) {
      $('secao-provas').className = 'secao oculto'
      return
    }
    provas.forEach(function (a) {
      var c = document.createElement('div')
      c.className = 'pedido'
      var l1 = texto(c, 'div', 'linha1')
      texto(l1, 'span', 'num', dataHora(a.starts_at))
      if (a.status) {
        texto(l1, 'span', 'selo' + (a.status === 'cancelado' ? '' : ' ok'), a.status)
      }
      alvo.appendChild(c)
    })
  }

  /* --- já estava logada? ------------------------------------------------ */

  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) abrirConta(null)
  })
})()
