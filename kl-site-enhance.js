/* Koisa Linda — sticky CTA + lightweight helpers */
(function(){
  if(window.__KL_SITE_ENHANCE__) return; window.__KL_SITE_ENHANCE__=true;
  function qs(s){return document.querySelector(s)}
  function pageKind(){
    var p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if(p==='catalogo.html') return 'catalogo';
    if(p==='peca.html') return 'peca';
    if(p.indexOf('noiva')>=0) return 'noiva';
    if(p.indexOf('debutante')>=0) return 'debutante';
    if(p.indexOf('madrinha')>=0) return 'madrinha';
    if(p.indexOf('terno')>=0) return 'terno';
    return 'geral';
  }
  function waForKind(k){return k==='noiva'||k==='debutante'||k==='catalogo'||k==='peca'?'5521966475383':'5521970858787'}
  function waText(k){
    var label={noiva:'vestido de noiva',debutante:'vestido de debutante',madrinha:'vestido de madrinha/convidada',terno:'terno',peca:'uma peça do catálogo',catalogo:'peças do catálogo'}[k]||'um atendimento';
    return 'Olá! Vim pelo site da Koisa Linda e quero ajuda com '+label+'.';
  }
  function catLink(k){
    if(k==='noiva') return 'catalogo.html?cat=vestidos-noiva';
    if(k==='debutante') return 'catalogo.html?cat=vestidos-debutante';
    if(k==='madrinha') return 'catalogo.html?cat=vestidos-madrinha';
    if(k==='terno') return 'catalogo.html?cat=ternos';
    return 'catalogo.html';
  }
  function mount(){
    if(sessionStorage.getItem('klStickyClosed')==='1') return;
    var k=pageKind();
    var box=document.createElement('div'); box.className='kl-sticky-cta';
    var wa='https://wa.me/'+waForKind(k)+'?text='+encodeURIComponent(waText(k));
    var label=document.createElement('span'); label.className='kl-sticky-text'; label.textContent='Agende sua prova';
    var cat=document.createElement('a'); cat.className='kl-sticky-cat'; cat.href=catLink(k); cat.textContent='Ver catálogo';
    var w=document.createElement('a'); w.className='kl-sticky-wa'; w.href=wa; w.target='_blank'; w.rel='noopener'; w.textContent='WhatsApp';
    var close=document.createElement('button'); close.className='kl-sticky-x'; close.type='button'; close.setAttribute('aria-label','Fechar'); close.textContent='×';
    box.appendChild(label); box.appendChild(cat); box.appendChild(w); box.appendChild(close);
    document.body.appendChild(box);
    var shown=false;
    function update(){var y=window.scrollY||0; if(!shown && y>420){box.classList.add('is-on'); shown=true;}}
    window.addEventListener('scroll',update,{passive:true}); setTimeout(update,900);
    box.querySelector('.kl-sticky-x').onclick=function(){box.classList.remove('is-on'); sessionStorage.setItem('klStickyClosed','1')};
    box.addEventListener('click',function(e){var a=e.target.closest('a'); if(!a) return; try{ if(typeof fbq==='function') fbq('trackCustom','KL_Sticky_CTA_Click',{cta_label:(a.textContent||'').trim(),page_path:location.pathname}); }catch(_){}});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
