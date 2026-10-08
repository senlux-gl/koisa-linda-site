'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadTracking}=require('./helpers/fake-tracking-browser.cjs');
for(const existing of [true,false])test('GA4 config and queued events survive '+(existing?'shared Ads loader':'standalone loader'),()=>{
 const env=loadTracking({gaReady:false});let inserted=[];
 const selector='script[src^="https://www.googletagmanager.com/gtag/js"]';
 env.document.querySelector=s=>s===selector&&existing?{src:'https://www.googletagmanager.com/gtag/js?id=AW-test'}:null;
 env.document.head.appendChild=x=>inserted.push(x);
 env.window.__klGA4EventQueue=[{name:'KL_Schedule_Experiment_View',params:{}}];
 env.dispatch('DOMContentLoaded');env.dispatch('DOMContentLoaded');
 assert.equal(inserted.filter(x=>String(x.src).includes('/gtag/js')).length,existing?0:1);
 assert.equal(env.gtagCalls.filter(x=>x[0]==='config'&&x[1]==='G-D6HYW29TS4').length,1);
 assert.equal(env.gtagCalls.filter(x=>x[0]==='event'&&x[1]==='KL_Schedule_Experiment_View').length,1);
});
