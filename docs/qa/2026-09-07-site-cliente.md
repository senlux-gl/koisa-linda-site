# Site da cliente: proporções e navegação

07/09/2026 · revisão local para conferência de Guilherme.

Prévia: http://localhost:4190/ · origem do trabalho: `origin/main` em `161f5bd`.
Pasta: `/Users/guilhermepessanha/koisa-linda-site-proporcoes-20260907`.
Nenhum commit, push ou deploy executado nesta revisão.

## Referências consultadas

- [Lovely Bride](https://lovelybride.com/): a descoberta dos vestidos faz parte de uma sequência explicada até a visita. Aplicação: modelos reais aparecem antes do artigo longo; a coleção oferece atalhos para modelos, visita, dúvidas e lojas.
- [Jenny Yoo](https://www.jennyyoo.com/): separa a descoberta por ocasião, referências salvas, lojas e agendamento. Aplicação: catálogo com busca e categoria visíveis, filtros secundários recolhíveis e medidas consistentes entre coleções e fichas.
- [Grace Loves Lace: agendamento](https://graceloveslace.com/pages/book-appointment): explica a experiência antes da escolha do atendimento. Aplicação: linguagem voltada à cliente e distinção visível entre prova marcada e visita livre.

As proporções aplicadas são decisões desta revisão, adaptadas à marca Koisa Linda. Não foram copiadas promessas de gratuidade, estoque, prazos ou condições dessas lojas. Fotos e informações do acervo existente foram preservadas.

## O que mudou

| Página / família | Ajuste |
| --- | --- |
| Início | Abertura proporcional, título com escala fluida, margens alinhadas, textos e imagens das seções com medidas comuns. |
| Noivas, debutantes, festa e ternos | Atalhos dentro da página, seis peças reais antes do texto longo, orientação de visita em três passos e melhor largura de leitura. |
| Catálogo | Título mais curto, três atalhos visíveis no celular, busca em destaque, filtros de cor/tamanho/detalhes recolhíveis, fichas com respiro e alinhamento. |
| Sobre | Escala dos títulos e textos, composição entre fotografia e conteúdo, valores e propósito com medidas consistentes. |
| Serviços | Grade editorial de três, duas ou uma coluna, conforme a tela, com textos mais legíveis. |
| Lojas | Duas colunas para duas lojas, atalhos para os endereços e orientação explícita sobre atendimento. |
| Como chegar | Tipografia, cartões, mapa e botões seguem as proporções comuns. |
| Experiência noiva | Abertura, narrativa, fotos e espaçamentos com as mesmas escalas do restante do site. |
| Estilos de noiva por cidade | Grade responsiva, títulos, fotos sem corte e acesso a catálogo/lojas no cabeçalho. |
| Fichas do acervo e detalhe dinâmico | Foto inteira, especificações legíveis, ações proporcionais e texto de visita coerente com a categoria. |
| Agendar / privacidade | Ajuste de títulos e proporções sem mudança nos formulários ou regras de atendimento. |

Foram removidos dos textos visíveis os comentários internos sobre campanha, intenção e próximo clique. Festa e ternos agora dizem “visite a loja” no guia e no detalhe da peça; noiva e debutante continuam com agendamento.

## Implementação

`kl-layout.css` é uma camada compartilhada aplicada pelo build depois dos estilos existentes. Um atributo estático identifica cada família de página. Não foi adicionado JavaScript de execução para o layout.

O build continua gerando as mesmas rotas, aliases e 835 URLs no sitemap. A camada aparece uma vez nas 837 páginas de conteúdo geradas, incluindo a página 404. A seleção de seis modelos usa os mesmos registros do catálogo e das fichas; ela apenas mudou de posição na página.

Fontes das alterações: `catalogo.html`, `noivas.html`, `debutantes.html`, `madrinhas.html`, `ternos.html`, `unidades.html`, `peca.html`, `kl-layout.css`, `tools/build-site.py` e `tools/seo_site.py`.

## Verificação

- Build de publicação e build de prévia concluídos. Prévia sem carregadores de analytics/Pixel.
- 32 rotas, em 320, 390, 768, 1024, 1440 e 1920 px: **192 verificações**, todas sem transbordamento horizontal, com título e camada visual carregados. Abrange todas as páginas principais, os 14 estilos/cidades, índice, 404 e fichas representativas. Não representa inspeção visual individual das 807 fichas.
- Inspeção visual de home, catálogo, coleção, lojas e galeria em celular/painel intermediário; medidas de desktop verificadas pelo DOM.
- Catálogo em 1440 px: primeira linha de produtos passou de 1402 para 834 px do topo. Em 768 px, de 1922 para 887 px. Em 320 px, de 1435 para 1113 px. São medidas da prévia, com o convite inicial já fechado e os filtros secundários recolhidos; não são dados de conversão ou de velocidade em produção.
- Menu abre e fecha com Escape. Filtro Azul produz `?co=Azul`, 10 peças e indicação de filtro ativo. Galeria abre com o código, mantém links e cabe em 320 px.
- Agenda com ocasião, unidade e modelo mostra Noiva, São Francisco e referência NV-001. Nenhum agendamento foi submetido.
- Popup em sessão nova abre na entrada, cabe em 320 × 740, permite Escape e não reaparece na navegação seguinte. Consentimentos opcionais desmarcados. Não foi enviado formulário, WhatsApp ou foto.
- Entrada `/catalogo/?prova=1&p=NV-001` abre a prova virtual sem sobrepor novamente o popup.
- Testes específicos: **23 Python + 62 JavaScript aprovados**. Cobrem URLs/fragmentos, SEO, popup, captura, agenda, galeria, redirecionamento e identidade Google. `git diff --check` passou.
- A suíte geral não está integralmente verde: **34 falhas Python e 10 JavaScript preexistentes**. A primeira execução JS antes do build tinha ainda uma falha por artefato ausente; ela desapareceu após gerar `_site`. Não foram introduzidos novos nomes de falhas. Os contratos antigos não foram reescritos para mascarar essa situação.

## Conferência e publicação

Esta revisão está local e pronta para conferir. Publicar exige a aprovação específica do resultado e o fluxo manual existente. O artefato publicável é `_site/`; `_preview/` serve somente à conferência. Antes de publicar, revalidar o estado atual do principal para preservar trabalhos concorrentes. O trabalho do sistema interno e seu caderno em `127.0.0.1:4188` continuam separados e intactos.
