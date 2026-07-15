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

test('serializeState omite defaults e produz ordem estável', () => {
  const query = Core.serializeState({
    query: 'vinho', category: 'vestidos-debutante', unit: 'sf',
    colors: ['vinho', 'rosa'], sizes: ['M', 'P'], page: 2, openProduct: 'DB-010',
  });
  assert.equal(query, 'q=vinho&cat=vestidos-debutante&un=sf&co=rosa&co=vinho&tam=M&tam=P&p=DB-010&pg=2');
});
