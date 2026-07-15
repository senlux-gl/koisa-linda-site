# Koisa Linda — catálogo híbrido editorial

**Data:** 15 de julho de 2026

**Status:** desenho aprovado; aguardando revisão escrita final antes do plano de implementação

**Escopo:** evolução local de `catalogo.html` e dos módulos diretamente ligados à experiência do catálogo
**Fora deste documento:** deploy, alteração de campanha/Pixel, migração de framework e promessa de estoque em tempo real

## 1. Resumo executivo

O catálogo será reorganizado como uma experiência híbrida: entrada editorial curta, descoberta rápida de peças e galeria imersiva no mesmo contexto. O objetivo é valorizar a marca e as fotos sem atrasar a cliente que já sabe o que procura.

A cliente verá peças das duas unidades por padrão. O filtro de unidade ficará sempre visível e começará em **Todas**, evitando a barreira de escolher uma loja antes de conhecer o acervo. Ao abrir uma peça, a cliente entrará numa galeria imersiva, sem perder busca, filtros, quantidade carregada ou posição da página. Nessa galeria, o contato com a unidade correta pelo WhatsApp será a ação principal; **Provar em mim** continuará disponível como ação secundária.

A mudança preserva a arquitetura atual em HTML, CSS e JavaScript vanilla, as rotas públicas, as fotografias, a prova virtual, os favoritos e o carregamento leve. Primeiro melhora-se a experiência usando os 752 produtos existentes. A reconciliação e o enriquecimento dos dados pelo Clariai serão uma segunda fase e não bloquearão a evolução visual e funcional.

## 2. Contexto e evidências

O catálogo atual já possui uma base valiosa: 752 peças, fotos reais, busca, filtros, favoritos, página de detalhe, prova virtual, WhatsApp por produto e carregamento incremental. O problema principal não é a falta de acervo; é como esse acervo é apresentado e como o estado da navegação é tratado.

O diagnóstico local encontrou:

- 535 peças da Barra da Tijuca e 217 de São Francisco;
- 215 noivas, 56 debutantes, 285 madrinhas/festa, 7 ternos, 82 bolsas, 24 calçados e 83 acessórios;
- as primeiras 72 peças da ordem atual são de noiva, fazendo a entrada padrão parecer um catálogo de uma única categoria;
- no mobile de 390 px, a primeira peça aparece por volta de 984 px, depois de uma área de ferramentas alta demais;
- filtros de cor e tamanho não respeitam corretamente a unidade selecionada;
- tamanhos numéricos existentes não aparecem no filtro atual;
- parâmetros de unidade na URL podem filtrar os dados sem atualizar a seleção visual;
- favoritos de unidades diferentes podem ser enviados ao WhatsApp de apenas uma loja;
- falha de dados é apresentada como se não houvesse resultado;
- o carregamento depende do `IntersectionObserver` sem botão de contingência;
- parte do tracking procura dados em propriedades globais que a página não expõe;
- a galeria atual não funciona como diálogo acessível e não preserva explicitamente o contexto anterior;
- 488 peças usam tamanho `Único`, 467 não têm cor e faltam campos como ocasião, estilo, tecido, coleção e atualização.

Os 24 testes de contrato atuais passam. Eles protegem elementos estáticos e integrações, mas ainda não testam combinações de filtros, URL, favoritos por unidade, falhas, continuidade de navegação ou galeria.

## 3. Princípios do desenho

1. **Descoberta antes da burocracia.** A cliente pode explorar o acervo sem escolher loja antecipadamente.
2. **Marca e função em equilíbrio.** A abertura tem presença editorial, mas os produtos começam cedo.
3. **Fotografia é protagonista.** Controles e textos não cobrem rosto, corpo, vestido ou gesto importante.
4. **Contexto nunca se perde.** Abrir e fechar uma peça devolve a cliente ao ponto exato da busca.
5. **A unidade certa atende.** Toda ação de serviço usa a unidade da peça ou separa escolhas por unidade.
6. **Sem promessas falsas.** O site apresenta o acervo e pede confirmação de disponibilidade com a loja.
7. **Evolução cirúrgica.** Preservar stack, identidade, rotas, fotos e integrações que já funcionam.
8. **Acessível e leve.** Teclado, leitor de tela, movimento reduzido e carregamento progressivo fazem parte do desenho.

## 4. Objetivos

- tornar a entrada do catálogo mais elegante e mais direta;
- mostrar variedade real de categorias e das duas unidades desde o início;
- reduzir a altura das ferramentas no mobile;
- permitir busca e refinamento sem combinações impossíveis;
- transformar a abertura da peça numa galeria imersiva, rápida e reversível;
- encaminhar WhatsApp, prova virtual e favoritos com contexto correto;
- tornar o estado pesquisável, compartilhável e restaurável pela URL;
- tratar carregamento, erro e ausência de resultados como estados diferentes;
- reparar a coleta de eventos do catálogo sem alterar o Pixel ou campanhas;
- criar testes comportamentais suficientes para evoluir o catálogo com segurança.

## 5. Não objetivos

- não redesenhar todas as páginas do site;
- não substituir HTML/CSS/JavaScript vanilla por React, Vue ou outra biblioteca;
- não modificar ID, configuração ou estratégia do Meta Pixel;
- não prometer estoque ou disponibilidade em tempo real;
- não inventar popularidade, novidade, coleção, tecido ou estilo ausentes na base;
- não alterar os canais públicos das unidades;
- não bloquear a entrega até a reconciliação total com o Clariai;
- não publicar em produção antes de uma aprovação visual final do Guilherme;
- não remover a página de detalhe ou a rota de prova virtual sem uma decisão posterior explícita.

## 6. Decisões aprovadas

### 6.1 Entrada híbrida editorial

A abertura combina uma introdução visual curta com ferramentas de descoberta. Ela não será um hero alto ocupando a primeira tela inteira. A prioridade é fazer a primeira fileira de peças aparecer cedo, especialmente no mobile.

Ordem da página:

1. cabeçalho existente;
2. introdução editorial compacta com título e apoio;
3. busca em posição de destaque;
4. atalhos visuais para **Noivas**, **Debutantes** e **Festa**;
5. barra de refinamento com unidade sempre visível;
6. filtros ativos removíveis e contador de resultados;
7. grade de produtos;
8. carregamento incremental com contingência manual.

No desktop, a introdução e a busca podem compartilhar a largura de forma editorial. No mobile, texto, busca e atalhos se empilham sem ultrapassar aproximadamente uma primeira tela antes do começo da grade. O valor exato será validado visualmente em 320 e 375 px.

### 6.2 Duas unidades por padrão

O filtro de unidade ficará visível no fluxo principal, com três estados:

- **Todas** — padrão;
- **Barra da Tijuca**;
- **São Francisco**.

Não haverá tela ou modal obrigatório de escolha de loja. A cliente poderá reduzir o acervo quando quiser, sem limitar sua primeira descoberta.

### 6.3 Mistura inicial determinística

Em **Todas**, a grade não seguirá simplesmente a ordem bruta da base. Ela usará um intercalamento determinístico entre categorias e unidades para evitar longos blocos de uma única categoria ou loja.

Regras:

- usar somente campos reais existentes;
- preservar uma ordem estável entre recarregamentos e compartilhamentos;
- intercalar categorias elegíveis antes de repetir a mesma categoria várias vezes;
- alternar unidades quando houver peças suficientes, sem impor uma falsa proporção de 50/50;
- não criar selos como “mais procurado”, “novo” ou “tendência” sem fonte de dados;
- quando a cliente selecionar categoria, unidade, busca ou refinamento, usar a ordem estável daquele subconjunto.

A função de ordenação ficará isolada e coberta por teste, para que uma futura ordenação real por coleção ou relevância possa substituí-la sem reescrever a interface.

## 7. Jornada aprovada

### 7.1 Descoberta

1. A cliente entra no catálogo e vê a busca logo no início.
2. Pode tocar em Noivas, Debutantes ou Festa, ou continuar em **Todas**.
3. Vê peças das duas unidades misturadas.
4. Pode filtrar por unidade, cor e tamanho sem combinações mortas.
5. Cada filtro ativo aparece como elemento removível.
6. A contagem informa o conjunto resultante e é anunciada de modo não intrusivo a tecnologias assistivas.
7. Mais peças carregam automaticamente conforme a rolagem; um botão **Carregar mais** fica disponível como contingência.

### 7.2 Abertura de uma peça

1. A cliente toca na foto ou no comando de abrir a peça.
2. A galeria imersiva entra sobre a página, mantendo o catálogo montado por baixo.
3. A URL passa a identificar a peça aberta, sem recarregar a página.
4. A cliente pode navegar por foto, salvar a peça, avançar ou voltar para peças vizinhas e ler os dados essenciais.
5. O botão principal abre uma conversa com a unidade correta e identifica a peça.
6. **Provar em mim** aparece como ação secundária quando a peça é compatível com o fluxo atual.
7. Ao fechar, usar Voltar do navegador ou tecla Escape, a URL e o foco retornam ao estado anterior.

### 7.3 Retorno exato

O catálogo deve restaurar:

- texto de busca;
- categoria;
- unidade;
- cores e tamanhos selecionados;
- quantidade de lotes já exibidos;
- posição vertical;
- último elemento com foco;
- peça aberta, quando a URL compartilhada chegar diretamente à galeria.

Abrir a galeria não desmontará a grade. Ao fechar, a cliente deve enxergar a mesma peça no mesmo ponto, sem salto perceptível.

## 8. Busca, filtros e URL

### 8.1 Busca

A busca aceitará correspondência normalizada, sem diferenciar maiúsculas, minúsculas ou acentos, nos campos disponíveis:

- código da peça;
- categoria;
- cor;
- tamanho.

Campos futuros só entram após existirem de forma confiável na base. A busca terá rótulo acessível além do placeholder e não disparará recomputação a cada tecla sem um pequeno controle de frequência.

### 8.2 Refinamentos dependentes

As opções de cor e tamanho serão calculadas sobre o universo já reduzido por:

- categoria;
- unidade;
- busca;
- demais refinamentos compatíveis.

Uma opção não deve aparecer habilitada se inevitavelmente produzir zero resultado. Ao mudar unidade ou categoria:

- seleções ainda válidas permanecem;
- seleções incompatíveis são removidas de forma previsível;
- a interface informa a mudança pela atualização dos filtros ativos e do contador;
- tamanhos alfabéticos, numéricos e `Único` podem aparecer conforme existirem no conjunto.

### 8.3 Modelo de estado

O estado de catálogo será representado por um objeto único, em vez de variáveis soltas:

```text
CatalogState
  query: string
  category: string | null
  unit: "barra" | "sf" | null
  colors: string[]
  sizes: string[]
  page: number
  openProduct: string | null
```

Parâmetros públicos propostos:

- `q`: busca;
- `cat`: categoria;
- `un`: unidade;
- `co`: uma ou mais cores;
- `tam`: um ou mais tamanhos;
- `p`: código da peça aberta;
- `pg`: quantidade de lotes exibidos quando necessária para restauração.

Compatibilidade:

- manter leitura dos parâmetros públicos atuais;
- normalizar aliases conhecidos para valores canônicos;
- ignorar valores inválidos em vez de produzir uma seleção visual enganosa;
- não escrever parâmetros vazios;
- usar `history.replaceState` durante refinamentos frequentes e `pushState` para mudanças de contexto que devam responder ao botão Voltar, especialmente abrir/fechar galeria;
- responder ao evento `popstate` sem recarregar a página;
- manter URLs legíveis e com ordem estável de parâmetros.

`sessionStorage` pode guardar posição e foco como apoio temporário. A URL continua sendo a fonte compartilhável dos filtros, não o armazenamento do navegador.

## 9. Grade de produtos

### 9.1 Estrutura visual

- duas colunas no mobile, preservando área útil para a fotografia;
- número de colunas adaptável no tablet e desktop;
- proporção consistente para reduzir saltos de layout;
- código, categoria/unidade e ação de salvar com hierarquia discreta;
- controles com alvo mínimo adequado ao toque;
- nenhuma tarja extensa sobre rosto ou área principal da roupa;
- rótulos sobre foto, quando indispensáveis, restritos a bordas seguras e com contraste controlado;
- cartões navegáveis por teclado e foco visível.

### 9.2 Carregamento

- primeiro lote pequeno o suficiente para resposta rápida;
- miniaturas e `loading="lazy"` preservados;
- dimensões ou proporção reservadas antes de a imagem carregar;
- `IntersectionObserver` antecipa o lote seguinte;
- botão **Carregar mais** continua funcional mesmo sem observer;
- o botão desaparece somente quando todos os resultados elegíveis forem exibidos;
- falha de imagem tenta o fallback existente e, se ele também falhar, exibe um placeholder coerente com link/ação ainda utilizável.

## 10. Galeria imersiva

### 10.1 Comportamento

A galeria é uma camada de navegação do catálogo, não uma nova página obrigatória. Ela ocupa a janela de forma imersiva e mantém a grade no DOM.

Controles:

- fechar;
- anterior e próxima peça dentro do conjunto filtrado;
- salvar/remover dos favoritos;
- indicador da peça;
- WhatsApp da unidade correta como CTA principal;
- **Provar em mim** como CTA secundária;
- dados essenciais: código, categoria, cor, tamanho e unidade, quando existirem.

Interações:

- gesto horizontal no touch;
- setas esquerda/direita no teclado;
- Escape fecha;
- Enter/Espaço ativam controles focados;
- foco fica preso dentro do diálogo enquanto aberto;
- ao fechar, foco volta ao cartão que abriu a galeria;
- navegação anterior/próxima atualiza `p` na URL sem perder os filtros;
- uma URL com `p` válido abre diretamente a galeria depois que os dados estiverem prontos;
- um `p` inválido é removido de forma segura e o catálogo permanece utilizável.

### 10.2 Composição face-safe

A fotografia terá uma área central limpa. Informações e ações serão distribuídas em zonas periféricas:

- controles de fechar e salvar nas bordas superiores;
- navegação lateral fora da área central quando houver espaço;
- painel de dados e CTAs na lateral no desktop;
- folha inferior sólida ou com fundo próprio no mobile, sem cobrir permanentemente a modelo;
- gradientes apenas nas bordas e no mínimo necessário para contraste;
- nenhum texto central sobre rosto, colo, vestido ou gesto;
- a foto poderá ser vista integralmente por gesto/ação de ocultar o painel se o viewport for muito baixo.

O desenho usará Ruby, Baunilha e dourado com as famílias Playfair/Arapey/Questrial já adotadas. As transições usarão somente `transform` e `opacity`. Em `prefers-reduced-motion: reduce`, entrada, saída e troca de peça serão imediatas.

### 10.3 Compatibilidade com detalhe existente

`peca.html?codigo=...` continuará válido. A galeria passa a ser a abertura padrão dentro do catálogo; a página de detalhe permanece como rota compatível e fallback compartilhável durante esta fase. Não será removida até que métricas, acessibilidade e compatibilidade sejam validadas.

## 11. Atendimento e conversão

### 11.1 Peça individual

O CTA principal da galeria usa a unidade da peça. A mensagem informa o código e solicita confirmação de disponibilidade, sem afirmar que a peça está disponível naquele instante.

O CTA flutuante compartilhado deverá respeitar o contexto da peça ou seleção atual. Rotas que não possuam uma unidade inequívoca não podem escolher uma loja arbitrariamente.

### 11.2 Favoritos

Favoritos terão uma visualização dedicada acessível pelo catálogo. O armazenamento local existente será mantido ou migrado de forma compatível.

Regras:

- mostrar contagem atualizada;
- permitir remover itens individualmente;
- agrupar visualmente por Barra da Tijuca e São Francisco;
- criar uma ação de atendimento por unidade, nunca enviar itens das duas lojas para um único destino;
- dividir mensagens longas em lotes seguros ou orientar a cliente a enviar por grupo;
- nunca expor uma URL de WhatsApp excessivamente longa;
- identificar códigos que deixaram de existir na base e permitir limpá-los sem quebrar a tela;
- manter o aviso de confirmação de disponibilidade.

## 12. Estados da interface

### 12.1 Carregando

- skeletons com proporção dos cartões;
- texto acessível indicando que o catálogo está sendo carregado;
- sem exibir “nenhuma peça” antes de os dados terminarem de carregar;
- sem bloquear cabeçalho e navegação.

### 12.2 Erro de dados

- mensagem específica de indisponibilidade temporária;
- botão **Tentar novamente**;
- alternativa para falar com a loja sem atribuir uma unidade incorreta;
- evento técnico de falha, sem incluir dados pessoais;
- uma falha não pode apagar favoritos locais.

### 12.3 Nenhum resultado

- explicar que a combinação de filtros não encontrou peças;
- mostrar filtros ativos;
- oferecer **Limpar refinamentos** preservando, quando fizer sentido, a busca ou categoria escolhida;
- não confundir ausência de resultado com erro de rede ou de script.

### 12.4 Falha de imagem

- manter o cartão e os dados úteis;
- apresentar placeholder de marca discreto;
- impedir loop infinito de tentativas;
- permitir abrir galeria/atendimento mesmo sem a fotografia.

## 13. Arquitetura proposta

A implementação continua sem framework e será dividida por responsabilidade para evitar novo script monolítico.

### 13.1 Camada de dados

Responsável por:

- carregar e validar `kl-catalog-data.js`;
- normalizar campos existentes sem inventar conteúdo;
- expor uma interface de leitura estável;
- produzir índices leves de código, categoria, unidade, cor e tamanho;
- diferenciar carregamento, sucesso e erro.

### 13.2 Motor de catálogo

Responsável por:

- estado único;
- leitura e escrita da URL;
- busca;
- refinamentos dependentes;
- mistura determinística;
- lotes e contagem;
- restauração de navegação.

### 13.3 Camada de visualização

Responsável por:

- entrada editorial;
- busca, atalhos e filtros;
- chips ativos;
- grade e skeletons;
- estados de erro/vazio;
- botão de contingência de carregamento.

### 13.4 Galeria

Responsável por:

- ciclo de abertura/fechamento;
- teclado, toque e foco;
- peça anterior/próxima;
- atualização do parâmetro `p`;
- composição face-safe;
- ações principais da peça.

### 13.5 Favoritos e atendimento

Responsável por:

- persistência e migração compatível;
- agrupamento por unidade;
- construção segura das mensagens;
- limite de tamanho;
- escolha do canal correto;
- chamadas para prova virtual.

### 13.6 Telemetria

Responsável por:

- receber o produto e o estado reais por API explícita, sem depender de variáveis lexicais inacessíveis em `window`;
- registrar busca, refinamento, abertura de galeria, troca de peça, favorito, prova virtual, carregamento adicional, erro e WhatsApp;
- reutilizar a infraestrutura atual;
- não mudar configuração, ID ou estratégia do Pixel;
- não registrar texto livre sensível nem informação pessoal.

Os nomes e a quantidade final de arquivos serão definidos no plano de implementação após a aprovação desta especificação. O limite arquitetural é mais importante que o nome físico dos módulos.

## 14. Dados: fase atual e fase Clariai

### Fase 1 — experiência com base existente

- usar as 752 peças existentes;
- normalizar apenas valores equivalentes de forma comprovável;
- não preencher cor, tamanho ou categoria ausentes por inferência visual;
- incluir tamanhos numéricos nos filtros;
- esconder opções sem dados em vez de inventá-las;
- manter código e unidade como chaves de atendimento.

### Fase 2 — reconciliação Clariai

- reconciliar códigos e unidade da Barra;
- definir fonte de verdade e rotina segura de atualização;
- acrescentar campos somente após validação: ocasião, estilo, tecido, coleção, disponibilidade e data de atualização;
- atualizar o script operacional de miniaturas para ler a fonte atual;
- criar relatório de divergências antes de alterar dados publicados;
- não bloquear a fase 1.

## 15. Acessibilidade

Critérios mínimos:

- busca com `<label>` disponível para leitor de tela;
- contador com `aria-live="polite"` e atualizações agrupadas;
- filtros com estado programático (`aria-pressed` ou controles equivalentes);
- grupos de filtros identificados;
- chips removíveis com nome completo;
- cartões e ações navegáveis por teclado;
- foco visível em superfícies claras e escuras;
- galeria com semântica de diálogo modal, nome acessível, foco inicial, foco preso e restauração;
- descrição alternativa útil nas imagens sem afirmar atributos ausentes;
- controles sem depender somente de cor ou ícone;
- alvo de toque mínimo de 44 px, preferindo 48 px nas ações principais;
- suporte a `prefers-reduced-motion`;
- bloqueio de rolagem do fundo sem causar salto de layout;
- ordem de leitura coerente no painel mobile e desktop.

## 16. Desempenho e robustez

- preservar miniaturas, lazy-load e carregamento por lotes;
- evitar nova dependência externa;
- reservar proporção das imagens para reduzir `layout shift`;
- calcular índices uma vez após o carregamento dos dados;
- controlar chamadas da busca e escrita de URL;
- usar delegação de eventos na grade;
- manter navegação funcional se `IntersectionObserver` não existir;
- manter catálogo e rota de detalhe utilizáveis mesmo que a animação falhe;
- não carregar fotos em resolução máxima para todos os cartões;
- medir tamanho transferido, tempo até primeira grade e responsividade antes/depois durante QA.

## 17. Tracking e privacidade

Eventos funcionais propostos:

- catálogo carregado ou falhou;
- busca aplicada, com termo somente se a política atual permitir e sem informação pessoal;
- categoria/unidade/cor/tamanho selecionados;
- lote adicional exibido;
- peça aberta na galeria;
- navegação entre peças;
- favorito adicionado/removido;
- visualização de favoritos;
- clique no WhatsApp com código e unidade;
- clique em **Provar em mim**;
- estado vazio.

O reparo consiste em passar dados reais por uma interface explícita ao tracking existente. Não inclui alterar campanhas, Pixel, consentimento, endpoints ou identificadores de produção.

## 18. Estratégia de testes

### 18.1 Contratos preservados

Os testes atuais continuam protegendo:

- rotas públicas;
- scripts essenciais;
- canais autorizados;
- foco e alvos móveis;
- rodapé e identidade.

### 18.2 Testes comportamentais novos

Cobrir pelo menos:

1. entrada padrão mistura categorias e unidades de forma estável;
2. unidade selecionada atualiza visual, resultados e opções de refinamento;
3. parâmetro inválido é sanitizado sem tela vazia enganosa;
4. busca encontra por código, categoria, cor e tamanho;
5. tamanhos numéricos aparecem quando aplicáveis;
6. cor/tamanho incompatíveis não ficam habilitados;
7. URL reproduz o estado do catálogo;
8. `popstate` restaura filtros e galeria;
9. abrir/fechar galeria preserva rolagem e foco;
10. deep-link de peça abre a galeria correta;
11. teclado e foco da galeria funcionam;
12. favoritos ficam agrupados e roteados por unidade;
13. mensagens longas são limitadas/divididas;
14. `IntersectionObserver` ausente ainda permite carregar tudo;
15. erro de dados, vazio e erro de imagem geram estados distintos;
16. eventos recebem metadados reais da peça;
17. prova virtual mantém a rota existente;
18. `prefers-reduced-motion` remove movimentos não essenciais.

Os testes devem usar ferramentas compatíveis com o repositório atual e evitar introduzir um framework pesado apenas para testá-lo. A escolha exata será feita no plano de implementação com base no menor custo confiável.

### 18.3 Matriz de QA visual

Validar manualmente em:

- 320 px;
- 375 px;
- 768 px;
- 1024 px;
- 1440 px.

Em cada largura verificar:

- tempo e distância até a primeira fileira de produtos;
- legibilidade e hierarquia;
- duas colunas no mobile sem corte de controles;
- nenhuma sobreposição em rostos ou roupa principal;
- filtros e chips sem estouro horizontal indevido;
- abertura, troca e fechamento da galeria;
- painel de CTA sem esconder a fotografia;
- foco, Escape e navegação por teclado;
- retorno exato à grade;
- estados de loading, vazio, erro e imagem quebrada;
- movimento reduzido;
- funcionamento sem JavaScript de animação não essencial.

## 19. Critérios de aceite

A fase 1 estará pronta para aprovação visual quando:

- a cliente vir peças de ambas as unidades em **Todas**;
- a entrada editorial não empurrar excessivamente a grade no mobile;
- busca e filtros produzirem combinações válidas e refletirem a URL;
- cores e tamanhos respeitarem unidade, categoria e busca;
- tamanhos numéricos existentes puderem ser filtrados;
- a galeria abrir sem desmontar o catálogo;
- fechar/Voltar devolverem posição, filtros e foco;
- texto e controles não cobrirem rosto ou área principal do vestido;
- WhatsApp individual usar a unidade da peça;
- favoritos forem agrupados e enviados por unidade;
- **Provar em mim** permanecer funcional como CTA secundária;
- loading, erro, vazio e falha de imagem forem diferentes;
- carregamento manual funcionar sem observer;
- tracking receber dados reais sem mudança de Pixel;
- testes automatizados passarem;
- QA nas cinco larguras não revelar bloqueio funcional ou regressão de identidade;
- o Guilherme aprovar visualmente o resultado local.

## 20. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| O intercalamento parecer artificial | Ordem determinística, sem selos falsos, validada com amostra real das categorias e unidades |
| A galeria cobrir a fotografia no mobile | Painel inferior próprio, área central limpa, possibilidade de reduzir/ocultar painel e QA face-safe |
| URLs antigas quebrarem | Leitura compatível, normalização e testes de parâmetros atuais |
| Favoritos antigos se perderem | Migração compatível e limpeza apenas de códigos comprovadamente inexistentes |
| Mensagem de WhatsApp exceder limite prático | Agrupamento por unidade e divisão em lotes |
| Dados incompletos limitarem filtros | Mostrar somente atributos reais; Clariai fica como fase de enriquecimento |
| Tracking continuar sem metadados | API explícita entre catálogo e módulo de telemetria, com teste de payload |
| Mudança degradar carregamento | Preservar miniaturas/lotes, medir antes/depois e manter botão de contingência |
| Sessões paralelas alterarem o mesmo site | Trabalho em branch e worktree isolados; produção intocada |
| Evolução visual mudar a essência da marca | Preservar fotos, paleta, tipografia, linguagem e rotas; revisão visual antes do deploy |

## 21. Sequência de entrega

1. Aprovação desta especificação escrita.
2. Plano detalhado de implementação com tarefas, arquivos, testes e checkpoints.
3. Implementação em worktree/branch isolados, guiada por testes.
4. Preview local e QA funcional/visual.
5. Ajustes após revisão do Guilherme.
6. Aprovação visual final explícita.
7. Somente então, plano de merge e deploy separado.

Esta aprovação de desenho não autoriza publicação automática em produção.
