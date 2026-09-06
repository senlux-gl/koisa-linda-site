# Pop-up de captação na entrada

Correção explícita do Guilherme: além do convite aplicado, mostrar um pop-up na tela ao abrir o site para pedir um dado de contato. Implementar/publicar está autorizado na continuidade desta tarefa; não pedir nova aprovação do mesmo formato.

## Experiência

Usar o formulário de captura existente, com só WhatsApp com DDD obrigatório e novidades opcionais/desmarcadas. Modal nativo com fechamento visível de 44 px, Escape, fundo clicável, foco contido e retorno sem salto. Abrir no início da visita (DOM pronto/próximo frame), sem esperar 30 segundos ou rolagem. Não reabrir automaticamente na mesma sessão; respeitar pedidos pendentes, contatos confirmados e dispensa vigente. Nenhum bloqueio de acesso condicionado a cadastro.

Disponível nas páginas de descoberta do site, inclusive home, catálogo, verticais e conteúdo. Agenda, privacidade e páginas de erro/redirect não recebem convite concorrente. Se a galeria/prova virtual já estiver aberta ou um campo estiver em uso, não sobrepor outro modal; tentar quando o diálogo anterior fechar. Entrada manual continua acessível no convite da página. Manter fluxo de agenda já publicado.

Reusar a mesma seção/formulário dentro do modal, devolvendo-a à página ao fechar; não duplicar IDs/controladores. Resultado e fechamento continuam acessíveis durante pedido/erro/pendência. Não exibir teclado móvel até ação da visitante.

## Contrato e dados

Não mudar backend, schema, consentimento, validação, tokens, envio ou campanhas. POST existente só após submit válido da visitante; abertura/fechamento não cria lead nem mensagem. Pendência exige confirmação no WhatsApp como hoje. Não colocar telefone em query, eventos ou armazenamento. Contexto do catálogo vem do App existente; páginas sem catálogo usam categoria conhecida e links contextuais, sem inventar peças. Origem/atribuição existente preservada.

Manter identidade KL (rubi/off-white/dourado, tipografia atual). Template compartilhado de captura no build evita divergência entre páginas e copia textos existentes de uso/consentimento. Sem claims novos de oferta/estoque/duração.

## Aceitação

Testes de abertura imediata, dispensa por sessão, navegação interna, reabertura manual, contato pendente/confirmado, Escape/fundo, foco, galeria já aberta, erro e sucesso simulado. Navegador 390/1440 e viewport pequena sem transbordamento; overlay não cobre seu próprio fechar. Testar apenas com API simulada/POST interceptado. Build/URLs/SEO e regressão dirigida da captura/agenda. Revisão independente, publicação manual e bytes/fluxo no domínio, sem formulário real.

Rollback: reverter só este incremento e republicar, preservando agenda e captura/backend anteriores (`517ae2a`).
