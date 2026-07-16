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

test('detalhe e prova usam somente unidade válida da peça', () => {
  assert.match(
    Site.resolveStickyCta({ page: 'peca', product: { k: 'NV-001', un: 'barra' } }, contacts).href,
    /wa\.me\/101/,
  );
  assert.match(
    Site.resolveStickyCta({ page: 'provar', product: { k: 'NV-002', un: 'sf' } }, contacts).href,
    /wa\.me\/202/,
  );
  assert.equal(
    Site.resolveStickyCta({ page: 'peca', product: { k: 'X', un: 'invalida' } }, contacts).href,
    'unidades.html',
  );
  assert.equal(Site.resolveStickyCta({ page: 'provar', product: null }, contacts).href, 'unidades.html');
});

test('contexto inicial resolve codigo e p no detalhe e p na prova virtual', () => {
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
  root.location.pathname = '/provar.html';
  assert.equal(Site.initialContext(root).product.k, 'NV-002');
});
