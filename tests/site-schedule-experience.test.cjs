'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSchedule, submitBooking } = require('./helpers/fake-schedule-browser.cjs');

const products = [
  { k: 'NV-001', c: 'vestidos-noiva', un: 'barra' },
  { k: 'DB-001', c: 'vestidos-debutante', un: 'sf' },
  { k: 'MD-001', c: 'vestidos-madrinha', un: 'barra' },
];
const start = (query, options = {}) => loadSchedule({
  url: 'https://koisalinda.com.br/agendar/?un=barra&' + query,
  products,
  ...options,
});

for (const variant of ['a', 'b', 'd']) {
  test('flow ' + variant + ' carries valid catalog reference to lead and booking without analytics PII', async () => {
    const env = start('ocasiao=noiva&modelo=NV-001&variant=' + variant);
    await submitBooking(env);
    for (const suffix of ['/lead', '/pedido']) {
      const payload = env.calls.find(call => call.url.endsWith(suffix)).payload;
      assert.match(payload.notas, /Referência do catálogo: NV-001/);
      assert.match(payload.notas, /Texto privado/);
      assert.ok(payload.notas.length <= 400);
      assert.equal(payload.notas.split('Referência do catálogo:').length, 2);
    }
    const analytics = JSON.stringify([env.fbqCalls, env.gtagCalls]);
    assert.doesNotMatch(analytics, /Pessoa Fixture|fixture@example/);
    assert.equal(analytics.includes(env.calls.find(call => call.url.endsWith('/lead')).payload.telefone), false);
  });
}

test('invalid, unknown or incompatible reference never reaches rendered content or order notes', async () => {
  for (const model of ['NV-DOES-NOT-EXIST', 'MD-001', 'DB-001', '<img src=x onerror=alert(1)>']) {
    const env = start('variant=a&ocasiao=noiva&modelo=' + encodeURIComponent(model));
    await submitBooking(env);
    assert.doesNotMatch(env.calls.find(call => call.url.endsWith('/pedido')).payload.notas, /Referência do catálogo:/);
    assert.doesNotMatch(env.document.getElementById('cartao').innerHTML, /onerror|NV-DOES-NOT-EXIST/);
  }
});

test('booking remains available when catalog data could not load', async () => {
  const env = start('variant=a&ocasiao=noiva&modelo=NV-001', { products: [] });
  await submitBooking(env);
  assert.ok(env.calls.some(call => call.url.endsWith('/pedido')));
  assert.doesNotMatch(env.calls.find(call => call.url.endsWith('/pedido')).payload.notas, /Referência do catálogo:/);
});

test('back from form retains typed fields and choice of consent when selecting another time', async () => {
  const env = start('variant=a&ocasiao=noiva&modelo=NV-001');
  const doc = env.document;
  await new Promise(setImmediate);
  const help = doc.getElementById('cartao').querySelectorAll('a').find(a => (a.getAttribute('href') || '').includes('#duvidas-agendamento'));
  assert.match(help.getAttribute('href'), /modelo=NV-001/);
  assert.match(help.getAttribute('href'), /variant=a/);
  doc.getElementById('horarios').querySelector('.hora').click();
  doc.getElementById('ir3').click();
  doc.getElementById('nome').value = 'Nome de teste';
  doc.getElementById('telefone').value = '(00) 00000-0000';
  doc.getElementById('evento').value = '2026-12-12';
  doc.getElementById('notas').value = 'Quero experimentar manga comprida';
  doc.getElementById('aceite').checked = true;
  doc.getElementById('voltar2').click();
  await new Promise(setImmediate);
  doc.getElementById('ir3').click();
  assert.equal(doc.getElementById('nome').value, 'Nome de teste');
  assert.equal(doc.getElementById('telefone').value, '(00) 00000-0000');
  assert.equal(doc.getElementById('evento').value, '2026-12-12');
  assert.equal(doc.getElementById('notas').value, 'Quero experimentar manga comprida');
  assert.equal(doc.getElementById('aceite').checked, true);
  assert.equal(env.calls.filter(call => /\/(lead|pedido)$/.test(call.url)).length, 0);
});

test('reference and comment fit the existing backend note limit', async () => {
  const context = require('../kl-schedule-context.js');
  assert.equal(context.resolveReference(' nv-001 ', 'noiva', products), 'NV-001');
  assert.equal(context.resolveReference('NV-001', 'debutante', products), '');
  const notes = context.orderNotes('NV-001', 'a'.repeat(400));
  assert.equal(notes.length, 400);
  assert.match(notes, /^Referência do catálogo: NV-001\./);
});

test('form-first flow updates captured context when the occasion changes before booking', async () => {
  const env = start('variant=d&ocasiao=noiva&modelo=NV-001');
  const doc = env.document;
  doc.getElementById('nome').value = 'Nome de teste';
  doc.getElementById('telefone').value = '00000000000';
  doc.getElementById('aceite').checked = true;
  doc.getElementById('lead-d').dispatchEvent({ type: 'submit', preventDefault() {} });
  await new Promise(setImmediate);
  doc.getElementById('cartao').querySelectorAll('.escolha').find(node => node.getAttribute('data-valor') === 'debutante').click();
  doc.getElementById('ir2').click();
  await new Promise(setImmediate);
  doc.getElementById('horarios').querySelector('.hora').click();
  doc.getElementById('ir3').click();
  await new Promise(setImmediate);
  const leads = env.calls.filter(call => call.url.endsWith('/lead'));
  const order = env.calls.find(call => call.url.endsWith('/pedido')).payload;
  assert.equal(leads.at(-1).payload.ocasiao, 'debutante');
  assert.equal(order.ocasiao, 'debutante');
  assert.doesNotMatch(leads.at(-1).payload.notas, /NV-001/);
  assert.doesNotMatch(order.notas, /NV-001/);
});

test('waiting for an updated lead freezes the selected booking and prevents another submission', async () => {
  const env = start('variant=d&ocasiao=noiva&modelo=NV-001');
  const doc = env.document;
  doc.getElementById('nome').value = 'Nome de teste';
  doc.getElementById('telefone').value = '00000000000';
  doc.getElementById('aceite').checked = true;
  doc.getElementById('lead-d').dispatchEvent({ type: 'submit', preventDefault() {} });
  await new Promise(setImmediate);
  doc.getElementById('cartao').querySelectorAll('.escolha').find(node => node.getAttribute('data-valor') === 'debutante').click();
  doc.getElementById('ir2').click();
  await new Promise(setImmediate);
  doc.getElementById('horarios').querySelector('.hora').click();
  const fetch = env.window.fetch;
  let release;
  env.window.fetch = (url, request) => url.endsWith('/lead') ? new Promise(resolve => { release = () => resolve(fetch(url, request)); }) : fetch(url, request);
  doc.getElementById('ir3').click();
  const back = doc.getElementById('voltar1');
  assert.equal(back.disabled, true);
  back.click();
  doc.getElementById('ir3').click();
  release();
  await new Promise(setImmediate);
  const orders = env.calls.filter(call => call.url.endsWith('/pedido'));
  assert.equal(orders.length, 1);
  assert.equal(orders[0].payload.loja, 'barra');
  assert.equal(orders[0].payload.data, '2026-10-10');
  assert.equal(orders[0].payload.hora, '10:00');
});
