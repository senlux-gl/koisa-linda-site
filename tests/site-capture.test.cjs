'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Capture = require('../kl-capture.js');
const store = () => { const map = new Map(); return {getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,v)}; };
test('phone validation accepts supplied mobile and rejects placeholders, fixed lines, invalid DDD', () => {
  const phone = '21' + '9' + '8765' + '4321';
  assert.equal(Capture.normalizePhone(phone), '55' + phone);
  assert.equal(Capture.normalizePhone('+55 (' + phone.slice(0,2) + ') ' + phone.slice(2)), '55' + phone);
  for (const bad of ['', '00' + phone.slice(2), '21' + '3' + '8765432', '21' + '999999999']) assert.equal(Capture.normalizePhone(bad), null);
});
test('request carries explicit optional consent and bounded model codes, no fake identity', () => {
  const p = Capture.makePayload({phone:'21'+'987654321',marketing:false,requestId:'request-id',sessionId:'session-test',context:{product_codes:['NV-A','NV-B'],category:'vestidos-noiva'},attribution:{first:{utm_source:'google'},last:{utm_source:'instagram'}}});
  assert.equal(p.marketing_opt_in, false); assert.equal(p.consent_version,'2026-09-06.capture.v1');
  assert.deepEqual(p.product_codes,['NV-A','NV-B']); assert.ok(!('name' in p)); assert.ok(!('store_id' in p));
  assert.deepEqual(p.attribution.first,{utm_source:'google'});
});
test('WhatsApp request never puts visitor phone into its URL, opt-in only when chosen', () => {
  const token = 'a'.repeat(32), destination='public-store';
  const plain = Capture.whatsappHref(token,false,destination);
  assert.match(decodeURIComponent(plain), /KL-MODELOS a{32}/);
  assert.doesNotMatch(decodeURIComponent(plain), /Também quero/);
  assert.match(decodeURIComponent(Capture.whatsappHref(token,true,destination)), /Também quero receber novidades e dicas\./);
  assert.throws(() => Capture.whatsappHref('invalid',true,destination));
});
test('dismissal lasts seven days, pending does not become confirmed, confirmation suppresses 180 days', () => {
  const s=store(), now=1000;
  Capture.saveState(s,{kind:'dismissed',until:now+7*Capture.DAY});
  assert.equal(Capture.isSuppressed(s,now+6*Capture.DAY),true);
  assert.equal(Capture.isSuppressed(s,now+8*Capture.DAY),false);
  Capture.saveState(s,{kind:'pending',until:now+7*Capture.DAY}); assert.equal(Capture.readState(s).kind,'pending');
  Capture.saveState(s,{kind:'confirmed',until:now+180*Capture.DAY}); assert.equal(Capture.isSuppressed(s,now+179*Capture.DAY),true);
  const broken={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  assert.doesNotThrow(()=>Capture.saveState(broken,{kind:'dismissed'})); assert.equal(Capture.isSuppressed(broken,now),false);
});
