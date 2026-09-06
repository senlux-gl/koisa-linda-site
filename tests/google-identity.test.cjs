'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadTracking}=require('./helpers/fake-tracking-browser.cjs');
function setup(handler){
  const e=loadTracking(); e.window.gtag=handler;
  e.window.setTimeout=setTimeout;e.window.clearTimeout=clearTimeout;
  return e.window.KLTracking;
}
test('optional measurement refusal never reads Google identifiers',async()=>{
  let calls=0;const t=setup(()=>calls++);
  for(const value of [false,undefined,'true',1]){
    const r=await t.getGoogleIdentity(value);assert.equal(r.consent,false);assert.equal(r.client_id,undefined);
  }
  assert.equal(calls,0);
});
test('reads Google IDs without sending an event or deriving from KL identity',async()=>{
  const t=setup((cmd,id,field,cb)=>{assert.equal(cmd,'get');assert.equal(id,'G-D6HYW29TS4');cb(field==='client_id'?'12345.1788723000':'1788723000');});
  const r=await t.getGoogleIdentity(true);
  assert.equal(r.client_id,'12345.1788723000');assert.equal(r.session_id,'1788723000');assert.equal(r.consent,true);
});
test('malformed or missing Google response cannot leak personal strings',async()=>{
  for(const bad of [undefined,'person@example.invalid','+55 21 99999-9999','kl_abc123',{},'1.'.repeat(200)]){
    const t=setup((cmd,id,field,cb)=>cb(bad));const r=await t.getGoogleIdentity(true);
    assert.equal(r.client_id,undefined);assert.equal(r.session_id,undefined);
  }
});
test('blocked tag times out; late callback cannot mutate the saved result',async()=>{
  const callbacks=[];const t=setup((cmd,id,field,cb)=>callbacks.push(cb));const start=Date.now();
  const r=await t.getGoogleIdentity(true);assert.ok(Date.now()-start<1500);assert.equal(r.client_id,undefined);
  callbacks[0]('12345.1788723000');assert.equal(r.client_id,undefined);
});
test('throwing tag still resolves and permits a valid response from the other field',async()=>{
  const t=setup((cmd,id,field,cb)=>{if(field==='client_id')throw Error('blocked');cb('1788723000');});
  const r=await t.getGoogleIdentity(true);assert.equal(r.client_id,undefined);assert.equal(r.session_id,'1788723000');
});
