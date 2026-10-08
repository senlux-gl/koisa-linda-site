'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSchedule } = require('./helpers/fake-schedule-browser.cjs');
test('returning from contact form reuses recent availability without losing the selected store', async () => {
  const env = loadSchedule({url:'https://koisalinda.com.br/agendar/?un=barra&ocasiao=noiva&variant=a'});
  await new Promise(setImmediate);
  const doc=env.document;
  doc.getElementById('horarios').querySelector('.hora').click();
  doc.getElementById('ir3').click();
  assert.match(doc.getElementById('cartao').innerHTML, /id="schedule-optional" hidden/);
  doc.getElementById('voltar2').click();
  await new Promise(setImmediate);
  assert.equal(env.calls.filter(c=>c.url.includes('/horarios?')).length,1);
  assert.match(env.calls.find(c=>c.url.includes('/horarios?')).url,/loja=barra&ocasiao=noiva/);
  assert.ok(doc.getElementById('horarios').querySelector('.hora'));
});
