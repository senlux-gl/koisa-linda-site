'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFakeCatalogBrowser,createStorage}=require('./helpers/fake-browser.cjs');
const Popup=require('../kl-capture-popup.js');
function fixture(options={}) {
 const env=createFakeCatalogBrowser(),{window:win,document:doc}=env,frames=[],events=[];
 win.location.pathname=options.path||'/noivas/';
 const section=doc.createElement('section');section.setAttribute('id','kl-capture');doc.body.appendChild(section);
 const phone=doc.createElement('input');phone.setAttribute('id','kl-capture-phone');section.appendChild(phone);
 const after=doc.createElement('footer');doc.body.appendChild(after);
 const proto=Object.getPrototypeOf(section);
 if(!proto.insertBefore)proto.insertBefore=function(child,next){if(!next)return this.appendChild(child);if(child.parentNode)child.parentNode.removeChild(child);const idx=this.childNodes.indexOf(next);assert.ok(idx>=0);this.childNodes.splice(idx,0,child);child.parentNode=this;return child;};
 doc.body.classList.toggle=(name,on)=>doc.body.classList[on?'add':'remove'](name);
 doc.visibilityState='visible';
 win.requestAnimationFrame=fn=>frames.push(fn);win.setTimeout=fn=>frames.push(fn);
 win.sessionStorage=options.sessionStorage||createStorage();
 const other=options.otherDialog?doc.createElement('dialog'):null;if(other){doc.body.appendChild(other);other.showModal();}
 const popup=Popup.mount(win,section,{isSuppressed:()=>Boolean(options.suppressed),onOpen:trigger=>events.push(['open',trigger]),onClose:()=>events.push(['close'])});
 return {win,doc,section,phone,after,popup,events,other,flush(){while(frames.length)frames.shift()();}};
}
test('catalog stays clean automatically but explicit contact still opens',()=>{
 for(const path of ['/catalogo/','/catalogo.html']){const f=fixture({path});f.flush();assert.equal(f.popup.isOpen(),false);assert.equal(f.popup.open(true),true);}
});
test('opens at first render without scroll or thirty-second wait; does not focus the phone keyboard',()=>{
 const f=fixture();f.flush();const dialog=f.doc.getElementById('kl-capture-dialog');assert.ok(dialog.open);assert.equal(f.section.parentNode,dialog);assert.notEqual(f.doc.activeElement,f.phone);assert.deepEqual(f.events,[['open','page_open']]);
});
test('close restores the same form and original position; another page in the session stays closed',()=>{
 const storage=createStorage(),f=fixture({sessionStorage:storage});f.flush();f.phone.value='draft';f.popup.close();assert.equal(f.section.parentNode,f.doc.body);assert.ok(f.doc.body.childNodes.indexOf(f.section)<f.doc.body.childNodes.indexOf(f.after));assert.equal(f.phone.value,'draft');
 const second=fixture({sessionStorage:storage});second.flush();assert.equal(second.doc.getElementById('kl-capture-dialog').open,false);assert.equal(second.popup.open(true),true);assert.deepEqual(second.events,[['open','manual']]);
});
test('manual close restores scroll and recalculates state after the form is back in the document',()=>{
 const f=fixture();f.flush();f.popup.close();const scrolls=[];f.win.scrollY=1200;f.win.scrollTo=position=>scrolls.push(position);f.popup.open(true);f.popup.close();assert.equal(scrolls.at(-1).top,1200);assert.equal(f.section.parentNode,f.doc.body);
});
test('pending or confirmed capture suppresses automatic opening but allows manual intent',()=>{
 const f=fixture({suppressed:true});f.flush();assert.equal(f.popup.isOpen(),false);assert.equal(f.popup.open(true),true);
});
test('does not stack over an existing gallery; opens after its close when eligible',()=>{
 const f=fixture({otherDialog:true});f.flush();assert.equal(f.popup.isOpen(),false);f.other.close();f.doc.dispatchEvent({type:'close',target:f.other});f.flush();assert.equal(f.popup.isOpen(),true);
});
test('escape and backdrop dismiss; clicks inside keep the popup open',()=>{
 const f=fixture();f.flush();const d=f.doc.getElementById('kl-capture-dialog');d.dispatchEvent({type:'click',target:f.phone});assert.equal(d.open,true);d.dispatchEvent({type:'click',target:d});assert.equal(d.open,false);f.popup.open(true);d.dispatchEvent({type:'cancel',preventDefault(){}});assert.equal(d.open,false);
});
test('input in use and hidden page are not interrupted, storage failure does not break manual control',()=>{
 const f=fixture({sessionStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});f.phone.focus();f.flush();assert.equal(f.popup.isOpen(),false);f.doc.activeElement=f.doc.body;f.doc.visibilityState='hidden';f.popup.tryAutomatic();assert.equal(f.popup.isOpen(),false);f.doc.visibilityState='visible';assert.equal(f.popup.open(true),true);f.popup.close();f.popup.tryAutomatic();assert.equal(f.popup.isOpen(),false);
});
