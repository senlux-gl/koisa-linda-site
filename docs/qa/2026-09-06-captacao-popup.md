# Pop-up de entrada — 06/09/2026

Guilherme esclareceu que quer a captura em uma janela na abertura do site, além do convite existente. Incremento sobre a base publicada `517ae2a`; mesma captação/backend já autorizada, sem novo disparo ou mudança de consentimento.

O formulário aparece em modal nativo no primeiro frame após a página ficar pronta. WhatsApp com DDD é o único campo obrigatório; novidades começam desmarcadas. X de 44px, Escape e fundo fecham a janela, sem condicionar acesso a cadastro. Teclado móvel não abre sozinho. O mesmo formulário volta ao lugar na página ao fechar, mantendo rascunho, foco e posição de rolagem.

Frequência: uma abertura automática por sessão, respeitando dispensa vigente, pedido pendente e contato confirmado. Galeria/prova virtual já aberta não recebe outro modal por cima. Agenda, privacidade, erro e redirecionamentos ficam fora da captação; a entrada manual continua no convite. No catálogo, posição e contexto de favoritos/filtros preservados. Demais páginas recebem categoria/unidade conhecidas pelo build e não inventam peças.

Template único em 833 páginas de descoberta; sitemap inalterado com 835 URLs. Dependências únicas/ordenadas. Páginas que ainda não carregavam o módulo de atribuição recebem `kl-tracking.js` existente antes da captura; versões já presentes/GA não são duplicados. Abertura é diagnóstico `capture_invite_view`, experiência `entry_popup_20260906`; pedido permanece pendente até confirmação autenticamente recebida pelo backend. Nada é criado ou enviado só ao abrir/fechar a janela.

Validação: 47 testes JS direcionados, 23 Python de build/URLs/SEO e 12 cenários de navegador com API simulada, nas larguras 320, 390 e 1440. Incluídos fechamento/retorno de scroll, frequência entre páginas, reabertura manual, galeria, pendência/confirmação, erro e fechamento durante requisição; origem paga na home/catalogo/ficha e ausência de telefone em URL, storage e eventos. Revisões independentes aprovadas, inclusive revalidação de foco/scroll e atribuição. Nenhum formulário real, cadastro persistente fictício ou mensagem real nos testes.

Segurança: varredura dos arquivos alterados aponta somente cinco correspondências de regex em catalogo.html: Pixel público confundido com telefone e contato público da loja, presentes e inalterados no HEAD. Não há secret nem dado de cliente novo. Template/JS/testes foram conferidos na varredura final staged; contatos operacionais não foram mascarados para satisfazer regex.

Publicação usa somente o artefato `_site/` no workflow Pages manual; testes da captura e presença do template foram incluídos no gate. Conferir sucesso da execução e igualdade dos arquivos/páginas servidos; abrir o site em contexto novo sem submeter formulário. Recibo operacional final no cérebro: `projects/kl-rastreamento-2026-09/captacao-leve/popup/`.

Rollback: reverter apenas este incremento e republicar. Preservar `517ae2a` e as entregas anteriores de agenda, tracking e backend de captura. Ganho de base/conversão ainda não medido; continuar no card existente de métricas.
