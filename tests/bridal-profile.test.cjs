'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadSchedule,submitBooking}=require('./helpers/fake-schedule-browser.cjs');
const origin='https://koisalinda.com.br/noivas/sua-prova/';
const valid=origin+'#'+'0'.repeat(64);

test('ficha is offered only with a confirmed bridal booking and a scoped private URL',async()=>{
 for(const [occasion,status,url,expected] of [
  ['noiva','confirmed',valid,true],['noiva','pending',valid,false],
  ['debutante','confirmed',valid,false],['noiva','confirmed','https://example.invalid/#'+ '0'.repeat(64),false],
  ['noiva','confirmed',origin+'?token='+ '0'.repeat(64),false],['noiva','confirmed',origin+'#short',false],
 ]){
  const env=loadSchedule({url:'https://koisalinda.com.br/agendar/?variant=d&un=barra&ocasiao='+occasion,response:{ok:true,status,appointment_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',ficha_url:url}});
  await submitBooking(env);
  const link=env.document.getElementById('kl-bridal-profile');
  assert.equal(Boolean(link),expected,`${occasion}/${status}/${url}`);
  if(expected){assert.equal(link.href,valid);assert.equal(link.getAttribute('referrerpolicy'),'no-referrer');}
  assert.doesNotMatch(JSON.stringify([env.fbqCalls,env.gtagCalls]),/sua-prova|00000000000000000000000000000000/);
 }
});

test('private built page excludes analytics, capture, demo routes and search indexing',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'_site/noivas/sua-prova/index.html'),'utf8');
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/name="referrer" content="no-referrer"/);
 assert.doesNotMatch(html,/kl-tracking|kl-ga|fbq|gtag|capture-popup|api\/demo|fixture|localhost/);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'_site/sitemap.xml'),'utf8'),/sua-prova/);
 const script=fs.readFileSync(path.join(root,'_site/kl-ficha-noiva.js'),'utf8');
 assert.match(script,/https:\/\/n8n\.janotattec\.com\.br\/webhook\/kl-ficha-noiva/);
 assert.doesNotMatch(script,/localStorage|sessionStorage|innerHTML|api\/demo/);
 for(const match of html.matchAll(/(?:src|href)="(\/(?:kl-ficha|fonts)[^"?]*)(?:\?[^\"]*)?"/g))assert.ok(fs.existsSync(path.join(root,'_site',match[1])),match[1]);
});
