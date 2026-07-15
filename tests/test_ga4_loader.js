const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('kl-ga4.js', 'utf8');

function run(measurementId) {
  const appended = [];
  const context = {
    window: { KL_GA4_MEASUREMENT_ID: measurementId },
    document: {
      createElement: () => ({ setAttribute(k, v) { this[k] = v; } }),
      head: { appendChild(node) { appended.push(node); } },
      documentElement: { appendChild(node) { appended.push(node); } }
    },
    Date,
    encodeURIComponent,
    String,
    Object,
    RegExp,
    isFinite
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { window: context.window, appended };
}

{
  const { window, appended } = run('');
  assert.equal(window.__KL_GA4_STATUS__, 'disabled_missing_id');
  assert.equal(appended.length, 0);
  assert.equal(window.klAnalyticsTrack('KL_WhatsApp_Click', {}), false);
}

{
  const { window, appended } = run('G-ABC12345XY');
  assert.equal(window.__KL_GA4_STATUS__, 'configured');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].async, true);
  assert.equal(appended[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-ABC12345XY');
  assert.ok(window.dataLayer.length >= 2, 'js/config commands must be queued');

  window.klAnalyticsTrack('KL_WhatsApp_Click', {
    store: 'barra', product_code: 'NV-001', phone: 'do-not-send', raw_query: 'private'
  });
  const lead = Array.from(window.dataLayer.at(-1));
  assert.equal(lead[0], 'event');
  assert.equal(lead[1], 'generate_lead');
  assert.equal(lead[2].method, 'whatsapp');
  assert.equal(lead[2].store, 'barra');
  assert.equal(lead[2].product_code, 'NV-001');
  assert.equal(lead[2].phone, undefined);
  assert.equal(lead[2].raw_query, undefined);

  window.klAnalyticsTrack('KL_Product_View', {
    product_code: 'NV-001', content_category: 'vestidos-noiva'
  });
  const item = Array.from(window.dataLayer.at(-1));
  assert.equal(item[1], 'view_item');
  assert.equal(item[2].items[0].item_id, 'NV-001');
  assert.equal(item[2].items[0].item_category, 'vestidos-noiva');
}

console.log('GA4 loader tests: PASS');
