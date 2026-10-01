(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.KLQualification=api;api.init(root);}})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 var STORES=['barra','saofrancisco'],ROUTES=['equipe','jussara'],OCCASIONS=['noiva','debutante'];
 var MODES=['acervo','primeiro_aluguel','compra','orientacao'];
 var BUDGETS=['ate_5','5_10','10_15','15_25','25_mais','a_definir'];
 var clean=function(v,n){return String(v||'').replace(/\s+/g,' ').trim().slice(0,n);};
 function phone(s){s=String(s||'').replace(/\D/g,'');if(s.length===13&&s.startsWith('55'))s=s.slice(2);return /^[1-9][0-9]9\d{8}$/.test(s)&&!/^([0-9])\1{8}$/.test(s.slice(2))?'+55'+s:null;}
 function validDate(s,today){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;var d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&s>=today;}
 function validate(v,step,today){
  if(!ROUTES.includes(v.rota))return 'Escolha o atendimento com a equipe ou a análise de projeto com Jussara.';
  if(!OCCASIONS.includes(v.ocasiao))return 'Informe se você é noiva ou debutante.';
  if(!STORES.includes(v.loja))return 'Escolha sua unidade de preferência.';
  if(!v.data_indefinida&&!validDate(v.data_evento,today))return 'Informe uma data futura válida ou marque que está definindo a data.';
  if(!MODES.includes(v.modalidade))return 'Escolha a modalidade ou peça orientação.';
  if(!BUDGETS.includes(v.investimento))return 'Escolha uma referência de investimento ou indique que ainda está definindo.';
  if(step===1)return '';
  if(!/[A-Za-zÀ-ÿ]{2}/.test(clean(v.nome,100)))return 'Informe seu nome ou o nome do responsável pelo atendimento.';
  if(!phone(v.telefone))return 'Confira o número de WhatsApp com DDD.';
  if(!v.consentimento)return 'Autorize o uso dos dados para este atendimento.';
  return '';
 }
 function payload(v,ctx){
  var t=ctx.attribution||{first:{},last:{}},last=t.last||{},date=v.data_indefinida?'':v.data_evento;
  var details=['Atendimento: '+v.rota,'Modalidade: '+v.modalidade,'Investimento informado: '+v.investimento,'Data: '+(date||'a definir'),'Estilo: '+clean(v.estilo,70),'Expectativa: '+clean(v.expectativa,250)].join('\n').slice(0,600);
  var p={schema_version:'2026-08-27.site_lead.v1',source:'site',source_detail:'qualificacao_'+v.rota+'_20261001',variant:'perfil-'+v.rota,stage:'lead_form_completed',nome:clean(v.nome,100),telefone:phone(v.telefone),ocasiao:v.ocasiao,loja:v.loja,data_evento:date,preferencia:'sem_preferencia',notas:details,consentimento:v.consentimento===true,sobrenome_confirmacao:clean(v.sobrenome_confirmacao,100),session_id:ctx.session,attribution:t,analytics:ctx.analytics||{consent:false,version:'2026-09-06.measurement.v1'},landing_page:ctx.path,page_path:ctx.path,referrer:ctx.referrer||'',created_at_client:new Date().toISOString()};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','gclid','fbclid','gbraid','wbraid'].forEach(function(k){p[k]=last[k]||'';});return p;
 }
 function accepted(d){return !!d&&d.ok===true&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(d.lead_id||'');}
 function bookingUrl(v,params){var p=new URLSearchParams();['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','gclid','fbclid','gbraid','wbraid'].forEach(function(k){if(params.get(k))p.set(k,params.get(k));});p.set('ocasiao',v.ocasiao);p.set('un',v.loja==='saofrancisco'?'sf':'barra');return '/agendar/prova/?'+p.toString();}
 function init(win){
  var doc=win.document,form=doc.getElementById('perfil');if(!form)return;
  var preview=!/^(www\.)?koisalinda\.com\.br$/.test(win.location.hostname),params=new URLSearchParams(win.location.search),busy=false,session=win.crypto.randomUUID();
  var today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  doc.getElementById('preview').hidden=!preview;doc.getElementById('data-evento').min=today;
  ['rota','ocasiao','loja'].forEach(function(k){var value=params.get(k);if(k==='loja')value=params.get('un')==='sf'?'saofrancisco':params.get('un')||value;if(value){var input=form.querySelector('[name="'+k+'"][value="'+value+'"]');if(input)input.checked=true;}});
  function read(){var v=Object.fromEntries(new FormData(form));['consentimento','measurement','data_indefinida'].forEach(function(k){v[k]=!!form.elements[k].checked;});return v;}
  function error(id,msg){var e=doc.getElementById(id);e.textContent=msg;e.hidden=!msg;}
  function step(n){doc.getElementById('step1').hidden=n!==1;doc.getElementById('step2').hidden=n!==2;doc.getElementById('p1').removeAttribute('aria-current');doc.getElementById('p2').removeAttribute('aria-current');doc.getElementById('p'+n).setAttribute('aria-current','step');doc.getElementById('title'+n).focus();}
  function route(){var v=read();doc.getElementById('jussara-note').hidden=v.rota!=='jussara';doc.getElementById('send').textContent=v.rota==='jussara'?'Enviar perfil para análise':'Enviar perfil e consultar horários';}
  form.addEventListener('change',route);route();
  doc.getElementById('next').onclick=function(){var m=validate(read(),1,today);error('error1',m);if(!m)step(2);};doc.getElementById('back').onclick=function(){step(1);};
  form.onsubmit=async function(ev){
   ev.preventDefault();if(busy)return;var v=read(),m=validate(v,2,today);error('error2',m);if(m)return;if(v.sobrenome_confirmacao)return;
   busy=true;var button=doc.getElementById('send');button.disabled=true;
   try{
    if(preview){doc.getElementById('success-title').textContent='Seu perfil está pronto para enviar.';doc.getElementById('success-copy').textContent='Esta é uma prévia. Nenhum dado foi enviado. '+(v.rota==='jussara'?'Na versão publicada, a equipe analisará o projeto antes de oferecer um horário com Jussara.':'Na versão publicada, você poderá consultar os horários após o registro do perfil.');}
    else{
     var track=win.KLTracking,identity=track&&track.getGoogleIdentity?await track.getGoogleIdentity(v.measurement):{consent:false,version:'2026-09-06.measurement.v1'};
     var attribution=track&&track.getAttribution?track.getAttribution():{first:{},last:{}};
     var controller=new AbortController(),timer=win.setTimeout(function(){controller.abort();},15000),response,data;
     try{response=await win.fetch('https://n8n.janotattec.com.br/webhook/kl-agenda/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(v,{session:session,attribution:attribution,analytics:identity,path:win.location.pathname,referrer:doc.referrer?new URL(doc.referrer).origin:''})),credentials:'omit',signal:controller.signal});data=await response.json();}finally{win.clearTimeout(timer);}
     if(!response.ok||!accepted(data))throw Error('unconfirmed');
     doc.getElementById('success-title').textContent=v.rota==='jussara'?'Seu perfil foi enviado para análise.':'Seu perfil ficou registrado.';
     doc.getElementById('success-copy').textContent=v.rota==='jussara'?'A equipe avaliará data, referências, modalidade e investimento. Se houver encaixe no projeto e na agenda, entrará em contato pelo WhatsApp. Isso ainda não confirma um atendimento com Jussara nem reserva um projeto.':'Agora você pode escolher um horário para provar com a equipe. A página de agenda informará se a prova está confirmada ou se o pedido aguarda confirmação.';
     if(v.rota==='equipe'){var link=doc.getElementById('booking');link.href=bookingUrl(v,params);link.hidden=false;}
     if(track&&track.gaEvent)track.gaEvent('KL_Qualification_Saved',{route:v.rota,occasion:v.ocasiao,store_id:v.loja,duplicate:data.duplicate===true?'yes':'no'});
    }
    form.hidden=true;doc.getElementById('success').hidden=false;doc.getElementById('success-title').focus();
   }catch(e){error('error2','Ainda não conseguimos confirmar o registro. Suas respostas continuam aqui. Tente novamente ou fale com sua unidade.');}
   finally{busy=false;button.disabled=false;}
  };
 }
 return {phone:phone,validDate:validDate,validate:validate,payload:payload,accepted:accepted,bookingUrl:bookingUrl,init:init};
});
