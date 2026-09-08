const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const routes = require('../kl-route-normalize.js');
const redirect = require('../kl-redirect.js');
const Actions = require('../kl-catalog-actions.js');
const TryOn = require('../kl-catalog-tryon.js');
const origin = 'https://koisalinda.com.br';

test('all catalog spellings migrate only the explicit simulation state', () => {
  for (const suffix of ['/catalogo/','/catalogo.html','/catalogo','/catalogo/index.html']) {
    const next = new URL(routes.destination(origin + suffix + '?prova=1&p=NV-001&utm_source=meta&gclid=g&co=azul&co=verde#foto'));
    assert.equal(next.pathname, '/prova-virtual/');
    assert.equal(next.searchParams.get('p'), 'NV-001');
    assert.equal(next.searchParams.get('utm_source'), 'meta');
    assert.equal(next.searchParams.get('gclid'), 'g');
    assert.deepEqual(next.searchParams.getAll('co'), ['azul','verde']);
    assert.equal(next.hash, '#foto');
    assert.equal(next.searchParams.has('prova'), false);
  }
  for (const suffix of ['/catalogo/?cat=ternos','/catalogo/?prova=0','/prova-virtual/?p=NV-001','/desconhecido/?prova=1']) {
    assert.equal(routes.destination(origin+suffix), null);
  }
});

test('old simulation bookmarks use the new page and keep campaign data', () => {
  const html = fs.readFileSync(path.join(__dirname, '../_site/provar.html'), 'utf8');
  const target = html.match(/id="kl-redirect" href="([^"]+)"/)[1];
  assert.equal(target, '/prova-virtual/');
  const next = new URL(redirect.destination(origin+'/provar.html?p=NV-001&un=sf&utm_source=google#foto',target));
  assert.equal(next.pathname,'/prova-virtual/');
  assert.equal(next.searchParams.get('un'),'sf');
  assert.equal(next.searchParams.get('utm_source'),'google');
  assert.equal(next.hash,'#foto');
});

test('catalog links navigate to the dedicated page without opening the old layer', () => {
  const href = Actions.tryOnHref({k:'NV-001',c:'vestidos-noiva'});
  assert.equal(href,'/prova-virtual/?p=NV-001');
  assert.equal(TryOn.shouldInterceptLink({button:0},{getAttribute:key=>key==='href'?href:''}),false);
  assert.equal(Actions.tryOnHref({k:'TR-001',c:'ternos'}),null);
});

function boot(search, available=true) {
  let url = new URL(origin+'/prova-virtual/'+search);
  const elements = new Map();
  const calls = [];
  const get = id => {
    if (!elements.has(id)) elements.set(id,{id,addEventListener:(type,fn)=>{ get(id)[type]=fn; },focus:()=>calls.push(['focus',id])});
    return elements.get(id);
  };
  const doc = {getElementById:get,querySelectorAll:()=>[],activeElement:get('virtual-start'),body:{classList:{add(){},remove(){}}}};
  const api = {Core:{},Actions,TryOn:{createWorkerClient:()=>({run(){throw Error('No network in QA');}}),create:opts=>{
    calls.push(['options',opts]);return {open:code=>calls.push(['open',code]),close:()=>calls.push(['close'])};
  }}};
  const root = {KLCatalog:available?api:{},KL_DATA:[{k:'NV-001',c:'vestidos-noiva'}],location:url,
    history:{state:null,replaceState:(_s,_t,target)=>{url=new URL(target,url);root.location=url;}},
    fetch(){throw Error('No network in QA');},setTimeout,clearTimeout,AbortController,
    URL:{createObjectURL(){},revokeObjectURL(){}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../kl-prova-virtual.js'),'utf8'),{window:root,document:doc,URL,FileReader:function(){}});
  return {calls,get,url:()=>url};
}

test('product selection normalizes a known model, preserves attribution and clears on close', () => {
  const page=boot('?p=%20nv-001%20&utm_source=meta&gclid=click#foto');
  assert.equal(page.calls.find(v=>v[0]==='open')[1],'NV-001');
  const opts=page.calls.find(v=>v[0]==='options')[1];
  opts.onSelectionChange('NV-001');
  assert.equal(page.url().searchParams.get('p'),'NV-001');
  opts.onRequestClose();
  assert.equal(page.url().searchParams.has('p'),false);
  assert.equal(page.url().searchParams.get('gclid'),'click');
  assert.equal(page.url().hash,'#foto');
});

test('unknown or hostile model text is not rendered or sent to the simulator', () => {
  for (const code of ['INEXISTENTE','<img src=x onerror=alert(1)>','A'.repeat(200)]) {
    const page=boot('?p='+encodeURIComponent(code));
    assert.equal(page.calls.find(v=>v[0]==='open')[1],null);
    assert.equal(page.url().searchParams.has('p'),false);
    assert.match(page.get('virtual-status').textContent,/não está disponível/);
  }
});

test('plain entry is an accessible landing and unavailable runtime offers a working fallback', () => {
  assert.equal(boot('').calls.some(v=>v[0]==='open'),false);
  const page=boot('',false);
  assert.equal(page.get('virtual-start').href,'/catalogo/');
  assert.match(page.get('virtual-status').textContent,/não carregou/);
});
