'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const Core = require('../kl-catalog-core.js');

function defaultState(overrides) {
  return Object.assign({
    query: '', category: null, unit: null,
    colors: [], sizes: [], page: 1, openProduct: null,
  }, overrides || {});
}

test('readState sanitiza aliases, inválidos e listas repetidas', () => {
  const state = Core.readState('?cat=all&un=invalida&co=vinho&co=rosa&tam=33&tam=ZZ&p=cl-033&pg=3&q=%20V%C3%8DNHO%20', fixtures);
  assert.deepEqual(state, {
    query: 'VÍNHO', category: null, unit: null,
    colors: ['rosa', 'vinho'], sizes: ['33'], page: 3, openProduct: 'CL-033',
  });
});

test('readState retorna o estado canônico completo sem parâmetros', () => {
  const state = Core.readState('', fixtures);
  assert.deepEqual(state, {
    query: '', category: null, unit: null,
    colors: [], sizes: [], page: 1, openProduct: null,
  });
});

test('readState rejeita páginas que não sejam inteiros positivos estritos', () => {
  ['2abc', '2.9', '2e2'].forEach((value) => {
    assert.equal(Core.readState(`?pg=${value}`, fixtures).page, 1, value);
  });
});

test('serializeState produz ordem canônica estável', () => {
  const query = Core.serializeState({
    query: 'vinho', category: 'vestidos-debutante', unit: 'sf',
    colors: ['vinho', 'rosa'], sizes: ['M', 'P'], page: 2, openProduct: 'DB-010',
  });
  assert.equal(query, 'cat=vestidos-debutante&un=sf&q=vinho&co=rosa&co=vinho&tam=M&tam=P&pg=2&p=DB-010');
});

test('serializeState omite o estado padrão e arrays vazios', () => {
  const defaultState = {
    query: '', category: null, unit: null,
    colors: [], sizes: [], page: 1, openProduct: null,
  };
  assert.equal(Core.serializeState(defaultState), '');
});

test('busca normalizada encontra categoria, tamanho e cor sem diacríticos', () => {
  assert.deepEqual(Core.derive(fixtures, defaultState({ query: 'calcado' })).products.map((p) => p.k), ['CL-033']);
  assert.deepEqual(Core.derive(fixtures, defaultState({ query: '63' })).products.map((p) => p.k), ['TR-001']);
  assert.deepEqual(Core.derive(fixtures, defaultState({ query: 'vinho' })).products.map((p) => p.k), ['DB-010']);
});

test('filtros usam OR dentro da faceta e AND entre facetas', () => {
  const view = Core.derive(fixtures, defaultState({
    unit: 'sf',
    colors: ['off-white', 'vinho'],
    sizes: ['P', 'G'],
  }));

  assert.deepEqual(view.products.map((p) => p.k).sort(), ['DB-010', 'NV-002']);
});

test('facetas dependentes respeitam unidade e preservam tamanhos numéricos', () => {
  const view = Core.derive(fixtures, defaultState({ unit: 'barra' }));

  assert.equal(view.facets.sizes['33'], 1);
  assert.equal(view.facets.sizes['63'], 1);
  assert.equal(view.facets.colors.vinho, undefined);
});

test('contagens de categoria e unidade permanecem globais', () => {
  const view = Core.derive(fixtures, defaultState({
    category: 'vestidos-noiva',
    unit: 'sf',
  }));

  assert.deepEqual(view.categoryCounts, {
    'vestidos-noiva': 2,
    'vestidos-debutante': 1,
    'vestidos-madrinha': 1,
    ternos: 1,
    bolsas: 1,
    calcados: 1,
    acessorios: 1,
  });
  assert.deepEqual(view.unitCounts, { barra: 4, sf: 4 });
});

test('mistura é determinística, completa e diversa no início', () => {
  const first = Core.derive(fixtures, defaultState()).products;
  const second = Core.derive(fixtures, defaultState()).products;
  const firstCodes = first.map((p) => p.k);

  assert.deepEqual(second.map((p) => p.k), firstCodes);
  assert.equal(firstCodes.length, fixtures.length);
  assert.equal(new Set(firstCodes).size, fixtures.length);
  assert.deepEqual(new Set(firstCodes), new Set(fixtures.map((p) => p.k)));
  assert.equal(new Set(first.slice(0, 7).map((p) => p.c)).size, 7);
  assert.ok(new Set(first.slice(0, 6).map((p) => p.un)).size >= 2);
});

test('deep-link incompatível remove só a peça aberta', () => {
  const requested = Core.readState('?cat=ternos&p=DB-010&q=terno', fixtures);
  const view = Core.derive(fixtures, requested);

  assert.equal(view.state.openProduct, null);
  assert.equal(view.state.category, 'ternos');
  assert.equal(view.state.query, 'terno');
});

test('resolveOpenProduct eleva a página para revelar peça válida', () => {
  const products = Array.from({ length: 25 }, (_, index) => ({
    k: `P-${String(index).padStart(2, '0')}`,
  }));
  const state = defaultState({ openProduct: 'P-24' });

  assert.equal(Core.resolveOpenProduct(products, state, 12).page, 3);
});

test('telemetria de busca não inclui termo bruto nem PII', () => {
  const email = ['nome', 'example.invalid'].join('@');
  const term = `meu contato ${email} NV-001`;
  const telemetry = Core.buildSearchTelemetry(term, fixtures, 1, defaultState());
  const json = JSON.stringify(telemetry);

  assert.deepEqual(telemetry, {
    query_length: term.length,
    query_has_product_code: 'no',
    product_code: '',
    result_count: 1,
    catalog_category: '',
    catalog_unit: '',
  });
  assert.equal(json.includes(email), false);
  assert.equal(json.includes(term), false);
});

test('telemetria reconhece somente busca que é exatamente o código', () => {
  const telemetry = Core.buildSearchTelemetry('  nv-001  ', fixtures, 1, defaultState());

  assert.equal(telemetry.query_length, 10);
  assert.equal(telemetry.query_has_product_code, 'yes');
  assert.equal(telemetry.product_code, 'NV-001');
});

test('validateProducts aceita fixtures válidas', () => {
  assert.deepEqual(Core.validateProducts(fixtures), {
    ok: true,
    products: fixtures,
    errors: [],
  });
});

test('validateProducts bloqueia unidade inválida, campo k ausente e código duplicado', () => {
  const malformed = [
    fixtures[0],
    Object.assign({}, fixtures[1], { un: 'invalida' }),
    Object.assign({}, fixtures[2], { k: '' }),
    Object.assign({}, fixtures[3], { k: 'nv-001' }),
  ];
  const report = Core.validateProducts(malformed);

  assert.equal(report.ok, false);
  assert.deepEqual(report.products, []);
  assert.ok(report.errors.some((error) => error.reason === 'invalid-unit'));
  assert.ok(report.errors.some((error) => error.reason === 'missing-field' && error.field === 'k'));
  assert.ok(report.errors.some((error) => error.reason === 'duplicate-code'));
});

test('validateProducts rejeita base não-array e item não-objeto', () => {
  assert.equal(Core.validateProducts(null).errors[0].reason, 'not-array');
  assert.equal(Core.validateProducts([null]).errors[0].reason, 'not-object');
});

test('unitOf nunca infere unidade inválida ou ausente', () => {
  assert.equal(Core.unitOf(fixtures[0]), 'barra');
  assert.equal(Core.unitOf(fixtures[1]), 'sf');
  assert.equal(Core.unitOf({ un: 'outra' }), null);
  assert.equal(Core.unitOf({}), null);
});

test('thumbUrl gera miniatura JPG preservando query e nunca reutiliza original', () => {
  assert.equal(Core.thumbUrl(fixtures[0]), 'https://img.test/noiva/NV-001-ia-thumb.jpg?v=2');
  assert.equal(Core.thumbUrl({ u: 'https://img.test/noiva/NV-001-ia.webp?v=2' }), '');
  assert.equal(Core.thumbUrl({}), '');
});

test('productDetailUrl codifica o código da peça', () => {
  assert.equal(Core.productDetailUrl({ k: 'NV 001/2' }), 'peca.html?codigo=NV%20001%2F2');
});
