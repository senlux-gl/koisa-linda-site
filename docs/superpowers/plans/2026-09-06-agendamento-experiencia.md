# Experiência de agendamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** ligar a escolha da peça à prova e tornar o formulário compreensível, preservando o contrato de confirmação.

**Architecture:** HTML/CSS estático e módulos JavaScript existentes; helper puro de link na camada Actions, integração na Gallery, contexto validado na agenda. Backend existente recebe referência em notas, sem mudança de schema.

**Tech Stack:** HTML/CSS/JS, Node test, Python unittest/build e Playwright para QA.

## 1. Galeria e entrada contextual

Arquivos: `kl-catalog-actions.js`, `kl-catalog-gallery.js`, `catalogo.html`, `kl-catalog.css`; se necessário `kl-catalog-app.js` para CTA do filtro. Testes: `tests/catalog-actions.test.cjs`, `tests/catalog-gallery.test.cjs` ou teste de integração do catálogo.

- [x] Escrever casos funcionais: noiva/debutante e loja correta; categoria não formal sem CTA; troca entre peças atualiza e oculta CTA corretamente.
- [x] Rodar testes e confirmar falha nova esperada, separada da asserção legada de copy WhatsApp já falhando na base (39/40).
- [x] Implementar `productScheduleHref(product)` com `/agendar/?ocasiao=...&un=...&modelo=...&ui_source=catalog_product_schedule`; só códigos canônicos do catálogo e categorias formais. Sem UTMs internas.
- [x] Inserir CTA primário da prova na galeria e convite contextual junto à seleção do catálogo. Alternativa de captura continua acessível.
- [x] Rodar suíte afetada; preservar favoritos, WhatsApp, prova virtual e teclado.

## 2. Agenda, contexto e dados

Arquivos: `agendar.html`, `kl-agendar.js`, opcional helper pequeno `kl-schedule-context.js` para validação de referência e montagem de notas. Testes: novo `tests/site-schedule-experience.test.cjs` e helper fake existente.

- [x] Escrever testes para referência real nas duas requisições, código inválido ignorado, categoria incompatível, preservação de dados ao voltar e conversões confirmado/pendente intactas.
- [x] Confirmar falha antes da implementação.
- [x] Carregar catálogo como dado estático antes do helper/agenda; validar código por match exato e categoria/ocasião, não confiar em query livre. Com falha de carregamento, seguir agenda sem referência.
- [x] Montar notas com referência válida e comentário opcional limitado a 400 caracteres, sem repetir prefixo em reenvio. Nenhum dado de formulário em query/analytics.
- [x] Exibir benefício curto sempre, corrigir copy de reserva/confirmado, agrupar campos opcionais e preservar valores ao navegar nos passos. FAQ pertinente antes de visita livre e ajuda para dúvidas/horários.
- [x] Rodar `node --test tests/site-schedule-*.test.cjs` e testes de atribuição/captura; corrigir falhas desta mudança.

## 3. Integração, revisão e publicação

- [x] Build público e preview: `python3 tools/build-site.py`; `python3 tools/build-site.py --preview --output _preview`.
- [x] Rodar checks do workflow: `python3 -m unittest discover -s tests -p test_url_build.py`, equivalente `test_seo_build.py`, `node --test tests/url-redirects.test.cjs`; syntax check dos scripts alterados.
- [x] QA Playwright com API simulada em 390/1440: galeria NV e DB, festa, formulário A/B/D, retorno de etapa, conflito/pendente/confirmado, token/origem não corrompidos. Verificar clique agenda, formulário e Schedule sem PII.
- [x] Revisões independentes de aderência à especificação e qualidade; resolver achados antes de publicar.
- [x] Atualizar relatório com baseline, resultado, recibo e rollback. Usar commit-seguro, stage restrito, commit/push da branch; PR e incorporação autorizados para publicar este site.
- [ ] Disparar `pages.yml` e esperar sucesso. Verificar bytes no domínio e navegação pública sem submissão.
- [ ] Acrescentar resultado ao canônico do site, handoff e card existente, preservando registros anteriores. Não registrar aumento de conversão sem dados posteriores.
