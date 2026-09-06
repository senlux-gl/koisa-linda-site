'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');
const raw = value => JSON.parse(JSON.stringify(value));
const META_ID = '120212345678901234';
const CLICK_ID = 'IwZXh0bgNhZW0CMTEAAR0123456789012345_ab-XY.z';

test('opaque attribution IDs survive landing and internal navigation byte for byte', () => {
  const entry = loadTracking({ url: 'https://koisalinda.com.br/noivas/', search: '?utm_source=meta&utm_campaign=' + META_ID + '&utm_content=001234567890123456&fbclid=' + CLICK_ID });
  entry.window.KLTracking.catalog('KL_Catalog_Loaded', { source: 'bootstrap' });
  assert.equal(entry.storage.getItem('kl_utm_campaign'), META_ID);
  const next = loadTracking({ url: 'https://koisalinda.com.br/agendar/', storage: entry.storage.snapshot() });
  const attribution = next.window.KLTracking.getAttribution();
  assert.equal(attribution.first.utm_campaign, META_ID);
  assert.equal(attribution.last.utm_content, '001234567890123456');
  assert.equal(attribution.last.fbclid, CLICK_ID);
  assert.equal(attribution.last.landing_path, '/noivas/');
  assert.equal(next.window.KLTracking.getPersistedAttribution().fbclid, 'present');
  next.window.KLTracking.catalog('KL_Catalog_Loaded', { source: 'bootstrap' });
  assert.doesNotMatch(JSON.stringify(next.gtagCalls), new RegExp(CLICK_ID.replace('.', '\\.')));
});

test('last entry replaces the complete attribution without mixing paid sources and first entry is retained', () => {
  const first = loadTracking({ search: '?utm_source=meta&fbclid=' + CLICK_ID });
  first.window.KLTracking.catalog('KL_Catalog_Loaded');
  const second = loadTracking({ url: 'https://koisalinda.com.br/noivas/', search: '?utm_source=google&gclid=opaque01234567890123', storage: first.storage.snapshot() });
  const { first: a, last: b } = second.window.KLTracking.getAttribution();
  assert.equal(a.utm_source, 'meta');
  assert.equal(b.utm_source, 'google');
  assert.equal(b.fbclid, undefined);
  assert.equal(b.gclid, 'opaque01234567890123');
  assert.equal(second.storage.getItem('kl_fbclid'), null);
});

test('attribution is allowlisted and bounded, filters personal UTM text and strips landing query', () => {
  const email = 'fixture' + '@example.invalid';
  const env = loadTracking({ search: '?utm_source=instagram&utm_campaign=' + encodeURIComponent('noiva ' + email) + '&utm_term=' + encodeURIComponent('ligar +55 (21) 98888-7777') + '&utm_medium=' + 'a'.repeat(121) + '&gclid=' + 'x'.repeat(513) + '&email=' + email });
  const result = env.window.KLTracking.getAttribution();
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /fixture|98888|email|[?]/);
  assert.equal(result.last.utm_source, 'instagram');
  assert.equal(result.last.utm_medium, undefined);
  assert.equal(result.last.gclid, undefined);
});

test('UI source is emitted as ui_source, leaving GA acquisition source untouched', () => {
  const env = loadTracking({ search: '?utm_source=google' });
  ['bootstrap', 'gallery', 'next'].forEach(source => env.window.KLTracking.catalog('KL_Product_Navigate', { source }));
  env.gtagCalls.forEach(([, , params], i) => {
    assert.equal(params.source, undefined);
    assert.equal(params.ui_source, ['bootstrap', 'gallery', 'next'][i]);
    assert.equal(params.utm_source, 'google');
  });
});

test('existing anonymous session ID is reused across page navigation', () => {
  const env = loadTracking({ storage: { kl_schedule_session_id: 'kl_fixture_session' } });
  assert.equal(env.window.KLTracking.getSessionId(), 'kl_fixture_session');
});

test('storage failure still keeps current attribution in memory', () => {
  const env = loadTracking({ search: '?utm_source=google&gclid=opaque01234567890123' });
  env.sandbox.sessionStorage.getItem = () => { throw new Error('blocked'); };
  env.sandbox.sessionStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(env.window.KLTracking.getAttribution().last.gclid, 'opaque01234567890123');
});

test('opaque numeric UTM IDs remain in backend attribution but are omitted from custom analytics', () => {
  const env = loadTracking({ search: '?utm_source=meta&utm_campaign=120212345678901234&utm_content=21988887777&utm_id=120298765432109876' });
  env.window.KLTracking.catalog('KL_Catalog_Loaded');
  assert.equal(env.window.KLTracking.getAttribution().last.utm_content, '21988887777');
  const event = env.gtagCalls[0][2];
  assert.equal(event.utm_campaign, undefined);
  assert.equal(event.utm_content, undefined);
  assert.equal(event.utm_id, undefined);
});

test('entry keeps original referrer origin and capture time without query or credentials', () => {
  const env = loadTracking({ search: '?utm_source=google', referrer: 'https://fixture:password@www.google.com/search?q=private' });
  const last = env.window.KLTracking.getAttribution().last;
  assert.equal(last.referrer, 'https://www.google.com');
  assert.match(last.captured_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(env.window.KLTracking.getPersistedAttribution().captured_at, undefined);
});

test('opaque campaign tokens with numeric segments remain exact without reaching custom analytics', () => {
  const id = 'campaign_120212345678901234_variant-A';
  const env = loadTracking({ search: '?utm_campaign=' + id });
  assert.equal(env.window.KLTracking.getAttribution().last.utm_campaign, id);
  env.window.KLTracking.catalog('KL_Catalog_Loaded');
  assert.doesNotMatch(JSON.stringify(env.gtagCalls), /120212345678901234/);
});

test('internal link carrying the same tags retains the actual entry page', () => {
  const search = '?utm_source=meta&utm_campaign=120212345678901234';
  const entry = loadTracking({ url: 'https://koisalinda.com.br/noivas/', search });
  const next = loadTracking({ url: 'https://koisalinda.com.br/catalogo/', search, referrer: 'https://koisalinda.com.br/noivas/', storage: entry.storage.snapshot() });
  assert.equal(next.window.KLTracking.getAttribution().last.landing_path, '/noivas/');
});

test('formatted phone-like campaign fields never reach custom analytics', () => {
  for (const key of ['utm_campaign', 'utm_content', 'utm_id']) {
    for (const value of ['21-98888-7777', '21.98888.7777', '+55 (21) 98888-7777', 'contato_21-98888-7777']) {
      const env = loadTracking({ search: '?' + key + '=' + encodeURIComponent(value) });
      env.window.KLTracking.catalog('KL_Catalog_Loaded');
      assert.equal(env.gtagCalls[0][2][key], undefined, key + '=' + value);
      assert.equal(env.fbqCalls[0][2][key], undefined, key + '=' + value);
    }
  }
});

const fs = require('node:fs');
const path = require('node:path');
const realCtas = [
  ['noivas.html', '/noivas/', 'noivas_hero_schedule'],
  ['index.html', '/', 'home_hero_cta'],
  ['kl-site-enhance.js', '/noivas/', 'lara_web_noiva'],
];
function sourceCta(filename, marker) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const match = source.match(new RegExp('["\x27](agendar\\.html[^"\x27]*' + marker + '[^"\x27]*)["\x27]'));
  assert.ok(match, filename + ': real CTA exists');
  return match[1];
}

test('actual site CTA URLs put UI context outside campaign UTM parameters', () => {
  for (const [file, , marker] of realCtas) {
    const url = new URL(sourceCta(file, marker), 'https://koisalinda.com.br/');
    assert.equal(url.searchParams.get('utm_content'), null, file);
    assert.equal(url.searchParams.get('ui_source'), marker, file);
  }
});

test('legacy real internal CTA markers preserve the complete paid entry and expose UI context separately', () => {
  for (const [file, landing, marker] of realCtas) {
    for (const [source, clickKey] of [['meta', 'fbclid'], ['google', 'gclid']]) {
      const entry = loadTracking({ url: 'https://koisalinda.com.br' + landing, search: '?utm_source=' + source + '&utm_campaign=120212345678901234&utm_content=120298765432109876&' + clickKey + '=opaque0123456789012345' });
      const legacy = new URL(sourceCta(file, marker).replace('ui_source=', 'utm_content=').replace('agendar.html', '/agendar/'), 'https://koisalinda.com.br/');
      const next = loadTracking({ url: legacy.href, referrer: entry.window.location.href, storage: entry.storage.snapshot() });
      const last = next.window.KLTracking.getAttribution().last;
      assert.equal(last.utm_source, source, file);
      assert.equal(last.utm_campaign, '120212345678901234');
      assert.equal(last.utm_content, '120298765432109876');
      assert.equal(last[clickKey], 'opaque0123456789012345');
      assert.equal(last.landing_path, landing);
      next.window.KLTracking.catalog('KL_Catalog_Loaded');
      assert.equal(next.gtagCalls[0][2].entry_ui_source, marker);
    }
  }
});

test('anonymous session stays stable in memory when browser storage is unavailable from startup', () => {
  const env = loadTracking({ blockedStorage: true });
  const first = env.window.KLTracking.getSessionId();
  assert.match(first, /^kl_[A-Za-z0-9_-]{6,80}$/);
  assert.equal(env.window.KLTracking.getSessionId(), first);
});
