(function(root){
  'use strict';
  function init(){
    var doc=root.document, stores=root.KL_VISIT_STORES||{};
    function product(code){return (root.KL_DATA||[]).find(function(p){return p.k===String(code||'').toUpperCase();});}
    function route(unit){return stores[unit]?'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(stores[unit].map_query):'/unidades/';}
    function inline(host,p){
      if(!host)return;
      var box=host.querySelector('.kl-visit-inline');
      if(!p||p.c!=='vestidos-madrinha'){if(box)box.hidden=true;return;}
      if(!box){box=doc.createElement('aside');box.className='kl-visit-inline';host.appendChild(box);}
      box.hidden=false;box.replaceChildren();
      var title=doc.createElement('strong');title.textContent='Venha provar sem agendar.';box.appendChild(title);
      var offer=doc.createElement('p');offer.className='kl-festa-offer-inline';offer.textContent='No aluguel do vestido de festa, bolsa, brinco e sandália ficam incluídos, sem custo adicional no aluguel.';box.appendChild(offer);
      var terms=doc.createElement('small');terms.textContent='Acessórios com devolução ao final do aluguel. Consulte modelos e tamanhos disponíveis na loja.';box.appendChild(terms);
      var store=stores[p.un];
      var address=doc.createElement('p');address.textContent=store?store.name+' · '+store.address:'Consulte a unidade desta peça antes de visitar.';box.appendChild(address);
      if(store){var hours=doc.createElement('small');hours.textContent=store.hours;box.appendChild(hours);}
      var link=doc.createElement('a');link.className='kl-visit-route';link.href=route(p.un);link.textContent=store?'Abrir rota para esta loja':'Ver as unidades';
      if(store){link.target='_blank';link.rel='noopener';}box.appendChild(link);
    }
    function sync(detail){
      detail=detail||{};
      var notice=doc.getElementById('kl-festa-visita');
      if(notice&&doc.getElementById('catalog-app'))notice.hidden=['vestidos-noiva','vestidos-debutante'].indexOf(detail.category)!==-1;
      var p=product(detail.openProduct), gallery=doc.querySelector('.gallery-panel');
      inline(gallery,p);
      if(p&&p.c==='vestidos-madrinha'){
        var action=doc.getElementById('gallery-schedule');
        if(action){action.href=route(p.un);action.textContent='Como chegar';if(stores[p.un]){action.target='_blank';action.rel='noopener';}}
      }else{
        var old=doc.getElementById('gallery-schedule');if(old){old.removeAttribute('target');old.removeAttribute('rel');}
      }
    }
    root.addEventListener('kl:catalog-state',function(event){sync(event.detail);});
    var q=new URLSearchParams(root.location.search);
    sync({openProduct:q.get('p'),category:q.get('cat')});
    function syncProduct(){inline(doc.querySelector('#app .product > section'),product(q.get('codigo')||q.get('p')));}
    var productApp=doc.getElementById('app');
    if(productApp)new MutationObserver(syncProduct).observe(productApp,{childList:true});
    syncProduct();
    function revealAddress(){
      if(root.location.hash.indexOf('#kl-visit')!==0&&root.location.hash!=='#kl-festa-visita')return;
      var details=doc.querySelector('.kl-visit-details');if(details)details.open=true;
      var target=doc.getElementById(root.location.hash.slice(1));if(target)target.scrollIntoView({block:'start'});
    }
    root.addEventListener('hashchange',revealAddress);revealAddress();
    var dresses=doc.getElementById('tryon-dresses');
    if(dresses){
      function syncTryon(){
        var selected=dresses.querySelector('[data-selected="true"]');
        var p=product(selected&&selected.getAttribute('data-code'));
        ['#tryon-form','#tryon-result .tryon-state-copy','#tryon-error .tryon-state-copy'].forEach(function(selector){inline(doc.querySelector(selector),p);});
      }
      new MutationObserver(syncTryon).observe(dresses,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selected']});syncTryon();
    }
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init);else init();
}(window));
