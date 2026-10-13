'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createFakeCatalogBrowser,createStorage}=require('./helpers/fake-browser.cjs');
const {addHTMLParser}=require('./helpers/fake-schedule-browser.cjs');
const fixtureContact = '21' + '9'.repeat(5) + '0'.repeat(4);
function landing(occasion) {
  const e=createFakeCatalogBrowser(),{window,document}=e;
  const createElement=document.createElement.bind(document);
  document.createElement=tag=>{const el=createElement(tag);el.classList.toggle=(token,force)=>{const add=force===undefined?!el.classList.contains(token):force;if(add)el.classList.add(token);else el.classList.remove(token);return add;};return el;};
  addHTMLParser(document);
  document.querySelector=sel=>document.querySelectorAll(sel)[0]||null;
  document.head=document.createElement('head'); document.title='Koisa Linda'; document.referrer=''; document.readyState='loading';
  const root=document.createElement('div'); root.setAttribute('id','nf-fluxo'); root.setAttribute('data-ocasiao',occasion);
  const body=document.createElement('div');body.setAttribute('data-nf-corpo','');root.appendChild(body);document.body.appendChild(root);
  const calls=[],events=[],meta=[];
  const location=new URL('https://koisalinda.com.br/'+(occasion==='debutante'?'debutantes':'noivas')+'/?utm_source=meta&utm_campaign=teste_contrato&utm_content=anuncio_teste');
  const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
  Object.assign(window,{location,sessionStorage:createStorage(),navigator:{userAgent:'Fixture'},gtag:(...x)=>events.push(x),fbq:(...x)=>meta.push(x),__klGA4Ready:true,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},addEventListener(){},scrollTo(){}});
  const fetch=async(url,request={})=>{calls.push({url,payload:request.body?JSON.parse(request.body):null});return {ok:true,status:200,json:async()=>url.includes('/horarios')?{ok:true,dias:[{data:day,rotulo:'Amanhã',horarios:['10:00','14:00']}]}:url.endsWith('/lead')?{ok:true,lead_id:'00000000-0000-4000-8000-000000000020'}:{ok:true,status:'confirmed',appointment_id:'00000000-0000-4000-8000-000000000021'}}};
  const ctx=vm.createContext({window,document,location,sessionStorage:window.sessionStorage,navigator:window.navigator,URL,URLSearchParams,Intl,Date,fetch,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,setInterval:window.setInterval,clearInterval:window.clearInterval,requestAnimationFrame:()=>1});
  for(const file of ['kl-tracking.js','kl-noivas-fluxo-20261012.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const click=sel=>{const el=body.querySelector(sel);assert.ok(el,sel);el.dispatchEvent({type:'click',target:el});};
  return {body,calls,events,meta,click};
}
for(const occasion of ['noiva','debutante']) test(occasion+': each displayed/answered question, real receipt and selected store have separate events',async()=>{
  const e=landing(occasion);
  for(const choice of ['6m',occasion==='debutante'?'tres':'acervo','barra',occasion==='debutante'?'brilho':'princesa']) {
    e.click('[data-nf-op="'+choice+'"]');
    e.click('[data-nf-seguir]');
    await new Promise(resolve=>setImmediate(resolve));
  }
  e.click('[data-nf-data]');
  e.body.querySelector('#nf-nome').value='Pessoa Teste';e.body.querySelector('#nf-tel').value=fixtureContact;e.body.querySelector('#nf-aceite').checked=true;
  e.body.querySelector('form').dispatchEvent({type:'submit',preventDefault(){}});
  for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
  const answers=e.events.filter(x=>x[1]==='KL_Flow_Answer');
  assert.equal(answers.length,5);
  assert.equal(answers[2][2].funnel_store,'barra');
  assert.equal(answers[1][2].flow_step,occasion==='debutante'?'vestidos':'caminho');
  assert.equal(e.events.filter(x=>x[1]==='KL_Lead_Form_Success').length,1);
  assert.equal(e.events.filter(x=>x[1]==='KL_Schedule_Request_Success').length,1);
  assert.equal(e.meta.filter(x=>x[1]==='Schedule').length,1);
  assert.equal(e.calls.find(x=>x.url.endsWith('/lead')).payload.ocasiao,occasion);
  assert.ok(e.calls.find(x=>x.url.endsWith('/pedido')).payload.lead_id);
  assert.ok(!JSON.stringify(e.events).includes('Pessoa Teste'));
  assert.ok(!JSON.stringify(e.events).includes(fixtureContact));
});
