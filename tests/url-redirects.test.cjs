const {test}=require('node:test');
const assert=require('node:assert/strict');
const {destination}=require('../kl-redirect.js');
const origin='https://koisalinda.com.br';
test('old ad URL keeps attribution, store, occasion, experiment, model and fragment',()=>{
 const query='?utm_source=meta&utm_campaign=noivas&fbclid=click&gclid=google&un=sf&ocasiao=noiva&variant=a&modelo=NV-001';
 assert.equal(destination(origin+'/agendar.html'+query+'#horarios','/agendar/'),origin+'/agendar/'+query+'#horarios');
});
test('try-on bridge merges prova flag without dropping product or attribution',()=>{
 const url=new URL(destination(origin+'/provar.html?p=NV-001&utm_source=google#galeria','/catalogo/?prova=1'));
 assert.equal(url.pathname,'/catalogo/');assert.equal(url.searchParams.get('p'),'NV-001');
 assert.equal(url.searchParams.get('utm_source'),'google');assert.equal(url.searchParams.get('prova'),'1');assert.equal(url.hash,'#galeria');
});
test('legacy redirects keep encoded filters, repeated values and destination fragment',()=>{
 const next=destination(origin+'/Festas.htm?q=vestido%20azul&cor=azul&cor=verde','/catalogo/#catalog-grid');
 assert.equal(next,origin+'/catalogo/?q=vestido%20azul&cor=azul&cor=verde#catalog-grid');
});
test('destination defaults win only their own keys',()=>{
 const next=new URL(destination(origin+'/provar.html?prova=0&un=barra','/catalogo/?prova=1'));
 assert.equal(next.searchParams.get('prova'),'1');assert.equal(next.searchParams.get('un'),'barra');
});
test('redirects cannot leave origin, run script, or loop',()=>{
 for(const target of ['https://evil.test/','//evil.test/','javascript:alert(1)','https://koisalinda.com.br.evil.test/','/agendar/']){
  assert.equal(destination(origin+'/agendar/',target),null,target);
 }
});
test('malformed input fails without redirect',()=>assert.equal(destination('not a URL','/catalogo/'),null));
test('built modules recognize clean paths and generate working product and store routes',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../_site/kl-urls.js'),'utf8'),sandbox);
 const urls=sandbox.window.KLUrls;
 assert.equal(urls.pageKind('/'),'index');
 assert.equal(urls.pageKind('/catalogo/'),'catalogo');
 assert.equal(urls.pageKind('/noivas/experiencia/'),'noivas-experiencia');
 const enhance=require('../_site/kl-site-enhance.js');
 const root={KLUrls:urls,URLSearchParams,location:new URL('https://koisalinda.com.br/noivas/?un=sf')};
 assert.equal(enhance.initialContext(root).page,'noivas');
 assert.equal(enhance.initialContext(root).unit,'sf');
 assert.equal(enhance.resolveStickyTargets({page:'noivas',unit:'sf'})[0].href,'/agendar/?ocasiao=noiva&un=sf');
 const actions=require('../_site/kl-catalog-actions.js');
 assert.equal(actions.tryOnHref({k:'NV-001',c:'vestidos-noiva',un:'sf'}),'/catalogo/?prova=1&p=NV-001');
});

test('catalog navigation keeps attribution through filter, gallery and try-on changes',()=>{
 const core=require('../kl-catalog-core.js');
 const state={category:'vestidos-noiva',unit:'sf',colors:[],sizes:[],page:1,query:'',tryOn:true,openProduct:'040301'};
 let query=core.serializeState(state,'?utm_source=meta&utm_campaign=noivas&fbclid=click&gclid=google&variant=a');
 for(const next of [state,{...state,tryOn:false},{...state,tryOn:false,openProduct:null,category:null,unit:null}]){
  query=core.serializeState(next,query);
  const params=new URLSearchParams(query);
  assert.equal(params.get('utm_source'),'meta');assert.equal(params.get('utm_campaign'),'noivas');
  assert.equal(params.get('fbclid'),'click');assert.equal(params.get('gclid'),'google');assert.equal(params.get('variant'),'a');
 }
 const final=new URLSearchParams(query);
 for(const key of ['prova','p','cat','un'])assert.equal(final.has(key),false,key);
});
test('catalog owns its filters while preserving repeated external parameters unchanged',()=>{
 const core=require('../kl-catalog-core.js');
 const previous=new URLSearchParams('cat=old&un=barra&co=azul&co=verde&tam=M&pg=8&q=velho&p=040301&prova=1&utm_content=a&utm_content=b&custom=sim');
 const original=previous.toString();
 const state={category:'vestidos-noiva',unit:'sf',colors:['Branco'],sizes:[],page:1,query:'',tryOn:false,openProduct:null};
 const query=core.serializeState(state,previous);
 const params=new URLSearchParams(query);
 assert.equal(previous.toString(),original);
 assert.equal(params.get('cat'),'vestidos-noiva');assert.equal(params.get('un'),'sf');
 assert.deepEqual(params.getAll('co'),['Branco']);assert.deepEqual(params.getAll('utm_content'),['a','b']);
 assert.equal(params.get('custom'),'sim');
 for(const key of ['tam','pg','q','p','prova'])assert.equal(params.has(key),false,key);
 assert.equal(core.serializeState(state,query),query);
});
