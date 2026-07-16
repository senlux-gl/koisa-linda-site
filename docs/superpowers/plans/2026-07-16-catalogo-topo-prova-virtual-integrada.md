# Topo do catálogo e Prova Virtual integrada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liberar a visualização das peças durante a rolagem e integrar a Prova Virtual ao catálogo em um diálogo da própria Koisa Linda, preservando filtros, URLs, histórico, Worker, privacidade e links antigos.

**Architecture:** O catálogo continua em HTML, CSS e JavaScript vanilla com módulos UMD. `KLCatalog.Core` permanece dono do estado canônico e da URL, `KLCatalog.App` passa a coordenar uma única camada de diálogo por vez, e o novo `KLCatalog.TryOn` encapsula seleção, foto, Worker e limpeza de dados transitórios. O painel completo fica no fluxo; um segundo `IntersectionObserver` controla uma barra compacta independente do sentinela de paginação.

**Tech Stack:** HTML5 semântico, CSS3, JavaScript ES2018 em IIFE/UMD, `<dialog>`, `IntersectionObserver`, Node.js `node:test`, Python `unittest`, servidor HTTP da stdlib e QA em navegador real.

---

## Escopo e regras de execução

- Executar no worktree `/Users/guilhermepessanha/.config/superpowers/worktrees/koisa-linda-site/catalogo-topo-prova-modal-20260716`.
- Branch: `codex/catalogo-topo-prova-modal-20260716`.
- Especificação aprovada: `docs/superpowers/specs/2026-07-16-catalogo-topo-prova-virtual-integrada-design.md`.
- Usar `@test-driven-development` para toda mudança funcional.
- Usar `@design-taste-frontend` somente na integração visual, preservando o design atual.
- Usar `@verification-before-completion` antes de declarar cada tarefa concluída.
- Usar `@commit-seguro` antes de cada commit.
- Não alterar `kl-catalog-data.js`, Worker, CORS, Pixel, tracking público, contatos das lojas, campanhas ou infraestrutura.
- Não instalar pacotes, criar `package.json`, migrar framework ou depender de Playwright global.
- Não enviar foto nem executar geração real no Worker durante testes ou QA.
- Não fazer push, merge ou deploy. A publicação exige aprovação visual posterior do Guilherme.
- Não reescrever a especificação e o plano de 15/07. Eles permanecem como histórico supersedido nas decisões explicitadas pela nova spec.

Baseline confirmado em 16/07/2026:

```text
base de código: 5f845897e5c98a37c4ce930980c7fe9600a063f6
branch à frente somente pelos commits de especificação
41/41 testes Python passando
81/81 testes JavaScript passando
768 produtos válidos
nenhuma alteração local fora dos documentos aprovados
```

## Leitura visual obrigatória

```text
Modo: redesign-preserve
Público: noivas, famílias e clientes de festa das duas unidades
Linguagem: editorial premium já existente na Koisa Linda
DESIGN_VARIANCE: 4
MOTION_INTENSITY: 3
VISUAL_DENSITY: 6
Tema: claro, fixado pela identidade atual
Paleta: Ruby, Baunilha, creme e dourado existentes
Tipografia: Playfair/Arapey/Questrial existentes
Raios: cartões discretos; botões e filtros em formato pill
```

Consequências:

- nenhuma nova biblioteca ou linguagem visual;
- nenhuma animação ornamental;
- transições somente para feedback e mudança de estado, usando `transform` e `opacity`;
- nenhum texto sobre rosto ou área principal do vestido;
- modal e barra devem parecer extensões do catálogo atual;
- nenhuma nova cor de destaque, gradiente genérico ou glassmorphism decorativo;
- nenhuma quebra de contraste, foco, alvo de toque ou movimento reduzido.

## Mapa de arquivos

### Criar

- `kl-catalog-tryon.js`: domínio da Prova Virtual, Worker, ciclo de requisição, limpeza e controlador DOM UMD.
- `kl-catalog-tryon.css`: diálogo, seleção, upload e estados responsivos da Prova Virtual.
- `tests/catalog-tryon.test.cjs`: elegibilidade, filtro interno, manequim, Worker mockado, concorrência, privacidade, ciclo DOM e ponte.
- `docs/qa/2026-07-16-catalogo-topo-prova-virtual.md`: evidência automatizada e visual da entrega local.

### Modificar

- `catalogo.html`: barra compacta, sentinela próprio, terceiro diálogo, links e ordem de assets.
- `kl-catalog.css`: painel completo no fluxo e barra compacta sticky.
- `kl-catalog-core.js`: `tryOn` no estado público e semântica dual de `p`.
- `kl-catalog-actions.js`: elegibilidade canônica e novo destino da Prova Virtual.
- `kl-catalog-app.js`: rail, estado, history, camada de diálogos, integração do TryOn e foco.
- `kl-site-enhance.css`: ocultar CTA global enquanto qualquer diálogo estiver ativo.
- `provar.html`: ponte leve com `location.replace()` e fallback manual.
- `sitemap.xml`: remover a rota de transição `noindex`.
- `index.html`, `sobre.html`, `como-chegar.html`, `servicos.html`, `unidades.html`, `noivas.html`, `debutantes.html`, `madrinhas.html`, `ternos.html`, `peca.html`: migrar entradas públicas e atualizar somente cache tokens necessários.
- `tests/helpers/fake-browser.cjs`: observer por alvo, history completo e suporte mínimo a diálogos.
- `tests/catalog-core.test.cjs`: leitura, serialização e derivação do modo Prova Virtual.
- `tests/catalog-actions.test.cjs`: nova URL e allowlist.
- `tests/catalog-app.test.cjs`: rail, history, diálogos, foco, popstate e tracking único.
- `tests/test_site_contract.py`: contratos semânticos, assets, ponte, links, CSS e acessibilidade.
- `tests/site-enhance-routing.test.cjs`: retirar a premissa de que `provar.html` ainda é a ferramenta operacional.

### Preservar sem alteração

- `kl-catalog-data.js` e todos os 768 produtos;
- `kl-catalog-gallery.js`, salvo se um teste provar que a API atual não permite a transição;
- `kl-tracking.js` e nomes dos eventos existentes;
- URLs das fotos e fotos reais;
- conteúdo, contatos e regras do Worker;
- galeria, favoritos, busca, filtros e paginação fora das mudanças descritas.

## Contratos entre módulos

### Estado público

```javascript
{
  query: '',
  category: null,
  unit: null,
  colors: [],
  sizes: [],
  page: 1,
  openProduct: null,
  tryOn: false,
}
```

- Sem `prova=1`, `openProduct` é a peça da galeria e deve pertencer ao conjunto filtrado.
- Com `prova=1`, `openProduct` é a seleção da Prova Virtual e é validada contra a base completa e `Actions.isTryOnEligible()`.
- `p` inválido ou inelegível é removido; `prova=1` e filtros permanecem.
- Filtros do catálogo nunca limitam a lista interna da Prova Virtual.

### History

```javascript
history.state.klCatalog = {
  layer: 'gallery' | 'tryOn',
  origin: 'grid' | 'menu' | 'gallery'
};
```

- Boot com modal na URL é sempre tratado como deep-link não possuído, mesmo se o navegador restaurar `history.state`.
- Abrir galeria ou Prova Virtual dentro do catálogo usa um `pushState`.
- Trocar peça dentro da camada atual usa `replaceState` e preserva o marcador existente.
- Fechar uma camada criada localmente usa `history.back()`.
- Fechar deep-link remove somente os parâmetros da camada com `replaceState`.
- `popstate` apenas lê, deriva, renderiza e reconcilia diálogos.

### Camada de diálogo

```javascript
createDialogShell({ body, scrollLock }) -> {
  activate(name),
  clear(options),
  current()
}
```

- Galeria, favoritos e Prova Virtual usam a mesma classe `body.kl-dialog-open`.
- A transição galeria para Prova Virtual não libera nem reaplica o scroll lock.
- Somente um `<dialog>` permanece aberto.
- O CTA global fica oculto enquanto `current()` não for `null`.

### Prova Virtual

```javascript
KLCatalog.TryOn.create(options) -> {
  open(productCode),
  update(productCode),
  close(),
  destroy(),
  isReady(),
  getSnapshot()
}
```

`products` sempre recebe a base completa validada, nunca `galleryProducts`.

Ordem de CSS em `catalogo.html`:

```html
<link rel="stylesheet" href="kl-catalog.css?v=20260716tryon1">
<link rel="stylesheet" href="kl-catalog-tryon.css?v=20260716tryon1">
<link rel="stylesheet" href="kl-site-enhance.css?v=20260716tryon1">
```

Ordem de JavaScript:

```html
<script defer src="kl-catalog-data.js?v=20260715db"></script>
<script defer src="kl-catalog-core.js?v=20260716tryon1"></script>
<script defer src="kl-catalog-actions.js?v=20260716tryon1"></script>
<script defer src="kl-catalog-gallery.js?v=20260715catalog1"></script>
<script defer src="kl-tracking.js?v=20260715catalog1"></script>
<script defer src="kl-catalog-tryon.js?v=20260716tryon1"></script>
<script defer src="kl-catalog-app.js?v=20260716tryon1"></script>
```

## Comandos compartilhados

Gate rápido:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
node --check kl-catalog-core.js
node --check kl-catalog-actions.js
node --check kl-catalog-gallery.js
node --check kl-catalog-tryon.js
node --check kl-catalog-app.js
node --check kl-site-enhance.js
git diff --check
```

Gate obrigatório antes de cada commit:

```bash
git status --short
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs <arquivos-da-tarefa>
git add <arquivos-da-tarefa>
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
```

Todo commit usa o trailer:

```text
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

### Task 0: Revalidar o baseline isolado

**Files:**
- Verify only: repository and test suites

- [ ] **Step 1: Confirmar branch, worktree e ausência de mudanças concorrentes**

```bash
git status --short --branch
git rev-parse HEAD
git log --oneline --left-right HEAD...origin/main
```

Expected: somente commits de documentação à frente de `5f84589`; nenhum arquivo funcional modificado. Se `origin/main` tiver avançado, revisar o diff antes de rebase. Não resolver conflito automaticamente.

- [ ] **Step 2: Rodar o baseline completo**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
```

Expected: 41 Python e 81 JavaScript passando. Qualquer falha anterior à feature é drift de baseline e deve ser investigada antes de editar código.

### Task 1: Adicionar o modo Prova Virtual ao estado e às URLs

**Files:**
- Modify: `tests/catalog-core.test.cjs`
- Modify: `tests/catalog-actions.test.cjs`
- Modify: `kl-catalog-core.js:65-99,177-209,236-251`
- Modify: `kl-catalog-actions.js:19-38,264-276`

- [ ] **Step 1: Escrever testes falhos de leitura, serialização e dualidade de `p`**

Atualizar `defaultState()` e expectativas existentes com `tryOn:false`. Adicionar:

```javascript
test('prova=1 preserva p elegível fora dos filtros da grade', () => {
  const requested = Core.readState('?cat=ternos&un=sf&pg=3&prova=1&p=NV-001', fixtures);
  const view = Core.derive(fixtures, requested, {
    isTryOnEligible: product => product.c === 'vestidos-noiva',
  });
  assert.equal(view.state.tryOn, true);
  assert.equal(view.state.openProduct, 'NV-001');
  assert.equal(view.state.page, 3);
});

test('p inelegível é removido sem fechar a prova nem apagar filtros', () => {
  const requested = Core.readState('?cat=ternos&prova=1&p=TR-001', fixtures);
  const view = Core.derive(fixtures, requested, {
    isTryOnEligible: product => product.c.startsWith('vestidos-'),
  });
  assert.equal(view.state.tryOn, true);
  assert.equal(view.state.openProduct, null);
  assert.equal(view.state.category, 'ternos');
});

test('serializeState escreve prova antes de p e ignora outros valores', () => {
  const state = Core.readState('?prova=sim&p=NV-001', fixtures);
  assert.equal(state.tryOn, false);
  assert.equal(Core.serializeState(defaultState({ tryOn: true, openProduct: 'NV-001' })), 'prova=1&p=NV-001');
});
```

- [ ] **Step 2: Escrever o teste falho da nova ação pública**

```javascript
test('CTA da prova integrada usa catálogo e a allowlist canônica', () => {
  assert.equal(Actions.isTryOnEligible(fixtures[0]), true);
  assert.equal(
    Actions.tryOnHref({ ...fixtures[0], k: ' nv 001/azul ' }),
    'catalogo.html?prova=1&p=NV%20001%2FAZUL',
  );
  assert.equal(Actions.isTryOnEligible(fixtures.find(item => item.c === 'ternos')), false);
});
```

- [ ] **Step 3: Rodar os testes e confirmar RED**

```bash
node --test tests/catalog-core.test.cjs tests/catalog-actions.test.cjs
```

Expected: falhas por `tryOn` e `isTryOnEligible` inexistentes e pelo href antigo.

- [ ] **Step 4: Implementar a menor mudança canônica**

Em Actions:

```javascript
function isTryOnEligible(product) {
  return Boolean(product && TRY_ON_CATEGORIES.indexOf(product.c) > -1);
}

function tryOnHref(product) {
  var code = normalizeCode(product && product.k);
  return isTryOnEligible(product) && code
    ? 'catalogo.html?prova=1&p=' + encodeURIComponent(code)
    : null;
}
```

Em Core:

```javascript
var tryOn = params.get('prova') === '1';

function resolveTryOnProduct(products, state, isEligible) {
  var next = Object.assign({}, state);
  if (!next.openProduct) return next;
  var code = normalizeCode(next.openProduct);
  var product = products.find(function (item) {
    return normalizeCode(item.k) === code;
  });
  next.openProduct = product && typeof isEligible === 'function' && isEligible(product)
    ? normalizeCode(product.k)
    : null;
  return next;
}
```

`derive()` chama `resolveTryOnProduct()` quando `state.tryOn` for verdadeiro e mantém `resolveOpenProduct()` para galeria. `serializeState()` escreve `prova=1` somente quando verdadeiro.

- [ ] **Step 5: Rodar GREEN e regressão dos módulos**

```bash
node --test tests/catalog-core.test.cjs tests/catalog-actions.test.cjs
node --test tests/catalog-gallery.test.cjs tests/site-enhance-routing.test.cjs
node --check kl-catalog-core.js
node --check kl-catalog-actions.js
```

Expected: todos passam; galeria continua com o comportamento anterior quando `tryOn=false`.

- [ ] **Step 6: Fazer commit seguro**

```bash
git add kl-catalog-core.js kl-catalog-actions.js tests/catalog-core.test.cjs tests/catalog-actions.test.cjs
git commit -m "feat(catalogo): adiciona estado da prova integrada" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Colocar os filtros completos no fluxo e criar a barra compacta

**Files:**
- Modify: `catalogo.html:158-196`
- Modify: `kl-catalog.css:136-145,948-1053,1135-1140`
- Modify: `tests/test_site_contract.py:623-787`

- [ ] **Step 1: Escrever contratos estáticos falhos**

Adicionar em `CatalogHybridContractTest`:

```python
def test_catalog_full_filters_are_in_flow_and_compact_rail_is_semantic(self):
    html = page("catalogo.html")
    self.assertIn('id="catalog-filters"', html)
    self.assertIn('id="catalog-filter-sentinel"', html)
    self.assertIn('id="catalog-filter-rail" class="catalog-filter-rail" hidden', html)
    self.assertIn('id="catalog-adjust-filters"', html)
    self.assertIn('aria-controls="catalog-filters"', html)
    self.assertLess(html.index('id="catalog-filter-sentinel"'), html.index('id="catalog-filter-rail"'))
    self.assertLess(html.index('id="catalog-filter-rail"'), html.index('id="catalog-results"'))

def test_catalog_filter_rail_is_sticky_mobile_safe_and_filters_are_not_sticky(self):
    css = page("kl-catalog.css")
    tools = balanced_css_block(css, ".catalog-tools").replace(" ", "")
    rail = balanced_css_block(css, ".catalog-filter-rail").replace(" ", "")
    self.assertNotIn("position:sticky", tools)
    self.assertIn("position:sticky", rail)
    self.assertIn("z-index:40", rail)
    self.assertIn(".catalog-filter-rail[hidden]", css)
```

- [ ] **Step 2: Rodar os dois testes e confirmar RED**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  tests.test_site_contract.CatalogHybridContractTest.test_catalog_full_filters_are_in_flow_and_compact_rail_is_semantic \
  tests.test_site_contract.CatalogHybridContractTest.test_catalog_filter_rail_is_sticky_mobile_safe_and_filters_are_not_sticky -v
```

Expected: falha por markup e CSS ausentes.

- [ ] **Step 3: Adicionar markup sem remover ou recolher nenhum filtro**

O fim do painel deve ser:

```html
<p id="catalog-count" class="catalog-count" aria-live="polite">Carregando catálogo…</p>
<div id="catalog-filter-sentinel" class="catalog-filter-sentinel" aria-hidden="true"></div>
</section>

<section id="catalog-filter-rail" class="catalog-filter-rail" aria-label="Resumo e ajuste do catálogo" hidden>
  <div class="catalog-filter-rail-inner">
    <div class="catalog-filter-rail-summary">
      <span id="catalog-filter-rail-count">Carregando catálogo…</span>
      <span id="catalog-filter-rail-category">Todas as categorias</span>
    </div>
    <fieldset id="catalog-filter-rail-units" class="catalog-filter-rail-units">
      <legend class="catalog-sr-only">Unidade</legend>
      <button type="button" data-unit="" aria-pressed="true">Todas</button>
      <button type="button" data-unit="barra" aria-pressed="false">Barra da Tijuca</button>
      <button type="button" data-unit="sf" aria-pressed="false">São Francisco</button>
    </fieldset>
    <button id="catalog-adjust-filters" type="button" aria-controls="catalog-filters">Ajustar filtros</button>
  </div>
</section>
```

O contador compacto não recebe outro `aria-live`.

- [ ] **Step 4: Mover o sticky para a barra compacta**

Preservar fundo e borda do painel completo, mas remover `position`, `top` e `z-index`. Adicionar `scroll-margin-top`. A barra usa `top:var(--catalog-header-offset,71px)`, `z-index:40`, fundo creme, borda e fallback de transparência. Botões têm 44 px, foco visível e estado pressionado.

No mobile até 680 px, ocultar somente categoria compacta e unidades compactas. Não alterar a exposição atual de cores e tamanhos no painel completo.

- [ ] **Step 5: Rodar GREEN e regressão CSS**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract.CatalogHybridContractTest -v
```

Expected: contratos novos e anteriores passam.

- [ ] **Step 6: Fazer commit seguro**

```bash
git add catalogo.html kl-catalog.css tests/test_site_contract.py
git commit -m "feat(catalogo): cria barra compacta de filtros" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Ligar o rail ao estado canônico sem scroll listener

**Files:**
- Modify: `tests/helpers/fake-browser.cjs:332-452`
- Modify: `tests/catalog-app.test.cjs`
- Modify: `kl-catalog-app.js:118-143,311-339,531-544,679-838,1384-1475`

- [ ] **Step 1: Expandir o fake browser somente com capacidades reais necessárias**

Montar o novo sentinela, rail, contador, categoria, botão de ajuste e três unidades. Adicionar:

```javascript
triggerIntersectionFor(node, entry) {
  observers
    .filter(observer => observer.observed.includes(node) && !observer.disconnected)
    .forEach(observer => observer.callback([entry]));
}
```

Preservar `triggerIntersection()` como helper da paginação.

- [ ] **Step 2: Escrever testes falhos do observer e fallback**

```javascript
test('barra compacta só aparece quando o sentinela passa acima do cabeçalho', () => {
  const { browser } = mountBrowser({ raw: fixtures });
  browser.triggerDOMContentLoaded();
  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: false,
    boundingClientRect: { top: 900 },
  });
  assert.equal(browser.nodes.filterRail.hidden, true);
  browser.triggerIntersectionFor(browser.nodes.filterSentinel, {
    isIntersecting: false,
    boundingClientRect: { top: 60 },
  });
  assert.equal(browser.nodes.filterRail.hidden, false);
});
```

Adicionar caso sem `IntersectionObserver`, retorno do sentinela visível e assert de `rootMargin` superior negativo.

- [ ] **Step 3: Escrever testes falhos de sincronização, no-op e troca real**

Cobrir:

- os dois grupos pressionam a mesma unidade;
- textos de contagem são idênticos;
- categoria compacta usa rótulo humano;
- unidade já ativa gera zero history, render e `KL_Filter_Change`;
- troca pela barra redefine página, remove `p`, usa `replaceState`, não força scroll e emite um único `KL_Filter_Change` com `source:'filter-rail'`.

- [ ] **Step 4: Escrever testes falhos de Ajustar filtros**

Verificar `scrollIntoView({block:'start',behavior:'smooth'})`, foco em categoria com `preventScroll:true`, nenhuma mudança de URL/tracking/grade e `behavior:'auto'` sob movimento reduzido.

- [ ] **Step 5: Rodar os testes e confirmar RED**

```bash
node --test tests/catalog-app.test.cjs
```

Expected: falhas por controlador, DOM e métodos inexistentes.

- [ ] **Step 6: Implementar `createFilterRailController()`**

Contrato mínimo:

```javascript
function shouldShowFilterRail(entry, headerOffset) {
  return Boolean(
    entry
    && !entry.isIntersecting
    && entry.boundingClientRect
    && Number(entry.boundingClientRect.top) <= Number(headerOffset || 0)
  );
}
```

O controller inicia com `hidden=true`, usa um segundo observer, mede a altura real do header para `rootMargin` e custom property, e mantém oculto sem IO. Nenhum `window.addEventListener('scroll')`.

- [ ] **Step 7: Implementar sincronização e ação única de unidade**

```javascript
function setUnitFilter(rawUnit, source) {
  var unit = Core.UNIT_IDS.indexOf(rawUnit) > -1 ? rawUnit : null;
  if (unit === state.unit) return false;
  return patchFilters({ unit: unit }, source || 'unit');
}
```

O painel completo usa `source:'unit'`; a barra usa `source:'filter-rail'`. `syncShellState()` atualiza os dois arrays. Centralizar o texto em `syncResultSummary(text)` para não criar um segundo contador de estado.

- [ ] **Step 8: Implementar Ajustar filtros e rodar GREEN**

```bash
node --test tests/catalog-app.test.cjs
node --check kl-catalog-app.js
```

Expected: rail, paginação e filtros passam sem eventos duplicados.

- [ ] **Step 9: Fazer commit seguro**

```bash
git add kl-catalog-app.js tests/catalog-app.test.cjs tests/helpers/fake-browser.cjs
git commit -m "feat(catalogo): ativa resumo sticky dos filtros" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 4: Extrair domínio e cliente do Worker da Prova Virtual

**Files:**
- Create: `tests/catalog-tryon.test.cjs`
- Create: `kl-catalog-tryon.js`

- [ ] **Step 1: Escrever testes falhos das funções puras**

Cobrir:

```javascript
test('lista interna usa a base completa e só categorias elegíveis', () => {
  const eligible = TryOn.filterEligibleProducts(fixtures, Actions.isTryOnEligible);
  assert.deepEqual(eligible.map(item => item.k).sort(), ['DB-010', 'MD-020', 'NV-001', 'NV-002']);
});

test('manequim nunca declara que o vestido não serve', () => {
  assert.deepEqual(TryOn.fitFor({ t: 'M' }, 'M'), { kind: 'ok', label: 'cabe' });
  assert.deepEqual(TryOn.fitFor({ t: 'P' }, 'M'), { kind: 'adjust', label: 'ajustável' });
  assert.deepEqual(TryOn.fitFor({ t: 'Único' }, 'M'), { kind: 'made', label: 'sob medida' });
});
```

Adicionar busca por código/cor sem diacríticos, categoria interna, lote 24 e WhatsApp por unidade com fallback `unidades.html`.

- [ ] **Step 2: Escrever testes falhos do Worker mockado**

Casos obrigatórios:

- POST usa `garment_url` sem query e `image_b64` somente após ação explícita;
- polling a cada 2.500 ms;
- sucesso retorna imagem e saldo;
- 429/limite, JSON inválido, status error, timeout e rede são estados distintos;
- resposta atrasada após `guard.invalidate()` retorna cancelado e não aplica estado;
- nenhum erro inclui base64, nome de arquivo ou resposta bruta.

API a testar:

```javascript
const client = TryOn.createWorkerClient({ fetch, wait, now, workerUrl });
const result = await client.run({ garmentUrl, imageBase64, isCurrent });
```

- [ ] **Step 3: Confirmar RED**

```bash
node --test tests/catalog-tryon.test.cjs
```

Expected: falha porque o módulo não existe.

- [ ] **Step 4: Criar UMD e helpers mínimos**

O módulo não toca `document` ao ser carregado por CommonJS. Exportar:

```text
DEFAULT_WORKER_URL
filterEligibleProducts
filterProducts
fitFor
createRequestGuard
createWorkerClient
resultWhatsAppHref
shouldInterceptLink
create
```

`shouldInterceptLink()` segue a mesma regra de clique primário sem modificadores usada pela galeria.

- [ ] **Step 5: Implementar o cliente com token após todo await**

O ciclo é `POST /tryon`, espera, `GET /status?id=...`, timeout em 90 s. `isCurrent()` é verificado antes e depois de cada espera/fetch. Nenhuma função faz `console.log()` de payload ou resposta.

- [ ] **Step 6: Rodar GREEN, sintaxe e privacidade**

```bash
node --test tests/catalog-tryon.test.cjs
node --check kl-catalog-tryon.js
rg -n "console\.(log|debug)|File\.name|query_text|image_b64.*track" kl-catalog-tryon.js
```

Expected: testes passam e `rg` não encontra vazamento.

- [ ] **Step 7: Fazer commit seguro**

```bash
git add kl-catalog-tryon.js tests/catalog-tryon.test.cjs
git commit -m "feat(catalogo): extrai motor da prova virtual" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Construir o diálogo acessível e o ciclo de privacidade

**Files:**
- Modify: `catalogo.html:125-132,199-228`
- Create: `kl-catalog-tryon.css`
- Modify: `kl-catalog-tryon.js`
- Modify: `tests/catalog-tryon.test.cjs`
- Modify: `tests/test_site_contract.py`

- [ ] **Step 1: Escrever contratos estáticos falhos do terceiro diálogo**

Exigir:

- `<dialog id="catalog-tryon" aria-labelledby="tryon-title" aria-describedby="tryon-description">`;
- botão fechar de 48 px;
- título focável programaticamente;
- labels reais para busca e arquivo;
- IDs prefixados `tryon-`;
- estados loading/result/error com `aria-live` adequado;
- CSS 100dvh em mobile, rolagem interna, sem overflow horizontal;
- animações apenas em `transform` e `opacity` e fallback reduced motion;
- nenhuma ação fixa cobre a seleção, upload ou resultado.

- [ ] **Step 2: Escrever testes falhos do controller DOM**

Com `options.elements` e fakes explícitos, provar:

- `open('NV-001')` reinicia formulário e seleciona apenas `NV-001`;
- `open(null)` não reaproveita seleção anterior;
- cada `open()` posiciona o foco no título ou no primeiro controle útil;
- categoria, busca e manequim não apagam uma seleção já feita;
- card é botão com `aria-pressed`;
- seleção chama `onSelectionChange(code)` uma vez;
- a ação explícita de limpar chama `onSelectionChange(null)` uma vez, limpa somente a seleção e não reinicia busca, categoria ou manequim;
- miniatura começa em `Core.thumbUrl(product)`, a primeira falha tenta `product.u` e uma segunda falha não repete a tentativa nem entra em loop;
- foto usa object URL apenas para preview e só é lida no submit;
- `close()` invalida requisição, aborta quando possível, revoga object URLs e limpa foto, input, resultado e erro;
- reabrir nunca restaura foto ou resultado;
- `destroy()` remove listeners.

- [ ] **Step 3: Confirmar RED**

```bash
node --test tests/catalog-tryon.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract.CatalogHybridContractTest -v
```

- [ ] **Step 4: Adicionar marcação estática preservando o conteúdo funcional**

Usar os IDs:

```text
tryon-title, tryon-description, tryon-close
tryon-sizes, tryon-categories, tryon-search, tryon-dresses, tryon-more
tryon-clear-selection
tryon-photo, tryon-file, tryon-preview, tryon-submit
tryon-form, tryon-loading, tryon-result, tryon-result-image
tryon-again, tryon-error, tryon-error-message, tryon-whatsapp
```

Usar `img/prova-virtual-exemplo.webp` como guia real. Código/caption fica no fluxo abaixo da foto, nunca sobre rosto ou vestido.

- [ ] **Step 5: Implementar CSS no sistema existente**

Desktop usa diálogo amplo dentro do catálogo, com cabeçalho, rolagem interna e composição equilibrada. Mobile usa `width:100vw`, `height:100dvh`, `max-height:none` e raio zero. Manter Ruby como único destaque e alvos de 44/48 px.

- [ ] **Step 6: Implementar `TryOn.create()`**

`open()` sempre chama reset transitório antes de reconstruir seleção do código. `close()` limpa toda informação sensível. Manequim pode persistir em `kl_manequim`. Busca interna, categoria e manequim nunca entram na URL ou tracking. O botão `#tryon-clear-selection` limpa o estado visual e chama `onSelectionChange(null)`; ele não altera os filtros internos. Cada card começa com `Core.thumbUrl(product)` e guarda um marcador privado de tentativa: no primeiro `error`, troca uma única vez para `product.u`; no segundo, remove a origem e mostra o estado indisponível, sem loop.

- [ ] **Step 7: Rodar GREEN e auditoria de copy**

```bash
node --test tests/catalog-tryon.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract.CatalogHybridContractTest -v
node --check kl-catalog-tryon.js
rg -n "—|–" catalogo.html kl-catalog-tryon.css kl-catalog-tryon.js
```

Expected: zero dash longo em texto visível e todos os testes passam.

- [ ] **Step 8: Fazer commit seguro**

```bash
git add catalogo.html kl-catalog-tryon.css kl-catalog-tryon.js tests/catalog-tryon.test.cjs tests/test_site_contract.py
git commit -m "feat(catalogo): monta dialogo da prova virtual" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: Generalizar history e scroll lock para uma camada por vez

**Files:**
- Modify: `tests/catalog-app.test.cjs:223-279`
- Modify: `tests/helpers/fake-browser.cjs`
- Modify: `kl-catalog-app.js:173-293,967-1077,1230-1382`
- Modify: `kl-site-enhance.css`

- [ ] **Step 1: Escrever testes falhos do controlador de camada**

```javascript
test('grid, galeria e prova formam entradas reversíveis sem duplicar history', () => {
  const history = createHistory('/catalogo.html');
  const controller = App.createLayerHistoryController(history, { initialLayer: null });
  controller.openLayer('gallery', '/catalogo.html?p=NV-001', 'grid');
  controller.openLayer('tryOn', '/catalogo.html?prova=1&p=NV-001', 'gallery');
  controller.replaceCurrent('/catalogo.html?prova=1&p=NV-002');
  assert.equal(history.snapshot().entries.length, 3);
  assert.equal(controller.requestClose('tryOn', '/catalogo.html?p=NV-001'), 'back');
});
```

Adicionar:

- deep-link fecha por replace;
- reload com marcador restaurado ainda é deep-link não owned;
- `popstate` nunca escreve;
- marcador da galeria reaparece ao voltar da Prova Virtual.

- [ ] **Step 2: Escrever testes falhos do `createDialogShell()`**

Provar que gallery para tryOn mantém um lock, `clear()` restaura exatamente uma vez, body class acompanha estado e `clear({restoreScroll:false})` funciona no pagehide.

- [ ] **Step 3: Confirmar RED**

```bash
node --test tests/catalog-app.test.cjs
```

- [ ] **Step 4: Implementar controller genérico**

API:

```text
openLayer(layer, url, origin)
replaceCurrent(url)
requestClose(layer, cleanUrl)
onPopState(historyState)
currentLayer()
currentOrigin()
```

`replaceCurrent()` preserva o state existente. Isso impede que uma seleção feita em deep-link passe a ser considerada uma entrada possuída.

- [ ] **Step 5: Implementar shell compartilhado**

`activate(name)` só chama `scrollLock.lock()` quando não havia camada. Trocar o nome ativo não desbloqueia. `clear()` remove `kl-dialog-open`, desbloqueia e restaura posição conforme opção.

- [ ] **Step 6: Migrar galeria e favoritos sem mudar o contrato externo**

Galeria continua usando a mesma API de `KLCatalog.Gallery`. Favoritos ativa/limpa o shell. O CTA global é ocultado por:

```css
body.kl-dialog-open .kl-sticky-cta {
  display:none!important;
}
```

- [ ] **Step 7: Rodar regressão de galeria e App**

```bash
node --test tests/catalog-app.test.cjs tests/catalog-gallery.test.cjs
node --check kl-catalog-app.js
```

Expected: comportamento anterior da galeria continua verde; novos testes de camada passam.

- [ ] **Step 8: Fazer commit seguro**

```bash
git add kl-catalog-app.js kl-site-enhance.css tests/catalog-app.test.cjs tests/helpers/fake-browser.cjs
git commit -m "refactor(catalogo): coordena camadas de dialogo" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Integrar menu, galeria e Prova Virtual ao mesmo diálogo

**Files:**
- Modify: `catalogo.html`
- Modify: `kl-catalog-app.js:23-58,311-339,721-766,967-1077,1258-1447`
- Modify: `tests/catalog-app.test.cjs`
- Modify: `tests/helpers/fake-browser.cjs`

- [ ] **Step 1: Escrever a matriz falha de entrada e saída**

Casos:

1. menu no grid cria `?prova=1`, abre TryOn sem peça e retorna ao grid;
2. Provar em mim na galeria fecha visualmente galeria, abre TryOn com a peça e mantém um único lock;
3. trocar vestido usa replace e não adiciona history;
4. limpar vestido remove somente `p` por replace, preserva `prova=1`, filtros, busca interna, categoria e manequim e não adiciona history;
5. voltar da Prova Virtual reabre galeria com a mesma peça, lote renderizado e posição e foca `#gallery-try-on`;
6. voltar de abertura pelo menu restaura grid, lote, posição e foco do link;
7. deep-link válido abre TryOn mesmo que filtros excluam o vestido;
8. deep-link inelegível mantém TryOn sem seleção e normaliza apenas `p`;
9. Escape e botão fechar usam a mesma máquina;
10. clique modificado não é interceptado;
11. cada clique em Provar em mim emite exatamente um `KL_Try_On_Click`.

- [ ] **Step 2: Escrever testes falhos de popstate, storage e pagehide**

Verificar:

- `popstate` faz zero push/replace;
- `restoreKey()` remove `tryOn` e `openProduct`;
- `readPendingRestore()` ignora estado modal;
- pagehide fecha TryOn, limpa foto e libera lock sem scroll;
- resposta tardia não altera diálogo reaberto.

- [ ] **Step 3: Confirmar RED**

```bash
node --test tests/catalog-app.test.cjs tests/catalog-tryon.test.cjs
```

- [ ] **Step 4: Criar um único wrapper de derivação**

```javascript
function deriveState(nextState) {
  return Core.derive(products, nextState, {
    isTryOnEligible: Actions.isTryOnEligible,
  });
}
```

Substituir todas as chamadas de `Core.derive()` do App por este wrapper.

- [ ] **Step 5: Criar `setupTryOn()` e callbacks canônicos**

`TryOn.create()` recebe a base `products`, não `galleryProducts`. `onSelectionChange(code)` aceita código ou `null`, cria o próximo estado alterando somente `openProduct`, mantém `tryOn:true` e todos os filtros, chama exatamente uma vez `historyController.replaceCurrent(urlFor(state))` e nunca faz `pushState`, tracking ou render duplicado. Com `null`, a URL perde somente `p` e mantém `prova=1`. `onRequestClose` usa a mesma função para botão, backdrop e Escape.

- [ ] **Step 6: Interceptar somente clique primário simples**

No catálogo, marcar menu desktop/mobile com `data-catalog-tryon-entry`. O link mantém `href="catalogo.html?prova=1"`. O `#gallery-try-on` mantém o href real de Actions. Ctrl, Cmd, Shift, Alt e botão do meio continuam navegando normalmente.

- [ ] **Step 7: Centralizar `reconcileDialogs(state)`**

Prioridade:

```text
state.tryOn = true        -> fecha gallery, ativa tryOn
state.tryOn = false e p   -> fecha tryOn, ativa gallery
sem camada               -> fecha ambos e limpa shell
```

O boot cria componentes primeiro e só então chama a reconciliação. `setupGallery()` não abre deep-link por conta própria.

- [ ] **Step 8: Rodar GREEN e regressão funcional**

```bash
node --test tests/catalog-app.test.cjs tests/catalog-tryon.test.cjs tests/catalog-gallery.test.cjs
node --check kl-catalog-app.js
```

- [ ] **Step 9: Fazer commit seguro**

```bash
git add catalogo.html kl-catalog-app.js tests/catalog-app.test.cjs tests/helpers/fake-browser.cjs
git commit -m "feat(catalogo): integra prova virtual ao historico" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Migrar entradas públicas e transformar `provar.html` em ponte

**Files:**
- Modify: `provar.html`
- Modify: `index.html`
- Modify: `sobre.html`
- Modify: `catalogo.html`
- Modify: `como-chegar.html`
- Modify: `servicos.html`
- Modify: `unidades.html`
- Modify: `noivas.html`
- Modify: `debutantes.html`
- Modify: `madrinhas.html`
- Modify: `ternos.html`
- Modify: `peca.html`
- Modify: `sitemap.xml`
- Modify: `tests/catalog-tryon.test.cjs`
- Modify: `tests/test_site_contract.py`
- Modify: `tests/site-enhance-routing.test.cjs`

- [ ] **Step 1: Escrever contratos falhos da ponte e das 19 entradas**

Exigir:

- nenhum `href="provar.html"` nos 11 HTMLs;
- exatamente `catalogo.html?prova=1` nas entradas públicas;
- `provar.html` com `noindex`, shell, link manual, `<noscript>` e uma chamada `location.replace`;
- ponte descarta parâmetros extras e hash;
- código recebe trim, uppercase, limite e validação sintática leve;
- ponte não contém Data/Core/Actions/TryOn, `fetch`, file input, Worker ou WhatsApp;
- `provar.html` não está no sitemap;
- Actions continua produzindo o deep-link por peça.

- [ ] **Step 2: Testar o script da ponte em VM antes de reescrever**

Adicionar casos no teste JavaScript:

```text
sem p                 -> catalogo.html?prova=1
p=nv-001              -> catalogo.html?prova=1&p=NV-001
p vazio/inválido      -> catalogo.html?prova=1
p válido + lixo/hash  -> somente prova e p
link manual           -> igual ao alvo do replace
replace count         -> exatamente 1
```

- [ ] **Step 3: Confirmar RED**

```bash
node --test tests/catalog-tryon.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract -v
```

- [ ] **Step 4: Reescrever a ponte de forma leve**

O script calcula primeiro o alvo e atualiza o link manual. Depois chama `location.replace(target.href)` uma vez. O catálogo completo faz a validação semântica do código e da categoria.

- [ ] **Step 5: Trocar os 19 links e remover a ponte do sitemap**

Executar substituição somente nos arquivos listados. Não fazer replace global em specs, planos ou memória histórica.

- [ ] **Step 6: Atualizar cache tokens dos assets alterados**

Usar `20260716tryon1` apenas para Core, Actions, App, catálogo CSS, TryOn JS/CSS e site-enhance CSS. Manter Data, Gallery, Tracking e site-enhance JS nas versões atuais se seus conteúdos não mudaram.

- [ ] **Step 7: Atualizar contratos antigos sem enfraquecê-los**

Substituir os testes que exigem a ferramenta completa em `provar.html` por contratos positivos da ponte e do diálogo integrado. Remover `provar.html` da matriz que exige scripts compartilhados. Manter testes de unidade de peça dentro de Actions/TryOn.

- [ ] **Step 8: Rodar GREEN e inventário de referências**

```bash
node --test tests/catalog-tryon.test.cjs tests/catalog-actions.test.cjs tests/site-enhance-routing.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract -v
rg -n 'href="provar\.html|provar\.html\?p=' --glob '*.html' --glob '*.js' --glob '*.xml'
rg -n 'KL_DATA|fetch\(|/tryon|type="file"|wa\.me' provar.html
```

Expected: os dois `rg` finais não encontram referências proibidas. Specs e planos podem conservar menções históricas.

- [ ] **Step 9: Fazer commit seguro**

```bash
git add provar.html index.html sobre.html catalogo.html como-chegar.html servicos.html unidades.html noivas.html debutantes.html madrinhas.html ternos.html peca.html sitemap.xml tests/catalog-tryon.test.cjs tests/test_site_contract.py tests/site-enhance-routing.test.cjs
git commit -m "feat(site): migra entradas da prova virtual" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 9: Rodar regressão, QA visual e registrar evidência

**Files:**
- Create: `docs/qa/2026-07-16-catalogo-topo-prova-virtual.md`
- Modify only if a defect is found: files owned by the failing task

- [ ] **Step 1: Rodar todos os testes e checks**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
node --check kl-catalog-core.js
node --check kl-catalog-actions.js
node --check kl-catalog-gallery.js
node --check kl-catalog-tryon.js
node --check kl-catalog-app.js
node --check kl-tracking.js
node --check kl-site-enhance.js
git diff --check
```

Expected: zero falhas e zero warnings de sintaxe/diff.

- [ ] **Step 2: Subir servidor local sem tocar produção**

```bash
python3 -m http.server 50535 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:50535/catalogo.html`.

- [ ] **Step 3: QA visual nos quatro viewports**

Validar 1440x900, 1024x768, 390x844 e 320x568:

- painel completo idêntico e no fluxo;
- barra aparece somente depois do sentinela subir;
- barra não cobre header, peças nem diálogos;
- mobile mostra resumo e Ajustar filtros sem overflow;
- unidades da barra atualizam grade, URL e contador;
- menu abre diálogo sem peça;
- galeria abre diálogo com peça correta;
- Voltar retorna à galeria ou grid correto;
- foco, Escape, backdrop e movimento reduzido;
- CTA global oculto durante qualquer diálogo;
- nenhum texto cobre rosto ou área principal do vestido;
- 100dvh funcional em 390 e 320;
- nenhum Worker real é acionado.

- [ ] **Step 4: QA funcional sem geração real**

Usar arquivo local somente até o preview, sem pressionar o submit contra o Worker. Confirmar limpeza ao fechar e reabrir. Estados de sucesso/erro/timeout ficam cobertos pelos mocks automatizados.

- [ ] **Step 5: Executar pre-flight visual e de copy**

Auditar contraste, labels, placeholders, foco, botões sem wrap, tema claro único, paleta única, raios consistentes, ausência de dash longo e ausência de listener de scroll.

- [ ] **Step 6: Registrar evidência**

`docs/qa/2026-07-16-catalogo-topo-prova-virtual.md` deve conter:

```text
commit base e HEAD
comandos e totais de testes
viewports testados
fluxos testados
confirmação de Worker não acionado
capturas locais ou caminhos de evidência
defeitos encontrados e correções
pendência explícita de aprovação antes do deploy
```

- [ ] **Step 7: Fazer commit seguro da evidência e correções finais**

```bash
git add docs/qa/2026-07-16-catalogo-topo-prova-virtual.md <correções-finais-se-houver>
git commit -m "test(catalogo): registra QA da prova integrada" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Parar antes de produção**

Entregar ao Guilherme URL local, resumo dos testes, capturas, branch e commits. Pedir aprovação visual explícita. Não fazer push ou merge nesta tarefa.
