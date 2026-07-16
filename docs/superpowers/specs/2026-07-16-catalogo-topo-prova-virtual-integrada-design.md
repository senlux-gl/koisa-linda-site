# Koisa Linda - topo do catálogo e Prova Virtual integrada

**Data:** 16 de julho de 2026

**Status:** desenho aprovado; aguardando revisão escrita final antes do plano de implementação

**Escopo:** evolução local de `catalogo.html`, do comportamento dos filtros e da Prova Virtual

**Fora deste documento:** deploy, alteração do Worker de IA, mudança de campanhas, Pixel, contatos das lojas ou migração de framework

## 1. Resumo executivo

O catálogo manterá o formato atual dos filtros, com categoria, unidade, cores, tamanhos, favoritos e contagens visíveis. A mudança será comportamental: o painel completo deixa de ficar preso durante a rolagem. Depois que ele sair da tela, uma barra fina passa a acompanhar a cliente com a contagem, as unidades e o comando **Ajustar filtros**.

A Prova Virtual deixa de parecer uma página externa. Ela passa a funcionar em um diálogo sobre o próprio catálogo. O link do menu abre o catálogo com a Prova Virtual pronta para escolher um vestido. O comando **Provar em mim** de uma peça abre o mesmo diálogo com o vestido já selecionado.

O fluxo de IA, upload, tamanhos, categorias, resultado, privacidade e Worker permanece funcionalmente igual. A rota `provar.html` continua existindo como ponte de compatibilidade para links antigos, mas encaminha a cliente para a experiência integrada no catálogo.

Esta especificação complementa `2026-07-15-catalogo-hibrido-editorial-design.md` e substitui somente as decisões que mantinham a Prova Virtual obrigatoriamente em uma página separada.

## 2. Contexto e causa raiz

### 2.1 Topo do catálogo

O catálogo renderiza 19 cores e 16 tamanhos. Os 35 controles têm altura mínima de 48 px e quebram em várias linhas. Como `.catalog-tools` está em `position: sticky`, o painel pode ocupar cerca de 536 px enquanto a cliente tenta ver as peças.

O usuário aprovou o formato atual dos filtros e rejeitou esconder cores e tamanhos por padrão. Portanto, a correção não compactará nem reorganizará o painel completo. Ela impedirá que esse painel grande acompanhe a rolagem.

### 2.2 Prova Virtual

`provar.html` nasceu como uma experiência beta isolada. Hoje ela usa:

- cabeçalho próprio com apenas **Início** e **Catálogo**;
- logo e escala diferentes do shell principal;
- layout de aplicativo limitado a 860 px;
- nenhum rodapé canônico;
- CTA global que pode se sobrepor à barra nativa da ferramenta.

A página permanece em `koisalinda.com.br`, sem redirecionamento externo. A sensação de estar fora do site é causada pelo shell visual e pela navegação diferentes.

## 3. Princípios

1. **Preservar o que já funciona.** Filtros, fotos, URLs, favoritos, galeria, Worker e fluxo da IA não serão reescritos sem necessidade.
2. **As peças precisam dominar a rolagem.** Controles extensos não podem bloquear a grade.
3. **Uma só experiência de marca.** A Prova Virtual faz parte do catálogo e usa o mesmo contexto visual e de navegação.
4. **Dois caminhos, um componente.** Menu e peça selecionada abrem a mesma Prova Virtual.
5. **Histórico reversível.** Voltar, fechar e Escape devolvem a cliente ao ponto anterior.
6. **Compatibilidade antes de limpeza.** Links antigos para `provar.html` continuam válidos.
7. **Foto e privacidade protegidas.** Nenhum log novo, persistência nova ou envio automático de foto será introduzido.
8. **Falha segura.** Se recursos avançados não iniciarem, catálogo, página de detalhe e links continuam utilizáveis.

## 4. Objetivos

- manter todos os filtros completos visíveis no início do catálogo;
- liberar a tela quando a cliente começa a navegar pelas peças;
- oferecer retorno rápido aos filtros sem manter o painel grande preso;
- abrir a Prova Virtual dentro do catálogo;
- preservar seleção de peça, filtros, paginação, posição e histórico;
- manter links antigos e abertura em nova aba funcionando;
- impedir sobreposição do CTA global com diálogos;
- cobrir o novo comportamento com testes de estado, URL, acessibilidade e regressão.

## 5. Não objetivos

- não esconder cor e tamanho em um botão recolhível por padrão;
- não reduzir os 35 filtros a uma rolagem horizontal permanente no desktop;
- não redesenhar o conteúdo interno completo da Prova Virtual;
- não alterar o modelo, Worker, CORS, limites, custos ou infraestrutura de IA;
- não alterar números de WhatsApp ou regras de unidade;
- não transformar o catálogo em React, Vue ou outra stack;
- não remover imediatamente `provar.html`;
- não executar upload ou geração real durante QA automatizado;
- não publicar em produção sem aprovação posterior ao QA local.

## 6. Decisão 1 - painel completo no fluxo

### 6.1 Estado inicial

O painel atual conserva:

- seletor de categoria;
- três estados de unidade;
- favoritos;
- todas as cores disponíveis;
- todos os tamanhos disponíveis;
- filtros ativos;
- contagem de peças.

Textos, ordem, quantidade, contagens e regras de filtragem permanecem iguais. A mudança principal é remover o comportamento sticky de `.catalog-tools`, colocando o painel no fluxo normal do documento.

### 6.2 Barra fina durante a rolagem

Depois que o painel completo ultrapassar o cabeçalho, aparece `.catalog-filter-rail`, fixada logo abaixo da navegação.

No desktop e tablet, a barra contém:

- quantidade de resultados visíveis e totais;
- resumo da categoria atual;
- unidades **Todas**, **Barra da Tijuca** e **São Francisco**;
- comando **Ajustar filtros**.

No mobile, a barra contém somente o resumo de resultados e **Ajustar filtros**. As unidades continuam disponíveis no painel completo para evitar uma faixa comprimida ou rolagem horizontal no topo.

O comando **Ajustar filtros** volta ao painel completo e posiciona o foco no seletor de categoria. A rolagem respeita o cabeçalho e usa movimento imediato quando `prefers-reduced-motion: reduce` estiver ativo.

### 6.3 Ativação sem listener de scroll

Um sentinela no fim do painel completo será observado por `IntersectionObserver`.

- sentinela abaixo ou visível: barra fina oculta;
- sentinela acima do cabeçalho: barra fina visível;
- retorno ao painel completo: barra fina volta a ficar oculta.

A decisão considera a posição vertical do sentinela para não mostrar a barra no carregamento inicial quando ele ainda estiver abaixo da janela. Sem `IntersectionObserver`, a barra fina permanece oculta e o painel completo continua funcional.

### 6.4 Sincronização

Os botões compactos de unidade escrevem o mesmo `CatalogState.unit` usado pelos botões principais. `syncShellState()` atualiza ambos os conjuntos, e a contagem da barra fina é atualizada pelo mesmo render que escreve `#catalog-count`.

Abrir, fechar ou usar a barra fina:

- não altera a URL por si só;
- não cria um segundo estado de filtros;
- não dispara evento de mudança de filtro sem mudança real;
- não desmonta a grade;
- não perde a posição nem a paginação.

## 7. Decisão 2 - Prova Virtual em diálogo

### 7.1 Componente

O catálogo recebe um `<dialog id="catalog-tryon">` próprio, separado dos diálogos de galeria e favoritos.

O código atualmente embutido em `provar.html` será separado em:

- `kl-catalog-tryon.js`: estado, seleção, upload, comunicação com o Worker e ciclo de resultado;
- `kl-catalog-tryon.css`: layout e responsividade exclusivos da ferramenta;
- marcação estática do diálogo em `catalogo.html`.

O módulo seguirá o padrão UMD dos módulos atuais e exporá uma API pequena em `window.KLCatalog.TryOn`. Ele receberá produtos validados, Actions, elementos do diálogo, callbacks de abertura/fechamento e o Worker já usado hoje.

Não haverá cópia independente da lógica dentro do catálogo e de `provar.html`.

### 7.2 Conteúdo preservado

O diálogo mantém o fluxo atual:

1. manequim opcional: PP, P, M, G, GG ou não sei;
2. filtro de vestidos elegíveis;
3. busca por código ou cor;
4. seleção do vestido;
5. orientação para foto de corpo inteiro;
6. upload explícito da foto;
7. comando **Provar em mim**;
8. processamento;
9. resultado, nova tentativa ou WhatsApp da unidade correta.

Somente noivas, madrinhas/festa e debutantes entram na Prova Virtual, mantendo `TRY_ON_CATEGORIES` como fonte canônica.

### 7.3 Dois pontos de entrada

**Pelo menu**

- os links de navegação apontam para `catalogo.html?prova=1`;
- se a cliente já estiver no catálogo, o clique primário simples é interceptado e abre o diálogo sem recarregar;
- se vier de outra página ou abrir em nova aba, a URL carrega o catálogo e abre o diálogo após a validação dos dados.

**Por uma peça**

- `Actions.tryOnHref(product)` passa a retornar `catalogo.html?prova=1&p=<código>`;
- na galeria, clique primário simples abre o diálogo sem recarregar e com o produto selecionado;
- Ctrl, Cmd, Shift, clique do meio, nova aba ou JavaScript indisponível usam o link real como fallback;
- a página de detalhe usa o mesmo destino.

### 7.4 Coordenação entre diálogos

Somente um diálogo pode permanecer aberto.

- ao abrir a Prova Virtual pela galeria, a galeria fecha visualmente sem apagar seu estado anterior;
- a Prova Virtual abre com o produto atual selecionado;
- fechar, usar Escape ou Voltar retorna à galeria anterior, com filtros, peça, lote, posição e foco preservados;
- abrir pelo menu a partir da grade retorna à grade;
- uma chegada direta por URL fecha por normalização da própria URL, sem retirar a cliente do catálogo.

O bloqueio de rolagem será compartilhado com o mecanismo já usado pela galeria para evitar compensações duplicadas no `body`.

## 8. Estado público e histórico

`CatalogState` recebe o campo:

```text
tryOn: boolean
```

Parâmetro público:

- `prova=1`: Prova Virtual aberta;
- `p=<código>`: produto selecionado quando houver.

Regras:

- sem `prova=1`, `p` continua representando a peça aberta na galeria;
- com `prova=1`, `p` representa a peça selecionada na Prova Virtual;
- `serializeState()` escreve `prova=1` somente quando `tryOn` for verdadeiro;
- valores diferentes de `1` são ignorados;
- abrir a Prova Virtual dentro do catálogo usa uma entrada de histórico própria;
- fechar uma abertura criada na sessão usa `history.back()`;
- fechar uma chegada direta remove `prova` e `p` por `replaceState`;
- `popstate` reconcilia qual diálogo deve estar aberto e nunca escreve outra entrada;
- nenhum termo de busca, nome de arquivo ou dado da foto entra na URL ou no tracking.

Ao abrir a Prova Virtual pela galeria, a nova entrada fica sobre o estado da galeria. Voltar restaura a galeria em vez de saltar diretamente para a grade.

## 9. Compatibilidade de `provar.html`

`provar.html` permanece publicado como ponte leve.

- lê somente um `p` válido da query;
- usa `location.replace()` para `catalogo.html?prova=1` com o código quando existir;
- apresenta o shell oficial e um link manual equivalente enquanto o redirecionamento ocorre;
- oferece mensagem funcional em `<noscript>`;
- não carrega uma segunda cópia da ferramenta;
- mantém `meta robots="noindex"` nesta fase para evitar indexar uma rota de transição.

Links antigos, favoritos do navegador e campanhas que ainda apontem para `provar.html?p=<código>` continuam chegando ao novo fluxo.

## 10. CTA global e camadas

`.kl-sticky-cta` não pode aparecer sobre galeria, favoritos ou Prova Virtual.

O catálogo aplicará uma classe única no `body` enquanto qualquer diálogo estiver aberto. `kl-site-enhance.css` ocultará o CTA global nesse estado. Ao fechar o último diálogo, a classe é removida e o CTA volta ao comportamento normal.

Ordem de camadas:

1. cabeçalho;
2. barra fina de filtros;
3. grade e conteúdo;
4. CTA global quando não houver diálogo;
5. backdrop e diálogo ativo.

A barra fina nunca fica acima de um diálogo.

## 11. Erros, concorrência e privacidade

- sem vestido ou sem foto, o comando de gerar permanece desabilitado;
- falha de miniatura tenta a imagem original uma única vez, como hoje;
- falha do Worker mantém a mensagem e a alternativa de WhatsApp existentes;
- limite de uso e resposta inválida continuam estados distintos;
- fechar o diálogo durante uma requisição invalida o ciclo atual;
- resposta atrasada nunca atualiza um diálogo fechado ou uma nova tentativa;
- nenhuma foto, base64, nome de arquivo ou conteúdo do resultado entra em logs, URL, Pixel ou eventos;
- o upload só ocorre depois da ação explícita **Provar em mim**;
- o Worker e suas regras de CORS não serão alterados neste escopo.

## 12. Acessibilidade e responsividade

### 12.1 Barra fina

- alvo mínimo de 44 px nos comandos;
- foco visível;
- `hidden` real quando não estiver ativa, retirando controles da ordem de tabulação;
- resumo textual de categoria e quantidade;
- retorno de foco previsível ao painel completo.

### 12.2 Prova Virtual

- `<dialog>` com `aria-labelledby` e descrição associada;
- foco inicial no título ou primeiro controle útil;
- foco preso pelo diálogo nativo;
- Escape fecha;
- foco retorna ao link ou botão que abriu;
- estados de processamento e erro usam `aria-live` sem repetição excessiva;
- controles de tamanho e categoria expõem estado pressionado;
- o input de arquivo mantém rótulo acessível;
- no mobile, o diálogo ocupa `100dvh`, com rolagem interna e ações alcançáveis;
- nenhuma ação fixa cobre a seleção de vestido, upload ou resultado;
- transições usam apenas `transform` e `opacity` e são removidas em movimento reduzido.

Viewports mínimos de QA:

- 1440 x 900;
- 1024 x 768;
- 390 x 844;
- 320 x 568.

## 13. Arquivos previstos

Arquivos novos:

- `kl-catalog-tryon.js`;
- `kl-catalog-tryon.css`;
- `tests/catalog-tryon.test.cjs`.

Arquivos alterados:

- `catalogo.html`;
- `kl-catalog.css`;
- `kl-catalog-core.js`;
- `kl-catalog-actions.js`;
- `kl-catalog-app.js`;
- `kl-catalog-gallery.js` se a API de transição exigir um callback explícito;
- `kl-site-enhance.css`;
- `provar.html`;
- páginas HTML que ainda apontam para `provar.html`;
- `tests/catalog-core.test.cjs`;
- `tests/catalog-actions.test.cjs`;
- `tests/catalog-app.test.cjs`;
- `tests/test_site_contract.py`;
- testes de roteamento e tracking somente se seus contratos públicos forem afetados.

## 14. Estratégia de testes

### 14.1 Testes de unidade e contrato

- leitura e serialização de `prova=1`;
- rejeição de valores inválidos;
- URL canônica da Prova Virtual por produto;
- painel completo não sticky;
- barra fina oculta no carregamento e visível após o sentinela subir;
- sincronização dos dois conjuntos de unidade;
- **Ajustar filtros** devolve foco ao painel;
- entrada por menu sem produto;
- entrada por peça com produto pré-selecionado;
- abertura da Prova Virtual fecha visualmente a galeria sem dois diálogos simultâneos;
- fechar restaura galeria ou grade conforme a origem;
- deep-link e `popstate` não escrevem histórico adicional;
- filtro de categorias elegíveis;
- tamanho, busca, seleção e limpeza;
- sucesso, erro, limite e resposta atrasada do Worker com mock;
- CTA global oculto enquanto um diálogo estiver aberto;
- `provar.html?p=<código>` preserva o código na ponte;
- navegação desktop e mobile aponta para a nova entrada.

### 14.2 Regressão

- 41 testes Python existentes;
- 81 testes JavaScript existentes;
- galeria, favoritos, paginação, filtros, restauração, WhatsApp e tracking continuam passando;
- nenhuma foto real é enviada durante os testes.

### 14.3 QA visual local

- painel completo igual ao atual;
- primeira fileira permanece no mesmo fluxo inicial;
- painel grande desaparece ao rolar;
- barra fina não cobre peças nem cabeçalho;
- menu abre Prova Virtual dentro do catálogo;
- peça abre com seleção correta;
- fechar volta ao ponto anterior;
- modal e CTA global nunca se sobrepõem;
- mobile sem rolagem horizontal;
- nenhuma ação ou texto cobre rosto ou área principal do vestido.

## 15. Critérios de aceite

O trabalho estará pronto localmente quando:

1. o painel completo mantiver exatamente os filtros e contagens atuais;
2. o painel completo não permanecer preso durante a navegação pelas peças;
3. a barra fina aparecer somente depois que o painel completo sair da tela;
4. menu e **Provar em mim** abrirem o mesmo diálogo no catálogo;
5. a abertura por peça chegar com o vestido correto selecionado;
6. fechar ou voltar restaurar galeria ou grade sem salto de estado;
7. `provar.html` continuar resolvendo links antigos;
8. Worker, upload e privacidade não sofrerem mudança de contrato;
9. CTA global não cobrir nenhum diálogo;
10. todos os testes existentes e novos passarem;
11. os quatro viewports de QA passarem sem sobreposição ou rolagem horizontal;
12. nenhuma mudança for publicada antes do aceite visual final.

## 16. Rollback

As mudanças serão entregues em uma branch própria e em commits pequenos.

- a barra fina pode ser removida sem afetar filtros ou estado;
- o destino de `Actions.tryOnHref()` pode voltar para `provar.html` sem tocar no Worker;
- `provar.html` anterior permanece recuperável pelo Git;
- nenhuma migração de banco ou infraestrutura será necessária;
- produção só será alterada por merge e push explícitos após QA.
