'use strict';
const root = document.getElementById('app');
const sections = ['Seu casamento', 'Seu vestido', 'Caimento e investimento', 'Sua prova'];
const hints = ['O cenário ajuda a imaginar o vestido que combina com o seu dia.', 'Inspirações são um ponto de partida. Você pode descobrir novos estilos na prova.', 'Algumas referências para preparar um atendimento mais próximo do que você procura.', 'Conte o que tornaria esse encontro ainda mais especial para você.'];
const help = {
 event_date:'Se a data ainda não estiver definida, deixe em branco.', event_time:'Horário aproximado da cerimônia.',
 venue:'Pode contar só a cidade, se o espaço ainda não estiver escolhido.', styles:'Escolha quantos estilos quiser.',
 shapes:'Não precisa conhecer as modelagens para fazer a prova.', references:'Um código do nosso catálogo ou um link de inspiração. Não precisa ter uma referência.',
 dress_size:'É apenas uma referência. O caimento será avaliado na prova.', height_cm:'Sem salto. Exemplo: 1,65 m.',
 budget_brl:'Um valor aproximado para orientar a conversa. Não representa orçamento da loja.',
 companions:'A equipe confirma as orientações de acompanhantes da unidade.', questions:'Vale contar dúvidas e preferências para o atendimento.'
};
let token = '', ctx, step = 0, busy = false, editingSubmitted = false, noticeTimer, pendingRequest, conflicted = false;

const el = (tag, cls, text) => {const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n;};
const button = (text, cls, click) => {const b=el('button',cls,text); b.type='button'; b.addEventListener('click',click); return b;};
function notice(text) {const n=document.getElementById('status');n.textContent=text;n.className='visible';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.className='',4500);}
async function api(data) {
 const payload=data?{...data,token}:{action:'context',token};
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),25000);
 try {
  const response=await fetch('https://n8n.janotattec.com.br/webhook/kl-ficha-noiva',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
  const result=await response.json();
  if(!response.ok&&!result.code)throw new Error('request_failed');
  return result;
 } catch(error) {throw new Error('Não foi possível conectar agora. Suas respostas continuam na tela. Tente novamente.');}
 finally {clearTimeout(timeout);}
}
async function refresh() {const result=await api();if(!result.ok)throw new Error('Esta ficha não está disponível. Fale com a equipe pelo WhatsApp para continuar.');ctx=result;}
function dateLabel() {return new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeZone:'America/Sao_Paulo'}).format(new Date(ctx.appointment.appointment_at))+' · '+new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(ctx.appointment.appointment_at));}
function intro() {
 const n=el('aside','intro');n.append(el('p','eyebrow','A EXPERIÊNCIA KOISA LINDA'));
 const h=el('h1');h.append(document.createTextNode('Sua prova começa '),el('em','', 'com você.'));n.append(h);
 n.append(el('p','','Conte um pouco sobre seu casamento e o vestido que você imagina. Assim, a equipe pode conhecer suas preferências antes do nosso encontro.'));
 const ap=el('div','appointment');ap.append(el('div','tag','✓ PROVA CONFIRMADA'),el('strong','',ctx.stores[ctx.appointment.store_id]),el('p','',dateLabel()));n.append(ap);
 n.append(el('div','privacy','Suas respostas são opcionais e ajudam a equipe da sua unidade a preparar o atendimento. Você pode deixar qualquer pergunta para a prova.'));
 return n;
}
function valueLabel(q,value) {
 if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length))return 'Conversar na prova';
 if(Array.isArray(value))return value.join(', ');
 if(q.type==='date')return String(value).split('-').reverse().join('/');
 if(q.type==='money')return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
 if(q.type==='height')return value+' cm';return String(value);
}
function review() {
 const n=el('div');for(const section of sections){const group=el('section','review-section');group.append(el('h3','',section));const dl=el('dl');for(const q of ctx.questions.filter(q=>q.section===section)){const row=el('div','review-row');row.append(el('dt','',q.label),el('dd','',valueLabel(q,ctx.state.answers[q.key])));dl.append(row);}group.append(dl);n.append(group);}return n;
}
function field(q) {
 const wrap=el(q.type==='multi'?'fieldset':'div','field');wrap.dataset.key=q.key;
 const label=el(q.type==='multi'?'legend':'label','',q.label);if(q.type!=='multi')label.htmlFor=q.key;wrap.append(label);
 const value=ctx.state.answers[q.key];
 if(q.type==='multi'){
   const choices=el('div','choices');for(const option of q.options){const l=el('label','choice'),input=el('input');input.type='checkbox';input.name=q.key;input.value=option;input.checked=Array.isArray(value)&&value.includes(option);l.append(input,el('span','',option));choices.append(l);}wrap.append(choices);
 }else if(q.type==='choice'){
   const select=el('select');select.id=q.key;select.name=q.key;const empty=el('option','','Prefiro conversar na prova');empty.value='';select.append(empty);for(const option of q.options.filter(x=>x!=='Prefiro conversar na prova')){const o=el('option','',option);o.value=option;select.append(o);}select.value=value==='Prefiro conversar na prova'?'':value||'';wrap.append(select);
 }else{
   const input=el(q.type==='text'&&q.max>200?'textarea':'input');input.id=q.key;input.name=q.key;
   if(input.tagName==='INPUT')input.type=['date','time'].includes(q.type)?q.type:'text';
   if(q.type==='date')input.min=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
   if(q.type==='money'||q.type==='height')input.inputMode='decimal';
   if(q.max)input.maxLength=q.max;
   input.value=value??'';input.autocomplete='off';
   input.placeholder={venue:'Cidade e local da celebração',details:'Mangas, renda, brilho, decote…',avoid:'O que não combina com você?',references:'Código do modelo ou link de inspiração',dress_size:'Ex.: 40 ou 42',height_cm:'Ex.: 1,65',budget_brl:'Ex.: 5.000',companions:'Ex.: minha mãe e minha irmã',questions:'O que gostaria que soubéssemos?'}[q.key]||'';
   wrap.append(input);
 }
 if(help[q.key]){const desc=el('small','',help[q.key]);desc.id=q.key+'-hint';wrap.append(desc);wrap.querySelectorAll('input,textarea,select').forEach(i=>i.setAttribute('aria-describedby',desc.id));}
 if((ctx.state.provenance||{})[q.key]==='agendamento')wrap.append(el('small','','Já informado no agendamento. Você pode ajustar aqui.'));
 return wrap;
}
function collect() {
 const values={};root.querySelectorAll('.field').forEach(f=>{const q=ctx.questions.find(q=>q.key===f.dataset.key);values[q.key]=q.type==='multi'?[...f.querySelectorAll('input:checked')].map(x=>x.value):f.querySelector('input,select,textarea').value;});return values;
}
function disable(value) {busy=value;root.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=value);}
function showConflict() {
 if(root.querySelector('.conflict'))return;
 const box=el('div','conflict');box.setAttribute('role','alert');
 box.append(el('p','','A ficha foi atualizada no WhatsApp ou em outra aba. Suas alterações continuam na tela; copie o que quiser manter antes de carregar as respostas mais recentes.'));
 box.append(button('Carregar ficha atualizada','secondary',async()=>{if(busy)return;disable(true);try{await refresh();conflicted=false;pendingRequest=null;render();}catch(error){notice(error.message);}finally{disable(false);}}));
 root.querySelector('.sheet').append(box);
}
async function save(action='save', values=collect()) {
 if(busy)return false;if(conflicted){showConflict();notice('Carregue a ficha atualizada para continuar.');return false;}disable(true);
 try{
   const signature=JSON.stringify({revision:ctx.revision,values,action});
   if(!pendingRequest||pendingRequest.signature!==signature)pendingRequest={signature,payload:{revision:ctx.revision,values,action,requestId:crypto.randomUUID()}};
   const result=await api(pendingRequest.payload);
   pendingRequest=null;
   root.querySelectorAll('.error').forEach(e=>e.remove());root.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));
   if(!result.ok){
     if(result.code==='revision_conflict'){conflicted=true;showConflict();return false;}
     if(result.errors){for(const [key,msg] of Object.entries(result.errors)){const f=root.querySelector(`[data-key="${key}"]`);if(f){f.append(el('span','error',msg));f.querySelector('input,textarea,select')?.setAttribute('aria-invalid','true');}}root.querySelector('[aria-invalid]')?.focus();return false;}
     throw new Error('Não foi possível salvar. Tente novamente ou fale com a equipe.');
   }
   if(!result.state||!Number.isInteger(result.revision))throw new Error('Não conseguimos conferir o salvamento. Reabra sua ficha para verificar as respostas.');
   ctx={...ctx,...result};if(action==='submit')editingSubmitted=false;return true;
 }catch(error){notice(error.message);return false;}finally{disable(false);}
}
function formView() {
 const layout=el('div','layout');layout.append(intro());const sheet=el('section','sheet');layout.append(sheet);
 if(ctx.state.stage==='submitted'&&!editingSubmitted){
   sheet.classList.add('success');sheet.append(el('div','success-icon','✓'),el('p','eyebrow','FICHA CONCLUÍDA'),el('h2','','Obrigada por compartilhar seus sonhos.'),el('p','hint','Suas preferências foram registradas para a equipe da sua unidade, junto à sua prova marcada. Você pode conferir ou ajustar as respostas antes do nosso encontro.'),el('p','hint','Peças, caimento, ajustes e valores serão conferidos com a consultora.'));
   sheet.append(button('Conferir ou ajustar respostas','primary',()=>{editingSubmitted=true;step=4;render();}));return layout;
 }
 const progress=el('div','steps');progress.setAttribute('aria-label',`Etapa ${step+1} de 5`);for(let i=0;i<5;i++)progress.append(el('div','step'+(i<=step?' done':'')));sheet.append(progress);
 sheet.append(el('p','step-count',step===4?'05 / 05 · ÚLTIMO CUIDADO':`0${step+1} / 05 · TUDO OPCIONAL`),el('h2','',step===4?'Vamos conferir?':sections[step]),el('p','hint',step===4?'Confira suas respostas antes de concluir. Tudo o que ficou em branco pode ser conversado na prova.':hints[step]));
 const form=el('form');form.noValidate=true;form.addEventListener('submit',e=>e.preventDefault());
 if(step===4)form.append(review());else ctx.questions.filter(q=>q.section===sections[step]).forEach(q=>form.append(field(q)));
 const controls=el('div','buttons');controls.append(button(step===0?'Salvar e continuar depois':step===4?'Ajustar respostas':'Voltar','secondary',async()=>{
   if(step===4){step=0;render();return;}
   if(await save()){if(step>0){step--;render();}else notice('Respostas salvas. Você pode voltar a esta ficha quando quiser.');}
 }));
 controls.append(button(step===4?'Concluir minha ficha':'Continuar →','primary',async()=>{if(await save(step===4?'submit':'save')){if(step<4)step++;render();const heading=root.querySelector('.sheet h2');heading.tabIndex=-1;heading.focus();heading.scrollIntoView({behavior:'auto',block:'start'});}}));form.append(controls);sheet.append(form);
 sheet.append(el('p','tiny','Preencher esta ficha é opcional e não altera sua prova marcada.'));
 return layout;
}
function render(){root.replaceChildren(formView());}
(async()=>{
 try{
  token=location.hash.slice(1);
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Esta ficha é acessada pelo link enviado após a confirmação da sua prova. Se precisar, fale com a Lara pelo WhatsApp da sua unidade.');
  await refresh();render();
 }catch(e){
  const box=el('section','sheet');box.append(el('p','eyebrow','SUA PROVA · KOISA LINDA'),el('h1','','Vamos preparar seu encontro.'),el('p','hint',e.message));
  const link=el('a','primary','Falar com minha unidade');link.href='/unidades/';box.append(link);root.replaceChildren(box);
 }
})();
