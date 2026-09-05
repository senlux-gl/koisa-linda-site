# Revisão do site Koisa Linda · 04/09/2026

Status: **publicada em 04/09/2026 após autorização do Guilherme; verificação no domínio concluída**.
Código: `/Users/guilhermepessanha/koisa-linda-site-review-20260904`.
Prévia: http://127.0.0.1:4185/ · base publicada usada na comparação: `4956efc`.

## Achados e correções

| Área | Antes | Entrega preparada |
|---|---|---|
| Home | Texto sobre fotografia, scrim vinho e troca automática de quatro imagens | Foto e conteúdo em planos separados; uma imagem responsiva AVIF/WebP prioritária; CTA com explicação da visita |
| Texto e hierarquia | Títulos com entrelinha apertada, cards com legendas sobre vestidos e termos internos como “escolha por intenção” | Títulos mais legíveis, texto direto, fotografias acima das legendas e ações alinhadas |
| Páginas por ocasião | Fotografia de fundo com texto sobreposto | Aberturas editoriais separadas em noivas, debutantes, madrinhas e ternos |
| Experiência de noivas | GSAP + ScrollTrigger + Lenis, cenas sobrepostas e rolagem pinada | Cenas em fluxo normal, legendas separadas, galeria com rolagem nativa, todas as cenas acessíveis |
| Movimento | Bibliotecas externas e loops de animação/crossfade | Um módulo de 3.173 bytes; entradas únicas via IntersectionObserver; apenas transform/opacity; reduced motion estático |
| Fontes | Google Fonts e fonts.gstatic.com em tempo de navegação | Arapey, Playfair e Questrial locais; 110.216 bytes de WOFF2 no total, `font-display:swap`, licenças OFL |
| Navegação móvel | Algumas páginas escondiam o menu sem oferecer abertura | Menu presente e funcional também nas páginas por ocasião, peça, agenda e 404; Escape fecha e restaura foco |
| Acessibilidade | Landmarks e atalhos inconsistentes; títulos de seção em divs na home | Main/skip link, headings da home, foco visível, privacidade no rodapé e âncoras seguras |
| URLs | Navegação `.html`, redirecionamentos históricos perdendo query/fragmento, prova virtual no sitemap apesar de noindex | Diretórios reais, canonical/OG/sitemap coerentes, aliases preservando os parâmetros e prova virtual fora do sitemap |

A identidade aprovada foi preservada: Ruby Wine, Dourado Koisa, creme, fontes e fotografia existentes. A skill kl-marca tinha pendências antigas já resolvidas nos canônicos BRAND/DESIGN e na direção aprovada do Pomar; os canônicos atuais prevaleceram.

## Endereços

- `/`, `/catalogo/`, `/agendar/`, `/noivas/`, `/debutantes/`, `/madrinhas/`, `/ternos/`.
- `/noivas/experiencia/`, `/sobre/`, `/servicos/`, `/unidades/`, `/como-chegar/`, `/privacidade/`.
- Páginas de intenção em `/noivas/<estilo>-<local>/`, sem extensão.
- `/peca/?codigo=…` preserva a interface do catálogo, com noindex no invólucro sem produto.
- As páginas indexadas em `/p/` mantêm seus endereços para preservar identidade existente.
- 40 aliases históricos, além das entradas antigas `.html`; `/provar.html` leva diretamente ao catálogo com `prova=1`.

**Limite da hospedagem:** as pontes usam JavaScript e link manual; não são HTTP 301. As URLs novas são documentos HTML reais com 200, sem depender de 404/SPA. Antes da publicação, o Pages servia o diretório raiz. Após a autorização, passou a publicar o artefato gerado pelo procedimento do README.

## Validação concluída

- 8 testes Python novos de artefato: aprovados.
- 9 testes Node novos de compatibilidade de URL, módulos gerados e preservação de atribuição durante a navegação do catálogo: aprovados.
- Varredura de 889 arquivos HTML gerados: nenhum href, asset local ou fragmento interno inexistente. Aliases `.htm`/`.php` também têm testes de destino e preservação de parâmetros.
- Sitemap: 835 endereços únicos, canônicos e indexáveis.
- Home e páginas principais: 320, 375, 768, 1024 e 1440 px; sem overflow horizontal após os ajustes finais. Páginas institucionais, agenda, catálogo e amostras SEO também conferidas em 320, 768 e 1440 px.
- Sete menus móveis novos: abrir/fechar e Escape funcionando; menu do catálogo também validado.
- Catálogo: categoria noiva + São Francisco; busca por código, resultado único, galeria, destino da prova virtual e unidade do WhatsApp preservados. Nenhuma mensagem enviada.
- Agendamento: URL antiga com unidade, ocasião, variante, UTM, fbclid e hash chegou à URL limpa com esses valores. Agenda respondeu, horário selecionado e formulário final aberto. Nenhum dado pessoal preenchido, lead criado ou pedido submetido.
- Experiência de noivas: quatro cenas visíveis no fluxo, legendas estáticas; âncora direta para a história funcionando.
- Console das páginas conferidas sem erro de execução novo; `node --check` e `git diff --check` aprovados.
- Reduced motion validado no CSS e no controle do módulo; não houve emulação do sistema operacional no navegador usado.

## Leveza e limites da medição

- Fonte HTML da home: 64.894 → 54.336 bytes, redução de 16,3%.
- Fonte da experiência de noivas: 41.792 → 36.396 bytes, redução de 12,9%.
- Esses números são dos HTMLs fonte. Há um CSS compartilhado de 13,6 KB e JS de UI de 3,2 KB; a entrega também deixa de solicitar GSAP, ScrollTrigger, Lenis e as três fotos extras do slideshow. Não confundir redução do HTML com redução total da página.
- Em uma observação local com cache, a home a 375 px registrou LCP 80 ms e CLS 0. O botão principal terminou em y=652 numa tela de 812 px. **Isso não é Lighthouse com 4G, dado de campo nem promessa para produção.** Reavaliar Core Web Vitals no domínio após publicar.

## Suíte preexistente

A base já apresentava 33 falhas no contrato Python e 11 no Node antes das alterações. A comparação final manteve os mesmos nomes de falhas, sem falhas novas. Incluem expectativas congeladas de copy/versões, fixtures e comportamento anterior de catálogo/prova virtual. A suíte completa não está verde; isso foi registrado antes de tocar o código.

Os testes afetados pelo novo movimento e pela inclusão de links no menu móvel foram atualizados para verificar o contrato atual. Os novos testes cobrem separadamente o artefato publicável, redirecionamentos, canonical, preservação de contexto e módulos que geram URLs.

## Publicação, contexto e pendência

Na etapa anterior à autorização, nada foi publicado. Campanhas, n8n, banco e agente vivo não foram alterados nesta entrega. `kl-agendar.js`, dados do catálogo, números de loja e IDs de medição foram preservados. `kl-tracking.js` recebeu somente reconhecimento de caminho limpo e identificação do destino catálogo; includes dos módulos alterados receberam versão de cache nova.

Workflow manual de publicação preparado; sem cron, gatilho por push ou execução remota. A autorização de publicação foi recebida nesta tarefa em 04/09. Rollback e mudança necessária da origem do Pages estão no README.

Tentativa de registrar a revisão em “Aguardando Guilherme” no Trello: não concluída, pois a credencial Trello Senlux não estava acessível pelo 1Password nesta sessão. Nenhum card foi criado; a pendência está explicitamente registrada no handoff, sem alegar que entrou na fila.


## Publicação autorizada e verificada

- Autorização do Guilherme nesta tarefa: “pode subir po”.
- Versão visual publicada pelo run `33936093073`, commit `9a3ce28`; ajuste final de atribuição pelo run `33936541002`, commit `9dc4e8d`. Os dois builds e deploys terminaram com success. O segundo repetiu os 17 testes novos (8 Python + 9 Node).
- GitHub Pages mudou de `legacy/main:/` para publicação por Actions. Domínio `koisalinda.com.br` e HTTPS preservados. Nenhuma rotina por push ou cron foi ativada.
- 27 páginas e arquivos do domínio retornaram 200 e conteúdo idêntico ao artefato revisado. As quatro saídas afetadas pelo ajuste final foram novamente comparadas após o segundo deploy. Sitemap contém 835 URLs únicas. Arquivos internos, instrumentação da prévia e caminho inexistente retornaram 404. Evidência: `2026-09-04-production-http.json`.
- Navegador em produção: home nova com uma imagem e sem overflow após carregar; catálogo antigo redirecionou mantendo categoria/unidade; busca de uma peça, galeria e destino correto do atendimento validados; agenda antiga manteve UTM, variante, unidade, ocasião e fragmento, consultou disponibilidade e avançou ao formulário final. Nenhum pedido enviado, foto submetida ou mensagem enviada.
- No QA final foi encontrada uma perda antiga de parâmetros dentro do próprio catálogo após o redirect da prova virtual. O serializador descartava tudo que não era filtro. A correção mantém o contexto externo ao atualizar filtros, abrir/fechar galeria e prova virtual; parâmetros do catálogo continuam sendo normalizados e removidos corretamente. Reprodução local, dois testes de regressão e navegador real confirmaram UTM/fbclid/fragmento preservados ao abrir e fechar a prova virtual e ao filtrar.
- Suíte completa após o ajuste: Python 65 testes, com as mesmas 33 falhas anteriores; Node 192 testes, com as mesmas 11 falhas anteriores. Nenhuma falha nova. Contratos de versão do core/app atualizados para os arquivos publicados; não declarar a suíte completa verde.
- Varredura de publicação: nenhum secret novo; os achados do scanner de conteúdo completo foram confrontados com a base e o site real: contatos públicos das lojas e falso positivo no ID público do Pixel, todos preservados. Detalhe sem valores sensíveis em `2026-09-04-publication-scan.json`.
- Cópia de retorno anterior preservada no remoto em `codex/kl-site-before-20260904`, commit `4956efc`. Procedimento no README. A decisão de publicação desta tarefa foi concluída; não há card de aprovação a criar.
