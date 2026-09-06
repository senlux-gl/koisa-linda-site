# Prova presencial: catálogo e agenda — 06/09/2026

Aplicação da direção aprovada por Guilherme após a pesquisa do funil. Base: `4380ecb`, preservando captura leve e rastreamento já publicados.

## Comportamento

- Galeria de noiva/debutante oferece **Agendar prova na loja**; ocasião, unidade e código chegam à agenda. Convite junto ao filtro acompanha categoria/unidade. Festa e ternos continuam com WhatsApp/visita livre.
- Referência validada contra catálogo/ocasião, mostrada no resumo e enviada nas notas de `/lead` e `/pedido` existentes, dentro do limite de 400 caracteres. Referência não garante disponibilidade.
- Descrição da prova visível no celular, FAQ antes de visita livre e ajuda perto do calendário. Nome e WhatsApp obrigatórios; data e preferências em detalhes opcionais.
- Voltar preserva campos e aceite na memória da página. Âncoras preservam query/documento. Contexto D atualizado antes do pedido quando ocasião/unidade mudam; controles ficam bloqueados durante envio para não trocar loja/data/hora nem duplicar o pedido em andamento.
- Confirmação e pendência refletem o servidor. Novo clique é diagnóstico, não `Schedule`/`Lead`. Atribuição paga e deduplicação existentes preservadas.

## Validação

- 65 testes Node direcionados: URLs, ações/galeria/tracking do catálogo, rastreamento e experiência da agenda.
- Três testes novos de integração do catálogo: convite contextual, clique e âncora da captura.
- Oito testes de build/URLs e nove de SEO aprovados; sintaxe dos scripts e diff sem erro.
- Oito cenários Playwright com endpoints de agenda simulados: percurso móvel catálogo→agenda com referência/origem; pendência A/B/D; festa sem agenda; galeria debutante; conflito com recuperação de dados; desktop. Telas em 390 e 1440 px, sem transbordamento ou erro JavaScript.
- Atribuição Google/campanha/criativo/gclid chega ao lead no percurso interno. Confirmação conta uma conversão; pendência não conta Schedule. Campos pessoais não aparecem no coletor simulado de analytics.
- Duas asserções antigas de catalog-app continuam fora desta alteração: evento inicial contém `category` adicional e URL preserva parâmetro desconhecido `lixo=1`. Ambas reproduzidas no HEAD isolado; não declarar toda a suíte histórica verde.
- Revisão de especificação aprovada após correção das âncoras; revisão técnica solicitou bloquear estado durante espera do cadastro, corrigido com caso de regressão deferred. Revalidação independente A/B/D com resposta atrasada e reativação após erro aprovada; nenhum achado material pendente.

Nenhum agendamento real ou mensagem de teste foi criado. Fotos públicas foram lidas para inspeção visual.

## Segurança e publicação

Varredura integral: sem secrets novos; os 21 apontamentos de regex foram confrontados com o HEAD e são contatos públicos já publicados, Pixel público ou fixtures sintéticas existentes. Na comparação das linhas adicionadas, os dois apontamentos são o mesmo Pixel já presente na linha HTML antes da alteração. Nenhum contato operacional ou ID foi mascarado para satisfazer regex. Recibo da revisão em `2026-09-06-agendamento-security-review.json`.

Publicar somente o artefato de `python3 tools/build-site.py`, pelo workflow manual `pages.yml` após integração. Os novos JS/CSS estão na allowlist do build. Verificação posterior: sucesso do workflow e igualdade dos arquivos servidos com o artefato; navegação pública sem envio de formulário. Recibo operacional final no cérebro compartilhado, em `projects/kl-rastreamento-2026-09/pesquisa-agendamento/aplicacao/`.

Rollback: reverter este commit funcional e republicar pelo mesmo workflow. Preservar as correções de tracking/captura da base; não voltar ao modo legado de publicação.

Não há medição de ganho de conversão nesta entrega. Acompanhar seleção de horário, pedidos confirmados e comparecimento; cliques e telefones captados são etapas diferentes.
