'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Site = require('../kl-site-enhance.js');

const contacts = { barra: '101', sf: '202' };

test('matriz pública preserva campanhas e não presume loja no catálogo misto', () => {
  assert.match(Site.resolveStickyCta({ page: 'noivas' }, contacts).href, /wa\.me\/101/);
  assert.match(Site.resolveStickyCta({ page: 'debutantes' }, contacts).href, /wa\.me\/101/);
  assert.match(Site.resolveStickyCta({ page: 'madrinhas' }, contacts).href, /wa\.me\/202/);
  assert.match(Site.resolveStickyCta({ page: 'ternos' }, contacts).href, /wa\.me\/101/);
  assert.equal(Site.resolveStickyCta({ page: 'catalogo', unit: null }, contacts).href, 'unidades.html');
  assert.equal(Site.resolveStickyCta({ page: 'catalogo', status: 'error', unit: 'barra' }, contacts).href, 'unidades.html');
  assert.match(Site.resolveStickyCta({ page: 'catalogo', unit: 'sf' }, contacts).href, /wa\.me\/202/);
  ['index', 'sobre', 'servicos', 'unidades', 'como-chegar'].forEach((page) => {
    assert.equal(Site.resolveStickyCta({ page }, contacts).href, 'unidades.html');
  });
});

test('detalhe usa somente unidade válida da peça', () => {
  assert.match(
    Site.resolveStickyCta({ page: 'peca', product: { k: 'NV-001', un: 'barra' } }, contacts).href,
    /wa\.me\/101/,
  );
  assert.equal(
    Site.resolveStickyCta({ page: 'peca', product: { k: 'X', un: 'invalida' } }, contacts).href,
    'unidades.html',
  );
});

test('contexto inicial resolve codigo e p no detalhe', () => {
  const products = [
    { k: 'NV-001', un: 'barra' },
    { k: 'NV-002', un: 'sf' },
  ];
  const root = {
    URLSearchParams,
    KL_DATA: products,
    KLCatalog: {
      Core: {
        validateProducts() {
          return { ok: true, products };
        },
      },
    },
    location: { pathname: '/peca.html', search: '?codigo=NV-001' },
  };

  assert.equal(Site.initialContext(root).product.k, 'NV-001');
  root.location.search = '?p=NV-002';
  assert.equal(Site.initialContext(root).product.k, 'NV-002');
});

test('sticky de noiva e debutante leva para a agenda, e o resto continua no WhatsApp', () => {
  const alvos = (ctx) => Site.resolveStickyTargets(ctx, contacts);

  // As duas ocasiões com hora marcada: o botão diz "Agende sua prova" e agora agenda.
  assert.deepEqual(alvos({ page: 'noivas' }).map((t) => t.href), ['agendar.html?ocasiao=noiva']);
  assert.deepEqual(alvos({ page: 'debutantes' }).map((t) => t.href), ['agendar.html?ocasiao=debutante']);
  assert.equal(alvos({ page: 'noivas' })[0].label, 'Escolher horário');

  // A loja que a cliente trouxe no ?un= viaja junto: ela cai direto no calendário.
  assert.equal(alvos({ page: 'noivas', unit: 'sf' })[0].href, 'agendar.html?ocasiao=noiva&un=sf');
  assert.equal(alvos({ page: 'debutantes', unit: 'barra' })[0].href, 'agendar.html?ocasiao=debutante&un=barra');
  assert.equal(alvos({ page: 'noivas', unit: 'inventada' })[0].href, 'agendar.html?ocasiao=noiva');

  // Visita livre não tem agenda — e madrinhas.html é o braço do teste de porta,
  // que depende do prefill de WhatsApp. Estas duas NÃO podem mudar de destino.
  ['madrinhas', 'ternos'].forEach((page) => {
    const r = alvos({ page });
    assert.equal(r.length, 2, `${page} deve manter as duas lojas`);
    r.forEach((t) => assert.match(t.href, /^https:\/\/wa\.me\//, `${page} deve ir para o WhatsApp`));
  });

  // O resto do site segue como estava.
  assert.equal(alvos({ page: 'index' })[0].href, 'unidades.html');
  assert.match(alvos({ page: 'catalogo', unit: 'barra' })[0].href, /wa\.me\/101/);
});

test('o marcador que o teste de porta procura no arquivo continua existindo', () => {
  // O job kl-teste-porta-site.service (VPS, seg 24/08 09h) baixa este arquivo em
  // produção e procura esta string antes de ligar o braço da Barra. Se ela sumir,
  // o teste liga só São Francisco — em silêncio.
  const fonte = require('node:fs').readFileSync(require.resolve('../kl-site-enhance.js'), 'utf8');
  assert.ok(fonte.includes('un= vale em qualquer'), 'marcador do teste de porta foi removido');
});
