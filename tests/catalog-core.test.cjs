'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const Core = require('../kl-catalog-core.js');

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
