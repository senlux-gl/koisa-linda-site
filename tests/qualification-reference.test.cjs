'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../kl-qualification.js');
test('chosen model survives qualification and team booking without losing attribution',()=>{
 const params=new URLSearchParams('modelo=040302&utm_source=instagram&utm_campaign=agenda');
 const url=new URL(api.bookingUrl({ocasiao:'noiva',loja:'saofrancisco'},params),'https://koisalinda.com.br');
 assert.equal(url.pathname,'/agendar/prova/');
 for(const [key,value] of [['modelo','040302'],['utm_source','instagram'],['utm_campaign','agenda'],['un','sf']])assert.equal(url.searchParams.get(key),value);
 const body=api.payload({rota:'equipe',modalidade:'acervo',investimento:'a_definir',data_indefinida:true,nome:'TESTE LOCAL',telefone:'21987654321',estilo:'',expectativa:'',consentimento:true},{model:api.modelReference(params),session:'local',path:'/agendar/'});
 assert.match(body.notas,/Modelo de referência: 040302/);assert.ok(body.notas.length<=600);
 assert.equal(body.schema_version,'2026-08-27.site_lead.v1');
});
test('model query accepts known code shapes and rejects markup and oversized values',()=>{
 for(const code of ['040302','BL-001','CF-35-001'])assert.equal(api.modelReference(new URLSearchParams({modelo:code})),code);
 for(const code of ['<script>','a b','https://example.com','A'.repeat(33)])assert.equal(api.modelReference(new URLSearchParams({modelo:code})), '');
 assert.equal(api.modelReference(new URLSearchParams({codigo:'040302'})),'040302');
 assert.equal(api.modelReference(new URLSearchParams()),'');
});
