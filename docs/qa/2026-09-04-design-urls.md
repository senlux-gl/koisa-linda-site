# Revisão do site Koisa Linda · 04/09/2026

Status: **prévia local pronta para conferir; não publicada**.
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

**Limite da hospedagem:** as pontes usam JavaScript e link manual; não são HTTP 301. As URLs novas são documentos HTML reais com 200, sem depender de 404/SPA. A configuração atual do Pages ainda serve o diretório raiz; o artefato gerado precisa ser publicado pelo procedimento do README, após autorização.

## Validação concluída

- 8 testes Python novos de artefato: aprovados.
- 7 testes Node novos de compatibilidade de URL e módulos gerados: aprovados.
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

Nada foi publicado nem alterado em campanhas, n8n, banco ou agente vivo. `kl-agendar.js`, dados do catálogo, números de loja e IDs de medição foram preservados. `kl-tracking.js` recebeu somente reconhecimento de caminho limpo e identificação do destino catálogo; includes dos módulos alterados receberam versão de cache nova.

Workflow manual de publicação preparado; sem cron, gatilho por push ou execução remota. Decisão pendente: conferir a apresentação e autorizar a publicação. Rollback e mudança necessária da origem do Pages estão no README.

Tentativa de registrar a revisão em “Aguardando Guilherme” no Trello: não concluída, pois a credencial Trello Senlux não estava acessível pelo 1Password nesta sessão. Nenhum card foi criado; a pendência está explicitamente registrada no handoff, sem alegar que entrou na fila.
