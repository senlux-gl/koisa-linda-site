'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSchedule, submitBooking } = require('./helpers/fake-schedule-browser.cjs');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');

test('lead payload uses persisted attribution and an existing anonymous session after internal navigation', async () => {
  const entry = loadTracking({ url: 'https://koisalinda.com.br/noivas/', search: '?utm_source=meta&utm_campaign=120212345678901234&fbclid=Iw01234567890123456789' });
  entry.window.KLTracking.catalog('KL_Catalog_Loaded');
  const env = loadSchedule({ storage: entry.storage.snapshot() });
  await submitBooking(env);
  const payload = env.calls.find(call => call.url.endsWith('/lead')).payload;
  assert.equal(payload.utm_campaign, '120212345678901234');
  assert.equal(payload.fbclid, 'Iw01234567890123456789');
  assert.equal(payload.attribution.first.landing_path, '/noivas/');
  assert.equal(payload.attribution.last.utm_source, 'meta');
  assert.equal(payload.landing_page, 'https://koisalinda.com.br/noivas/');
  assert.equal(payload.session_id, entry.storage.getItem('kl_schedule_session_id'));
  assert.doesNotMatch(JSON.stringify([env.fbqCalls, env.gtagCalls]), /Pessoa Fixture|21988887777|fixture@example/);
});

test('confirmed appointment renders confirmed copy and emits Schedule once with stable eventID across retry', async () => {
  const response = { ok: true, status: 'confirmed', appointment_id: '00000000-0000-4000-8000-000000000001', duplicado: true };
  const first = loadSchedule({ response });
  await submitBooking(first);
  const html = first.document.getElementById('cartao').innerHTML;
  assert.match(html, /Prova confirmada/);
  assert.doesNotMatch(html, /é por lá que a equipe confirma/);
  const schedule = first.fbqCalls.filter(args => args[0] === 'track' && args[1] === 'Schedule');
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0][3].eventID, '00000000-0000-4000-8000-000000000001');
  assert.equal(first.gtagCalls.filter(args => args[1] === 'agendamento_site').length, 1);
  const retry = loadSchedule({ response, storage: first.storage.snapshot() });
  await submitBooking(retry);
  assert.equal(retry.fbqCalls.filter(args => args[1] === 'Schedule').length, 0);
  assert.equal(retry.gtagCalls.filter(args => args[1] === 'agendamento_site').length, 0);
});

test('pending approval renders pending copy and never emits confirmed conversions', async () => {
  const env = loadSchedule({ response: { ok: true, status: 'pending_approval', appointment_id: '00000000-0000-4000-8000-000000000002' } });
  await submitBooking(env);
  assert.match(env.document.getElementById('cartao').innerHTML, /aguardando confirmação/);
  assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 0);
  assert.equal(env.gtagCalls.filter(args => args[1] === 'agendamento_site').length, 0);
  assert.equal(env.gtagCalls.filter(args => args[1] === 'KL_Schedule_Pending_Approval').length, 1);
});

test('early experiment view waits for GA4 config and flushes once', () => {
  const env = loadSchedule({ noGA: true, tracking: false });
  assert.equal((env.window.__klGA4EventQueue || []).filter(event => event.name === 'KL_Schedule_Experiment_View').length, 1);
  env.run('kl-tracking.js');
  env.triggerDOMContentLoaded();
  const events = Array.from(env.window.dataLayer, args => Array.from(args));
  const configIndex = events.findIndex(args => args[0] === 'config' && args[1] === 'G-D6HYW29TS4');
  const experimentIndex = events.findIndex(args => args[1] === 'KL_Schedule_Experiment_View');
  assert.ok(configIndex >= 0 && experimentIndex > configIndex);
  env.triggerDOMContentLoaded();
  assert.equal(Array.from(env.window.dataLayer).filter(args => args[1] === 'KL_Schedule_Experiment_View').length, 1);
});

for (const variant of ['a', 'b']) {
  test('flow ' + variant + ' preserves current URL fallback attribution when shared tracking is unavailable', async () => {
    const env = loadSchedule({ tracking: false, url: 'https://koisalinda.com.br/agendar/?variant=' + variant + '&un=barra&ocasiao=noiva&utm_source=google&utm_campaign=campaign_12345678901234&gclid=opaque0123456789012345' });
    await submitBooking(env);
    const payload = env.calls.find(call => call.url.endsWith('/lead')).payload;
    assert.equal(payload.gclid, 'opaque0123456789012345');
    assert.equal(payload.attribution.last.utm_campaign, 'campaign_12345678901234');
    assert.equal(payload.landing_page, 'https://koisalinda.com.br/agendar/');
    assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 1);
    assert.doesNotMatch(JSON.stringify([env.fbqCalls, env.gtagCalls]), /Pessoa Fixture|21988887777|fixture@example/);
  });
}

test('legacy pending response and confirmed response without stable ID never count as Schedule', async () => {
  for (const response of [
    { ok: true, status: 'pedido_registrado', appointment_id: '00000000-0000-4000-8000-000000000003' },
    { ok: true, status: 'confirmed' },
    { ok: true, status: 'unexpected', appointment_id: '00000000-0000-4000-8000-000000000004' },
  ]) {
    const env = loadSchedule({ response });
    await submitBooking(env);
    assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 0);
    assert.equal(env.gtagCalls.filter(args => args[1] === 'agendamento_site').length, 0);
  }
});

test('backend error text cannot leak personal data through lead error analytics', async () => {
  const env = loadSchedule({ leadResponse: { ok: false, reason: 'private fixture@example.invalid 21988887777' } });
  await submitBooking(env);
  assert.equal(env.gtagCalls.filter(args => args[1] === 'KL_Lead_Form_Error').length, 1);
  assert.doesNotMatch(JSON.stringify([env.fbqCalls, env.gtagCalls]), /fixture@example|21988887777/);
});

test('pending to confirmed transition for same appointment produces one actual Schedule', async () => {
  const first = loadSchedule({ response: { ok: true, status: 'pending_approval', appointment_id: '00000000-0000-4000-8000-000000000005' } });
  await submitBooking(first);
  const confirmed = loadSchedule({ storage: first.storage.snapshot(), response: { ok: true, status: 'confirmed', appointment_id: '00000000-0000-4000-8000-000000000005' } });
  await submitBooking(confirmed);
  assert.equal(confirmed.fbqCalls.filter(args => args[1] === 'Schedule').length, 1);
});

test('duplicate response on same page stays deduplicated when storage writes are blocked', async () => {
  const env = loadSchedule();
  env.storage.setItem = () => { throw new Error('write blocked'); };
  const button = await submitBooking(env);
  button.click();
  await new Promise(setImmediate);
  assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 1);
});

test('confirmed response with a non-UUID appointment ID cannot emit conversion', async () => {
  for (const appointment_id of ['fixture-appointment', '21988887777', '00000000-0000-0000-0000-00000000000Z']) {
    const env = loadSchedule({ response: { ok: true, status: 'confirmed', appointment_id } });
    await submitBooking(env);
    assert.equal(env.fbqCalls.filter(args => args[1] === 'Schedule').length, 0, appointment_id);
    assert.equal(env.gtagCalls.filter(args => args[1] === 'agendamento_site').length, 0, appointment_id);
  }
});

test('booking lead retains paid content after the real legacy noivas hero CTA', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../noivas.html'), 'utf8');
  const href = html.match(/href="([^"]*agendar\.html[^\"]*noivas_hero_schedule[^\"]*)"/)[1];
  const entry = loadTracking({ url: 'https://koisalinda.com.br/noivas/', search: '?utm_source=google&utm_campaign=campaign_12345678901234&utm_content=creative_12345678901234&gclid=opaque0123456789012345' });
  const clicked = new URL(href.replace('ui_source=', 'utm_content=').replace('agendar.html', '/agendar/'), 'https://koisalinda.com.br/');
  clicked.searchParams.set('un', 'barra');
  const env = loadSchedule({ url: clicked.href, referrer: entry.window.location.href, storage: entry.storage.snapshot() });
  await submitBooking(env);
  const payload = env.calls.find(call => call.url.endsWith('/lead')).payload;
  assert.equal(payload.utm_source, 'google');
  assert.equal(payload.utm_campaign, 'campaign_12345678901234');
  assert.equal(payload.utm_content, 'creative_12345678901234');
  assert.equal(payload.gclid, 'opaque0123456789012345');
  assert.equal(payload.landing_page, 'https://koisalinda.com.br/noivas/');
});

test('form fallback retains anonymous session on retries with unavailable browser storage', async () => {
  const env = loadSchedule({ tracking: false, blockedStorage: true });
  await submitBooking(env);
  env.run('kl-agendar.js');
  await submitBooking(env);
  const payloads = env.calls.filter(call => call.url.endsWith('/lead')).map(call => call.payload);
  assert.equal(payloads.length, 2);
  assert.match(payloads[0].session_id, /^kl_[A-Za-z0-9_-]{6,80}$/);
  assert.equal(payloads[0].session_id, payloads[1].session_id);
});

test('tracker loading after a form fallback keeps its in-memory anonymous session', async () => {
  const env = loadSchedule({ tracking: false, blockedStorage: true });
  await submitBooking(env);
  const first = env.calls.find(call => call.url.endsWith('/lead')).payload.session_id;
  env.run('kl-tracking.js');
  env.run('kl-agendar.js');
  await submitBooking(env);
  const payloads = env.calls.filter(call => call.url.endsWith('/lead')).map(call => call.payload);
  assert.equal(payloads[1].session_id, first);
});
