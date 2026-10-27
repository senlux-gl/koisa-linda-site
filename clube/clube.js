/* Clube Koisa Linda — peças comuns do painel da equipe e do painel da cliente.
 *
 * Fala direto com o banco da KL (Supabase). A chave abaixo é a chave pública
 * ("anon"), feita para ficar no navegador: quem protege os dados é a regra por
 * loja do banco (RLS) e as funções do Clube, que conferem loja, saldo e situação.
 *
 * A chave entra na publicação (tools/build-site.py, variável KL_SUPABASE_ANON_KEY do Actions);
 * no repositório fica só o marcador.
 *
 * ?demo=1 na URL liga a demonstração: dados inventados, nada vai para o banco. */

export const SUPABASE_URL = 'https://pyrbvkhqhpwwgoiilxjo.supabase.co'
export const SUPABASE_ANON_KEY = '__ANON_KEY__'
export const DEMO = new URLSearchParams(location.search).get('demo') === '1'

export const FORMAS = {
  pix_avista: { rotulo: 'Pix à vista', valor: 1188 },
  cartao_12x: { rotulo: 'Cartão em 12x', valor: 1500 },
  cartao_mensal: { rotulo: 'Cartão todo mês', valor: 149 },
}
export const SITUACOES = {
  ativa: 'ativa', aguardando_pagamento: 'aguardando pagamento', pausada: 'pausada',
  cancelada: 'cancelada', encerrada: 'encerrada',
}
export const LOJAS = {
  barra: { nome: 'Barra', zap: '5521966475383' },
  saofrancisco: { nome: 'São Francisco', zap: '5521970858787' },
}

export const data = (d) => !d ? '—' : new Date(String(d).length === 10 ? `${d}T12:00:00` : d)
  .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const dinheiro = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const novaChave = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
export const linkCliente = (token) => `https://koisalinda.com.br/clube/minha/#${token}`
/** Código que a cliente fala na loja: maiúsculo, sem espaço nem traço. */
export const normalizaCodigo = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Telefone digitado do jeito que a loja anota vira +55DDDNÚMERO; inválido devolve undefined. */
export function telefoneE164(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10 || d.length === 11) return `+55${d}`
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return `+${d}`
  return undefined
}

export function cliente() {
  if (DEMO) return demo()
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kl-clube-equipe' },
  })
}

/* ------------------------------------------------------------ demonstração */
function demo() {
  const hoje = new Date()
  const dia = (n) => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10)
  const linkDemo = (nome) => `demo-${nome}-`.padEnd(64, '0')
  const A = [
    { id: 'c1', store_id: 'barra', nome: 'Marina Fontes', telefone_e164: null, acompanhante: 'Rafael', forma_pagamento: 'pix_avista', valor: 1188, inicio: dia(-40), validade: dia(325), usos_total: 5, usos_liberados: 5, situacao: 'ativa', token: linkDemo('marina'), codigo: 'MRN4F7', observacao: null },
    { id: 'c2', store_id: 'barra', nome: 'Helena Castro', telefone_e164: null, acompanhante: null, forma_pagamento: 'cartao_mensal', valor: 149, inicio: dia(-10), validade: dia(355), usos_total: 5, usos_liberados: 1, situacao: 'ativa', token: linkDemo('helena'), codigo: 'HLN8K2', observacao: 'Mensal: um uso liberado por enquanto.' },
  ]
  const U = [
    { id: 'u1', assinante_id: 'c1', store_id: 'barra', beneficiario: 'Marina Fontes', peca: 'MD-073', pedido_clariai: '4521', data_evento: dia(-20), registrado_por: 'Letícia', estornado: false, criado_em: new Date(hoje - 25 * 864e5).toISOString() },
    { id: 'u2', assinante_id: 'c1', store_id: 'barra', beneficiario: 'Rafael', peca: 'terno marinho', data_evento: dia(-20), registrado_por: 'Letícia', estornado: false, criado_em: new Date(hoje - 25 * 864e5).toISOString() },
  ]
  const comSaldo = () => A.map((a) => {
    const usados = U.filter((u) => u.assinante_id === a.id && !u.estornado).length
    return { ...a, usos_usados: usados, saldo: Math.max(Math.min(a.usos_total, a.usos_liberados) - usados, 0),
             pode_usar: a.situacao === 'ativa' && a.validade >= dia(0) }
  })
  let logado = false
  const ouvintes = []
  const sessao = () => logado ? { user: { id: 'demo', email: 'demo@koisalinda.com.br' } } : null
  const tabela = (nome) => {
    let linhas = nome === 'v_clube_assinantes' ? comSaldo() : nome === 'clube_usos' ? [...U]
      : nome === 'app_users' ? [{ user_id: 'demo', store_id: 'barra', papel: 'admin', consultant_id: null, ativo: true }] : []
    const q = {
      select: () => q,
      eq: (c, v) => { linhas = linhas.filter((l) => l[c] === v); return q },
      order: (c, o) => { linhas.sort((a, b) => (a[c] > b[c] ? 1 : -1) * (o?.ascending === false ? -1 : 1)); return q },
      maybeSingle: () => Promise.resolve({ data: linhas[0] || null, error: null }),
      single: () => Promise.resolve({ data: linhas[0] || null, error: null }),
      insert: (l) => { A.unshift({ id: `d${Date.now()}`, usos_total: 5, usos_liberados: 5, token: linkDemo(Date.now()), codigo: Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * 32)]).join(''), ...l }); return Promise.resolve({ error: null }) },
      update: (campos) => ({ eq: (c, v) => { A.filter((l) => l[c] === v).forEach((l) => Object.assign(l, campos)); return Promise.resolve({ error: null }) } }),
      then: (f) => Promise.resolve({ data: linhas, error: null }).then(f),
    }
    return q
  }
  return {
    auth: {
      getSession: async () => ({ data: { session: sessao() } }),
      onAuthStateChange: (f) => { ouvintes.push(f); return { data: { subscription: { unsubscribe() {} } } } },
      signInWithPassword: async () => { logado = true; ouvintes.forEach((f) => f('SIGNED_IN', sessao())); return { error: null } },
      signOut: async () => { logado = false; ouvintes.forEach((f) => f('SIGNED_OUT', null)); return { error: null } },
    },
    from: tabela,
    rpc: async (nome, p) => {
      if (nome === 'kl_pode') return { data: true, error: null }
      if (nome === 'clube_minha_assinatura') {
        const a = comSaldo().find((x) => x.token === p.p_token)
        if (!a) return { data: null, error: null }
        return { data: { nome: a.nome.split(' ')[0], codigo: a.codigo, loja: a.store_id, forma_pagamento: a.forma_pagamento, inicio: a.inicio,
          validade: a.validade, situacao: a.situacao, usos_no_plano: Math.min(a.usos_total, a.usos_liberados), usos_usados: a.usos_usados,
          saldo: a.saldo, pode_usar: a.pode_usar, historico: U.filter((u) => u.assinante_id === a.id && !u.estornado)
            .map((u) => ({ quando: new Date(u.criado_em).toLocaleDateString('sv-SE'), quem: u.beneficiario, peca: u.peca, festa: u.data_evento })) }, error: null }
      }
      if (nome === 'clube_registrar_uso') {
        const rep = U.find((u) => u.chave === p.p_chave); if (rep) return { data: rep, error: null }
        const a = comSaldo().find((x) => x.id === p.p_assinante)
        if (!a?.pode_usar) return { data: null, error: { message: 'assinatura não pode usar agora' } }
        if (a.saldo <= 0) return { data: null, error: { message: 'sem saldo' } }
        const u = { id: `u${Date.now()}`, assinante_id: a.id, store_id: a.store_id, beneficiario: p.p_beneficiario, peca: p.p_peca,
          data_evento: p.p_data_evento, registrado_por: p.p_registrado_por, chave: p.p_chave, pedido_clariai: p.p_pedido_clariai || null, estornado: false, criado_em: new Date().toISOString() }
        U.unshift(u); return { data: u, error: null }
      }
      if (nome === 'clube_estornar_uso') {
        const u = U.find((x) => x.id === p.p_uso); if (u) Object.assign(u, { estornado: true, motivo_estorno: p.p_motivo }); return { data: u, error: null }
      }
      return { data: null, error: { message: `demonstração sem ${nome}` } }
    },
  }
}
