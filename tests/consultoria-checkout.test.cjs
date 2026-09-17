const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../kl-consultoria.js'), 'utf8');

async function render(config, fail = false) {
  const attributes = {'aria-disabled': 'true', role: 'link', tabindex: '0'};
  const link = {textContent: 'Inscrições em breve', getAttribute: key => attributes[key],
    removeAttribute: key => delete attributes[key], addEventListener() {}};
  const status = {textContent: 'O pagamento ainda não está disponível.'};
  const terms = {textContent: 'Previsão de parcelamento'};
  vm.runInNewContext(source, {URL, document: {
    getElementById: id => id === 'checkout-status' ? status : link,
    querySelector: () => terms
  }, fetch: () => fail ? Promise.reject(new Error('network')) : Promise.resolve({ok: true, json: () => Promise.resolve(config)})});
  await new Promise(resolve => setImmediate(resolve));
  return {link, status, terms, attributes};
}

test('unconfigured, unverified and wrong-price checkouts remain unavailable', async () => {
  for (const config of [{}, {checkoutUrl: 'https://example.com', checkoutVerified: false, priceBRL: 2997},
    {checkoutUrl: 'https://example.com', checkoutVerified: true, priceBRL: 997}]) {
    const state = await render(config);
    assert.equal(state.link.href, undefined);
    assert.equal(state.attributes['aria-disabled'], 'true');
  }
});
test('network failure and unsafe URLs keep the unavailable state', async () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'invalid']) {
    assert.equal((await render({checkoutUrl: url, checkoutVerified: true, priceBRL: 2997})).link.href, undefined);
  }
  assert.equal((await render({}, true)).link.href, undefined);
});
test('verified checkout offers direct purchase without claiming payment approval', async () => {
  const state = await render({checkoutUrl: 'https://example.com/checkout', checkoutVerified: true, priceBRL: 2997});
  assert.equal(state.link.href, 'https://example.com/checkout');
  assert.equal(state.link.textContent, 'Contratar consultoria');
  assert.equal(state.attributes['aria-disabled'], undefined);
  assert.match(state.status.textContent, /página de pagamento/);
  assert.doesNotMatch(state.terms.textContent, /12x|sem juros/);
});
test('only confirmed installment text is displayed', async () => {
  const state = await render({checkoutUrl: 'https://example.com/checkout', checkoutVerified: true,
    priceBRL: 2997, installmentsConfirmed: true, installmentDisclosure: 'Condições conferidas no provedor.'});
  assert.equal(state.terms.textContent, 'Condições conferidas no provedor.');
});
