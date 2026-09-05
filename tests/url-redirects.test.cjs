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
