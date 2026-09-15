const test=require('node:test');const assert=require('node:assert/strict');
const A=require('../kl-catalog-actions.js');const T=require('../kl-catalog-tryon.js');
for(const c of ['vestidos-noiva','vestidos-debutante']) for(const un of ['sf','barra']) {
 const p={k:'TEST-01',c,un};
 test(`conversion ${c} ${un}`,()=>{const href=A.productConversionHref(p);const u=new URL(href,'https://koisalinda.com.br');assert.equal(u.pathname,'/agendar/');assert.equal(u.searchParams.get('un'),un);assert.equal(u.searchParams.get('modelo'),p.k);assert.equal(T.resultWhatsAppHref(p,A),href);});
}
test('visita livre remains WhatsApp',()=>assert.match(A.productConversionHref({k:'F-1',c:'vestidos-madrinha',un:'sf'}),/^https:\/\/wa.me\//));
test('missing unit does not misroute bride to WhatsApp',()=>assert.equal(new URL(A.productConversionHref({k:'N-1',c:'vestidos-noiva'}),'https://koisalinda.com.br').pathname,'/agendar/'));
