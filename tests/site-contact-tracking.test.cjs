'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');

function assertContact(env, store, label) {
  const diagnostic = env.gtagCalls.filter(args => args[1] === 'KL_WhatsApp_Click');
  assert.equal(diagnostic.length, 1);
  assert.equal(diagnostic[0][2].store, store);
  assert.equal(diagnostic[0][2].conversion_stage, 'contact_click');
  assert.equal(env.gtagCalls.filter(args => args[1] === 'generate_lead').length, 1);
  const conversion = env.gtagCalls.filter(args => args[1] === 'conversion');
  assert.equal(conversion.length, 1);
  assert.equal(conversion[0][2].send_to, 'AW-test/' + label);
  assert.equal(env.fbqCalls.filter(args => args[0] === 'track' && args[1] === 'Lead').length, 1);
  assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 0);
  assert.doesNotMatch(JSON.stringify([env.fbqCalls, env.gtagCalls]), /fixture|988887777|@example/);
}

for (const [source, unit, phone, store, label] of [
  ['gallery', 'barra', '5521966475383', 'barra', 'barra-label'],
  ['favorites', 'sf', '5521970858787', 'sao_francisco', 'sf-label'],
]) {
  test(source + ' uses one shared contact-click conversion and correct store, even on duplicate emit', () => {
    const env = loadTracking();
    const context = { source, unit, href: 'https://wa.me/' + phone + '?text=' + encodeURIComponent('fixture@example.invalid 21988887777'), favoriteCount: 2 };
    env.window.KLTracking.catalog('KL_WhatsApp_Click', context);
    env.window.KLTracking.catalog('KL_WhatsApp_Click', context);
    assertContact(env, store, label);
  });
}

test('generic WhatsApp link uses the same deduplicated conversion semantics', () => {
  const env = loadTracking();
  env.dispatch('DOMContentLoaded');
  env.gtagCalls.length = 0;
  env.fbqCalls.length = 0;
  const attrs = { href: 'https://wa.me/5521970858787?text=' + encodeURIComponent('Olá, quero agendar uma prova. fixture@example.invalid 21988887777') };
  const link = {
    textContent: 'Falar com a loja', className: 'btn',
    getAttribute(name) { return attrs[name] || ''; }, setAttribute(name, value) { attrs[name] = value; },
    closest(selector) { return selector.startsWith('a[') ? this : null; },
  };
  env.dispatch('click', { target: link });
  env.dispatch('click', { target: link });
  assertContact(env, 'sao_francisco', 'sf-label');
  assert.equal(env.gtagCalls.filter(args => args[1] === 'KL_Schedule_Intent').length, 1);
});
