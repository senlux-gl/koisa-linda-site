# Site Koisa Linda — URLs, SEO e comunicação AIDA

Revisão local de 08/09/2026, a partir da publicação `7c5d102`. Prévia: http://127.0.0.1:4191/. A publicação anterior continua vigente; esta revisão não foi incorporada nem publicada.

## O endereço do print

`/catalogo/?prova=1` respondia HTTP 200 e abria a simulação, mas exibia o nome e o endereço do catálogo. Não foi constatada uma queda geral de páginas. Foram consultadas, por GET, as 835 URLs do sitemap publicado: todas HTTP 200. Mais dois endereços históricos responderam 200 e um endereço inexistente de controle respondeu 404. Recibo: `2026-09-08-seo-live.json`.

A experiência agora tem uma página própria: `/prova-virtual/`, com título, explicação e conteúdo disponível sem executar o catálogo. Links antigos de catálogo com `prova=1`, `/provar.html` e `/provar/` continuam levando à experiência. Peça, unidade, campanha e fragmentos são preservados; apenas o indicador antigo de abertura é removido. Parâmetros de filtros e de peças continuam sendo estados válidos, não novas páginas a colocar no sitemap.

A galeria abre a página dedicada com o código escolhido. A peça recebida pelo link aparece selecionada no primeiro lote, mesmo quando estava depois dos primeiros 24 resultados. O botão Voltar do navegador mantém a entrada do catálogo; fechar a simulação retorna à introdução. Código inexistente recebe orientação para escolher outro vestido, sem renderizar o texto arbitrário recebido pela URL. Não houve envio de foto ou consumo de simulação.

## Comunicação do anúncio à visita

Referências locais lidas: `galeria/DIRECAO-AIDA-POR-CRIATIVO.md`, `AUDITORIA-AIDA.md`, as legendas recriadas em 08/09 e, por último, `criativos-recriados-20260908/festa-estudio-v2/OVERRIDES.json`, no projeto de reconstrução de mídia. A leitura da tarefa pela ferramenta do aplicativo falhou; os arquivos atuais e o handoff foram a fonte efetivamente consultada.

AIDA orienta a sequência, sem transformar suas quatro etapas em rótulos para a cliente. Cada página começa pela ocasião ou decisão, desenvolve detalhes observáveis, explica o valor de conhecer a peça no corpo e convida ao próximo passo adequado.

| Jornada | Atenção e demonstração | Desejo e ação |
|---|---|---|
| Noivas / experiência | Detalhe, renda, silhueta e acabamento, em sintonia com M06–M12 | Imaginar a entrada, perceber movimento e consultar/agendar a prova na unidade escolhida |
| Debutantes | Estilo da jovem, volume e momentos da festa, em sintonia com M01–M05 | Descobrir na prova se a referência acompanha o jeito de viver os 15; condições de composição consultadas |
| Madrinhas e festa | Cor, convite, decote, textura e estilo, conforme M13–M16 atuais | Experimentar para decidir; visita livre e loja correta |
| Ternos | Corte, ombros, mangas, calça e conjunto | Perceber presença e conforto; visita livre |
| Catálogo / fichas / estilos | Referências reais, código, atributos e unidade | Imaginar a ocasião, conferir disponibilidade e conhecer o caimento |
| Home / sobre / serviços | Ocasião, história desde 1994 e trabalho concreto do ateliê | Clareza sobre modalidades, ajustes e condições antes de decidir |
| Prova virtual | Imaginar-se na peça e comparar estilos | Simulação como referência visual; tecido e caimento conferidos presencialmente |
| Unidades / como chegar / agenda | Preparar a visita e levar referências | Endereço, dia, horário e confirmação apresentados com clareza |

A primeira seleção de festa utiliza as mesmas oito referências da nova direção de estúdio: Barra `MD-G-034`, `MD-GG-017`, `MD-M-049`, `MD-015`; São Francisco `080950`, `080953`, `080957`, `080961`. Códigos, categorias, imagens e unidades conferidos com o catálogo atual. Nenhuma disponibilidade para uma data foi presumida.

Foram retiradas generalizações de ajuste universal, prazos/condições incondicionais e resultado virtual em segundos. A tabela de preços e parcelamento da home deu lugar à consulta das condições da peça. Depoimentos, identidade da marca, consentimentos e política de privacidade foram preservados. Textos de erro e informação prática priorizam clareza; a política de privacidade não foi convertida em publicidade. Agenda, catálogo e mensagens preparadas também receberam o mesmo tom, inclusive os textos carregados por JavaScript.

## Pesquisa SEO e aplicação

- **Endereços compreensíveis e consistentes:** página própria para a simulação e revisão dos links internos; filtros e identificação da peça continuam funcionando. [Estrutura de URLs do Google](https://developers.google.com/search/docs/crawling-indexing/url-structure) e [URLs de comércio eletrônico](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites).
- **Uma referência canônica por conteúdo:** sitemap e canonical concordam; estados de campanha não entram no sitemap. [Consolidação de URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- **Títulos descritivos e conteúdo que ajuda a escolher:** títulos e descrições únicos; a redação desenvolve produto, uso e visita, sem repetir palavras-chave artificialmente. [Títulos de busca](https://developers.google.com/search/docs/appearance/title-link) e [conteúdo útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
- **Descoberta das peças atuais:** 34 fichas faltantes, MD-069 a MD-102, foram criadas a partir dos dados existentes, sem inventar atributos. O índice usa as categorias atuais. As duas fichas antigas fora do catálogo, 040393 e 080912, continuam acessíveis com explicação e `noindex,follow`; não constam do novo sitemap. [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).
- **Preservação dos links anteriores:** os aliases continuam presentes. O GitHub Pages deste projeto publica arquivos estáticos; os redirecionamentos são feitos por JavaScript e têm um link manual. Não são respostas HTTP 301. O Google recomenda redirecionamento no servidor quando possível; mudar a infraestrutura exigiria outra execução. [Redirecionamentos](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

O artefato contém 872 páginas de conteúdo, 868 URLs indexáveis no sitemap e 52 documentos de redirecionamento. A varredura local conferiu destinos, fragmentos, IDs, H1, canonical, metadados e JSON-LD: zero problemas apontados, zero títulos/descrições duplicados e zero divergências entre canonical e sitemap. Campos de preço, estoque, avaliações e resultados não foram inventados no schema. FAQ visível e estruturado concordam.

## Verificação e limites

26 testes Python de build/URL/SEO/popup/jornada e 127 testes JavaScript direcionados aprovados. 84 verificações no navegador, envolvendo 32 rotas e larguras 320, 390, 768 e 1440, sem overflow nem H1 ausente. Nem todas as rotas foram repetidas nas quatro larguras; os 32 destinos foram conferidos em 320 e 768, e dez páginas principais também em 390 e 1440. Prova virtual testada com link antigo, peça específica, seleção visível e fechamento. Agenda carregou os dias com ocasião, unidade e modelo preservados. Nenhum formulário enviado, mensagem disparada, foto enviada ou banco alterado.

A suíte geral ainda contém falhas anteriores em contratos antigos de fonte/estado, tamanho de catálogo e CTA fixo; não é declarada integralmente verde. Os seis testes antigos que exigiam descartar a campanha no redirecionamento foram substituídos por regressões que preservam o contexto. Dois testes de transição interna da galeria passaram a verificar a navegação para a página própria. Relatórios de execução acompanham esta nota.

Não houve consulta autenticada ao Search Console, submissão de sitemap, medição de posições ou comprovação de tráfego/receita. HTTP 200, schema válido e sitemap correto não demonstram indexação ou ganho de ranking. Core Web Vitals de campo não foram medidos nesta revisão. A validação de rede descrita é da versão pública anterior; a nova versão foi validada localmente.

## Aplicação posterior

Conferir esta prévia, principalmente chamadas, condições comerciais e referências de festa. Se a publicação desta revisão for autorizada, conferir novamente `origin/main`, incorporar somente estes arquivos, executar a varredura de conteúdo e publicar `_site/` pelo workflow manual. Preservar `7c5d102` como referência da versão anterior e validar URLs, assets e fluxos após a publicação. O caderno/sistema em 4188 é um trabalho separado.

## Autorização e preparação de publicação — 08/09/2026

Após conferir a prévia, Guilherme autorizou expressamente: “pode publicar”. A referência anterior continua sendo `7c5d102`, revalidada antes da incorporação. A recompilação inicial em diretório vazio gerou os mesmos 1.093 arquivos, byte a byte, do artefato aprovado. Depois, a remoção de espaços finais nas 34 fichas novas alterou apenas espaços em linhas vazias: os outros 1.059 arquivos permaneceram idênticos e a equivalência textual das 34 fichas foi conferida. Os 26 testes Python e 127 JavaScript direcionados foram repetidos com sucesso. Nas 34 novas fontes de ficha, o contato antigo herdado do gerador foi substituído pelo mesmo CTA da ficha já presente no artefato aprovado; a saída pública não mudou.

A varredura de conteúdo não encontrou secrets. Os 71 alertas restantes foram revisados individualmente: 54 correspondem ao ID público de pixel interpretado como telefone e 17 aos dois contatos públicos das lojas, já presentes na versão anterior e no domínio oficial. Não foi acrescentada supressão ao scanner. A autorização de publicação abrange a permanência desses contatos do site aprovado. As evidências detalhadas da publicação e da conferência posterior ficam em `senlux-brain/projects/kl-site-aida-publicacao-20260908/`.
