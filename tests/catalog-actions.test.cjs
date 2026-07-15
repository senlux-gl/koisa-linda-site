'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const { createStorage } = require('./helpers/fake-browser.cjs');
const Actions = require('../kl-catalog-actions.js');

const contacts = Object.freeze({ barra: '101', sf: '202' });

test('favoritos v1 deduplicam em memória e preservam órfãos até limpeza explícita', () => {
  const original = ['NV-001', 'INEXISTENTE', 'DB-010', 'NV-001'];
  const storage = createStorage({
    'kl-favoritos-v1': JSON.stringify(original),
  });

  const favorites = Actions.createFavorites(storage, fixtures);

  assert.deepEqual(favorites.codes(), ['DB-010', 'INEXISTENTE', 'NV-001']);
  assert.deepEqual(favorites.items().map((item) => item.k), ['DB-010', 'NV-001']);
  assert.deepEqual(favorites.orphans(), ['INEXISTENTE']);
  assert.equal(favorites.has(' nv-001 '), true);
  assert.deepEqual(JSON.parse(storage.snapshot()['kl-favoritos-v1']), original);

  favorites.toggle(' cl-033 ');

  assert.deepEqual(
    JSON.parse(storage.snapshot()['kl-favoritos-v1']),
    ['CL-033', 'DB-010', 'INEXISTENTE', 'NV-001'],
  );
  assert.deepEqual(favorites.orphans(), ['INEXISTENTE']);

  favorites.cleanupOrphans();

  assert.deepEqual(favorites.orphans(), []);
  assert.deepEqual(favorites.codes(), ['CL-033', 'DB-010', 'NV-001']);
  assert.deepEqual(
    JSON.parse(storage.snapshot()['kl-favoritos-v1']),
    ['CL-033', 'DB-010', 'NV-001'],
  );
});

test('groups inclui somente peças válidas e clear limpa por ação explícita', () => {
  const storage = createStorage({
    'kl-favoritos-v1': JSON.stringify(['NV-002', 'NV-001', 'NAO-EXISTE']),
  });
  const favorites = Actions.createFavorites(storage, fixtures);

  assert.deepEqual(favorites.groups().barra.map((item) => item.k), ['NV-001']);
  assert.deepEqual(favorites.groups().sf.map((item) => item.k), ['NV-002']);
  assert.deepEqual(favorites.orphans(), ['NAO-EXISTE']);

  favorites.clear();

  assert.deepEqual(favorites.codes(), []);
  assert.deepEqual(favorites.items(), []);
  assert.deepEqual(favorites.groups(), { barra: [], sf: [] });
});

test('JSON inválido e valor v1 não-array carregam vazio sem reescrever storage', () => {
  ['{', JSON.stringify({ code: 'NV-001' })].forEach((stored) => {
    const storage = createStorage({ 'kl-favoritos-v1': stored });
    const favorites = Actions.createFavorites(storage, fixtures);

    assert.deepEqual(favorites.codes(), []);
    assert.equal(storage.snapshot()['kl-favoritos-v1'], stored);
  });
});

test('falha de leitura do storage não lança e mantém favoritos operando em memória', () => {
  const storage = {
    getItem() { throw new Error('read unavailable'); },
    setItem() { throw new Error('write unavailable'); },
    removeItem() { throw new Error('remove unavailable'); },
  };
  let favorites;

  assert.doesNotThrow(() => {
    favorites = Actions.createFavorites(storage, fixtures);
  });
  assert.doesNotThrow(() => favorites.toggle(' nv-001 '));
  assert.deepEqual(favorites.codes(), ['NV-001']);
  assert.deepEqual(favorites.items().map((item) => item.k), ['NV-001']);
});

test('falha de escrita do storage preserva toggle, limpeza de órfãos e clear em memória', () => {
  const storage = {
    getItem() { return JSON.stringify(['NV-001', 'INEXISTENTE']); },
    setItem() { throw new Error('write unavailable'); },
    removeItem() { throw new Error('remove unavailable'); },
  };
  const favorites = Actions.createFavorites(storage, fixtures);

  assert.doesNotThrow(() => favorites.toggle('DB-010'));
  assert.deepEqual(favorites.codes(), ['DB-010', 'INEXISTENTE', 'NV-001']);
  assert.doesNotThrow(() => favorites.cleanupOrphans());
  assert.deepEqual(favorites.codes(), ['DB-010', 'NV-001']);
  assert.doesNotThrow(() => favorites.clear());
  assert.deepEqual(favorites.codes(), []);
});

test('lotes respeitam URL codificada, unidade, ordem e numeração 1-based', () => {
  const many = Array.from({ length: 220 }, (_, index) => ({
    ...fixtures[index % fixtures.length],
    k: `PECA-${String(index).padStart(3, '0')}`,
    un: index % 2 ? 'sf' : 'barra',
  }));

  const batches = Actions.buildFavoriteBatches(many, contacts, 1800);

  assert.ok(batches.length > 2);
  assert.deepEqual(
    batches.flatMap((batch) => batch.items.map((item) => item.k)),
    many.slice().sort((left, right) => (
      left.un.localeCompare(right.un) || left.k.localeCompare(right.k)
    )).map((item) => item.k),
  );

  batches.forEach((batch) => {
    const message = decodeURIComponent(batch.href.split('?text=')[1]);
    const productLines = message.split('\n').filter((line) => (
      batch.items.some((item) => line.includes(item.k))
    ));

    assert.ok(batch.href.length <= 1800, `${batch.unit} ${batch.href.length}`);
    assert.equal(new Set(batch.items.map((item) => item.un)).size, 1);
    assert.equal(batch.unit, batch.items[0].un);
    assert.match(batch.href, new RegExp(`^https://wa\\.me/${contacts[batch.unit]}\\?text=`));
    assert.equal(productLines.length, batch.items.length);
  });

  ['barra', 'sf'].forEach((unit) => {
    const unitBatches = batches.filter((batch) => batch.unit === unit);
    assert.deepEqual(unitBatches.map((batch) => batch.index), unitBatches.map((_, index) => index + 1));
    assert.ok(unitBatches.every((batch) => batch.total === unitBatches.length));
  });
});

test('CTA individual e prova virtual seguem a unidade e o código canônico da peça', () => {
  assert.match(Actions.productWhatsAppHref(fixtures[0], contacts), /^https:\/\/wa\.me\/101\?text=/);
  assert.equal(
    decodeURIComponent(Actions.productWhatsAppHref(fixtures[0], contacts).split('?text=')[1]),
    'Olá! Tenho interesse na peça NV-001. Você consegue confirmar a disponibilidade e me ajudar a agendar uma prova?',
  );
  assert.equal(Actions.productWhatsAppHref({ k: 'X', un: 'invalida' }, contacts), 'unidades.html');
  assert.equal(
    Actions.tryOnHref({ ...fixtures[0], k: ' nv 001/azul ' }),
    'provar.html?p=NV%20001%2FAZUL',
  );
  assert.equal(Actions.tryOnHref(fixtures.find((item) => item.c === 'ternos')), null);
});

test('CTA compartilhado nunca escolhe unidade arbitrária e mantém labels exatos', () => {
  assert.deepEqual(
    Actions.resolveSharedCta({ page: 'catalogo', unit: null }, contacts),
    { href: 'unidades.html', label: 'Escolher unidade' },
  );

  const catalogCta = Actions.resolveSharedCta({ page: 'catalogo', unit: 'sf' }, contacts);
  assert.equal(catalogCta.label, 'WhatsApp');
  assert.match(catalogCta.href, /^https:\/\/wa\.me\/202\?text=/);
  assert.equal(
    decodeURIComponent(catalogCta.href.split('?text=')[1]),
    'Olá! Vim pelo catálogo da Koisa Linda e quero ajuda para agendar uma prova.',
  );

  const productCta = Actions.resolveSharedCta({ page: 'peca', product: fixtures[0] }, contacts);
  assert.equal(productCta.label, 'WhatsApp');
  assert.match(productCta.href, /^https:\/\/wa\.me\/101\?text=/);

  assert.deepEqual(
    Actions.resolveSharedCta({ page: 'catalogo', status: 'error' }, contacts),
    { href: 'unidades.html', label: 'Escolher unidade' },
  );
  assert.deepEqual(
    Actions.resolveSharedCta(null, contacts),
    { href: 'unidades.html', label: 'Escolher unidade' },
  );
});

test('exporta constantes públicas e API UMD no browser sem tocar document', () => {
  assert.equal(Actions.FAVORITES_KEY, 'kl-favoritos-v1');
  assert.deepEqual(Actions.TRY_ON_CATEGORIES, [
    'vestidos-noiva',
    'vestidos-madrinha',
    'vestidos-debutante',
  ]);
  assert.equal(Object.isFrozen(Actions.CONTACTS), true);

  const source = fs.readFileSync(path.join(__dirname, '..', 'kl-catalog-actions.js'), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  Object.defineProperty(sandbox, 'document', {
    configurable: true,
    get() { throw new Error('document must not be read'); },
  });

  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, { filename: 'kl-catalog-actions.js' }));
  assert.equal(typeof sandbox.window.KLCatalog.Actions.createFavorites, 'function');
  assert.equal(typeof Actions.createFavorites, 'function');
});
