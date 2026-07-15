'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');

const ALLOWED_EVENTS = [
  'KL_Catalog_Loaded', 'KL_Catalog_Error', 'KL_Catalog_Search',
  'KL_Filter_Change', 'KL_Catalog_Load_More', 'KL_Product_Open',
  'KL_Product_Navigate', 'KL_Favorite_Toggle', 'KL_Favorites_View',
  'KL_WhatsApp_Click', 'KL_Try_On_Click', 'KL_Catalog_Empty',
];

test('KLTracking.catalog envia toda a matriz permitida e rejeita evento desconhecido', () => {
  const rawEmail = 'nome' + '@' + 'example.invalid';
  const rawPhone = '101' + '202' + '3030';
  const env = loadTracking({
    search: '?q=' + encodeURIComponent(rawEmail + ' ' + rawPhone) + '&utm_source=instagram',
    products: [{
      c: 'vestidos-noiva', l: 'Noivas', k: 'NV-001', un: 'barra', t: 'M',
      co: 'off-white', u: 'https://img.test/NV-001.jpg',
    }],
  });

  ALLOWED_EVENTS.forEach((name) => env.window.KLTracking.catalog(name, {
    productCode: 'NV-001', resultCount: 1, category: 'vestidos-noiva', unit: 'barra',
    queryLength: 6, queryHasProductCode: 'yes', favoriteCount: 1,
    source: name === 'KL_Catalog_Loaded' ? rawEmail : 'catalog',
    query: rawEmail, term: rawPhone, email: rawEmail, phone: rawPhone,
  }));
  env.window.KLTracking.catalog('KL_Not_Allowed', { productCode: 'NV-001' });

  const custom = env.fbqCalls.filter(args => args[0] === 'trackCustom');
  assert.deepEqual(custom.map(args => args[1]), ALLOWED_EVENTS);
  const serialized = JSON.stringify(custom);
  assert.doesNotMatch(serialized, new RegExp(rawEmail.replace('.', '\\.')));
  assert.doesNotMatch(serialized, new RegExp(rawPhone));
  custom.forEach((args) => {
    assert.equal(args[2].page_path, '/catalogo.html');
    assert.equal(args[2].landing_path, '/catalogo.html');
    assert.ok(!JSON.stringify(args[2]).includes('?q='));
  });
});

test('migra landing_path legado removendo query antes do envio', () => {
  const rawEmail = 'legado' + '@' + 'example.invalid';
  const env = loadTracking({
    search: '',
    storage: { kl_landing_path: '/catalogo.html?q=' + encodeURIComponent(rawEmail) },
    products: [],
  });
  env.window.KLTracking.catalog('KL_Catalog_Empty', { resultCount: 0, source: 'data' });

  const payload = env.fbqCalls.find(args => args[1] === 'KL_Catalog_Empty')[2];
  assert.equal(payload.landing_path, '/catalogo.html');
  assert.doesNotMatch(JSON.stringify(payload), /legado|example\.invalid/i);
  assert.equal(env.storage.getItem('kl_landing_path'), '/catalogo.html');
});

test('produto inválido nunca ganha unidade Barra por fallback', () => {
  const env = loadTracking({
    products: [{ c: 'ternos', l: 'Ternos', k: 'TR-999', un: 'outra', t: 'M', co: 'preto', u: 'x' }],
  });
  env.window.KLTracking.catalog('KL_Product_Open', { productCode: 'TR-999', source: 'grid' });

  const payload = env.fbqCalls.find(args => args[1] === 'KL_Product_Open')[2];
  assert.equal(payload.unidade, undefined);
});
