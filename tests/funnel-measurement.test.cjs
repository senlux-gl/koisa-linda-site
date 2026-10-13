'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');
const { loadSchedule, submitBooking } = require('./helpers/fake-schedule-browser.cjs');
const id = '00000000-0000-4000-8000-000000000010';

test('CRM receipt rejects simulated QA IDs, missing IDs, unknown state and unsuccessful HTTP', () => {
  const t = loadTracking().window.KLTracking;
  assert.equal(t.receiptId('lead', {ok:true,lead_id:'qa-lead-0001'},200),'');
  assert.equal(t.receiptId('lead', {ok:true},200),'');
  assert.equal(t.receiptId('lead', {ok:true,lead_id:id},500),'');
  assert.equal(t.receiptId('lead', {ok:true,lead_id:id},undefined),'');
  assert.equal(t.receiptId('lead', {ok:true,lead_id:id},200),id);
  assert.equal(t.receiptId('appointment', {ok:true,appointment_id:id,status:'unknown'},200),'');
  assert.equal(t.receiptId('appointment', {ok:true,appointment_id:id,status:'confirmed'},200),id);
});
test('same receipt remains deduplicated across page loads; lead and request remain different stages', () => {
  const a=loadTracking();
  assert.equal(a.window.KLTracking.firstReceipt('lead',id),true);
  assert.equal(a.window.KLTracking.firstReceipt('lead',id),false);
  const b=loadTracking({storage:a.storage.snapshot()});
  assert.equal(b.window.KLTracking.firstReceipt('lead',id),false);
  assert.equal(b.window.KLTracking.firstReceipt('request',id),true);
});
test('selected SF store is normalized without changing legacy Meta conversion parameters', () => {
  const t=loadTracking().window.KLTracking;
  for (const store of ['sf','sao_francisco','saofrancisco']) {
    const p=t.measurementParams('KL_Unit_Selected',{store,content_category:'vestidos-madrinha',ui_source:'gallery'});
    assert.equal(p.store,store); assert.equal(p.funnel_store,'saofrancisco'); assert.equal(p.funnel_sector,'festa');
    assert.equal(p.ocasiao,'festa');assert.equal(p.ui_source,'gallery');
  }
  assert.equal(t.measurementParams('KL_Flow_Answer',{ocasiao:'debutante',flow_step:'vestidos',flow_choice:'tres'}).funnel_sector,'prova_agendada');
});
test('GA4 keeps registered funnel dimensions within its 25-parameter limit', () => {
  const e=loadTracking(); const extra={};
  for(let i=0;i<35;i++)extra['extra_'+i]='extra';
  Object.assign(extra,{ocasiao:'festa',store:'sao_francisco',content_category:'vestidos-madrinha',product_code:'MD-001',flow_step:'unit_selected',flow_choice:'sf',ui_source:'gallery'});
  e.window.KLTracking.gaEvent('KL_Unit_Selected',extra);
  const p=e.gtagCalls.at(-1)[2];
  assert.ok(Object.keys(p).length<=25);
  assert.equal(p.product_code,'MD-001');assert.equal(p.funnel_store,'saofrancisco');assert.equal(p.measurement_mode,'live');assert.equal(p.flow_step,'unit_selected');
});
test('QA is classified and cannot create the festa custom conversion or Lead in Meta', () => {
  const e=loadTracking({search:'?utm_source=qa',products:[{k:'MD-001',c:'vestidos-madrinha',un:'barra'}]});
  e.window.KLTracking.catalog('KL_Unit_Selected',{productCode:'MD-001',unit:'barra',source:'gallery'});
  const g=e.gtagCalls.find(x=>x[1]==='KL_Unit_Selected');
  assert.equal(g[2].measurement_mode,'qa');
  assert.equal(e.fbqCalls.filter(x=>x[1]==='KL_Unit_Selected'||x[1]==='Lead').length,0);
});
test('invalid lead receipt does not become Lead_Form_Success but the customer can still request a time', async () => {
  const e=loadSchedule({leadResponse:{ok:true,lead_id:'qa-lead-0001'}});
  await submitBooking(e);
  assert.equal(e.gtagCalls.filter(x=>x[1]==='KL_Lead_Form_Success').length,0);
  assert.ok(e.gtagCalls.some(x=>x[1]==='KL_Lead_Form_Error'));
  assert.ok(e.calls.some(x=>x.url.endsWith('/pedido')));
});
test('invalid appointment response never generates a campaign request-success conversion', async () => {
  const e=loadSchedule({response:{ok:true,status:'confirmed',appointment_id:'qa-request'}});
  await submitBooking(e);
  assert.equal(e.fbqCalls.filter(x=>x[1]==='KL_Schedule_Request_Success'||x[1]==='Schedule').length,0);
  assert.ok(e.gtagCalls.some(x=>x[1]==='KL_Schedule_Receipt_Unverified'));
});
test('valid appointment still produces the conversion when the shared tracker is blocked', async () => {
  const e=loadSchedule({tracking:false});
  await submitBooking(e);
  assert.equal(e.fbqCalls.filter(x=>x[1]==='KL_Schedule_Request_Success').length,1);
});
