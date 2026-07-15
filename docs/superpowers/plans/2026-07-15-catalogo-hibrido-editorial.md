# Catálogo híbrido editorial da Koisa Linda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o catálogo atual numa experiência híbrida editorial, pesquisável e imersiva, com peças das duas unidades, filtros coerentes, galeria face-safe, favoritos por loja e atendimento contextual, sem alterar produção antes da aprovação visual final.

**Architecture:** A implementação permanece em HTML, CSS e JavaScript vanilla. O monólito inline de `catalogo.html` será dividido em quatro módulos UMD testáveis (`Core`, `Actions`, `Gallery`, `App`) sob um único namespace `window.KLCatalog`, enquanto `kl-tracking.js` continua sendo a fronteira de telemetria e o App permanece como único dono de URL/history. A fonte `window.KL_DATA`, as rotas públicas, o Pixel, a prova virtual e os contatos públicos existentes são preservados. Dados inválidos são bloqueados antes de qualquer inferência de unidade; nenhuma peça malformada pode aparecer como Barra por fallback.

**Tech Stack:** HTML5 semântico, CSS3, JavaScript ES2018 em IIFEs/UMD, Node.js 22 `node:test`, Python 3 `unittest`, servidor HTTP da stdlib e QA em navegador real.

---

## Regras de execução

- Executar em `/Users/guilhermepessanha/.config/superpowers/worktrees/koisa-linda-site/codex-kl-catalogo-hibrido-20260715`.
- Branch: `codex/kl-catalogo-hibrido-20260715`.
- Usar `@test-driven-development` em toda mudança funcional.
- Usar `@design-taste-frontend` ao implementar o shell, os cartões e a galeria.
- Usar `@verification-before-completion` antes de declarar qualquer tarefa ou entrega concluída.
- Usar `@commit-seguro` antes de cada commit.
- Não modificar `kl-catalog-data.js` nesta fase.
- Não instalar pacote, criar `package.json`, migrar framework ou depender do Playwright global.
- Não alterar ID/configuração do Pixel, Worker da prova virtual, contatos públicos, DNS, campanha ou produção.
- Não fazer push, merge ou deploy neste plano.
- A reconciliação Clariai é fase 2 e não entra nas tarefas abaixo.

Baseline confirmado e reconciliado em 15/07/2026:

```text
Node v22.22.1
Python 3.14.4
origin/main em abe1867
768 peças, sete categorias, 551 peças da Barra e 217 de São Francisco
0 códigos duplicados e 0 campos obrigatórios/unidades ausentes ou inválidos
23/24 testes Python passando antes da feature: somente o hash congelado de kl-catalog-data.js ficou obsoleto após a entrada legítima de 16 debutantes
branch isolada rebased sobre origin/main e à frente apenas pelos commits da especificação
```

## Mapa de arquivos

### Criar

- `kl-catalog-core.js`: normalização, busca, filtros, facetas, mistura determinística, estado, URL, paginação e payload seguro de busca.
- `kl-catalog-actions.js`: contatos já autorizados, WhatsApp contextual, prova virtual, persistência de favoritos, agrupamento por unidade e lotes de até 1.800 caracteres.
- `kl-catalog-gallery.js`: diálogo imersivo, teclado/touch, foco, política de imagens e intenções de navegação; nunca escreve history.
- `kl-catalog-app.js`: bootstrap, estado único, URL/history, shell DOM, grade, filtros, carregamento, favoritos e coordenação da galeria.
- `kl-catalog.css`: somente estilos da experiência de catálogo.
- `tests/helpers/catalog-fixtures.cjs`: conjunto pequeno e explícito com categorias, unidades, cores e tamanhos representativos.
- `tests/helpers/fake-browser.cjs`: history, storage e image loader mínimos; não simula layout nem inventa DOM.
- `tests/helpers/fake-tracking-browser.cjs`: ambiente mínimo de `window`/`document` para executar `kl-tracking.js` via `node:vm` e capturar o payload final enviado ao Pixel.
- `tests/catalog-core.test.cjs`: comportamento puro de estado, URL, busca, filtros, mistura, deep-link e paginação.
- `tests/catalog-actions.test.cjs`: favoritos, roteamento, limite de URL e prova virtual.
- `tests/catalog-gallery.test.cjs`: clique progressivo, máquina de fechamento e política de imagens.
- `tests/catalog-app.test.cjs`: ownership de history, fechamento e regra de `popstate` sem escrita.
- `tests/catalog-tracking.test.cjs`: matriz runtime de eventos permitidos, payload final e ausência de busca/contato bruto.
- `tests/site-enhance-routing.test.cjs`: matriz pública de destino por página, unidade e peça, sem montagem DOM.
- `docs/qa/2026-07-15-catalogo-hibrido.md`: evidência final automatizada e visual.

### Modificar

- `catalogo.html:9-20,107-193,224-355`: remover listener duplicado e monólito; adicionar shell semântico e assets na ordem canônica.
- `peca.html:3-24`: consumir Core/Actions, preservar fallback, corrigir elegibilidade da prova e relacionadas leves.
- `kl-tracking.js:45-100,167-281,312-340`: receber contexto explícito, usar `window.KL_DATA` e impedir evento duplicado/termo bruto.
- `kl-site-enhance.js:5-42`: resolver CTA pela unidade real ou por `unidades.html`, nunca por fallback arbitrário.
- `tests/test_site_contract.py:165-181,433-519,542-559`: atualizar o contrato obsoleto da base real, trocar hashes dos scripts intencionalmente alterados por contratos semânticos e adicionar o shell/asset/cache-bust.
- `index.html`, `sobre.html`, `catalogo.html`, `como-chegar.html`, `servicos.html`, `unidades.html`, `noivas.html`, `debutantes.html`, `madrinhas.html`, `peca.html`: somente atualização mecânica das versões de `kl-tracking.js` e `kl-site-enhance.js` após os dois arquivos mudarem.
- `ternos.html`: atualização das versões compartilhadas e correção isolada dos dois CTAs explícitos de São Francisco para Barra, conforme auditoria da Task 9.
- `provar.html`: atualização das versões compartilhadas e remoção do fallback local que presume Barra quando a peça/unidade não é válida.

### Preservar sem alteração

- conteúdo de `kl-catalog-data.js`; a referência atual é `v=20260715db` e seu contrato passa a validar schema, códigos, categorias e unidades sem editar a base.
- Worker, upload, geração e jornada visual de `provar.html`; somente o fallback de atendimento e as versões compartilhadas mudam.
- todas as fotos e URLs públicas existentes.
- `peca.html?codigo=...`, `peca.html?p=...`, `catalogo.html?cat=...&un=...&p=...` e `provar.html?p=...`.

## Contratos entre módulos

```text
window.KL_DATA
  -> KLCatalog.Core
       readState(search, products)
       serializeState(state)
       derive(products, state)
       validateProducts(products)
       thumbUrl(product)
       productDetailUrl(product)
       buildSearchTelemetry(term, products, resultCount, state)
  -> KLCatalog.Actions
       createFavorites(storage, products)
       productWhatsAppHref(product)
       buildFavoriteBatches(products, maxLength)
       tryOnHref(product)
       resolveSharedCta(context)
       exposes orphan favorites until explicit cleanup
  -> KLCatalog.Gallery
       create(options) -> open/update/close/isReady/destroy
       emits onNavigate/onRequestClose/onFavorite
       never reads or writes history
  -> KLCatalog.App
       owns CatalogState, URL, history, scroll/focus and DOM
       emits kl:catalog-state and calls KLTracking.catalog
  -> KLTracking.catalog(eventName, context)
       sanitizes and sends trackCustom without changing Pixel
```

Ordem de scripts com `defer` em `catalogo.html`:

```html
<script defer src="kl-catalog-data.js?v=20260715db"></script>
<script defer src="kl-catalog-core.js?v=20260715catalog1"></script>
<script defer src="kl-catalog-actions.js?v=20260715catalog1"></script>
<script defer src="kl-catalog-gallery.js?v=20260715catalog1"></script>
<script defer src="kl-tracking.js?v=20260715catalog1"></script>
<script defer src="kl-catalog-app.js?v=20260715catalog1"></script>
```

`kl-catalog.css?v=20260715catalog1` deve carregar depois do CSS-base inline e antes de `kl-site-enhance.css`.

## Comandos compartilhados

Gate rápido:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-core.js
node --check kl-catalog-actions.js
node --check kl-catalog-gallery.js
node --check kl-catalog-app.js
node --check kl-tracking.js
node --check kl-site-enhance.js
git diff --check
```

Gate de commit, executado com a lista de arquivos da tarefa:

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs <arquivos-da-tarefa>
git add <arquivos-da-tarefa>
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
```

Todo commit usa o trailer:

```text
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

### Task 0: Sincronizar e congelar a base de implementação

**Files:**
- Modify: `tests/test_site_contract.py`

- [ ] **Step 1: Revalidar o ponto de partida sem sobrescrever trabalho concorrente**

```bash
git status --short --branch
git fetch --prune
git log --oneline --left-right HEAD...origin/main
git rebase origin/main
git rev-parse HEAD
```

O rebase só pode prosseguir com o worktree limpo, exceto por este plano já commitado. Se houver conflito em `catalogo.html`, `peca.html`, `kl-catalog-data.js`, scripts compartilhados ou testes, parar e revisar o diff; não escolher um lado automaticamente. Depois do rebase, confirmar a versão do asset, total, schema, unidades e códigos com o mesmo carregamento `node:vm` usado na Task 6. Registrar a saída final de `git rev-parse HEAD` como `BASELINE_COMMIT` nas anotações de execução para a comparação da Task 10.

Baseline atual esperado:

```text
origin/main: abe1867
kl-catalog-data.js?v=20260715db
sha256 kl-catalog-data.js: 592d9540486561934ef302f57d75e0ff9c143f64621dce5364d5fdec90f37301
768 peças; 768 códigos únicos; 7 categorias; barra=551; sf=217
campos c/k/u/t/un: todos strings não vazios; unidades fora de barra/sf: 0
```

Se `origin/main` tiver avançado com novas peças legítimas, atualizar **somente** versão, hash e contagens de baseline depois de provar que a alteração é aditiva, sem duplicidade e sem schema inválido. Se houver remoção, troca de unidade/código ou mudança não explicada, parar e pedir revisão humana.

- [ ] **Step 2: Reparar o contrato já obsoleto da base real**

Em `HomeHeroContractTest.test_home_keeps_critical_routes_and_integrations`, substituir somente o hash antigo de `kl-catalog-data.js` pelo hash confirmado acima. Manter os demais hashes e rotas intactos. Atualizar as referências estáticas de `kl-catalog-data.js` nos contratos para `v=20260715db`.

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Expected: `24/24` testes passam antes de criar qualquer módulo novo. Se outro teste falhar, tratá-lo como drift de baseline e não mascarar na feature.

- [ ] **Step 3: Fazer commit isolado do baseline**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/test_site_contract.py
git add tests/test_site_contract.py
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "test(catalogo): atualiza contrato da base real" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 1: Estado canônico e round-trip de URL

**Files:**
- Create: `tests/helpers/catalog-fixtures.cjs`
- Create: `tests/catalog-core.test.cjs`
- Create: `kl-catalog-core.js`

- [ ] **Step 1: Criar fixtures pequenas, sem copiar a base inteira**

Criar `tests/helpers/catalog-fixtures.cjs`:

```javascript
'use strict';

module.exports = Object.freeze([
  { c: 'vestidos-noiva', l: 'Noivas', k: 'NV-001', un: 'barra', t: 'M', co: 'off-white', u: 'https://img.test/noiva/NV-001-ia.jpg?v=2' },
  { c: 'vestidos-noiva', l: 'Noivas', k: 'NV-002', un: 'sf', t: 'G', co: 'off-white', u: 'https://img.test/noiva/NV-002-ia.jpg' },
  { c: 'vestidos-debutante', l: 'Debutantes', k: 'DB-010', un: 'sf', t: 'P', co: 'vinho', u: 'https://img.test/debutante/DB-010-ia.jpg' },
  { c: 'vestidos-madrinha', l: 'Madrinhas & Festa', k: 'MD-020', un: 'barra', t: 'M', co: 'rosa', u: 'https://img.test/festa/MD-020-ia.jpg' },
  { c: 'ternos', l: 'Ternos', k: 'TR-001', un: 'barra', t: '63', co: 'preto', u: 'https://img.test/ternos/TR-001-ia.jpg' },
  { c: 'bolsas', l: 'Bolsas', k: 'BL-001', un: 'sf', t: 'Único', co: 'champagne', u: 'https://img.test/bolsas/BL-001-ia.jpg' },
  { c: 'calcados', l: 'Calçados', k: 'CL-033', un: 'barra', t: '33', co: 'nude', u: 'https://img.test/calcados/CL-033-ia.jpg' },
  { c: 'acessorios', l: 'Acessórios', k: 'AC-001', un: 'sf', t: 'Único', u: 'https://img.test/acessorios/AC-001-ia.jpg' },
]);
```

- [ ] **Step 2: Escrever os primeiros testes falhos de estado e URL**

Adicionar a `tests/catalog-core.test.cjs`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const Core = require('../kl-catalog-core.js');

test('readState sanitiza aliases, inválidos e listas repetidas', () => {
  const state = Core.readState('?cat=all&un=invalida&co=vinho&co=rosa&tam=33&tam=ZZ&p=cl-033&pg=3&q=%20V%C3%8DNHO%20', fixtures);
  assert.deepEqual(state, {
    query: 'VÍNHO',
    category: null,
    unit: null,
    colors: ['rosa', 'vinho'],
    sizes: ['33'],
    page: 3,
    openProduct: 'CL-033',
  });
});

test('serializeState omite defaults e produz ordem estável', () => {
  const query = Core.serializeState({
    query: 'vinho', category: 'vestidos-debutante', unit: 'sf',
    colors: ['vinho', 'rosa'], sizes: ['M', 'P'], page: 2, openProduct: 'DB-010',
  });
  assert.equal(query, 'q=vinho&cat=vestidos-debutante&un=sf&co=rosa&co=vinho&tam=M&tam=P&p=DB-010&pg=2');
});
```

- [ ] **Step 3: Rodar e confirmar RED**

Run: `node --test tests/catalog-core.test.cjs`

Expected: FAIL com `Cannot find module '../kl-catalog-core.js'`.

- [ ] **Step 4: Criar o wrapper UMD e a implementação mínima**

Criar `kl-catalog-core.js` com este formato e implementar os corpos indicados:

```javascript
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.KLCatalog = root.KLCatalog || {};
    root.KLCatalog.Core = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UNIT_IDS = ['barra', 'sf'];
  var BATCH_SIZE = 12;

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });
  }

  function values(params, key) {
    return params.getAll(key).reduce(function (out, value) {
      return out.concat(String(value || '').split(','));
    }, []).map(function (value) { return value.trim(); }).filter(Boolean);
  }

  function readState(search, products) {
    var params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
    var categories = new Set(products.map(function (p) { return p.c; }));
    var colors = new Set(products.map(function (p) { return p.co; }).filter(Boolean));
    var sizes = new Set(products.map(function (p) { return p.t; }).filter(Boolean));
    var codes = new Set(products.map(function (p) { return String(p.k).toUpperCase(); }));
    var rawCategory = params.get('cat');
    var rawUnit = params.get('un');
    var rawProduct = String(params.get('p') || '').toUpperCase();
    var rawPage = parseInt(params.get('pg') || '1', 10);
    return {
      query: String(params.get('q') || '').trim().slice(0, 80),
      category: rawCategory && rawCategory !== 'all' && categories.has(rawCategory) ? rawCategory : null,
      unit: UNIT_IDS.indexOf(rawUnit) > -1 ? rawUnit : null,
      colors: uniqueSorted(values(params, 'co').filter(function (value) { return colors.has(value); })),
      sizes: uniqueSorted(values(params, 'tam').filter(function (value) { return sizes.has(value); })),
      page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
      openProduct: codes.has(rawProduct) ? rawProduct : null,
    };
  }

  function serializeState(state) {
    var params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.category) params.set('cat', state.category);
    if (state.unit) params.set('un', state.unit);
    uniqueSorted(state.colors || []).forEach(function (value) { params.append('co', value); });
    uniqueSorted(state.sizes || []).forEach(function (value) { params.append('tam', value); });
    if (state.openProduct) params.set('p', String(state.openProduct).toUpperCase());
    if ((state.page || 1) > 1) params.set('pg', String(state.page));
    return params.toString();
  }

  return {
    BATCH_SIZE: BATCH_SIZE,
    UNIT_IDS: UNIT_IDS.slice(),
    readState: readState,
    serializeState: serializeState,
  };
}));
```

- [ ] **Step 5: Confirmar GREEN e sintaxe**

Run: `node --test tests/catalog-core.test.cjs && node --check kl-catalog-core.js`

Expected: `2 tests`, `pass 2`, exit 0.

- [ ] **Step 6: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/helpers/catalog-fixtures.cjs tests/catalog-core.test.cjs kl-catalog-core.js
git add tests/helpers/catalog-fixtures.cjs tests/catalog-core.test.cjs kl-catalog-core.js
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): cria estado e URL canônicos" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Busca, facetas dependentes, mistura e deep-link

**Files:**
- Modify: `tests/catalog-core.test.cjs`
- Modify: `kl-catalog-core.js`

- [ ] **Step 1: Adicionar testes falhos para a descoberta completa**

Adicionar casos com estes nomes e assertions:

```javascript
test('busca normalizada encontra código, categoria, cor e tamanho', () => {
  assert.deepEqual(Core.derive(fixtures, { query: 'calcado', category: null, unit: null, colors: [], sizes: [], page: 1, openProduct: null }).products.map(p => p.k), ['CL-033']);
  assert.deepEqual(Core.derive(fixtures, { query: '63', category: null, unit: null, colors: [], sizes: [], page: 1, openProduct: null }).products.map(p => p.k), ['TR-001']);
  assert.deepEqual(Core.derive(fixtures, { query: 'vinho', category: null, unit: null, colors: [], sizes: [], page: 1, openProduct: null }).products.map(p => p.k), ['DB-010']);
});

test('usa OR dentro da faceta e AND entre facetas', () => {
  const view = Core.derive(fixtures, { query: '', category: null, unit: 'sf', colors: ['off-white', 'vinho'], sizes: ['P', 'G'], page: 1, openProduct: null });
  assert.deepEqual(view.products.map(p => p.k).sort(), ['DB-010', 'NV-002']);
});

test('facetas respeitam unidade e incluem tamanhos numéricos', () => {
  const view = Core.derive(fixtures, { query: '', category: null, unit: 'barra', colors: [], sizes: [], page: 1, openProduct: null });
  assert.equal(view.facets.sizes['33'], 1);
  assert.equal(view.facets.sizes['63'], 1);
  assert.equal(view.facets.colors.vinho, undefined);
});

test('mistura determinística não perde nem duplica peças', () => {
  const first = Core.derive(fixtures, Core.readState('', fixtures)).products.map(p => p.k);
  const second = Core.derive(fixtures, Core.readState('', fixtures)).products.map(p => p.k);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, fixtures.length);
  assert.deepEqual(new Set(first), new Set(fixtures.map(p => p.k)));
  assert.equal(new Set(first.slice(0, 7).map(code => fixtures.find(p => p.k === code).c)).size, 7);
  assert.ok(new Set(first.slice(0, 6).map(code => fixtures.find(p => p.k === code).un)).size >= 2);
});

test('deep-link incompatível remove só p e deep-link válido eleva pg', () => {
  const incompatible = Core.derive(fixtures, Core.readState('?cat=ternos&p=DB-010&q=terno', fixtures));
  assert.equal(incompatible.state.openProduct, null);
  assert.equal(incompatible.state.category, 'ternos');
  assert.equal(incompatible.state.query, 'terno');
  const expanded = Core.resolveOpenProduct(Array.from({ length: 25 }, (_, i) => ({ k: 'P-' + i })), { page: 1, openProduct: 'P-24' }, 12);
  assert.equal(expanded.page, 3);
});

test('telemetria de busca nunca contém o termo bruto', () => {
  const raw = 'meu contato nome' + '@' + 'example.invalid NV-001';
  const payload = Core.buildSearchTelemetry(raw, fixtures, 1, Core.readState('', fixtures));
  assert.equal(payload.query_length, raw.length);
  assert.equal(payload.query_has_product_code, 'no');
  assert.equal(payload.product_code, '');
  assert.equal(payload.result_count, 1);
  assert.equal(payload.catalog_category, '');
  assert.equal(payload.catalog_unit, '');
  assert.doesNotMatch(JSON.stringify(payload), /example\.invalid|meu contato/i);

  const exact = Core.buildSearchTelemetry('  nv-001  ', fixtures, 1, Core.readState('', fixtures));
  assert.equal(exact.query_has_product_code, 'yes');
  assert.equal(exact.product_code, 'NV-001');
});

test('valida schema, unidade e unicidade antes de derivar', () => {
  assert.deepEqual(Core.validateProducts(fixtures).errors, []);
  const malformed = fixtures.concat([
    { c: 'vestidos-noiva', l: 'Noivas', k: 'SEM-UN', un: 'invalida', t: 'M', u: 'https://img.test/x.jpg' },
    { c: 'vestidos-noiva', l: 'Noivas', k: '', un: 'barra', t: 'M', u: 'https://img.test/y.jpg' },
    { ...fixtures[0] },
  ]);
  const report = Core.validateProducts(malformed);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.reason === 'invalid-unit'));
  assert.ok(report.errors.some(error => error.reason === 'missing-field' && error.field === 'k'));
  assert.ok(report.errors.some(error => error.reason === 'duplicate-code'));
});

test('thumbnail preserva a versão de cache sem cair na original', () => {
  assert.equal(Core.thumbUrl(fixtures[0]), 'https://img.test/noiva/NV-001-ia-thumb.jpg?v=2');
});
```

- [ ] **Step 2: Rodar e confirmar RED pelas funções ausentes**

Run: `node --test tests/catalog-core.test.cjs`

Expected: FAIL mencionando `Core.derive is not a function`.

- [ ] **Step 3: Implementar normalização, filtros e facetas**

Adicionar ao factory de `kl-catalog-core.js`:

```javascript
var CATEGORY_ORDER = ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha', 'ternos', 'bolsas', 'calcados', 'acessorios'];

function fold(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function unitOf(product) {
  return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
}

function validateProducts(raw) {
  var errors = [];
  var seen = new Set();
  if (!Array.isArray(raw)) return { ok: false, products: [], errors: [{ reason: 'not-array' }] };
  raw.forEach(function (product, index) {
    if (!product || typeof product !== 'object') {
      errors.push({ index: index, reason: 'not-object' });
      return;
    }
    ['c', 'l', 'k', 'un', 't', 'u'].forEach(function (field) {
      if (typeof product[field] !== 'string' || !product[field].trim()) {
        errors.push({ index: index, reason: 'missing-field', field: field });
      }
    });
    if (unitOf(product) === null) errors.push({ index: index, reason: 'invalid-unit' });
    var code = String(product.k || '').trim().toUpperCase();
    if (code && seen.has(code)) errors.push({ index: index, reason: 'duplicate-code', code: code });
    if (code) seen.add(code);
  });
  return { ok: errors.length === 0, products: errors.length ? [] : raw.slice(), errors: errors };
}

function matchesTerm(product, query) {
  if (!query) return true;
  var haystack = [product.k, product.c, product.l, product.co, product.t].map(fold).join(' ');
  return haystack.indexOf(fold(query)) > -1;
}

function filterProducts(products, state, omit) {
  omit = omit || '';
  return products.filter(function (product) {
    if (state.category && product.c !== state.category) return false;
    if (state.unit && unitOf(product) !== state.unit) return false;
    if (!matchesTerm(product, state.query)) return false;
    if (omit !== 'colors' && state.colors.length && (!product.co || state.colors.indexOf(product.co) < 0)) return false;
    if (omit !== 'sizes' && state.sizes.length && state.sizes.indexOf(product.t) < 0) return false;
    return true;
  });
}

function counts(products, key) {
  return products.reduce(function (out, product) {
    var value = key === 'unit' ? unitOf(product) : product[key];
    if (value) out[value] = (out[value] || 0) + 1;
    return out;
  }, {});
}

function reconcile(products, state) {
  var next = Object.assign({}, state, { colors: (state.colors || []).slice(), sizes: (state.sizes || []).slice() });
  var base = filterProducts(products, Object.assign({}, next, { colors: [], sizes: [] }));
  var validColors = new Set(base.map(function (p) { return p.co; }).filter(Boolean));
  next.colors = next.colors.filter(function (value) { return validColors.has(value); });
  var validSizes = new Set(filterProducts(base, Object.assign({}, next, { sizes: [] }), 'sizes').map(function (p) { return p.t; }).filter(Boolean));
  next.sizes = next.sizes.filter(function (value) { return validSizes.has(value); });
  var compatibleColors = new Set(filterProducts(base, Object.assign({}, next, { colors: [] }), 'colors').map(function (p) { return p.co; }).filter(Boolean));
  next.colors = next.colors.filter(function (value) { return compatibleColors.has(value); });
  return next;
}
```

- [ ] **Step 4: Implementar mistura, deep-link, thumbnail e telemetria**

Adicionar:

```javascript
function interleave(products) {
  var buckets = new Map();
  products.forEach(function (product) {
    var key = product.c + '|' + unitOf(product);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  });
  var categories = CATEGORY_ORDER.slice();
  Array.from(new Set(products.map(function (product) { return product.c; }))).sort().forEach(function (category) {
    if (categories.indexOf(category) < 0) categories.push(category);
  });
  var nextUnit = {};
  var output = [];
  var remaining = true;
  while (remaining) {
    remaining = false;
    categories.forEach(function (category) {
      var preferred = nextUnit[category] === 'sf' ? ['sf', 'barra'] : ['barra', 'sf'];
      var used = preferred.find(function (unit) {
        var bucket = buckets.get(category + '|' + unit);
        return bucket && bucket.length;
      });
      if (!used) return;
      output.push(buckets.get(category + '|' + used).shift());
      nextUnit[category] = used === 'barra' ? 'sf' : 'barra';
      remaining = true;
    });
  }
  return output;
}

function resolveOpenProduct(products, state, batchSize) {
  var next = Object.assign({}, state);
  if (!next.openProduct) return next;
  var index = products.findIndex(function (product) { return String(product.k).toUpperCase() === next.openProduct; });
  if (index < 0) {
    next.openProduct = null;
    return next;
  }
  next.page = Math.max(next.page || 1, Math.ceil((index + 1) / (batchSize || BATCH_SIZE)));
  return next;
}

function derive(products, state) {
  var next = reconcile(products, state);
  var filtered = filterProducts(products, next);
  var ordered = interleave(filtered);
  next = resolveOpenProduct(ordered, next, BATCH_SIZE);
  return {
    state: next,
    products: ordered,
    visibleProducts: ordered.slice(0, next.page * BATCH_SIZE),
    facets: {
      colors: counts(filterProducts(products, next, 'colors'), 'co'),
      sizes: counts(filterProducts(products, next, 'sizes'), 't'),
    },
    categoryCounts: counts(products, 'c'),
    unitCounts: counts(products, 'unit'),
  };
}

function thumbUrl(product) {
  var raw = String(product && product.u || '');
  var parts = raw.split('?');
  if (!/\.jpg$/i.test(parts[0])) return '';
  return parts[0].replace(/\.jpg$/i, '-thumb.jpg') + (parts[1] ? '?' + parts.slice(1).join('?') : '');
}

function productDetailUrl(product) {
  return 'peca.html?codigo=' + encodeURIComponent(product.k);
}

function buildSearchTelemetry(term, products, resultCount, state) {
  var raw = String(term || '');
  var normalized = fold(raw);
  var product = products.find(function (item) { return normalized === fold(item.k); });
  return {
    query_length: raw.length,
    query_has_product_code: product ? 'yes' : 'no',
    product_code: product ? product.k : '',
    result_count: resultCount,
    catalog_category: state.category || '',
    catalog_unit: state.unit || '',
  };
}
```

Exportar também `derive`, `filterProducts`, `interleave`, `resolveOpenProduct`, `thumbUrl`, `productDetailUrl`, `buildSearchTelemetry`, `validateProducts`, `CATEGORY_ORDER` e `unitOf`.

`validateProducts` é o gate obrigatório do App. Não existe fallback legado para `un`: a base atual tem `un` explícito em todas as 768 peças. Ausência, valor inválido, campo obrigatório vazio ou código duplicado produz estado `data-error`; não filtrar nem persistir favoritos com essa base.

- [ ] **Step 5: Rodar toda a suíte Core e ajustar somente para os contratos escritos**

Run: `node --test tests/catalog-core.test.cjs && node --check kl-catalog-core.js`

Expected: todos os testes Core passam; sem perda ou duplicação.

- [ ] **Step 6: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/catalog-core.test.cjs kl-catalog-core.js
git add tests/catalog-core.test.cjs kl-catalog-core.js
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): implementa descoberta e facetas" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Favoritos e atendimento por unidade

**Files:**
- Create: `tests/helpers/fake-browser.cjs`
- Create: `tests/catalog-actions.test.cjs`
- Create: `kl-catalog-actions.js`

- [ ] **Step 1: Criar storage mínimo injetável**

Criar `tests/helpers/fake-browser.cjs` inicialmente com:

```javascript
'use strict';

function createStorage(seed) {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values),
  };
}

module.exports = { createStorage };
```

- [ ] **Step 2: Escrever testes falhos de favoritos, lotes e prova**

Criar `tests/catalog-actions.test.cjs`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const { createStorage } = require('./helpers/fake-browser.cjs');
const Actions = require('../kl-catalog-actions.js');

const contacts = { barra: '101', sf: '202' };

test('migra favoritos v1 sem apagar órfãos até limpeza explícita', () => {
  const storage = createStorage({ 'kl-favoritos-v1': JSON.stringify(['NV-001', 'INEXISTENTE', 'DB-010', 'NV-001']) });
  const favorites = Actions.createFavorites(storage, fixtures);
  assert.deepEqual(favorites.items().map(item => item.k).sort(), ['DB-010', 'NV-001']);
  assert.deepEqual(favorites.orphans(), ['INEXISTENTE']);
  assert.deepEqual(JSON.parse(storage.snapshot()['kl-favoritos-v1']), ['NV-001', 'INEXISTENTE', 'DB-010', 'NV-001']);
  favorites.toggle('CL-033');
  assert.deepEqual(JSON.parse(storage.snapshot()['kl-favoritos-v1']).sort(), ['CL-033', 'DB-010', 'INEXISTENTE', 'NV-001']);
  favorites.cleanupOrphans();
  assert.deepEqual(favorites.orphans(), []);
  assert.deepEqual(JSON.parse(storage.snapshot()['kl-favoritos-v1']).sort(), ['CL-033', 'DB-010', 'NV-001']);
});

test('agrupa e cria lotes sem misturar unidades ou ultrapassar 1800', () => {
  const many = Array.from({ length: 220 }, (_, i) => ({ ...fixtures[i % fixtures.length], k: 'PECA-' + String(i).padStart(3, '0'), un: i % 2 ? 'sf' : 'barra' }));
  const batches = Actions.buildFavoriteBatches(many, contacts, 1800);
  assert.ok(batches.length > 2);
  batches.forEach(batch => {
    assert.ok(batch.href.length <= 1800);
    assert.equal(new Set(batch.items.map(item => item.un)).size, 1);
    assert.equal(batch.unit, batch.items[0].un);
  });
});

test('CTA individual e prova virtual seguem a peça real', () => {
  assert.match(Actions.productWhatsAppHref(fixtures[0], contacts), /^https:\/\/wa\.me\/101\?/);
  assert.equal(Actions.productWhatsAppHref({ k: 'X', un: 'invalida' }, contacts), 'unidades.html');
  assert.equal(Actions.tryOnHref(fixtures[0]), 'provar.html?p=NV-001');
  assert.equal(Actions.tryOnHref(fixtures.find(item => item.c === 'ternos')), null);
});

test('CTA compartilhado nunca escolhe unidade arbitrária', () => {
  assert.equal(Actions.resolveSharedCta({ page: 'catalogo', unit: null }, contacts).href, 'unidades.html');
  assert.match(Actions.resolveSharedCta({ page: 'catalogo', unit: 'sf' }, contacts).href, /^https:\/\/wa\.me\/202/);
  assert.match(Actions.resolveSharedCta({ page: 'peca', product: fixtures[0] }, contacts).href, /^https:\/\/wa\.me\/101/);
  assert.equal(Actions.resolveSharedCta({ page: 'catalogo', status: 'error' }, contacts).href, 'unidades.html');
});
```

- [ ] **Step 3: Rodar e confirmar RED**

Run: `node --test tests/catalog-actions.test.cjs`

Expected: FAIL com `Cannot find module '../kl-catalog-actions.js'`.

- [ ] **Step 4: Implementar Actions com dependências injetáveis**

Usar o mesmo wrapper UMD de Core e expor `KLCatalog.Actions`. Mover os dois contatos públicos já verificados de `catalogo.html:260` **sem alterar seus valores** para um `CONTACTS` congelado. Implementar estes contratos:

```javascript
var FAVORITES_KEY = 'kl-favoritos-v1';
var TRY_ON_CATEGORIES = ['vestidos-noiva', 'vestidos-madrinha', 'vestidos-debutante'];

function unitOf(product) {
  return product && (product.un === 'barra' || product.un === 'sf') ? product.un : null;
}

function tryOnHref(product) {
  return product && TRY_ON_CATEGORIES.indexOf(product.c) > -1
    ? 'provar.html?p=' + encodeURIComponent(product.k)
    : null;
}

function productMessage(product) {
  return 'Olá! Tenho interesse na peça ' + product.k + '. Você consegue confirmar a disponibilidade e me ajudar a agendar uma prova?';
}

function whatsappHref(contact, message) {
  return 'https://wa.me/' + contact + '?text=' + encodeURIComponent(message);
}

function productWhatsAppHref(product, contacts) {
  var unit = unitOf(product);
  return unit && contacts[unit] ? whatsappHref(contacts[unit], productMessage(product)) : 'unidades.html';
}
```

Para `createFavorites`, ler o array v1 dentro de `try/catch`, normalizar códigos em maiúsculas e deduplicar **em memória**, sem escrever no storage durante o carregamento. Retornar `codes`, `items`, `orphans`, `has`, `toggle`, `cleanupOrphans`, `clear` e `groups`:

- `codes()` inclui referências válidas e órfãs;
- `items()` e `groups()` incluem somente produtos encontrados na base validada;
- `orphans()` lista códigos ausentes sem removê-los;
- `toggle()` persiste a lista completa, preservando os órfãos existentes;
- `cleanupOrphans()` é a única migração que remove órfãos e só será chamada por ação explícita da cliente;
- `clear()` permanece uma ação explícita e limpa tudo.

Falha de leitura/escrita do storage não pode impedir o catálogo de funcionar. O App só instancia `createFavorites` depois que `Core.validateProducts(window.KL_DATA).ok` for verdadeiro; erro/indisponibilidade da base nunca grava, migra ou limpa favoritos.

Para `buildFavoriteBatches`, ordenar primeiro por unidade e depois código, montar uma linha por peça e testar o comprimento do `href` **já codificado** antes de adicionar cada linha. Ao ultrapassar o teto, fechar o lote atual e iniciar outro da mesma unidade. Cada retorno tem `{ unit, index, total, items, href }`.

Para `resolveSharedCta`:

```javascript
function resolveSharedCta(context, contacts) {
  if (!context || context.status === 'error') return { href: 'unidades.html', label: 'Escolher unidade' };
  var unit = context.product ? unitOf(context.product) : context.unit;
  if (!unit || !contacts[unit]) return { href: 'unidades.html', label: 'Escolher unidade' };
  return {
    href: whatsappHref(contacts[unit], context.product ? productMessage(context.product) : 'Olá! Vim pelo catálogo da Koisa Linda e quero ajuda para agendar uma prova.'),
    label: 'WhatsApp',
  };
}
```

- [ ] **Step 5: Confirmar GREEN e limite real**

Run: `node --test tests/catalog-actions.test.cjs && node --check kl-catalog-actions.js`

Expected: todos passam; nenhuma URL supera 1.800 caracteres.

- [ ] **Step 6: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/helpers/fake-browser.cjs tests/catalog-actions.test.cjs kl-catalog-actions.js
git add tests/helpers/fake-browser.cjs tests/catalog-actions.test.cjs kl-catalog-actions.js
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): separa favoritos e atendimento" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 4: Contratos puros da galeria e política de imagens

**Files:**
- Modify: `tests/helpers/fake-browser.cjs`
- Create: `tests/catalog-gallery.test.cjs`
- Create: `kl-catalog-gallery.js`

- [ ] **Step 1: Acrescentar history e image loader controláveis**

Adicionar ao helper factories que registrem chamadas, sem construir DOM:

```javascript
function createHistory(initialUrl) {
  const entries = [{ url: initialUrl, state: null }];
  const operations = [];
  let index = 0;
  return {
    getState() { return entries[index].state; },
    pushState(state, _title, url) { operations.push('push'); entries.splice(++index); entries.push({ state, url: String(url) }); },
    replaceState(state, _title, url) { operations.push('replace'); entries[index] = { state, url: String(url) }; },
    back() { operations.push('back'); if (index > 0) index -= 1; },
    snapshot: () => ({ entries: structuredClone(entries), operations: operations.slice(), index }),
  };
}

function createImageLoader() {
  const requests = [];
  return {
    load(url) {
      let resolve;
      let reject;
      const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
      requests.push({ url, resolve, reject });
      return promise;
    },
    requests,
  };
}

module.exports = { createStorage, createHistory, createImageLoader };
```

- [ ] **Step 2: Escrever os testes falhos das regras independentes do DOM**

Criar `tests/catalog-gallery.test.cjs` cobrindo:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Gallery = require('../kl-catalog-gallery.js');

test('intercepta somente clique primário simples com galeria pronta', () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  assert.equal(Gallery.shouldInterceptProductLink(base, true), true);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, button: 1 }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink({ ...base, metaKey: true }, true), false);
  assert.equal(Gallery.shouldInterceptProductLink(base, false), false);
});

test('fecha por back somente quando a entrada pertence à abertura da grade', () => {
  assert.equal(Gallery.closeAction({ ownedHistoryEntry: true }), 'back');
  assert.equal(Gallery.closeAction({ ownedHistoryEntry: false }), 'replace-without-product');
});

test('preload inclui no máximo uma vizinha por lado', () => {
  assert.deepEqual(Gallery.neighborIndexes(2, 6), [1, 3]);
  assert.deepEqual(Gallery.neighborIndexes(0, 1), []);
  assert.ok(Gallery.neighborIndexes(0, 6).length <= 2);
});

test('resposta atrasada não pode substituir a peça ativa', () => {
  const guard = Gallery.createRequestGuard();
  const first = guard.next('A');
  const second = guard.next('B');
  assert.equal(guard.isCurrent(first, 'A'), false);
  assert.equal(guard.isCurrent(second, 'B'), true);
});
```

- [ ] **Step 3: Rodar e confirmar RED**

Run: `node --test tests/catalog-gallery.test.cjs`

Expected: FAIL com módulo ausente.

- [ ] **Step 4: Criar o wrapper e os helpers puros**

Implementar e exportar:

```javascript
function shouldInterceptProductLink(event, ready) {
  return Boolean(ready && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey);
}

function closeAction(context) {
  return context && context.ownedHistoryEntry ? 'back' : 'replace-without-product';
}

function neighborIndexes(index, length) {
  var values = [];
  if (index > 0) values.push(index - 1);
  if (index + 1 < length) values.push(index + 1);
  return values;
}

function createRequestGuard() {
  var token = 0;
  var currentCode = '';
  return {
    next: function (code) { currentCode = code; token += 1; return token; },
    isCurrent: function (candidate, code) { return candidate === token && code === currentCode; },
  };
}
```

O factory `create(options)` será completado na Task 7. Nesta tarefa ele deve validar opções e retornar uma API inerte com `isReady() === false`, sem tocar `document` durante `require()` no Node.

- [ ] **Step 5: Confirmar GREEN**

Run: `node --test tests/catalog-gallery.test.cjs && node --check kl-catalog-gallery.js`

Expected: `4 tests`, todos passam.

- [ ] **Step 6: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/helpers/fake-browser.cjs tests/catalog-gallery.test.cjs kl-catalog-gallery.js
git add tests/helpers/fake-browser.cjs tests/catalog-gallery.test.cjs kl-catalog-gallery.js
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "test(catalogo): define contratos da galeria" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Shell editorial compacto e grade progressiva

**Files:**
- Modify: `tests/test_site_contract.py`
- Create: `tests/catalog-app.test.cjs`
- Create: `kl-catalog.css`
- Create: `kl-catalog-app.js`
- Modify: `catalogo.html:9-20,107-193,224-355`

- [ ] **Step 1: Escrever contratos estáticos falhos para o novo shell**

Adicionar `CatalogHybridContractTest` em `tests/test_site_contract.py`:

```python
class CatalogHybridContractTest(unittest.TestCase):
    def test_catalog_loads_split_assets_in_dependency_order(self):
        html = page("catalogo.html")
        assets = (
            "kl-catalog-data.js?v=20260715db",
            "kl-catalog-core.js?v=20260715catalog1",
            "kl-catalog-actions.js?v=20260715catalog1",
            "kl-catalog-gallery.js?v=20260715catalog1",
            "kl-tracking.js?v=20260710deep3",
            "kl-catalog-app.js?v=20260715catalog1",
        )
        positions = [html.index(asset) for asset in assets]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('href="kl-catalog.css?v=20260715catalog1"', html)
        self.assertNotIn("const DATA=window.KL_DATA", html)
        self.assertNotIn("let cat=new URLSearchParams", html)

    def test_catalog_shell_is_semantic_and_complete(self):
        html = page("catalogo.html")
        for required in (
            'aria-labelledby="catalog-title"',
            '<label for="catalog-search"',
            'role="search"',
            'id="catalog-category"',
            'id="catalog-units"',
            'id="catalog-facets"',
            'id="catalog-active-filters"',
            'id="catalog-count" aria-live="polite"',
            'id="catalog-grid"',
            'id="catalog-load-more"',
            'id="catalog-gallery"',
            'id="catalog-favorites"',
        ):
            self.assertIn(required, html)
        for category in (
            "vestidos-noiva", "vestidos-debutante", "vestidos-madrinha",
            "ternos", "bolsas", "calcados", "acessorios",
        ):
            self.assertIn(f'value="{category}"', html)

    def test_catalog_shortcuts_keep_text_outside_photos(self):
        html = page("catalogo.html")
        shortcuts = section_with_class(html, "catalog-shortcuts")
        self.assertEqual(3, shortcuts.count('class="catalog-shortcut"'))
        for image in ("hero-noiva.webp", "hero-debutante.webp", "hero-madrinha.webp"):
            self.assertIn(image, shortcuts)
        self.assertNotRegex(shortcuts, r'<span[^>]*class="[^\"]*overlay')

    def test_catalog_css_has_two_mobile_columns_and_reduced_motion(self):
        css = page("kl-catalog.css")
        mobile = balanced_css_block(css, "@media(max-width:680px)").replace(" ", "")
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", mobile)
        reduced = balanced_css_block(css, "@media(prefers-reduced-motion:reduce)").replace(" ", "")
        self.assertIn("animation:none", reduced)
        self.assertIn("transition:none", reduced)
        low = balanced_css_block(css, "@media(max-height:600px)").replace(" ", "")
        self.assertIn("max-height:34dvh", low)
        self.assertIn("display:none", low)

    def test_catalog_dialogs_are_named_and_face_safe(self):
        html = page("catalogo.html")
        self.assertRegex(html, r'<dialog[^>]+id="catalog-gallery"[^>]+aria-labelledby="gallery-title"')
        self.assertIn('class="gallery-media"', html)
        self.assertIn('class="gallery-panel"', html)
        self.assertLess(html.index('class="gallery-media"'), html.index('class="gallery-panel"'))
        media = re.search(r'<figure class="gallery-media"[^>]*>(.*?)</figure>', html, re.DOTALL)
        self.assertIsNotNone(media)
        self.assertNotRegex(media.group(1), r"<(?:h[1-6]|p|a)\b")

    def test_catalog_grid_preserves_lazy_thumbnails_without_original_fallback(self):
        js = page("kl-catalog-app.js")
        self.assertIn("image.loading = 'lazy'", js)
        self.assertNotIn("image.loading = 'eager'", js)
        self.assertIn("gridImageFailurePolicy", js)
        self.assertIn("requestOriginal: false", js)

    def test_catalog_external_css_replaces_old_focus_and_tap_contracts(self):
        css = page("kl-catalog.css")
        dark = balanced_css_block(css, ".gallery-media button:focus-visible").replace(" ", "")
        light = balanced_css_block(css, ".gallery-panel a:focus-visible").replace(" ", "")
        self.assertIn("outline:3pxsolid#fff", dark)
        self.assertIn("outline:3pxsolidvar(--ruby)", light)
        for selector in (
            ".catalog-units button", ".catalog-favorites-trigger",
            ".catalog-load-more", ".gallery-primary", ".gallery-secondary",
        ):
            rule = balanced_css_block(css, selector).replace(" ", "")
            self.assertRegex(rule, r"min-height:(?:44|48)px")
```

Fazer a migração exata dos contratos antigos em `VisiblePagesContractTest`:

1. remover por inteiro `test_catalog_focus_is_white_on_lightbox_and_favorites_bar`;
2. preservar o loop geral de `test_visible_pages_wrap_social_links_and_keep_mobile_tap_targets`, mas remover somente o bloco final `catalog = page("catalogo.html")` que exige `.pill,.search,.szchip,.sw,.cbtn,.favbtn,.favbar .fgo,.favbar .fclear,.lb-close,.lb-nav,.lb-try,.lb-cta`;
3. remover por inteiro `test_catalog_mobile_target_override_wins_the_css_cascade`;
4. substituir esses três contratos específicos pelo novo `test_catalog_external_css_replaces_old_focus_and_tap_contracts`.

Não afrouxar os contratos gerais das demais páginas. Manter os hashes atuais de `kl-tracking.js`, `kl-site-enhance.js` e o hash de dados já reparado na Task 0; os dois primeiros só serão substituídos por contratos semânticos quando seus arquivos mudarem na Task 9.

Criar também `tests/catalog-app.test.cjs` com os contratos puros de estado de carga e paginação manual:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./helpers/catalog-fixtures.cjs');
const Core = require('../kl-catalog-core.js');
const App = require('../kl-catalog-app.js');

test('distingue loading, erro de fonte, schema inválido, vazio e sucesso', () => {
  assert.equal(App.classifyData(undefined, Core.validateProducts, 'loading'), 'loading');
  assert.equal(App.classifyData(undefined, Core.validateProducts), 'data-error');
  assert.equal(App.classifyData(null, Core.validateProducts), 'data-error');
  assert.equal(App.classifyData([], Core.validateProducts), 'empty');
  assert.equal(App.classifyData(fixtures, Core.validateProducts), 'ready');
  assert.equal(App.classifyData([{ ...fixtures[0], un: 'invalida' }], Core.validateProducts), 'data-error');
});

test('janela de página é derivada somente do state.page canônico', () => {
  assert.deepEqual(App.pageWindow(25, 1, 12), { page: 1, visible: 12, hasMore: true });
  assert.deepEqual(App.pageWindow(25, 2, 12), { page: 2, visible: 24, hasMore: true });
  assert.deepEqual(App.pageWindow(25, 3, 12), { page: 3, visible: 25, hasMore: false });
});

test('controller emite intenção manual/observer sem possuir contador de página', () => {
  const callbacks = [];
  const requests = [];
  const automatic = App.createPagingController({
    onRequestMore: source => requests.push(source),
    observerFactory: callback => ({ observe: () => callbacks.push(callback), disconnect() {} }),
  });
  assert.equal(automatic.connect({}), 'automatic');
  callbacks[0]([{ isIntersecting: false }]);
  callbacks[0]([{ isIntersecting: true }]);
  automatic.requestManual();
  assert.deepEqual(requests, ['observer', 'manual']);
  assert.equal(automatic.snapshot, undefined);

  const manualRequests = [];
  const manual = App.createPagingController({ onRequestMore: source => manualRequests.push(source) });
  assert.equal(manual.connect({}), 'manual');
  manual.requestManual();
  assert.deepEqual(manualRequests, ['manual']);
});

test('erro da miniatura vira placeholder e nunca pede a original', () => {
  assert.deepEqual(App.gridImageFailurePolicy(), { showPlaceholder: true, requestOriginal: false });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract.CatalogHybridContractTest -v
node --test tests/catalog-app.test.cjs
```

Expected: Python falha por assets/shell ausentes e Node falha porque `kl-catalog-app.js` ainda não existe.

- [ ] **Step 3: Substituir o miolo do catálogo por shell semântico estático**

Em `catalogo.html`:

1. preservar o bootstrap do Meta Pixel sem trocar ID/configuração;
2. remover somente o listener inline `KL Lead tracking`, porque a Task 9 dará um único dono aos eventos;
3. remover o CSS específico antigo entre `.tools` e o override final móvel, deixando o CSS-base do site;
4. adicionar o link de `kl-catalog.css` e os seis scripts `defer` na ordem canônica; nesta tarefa, manter `kl-tracking.js?v=20260710deep3`, elevando-o em conjunto com todas as páginas somente na Task 9;
5. remover `kl-catalog-data.js` e os scripts monolíticos do final do body;
6. usar este shell entre header e footer:

```html
<main id="catalog-app" aria-labelledby="catalog-title">
  <section class="catalog-intro">
    <div class="catalog-intro-copy">
      <div class="eyebrow">Catálogo Koisa Linda · duas unidades</div>
      <h1 id="catalog-title">Encontre a peça que faz parte da sua história.</h1>
      <p>Explore vestidos, ternos e acessórios. Salve seus favoritos e fale com a unidade certa para confirmar disponibilidade.</p>
      <form class="catalog-search" role="search" novalidate>
        <label for="catalog-search">Buscar no catálogo</label>
        <input id="catalog-search" name="q" type="search" autocomplete="off" placeholder="Código, categoria, cor ou tamanho">
      </form>
    </div>
    <section class="catalog-shortcuts" aria-label="Atalhos de coleção">
      <button class="catalog-shortcut" type="button" data-shortcut-cat="vestidos-noiva">
        <img src="img/hero-noiva.webp" alt="" width="360" height="240"><span>Noivas</span>
      </button>
      <button class="catalog-shortcut" type="button" data-shortcut-cat="vestidos-debutante">
        <img src="img/hero-debutante.webp" alt="" width="360" height="240"><span>Debutantes</span>
      </button>
      <button class="catalog-shortcut" type="button" data-shortcut-cat="vestidos-madrinha">
        <img src="img/hero-madrinha.webp" alt="" width="360" height="240"><span>Festa</span>
      </button>
    </section>
  </section>

  <section class="catalog-tools" aria-label="Refinar catálogo">
    <div class="catalog-primary-filters">
      <label class="catalog-select-label" for="catalog-category">Categoria
        <select id="catalog-category" name="cat">
          <option value="">Todas as categorias</option>
          <option value="vestidos-noiva">Noivas</option>
          <option value="vestidos-debutante">Debutantes</option>
          <option value="vestidos-madrinha">Madrinhas & Festa</option>
          <option value="ternos">Ternos</option>
          <option value="bolsas">Bolsas</option>
          <option value="calcados">Calçados</option>
          <option value="acessorios">Acessórios</option>
        </select>
      </label>
      <fieldset id="catalog-units" class="catalog-units">
        <legend>Unidade</legend>
        <button type="button" data-unit="" aria-pressed="true">Todas</button>
        <button type="button" data-unit="barra" aria-pressed="false">Barra da Tijuca</button>
        <button type="button" data-unit="sf" aria-pressed="false">São Francisco</button>
      </fieldset>
      <button id="catalog-open-favorites" class="catalog-favorites-trigger" type="button" aria-haspopup="dialog">
        Salvos <span id="catalog-favorite-count">0</span>
      </button>
    </div>
    <div id="catalog-facets" class="catalog-facets"></div>
    <div id="catalog-active-filters" class="catalog-active-filters" aria-label="Filtros ativos"></div>
    <p id="catalog-count" class="catalog-count" aria-live="polite">Carregando catálogo…</p>
  </section>

  <section id="catalog-results" class="catalog-results" aria-busy="true">
    <div id="catalog-status" class="catalog-status" role="status">
      <div class="catalog-skeleton-grid" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>
    <div id="catalog-grid" class="catalog-grid"></div>
    <button id="catalog-load-more" class="catalog-load-more" type="button" hidden>Carregar mais</button>
    <div id="catalog-sentinel" aria-hidden="true"></div>
  </section>
</main>

<dialog id="catalog-gallery" class="catalog-gallery" aria-labelledby="gallery-title">
  <div class="gallery-layout">
    <figure class="gallery-media">
      <img id="gallery-image" alt="">
      <button class="gallery-nav gallery-prev" type="button" aria-label="Peça anterior">‹</button>
      <button class="gallery-nav gallery-next" type="button" aria-label="Próxima peça">›</button>
    </figure>
    <section class="gallery-panel">
      <button class="gallery-close" type="button" aria-label="Fechar galeria">×</button>
      <p id="gallery-unit" class="eyebrow"></p>
      <h2 id="gallery-title"></h2>
      <p id="gallery-code"></p>
      <dl id="gallery-specs"></dl>
      <button id="gallery-favorite" type="button"></button>
      <a id="gallery-whatsapp" class="gallery-primary" target="_blank" rel="noopener">Falar no WhatsApp</a>
      <a id="gallery-try-on" class="gallery-secondary">Provar em mim</a>
      <p class="gallery-note">Consulte a unidade para confirmar disponibilidade.</p>
    </section>
  </div>
</dialog>

<dialog id="catalog-favorites" class="catalog-favorites" aria-labelledby="favorites-title">
  <div class="favorites-head">
    <h2 id="favorites-title">Peças salvas</h2>
    <button type="button" data-close-favorites aria-label="Fechar favoritos">×</button>
  </div>
  <div id="favorites-content"></div>
</dialog>
```

- [ ] **Step 4: Criar o CSS do catálogo com invariantes face-safe**

Criar `kl-catalog.css`. O refinamento visual pode ajustar escala e respiro, mas estes contratos não mudam:

```css
.catalog-intro{max-width:1320px;margin:0 auto;padding:clamp(34px,5vw,68px) 32px 24px;display:grid;grid-template-columns:minmax(0,.85fr) minmax(420px,1.15fr);gap:clamp(28px,5vw,72px);align-items:end}
.catalog-intro h1{max-width:680px;margin:14px 0 16px;font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(42px,5vw,72px);line-height:.98;color:var(--ruby)}
.catalog-search label,.catalog-select-label,fieldset legend{font-family:var(--sans);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f6258}
.catalog-search input,.catalog-select-label select{width:100%;min-height:48px;margin-top:8px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font:16px var(--sans);padding:0 18px}
.catalog-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.catalog-shortcut{min-width:0;padding:0;border:1px solid var(--line);background:#fff;color:var(--ruby);cursor:pointer;overflow:hidden}
.catalog-shortcut img{width:100%;aspect-ratio:3/2;object-fit:cover;object-position:center top}
.catalog-shortcut span{display:block;min-height:48px;padding:13px 8px;font:13px var(--sans);letter-spacing:1.4px;text-transform:uppercase}
.catalog-tools{position:sticky;top:71px;z-index:40;background:rgba(251,247,239,.96);backdrop-filter:blur(12px);border-block:1px solid var(--line);padding:14px 32px}
.catalog-primary-filters{max-width:1320px;margin:0 auto;display:grid;grid-template-columns:minmax(210px,320px) 1fr auto;gap:16px;align-items:end}
.catalog-units{border:0;display:flex;gap:8px;flex-wrap:wrap}
.catalog-units button,.catalog-favorites-trigger,.catalog-load-more,.catalog-chip,.catalog-facet{min-height:48px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#5f534b;font:12px var(--sans);padding:10px 16px;cursor:pointer}
.catalog-units button[aria-pressed="true"],.catalog-facet[aria-pressed="true"]{background:var(--ruby);border-color:var(--ruby);color:#fff}
.catalog-results{max-width:1320px;margin:0 auto;padding:26px 32px 90px}
.catalog-grid,.catalog-skeleton-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px}
.catalog-card{min-width:0;background:#fff;border:1px solid var(--line);display:flex;flex-direction:column}
.catalog-card-photo{display:block;aspect-ratio:3/4;background:#efe6d8;overflow:hidden}
.catalog-card-photo img{width:100%;height:100%;object-fit:cover}
.catalog-card.is-image-error .catalog-card-photo img{display:none}
.catalog-card.is-image-error .catalog-card-photo::after{content:"Foto indisponível";height:100%;display:grid;place-items:center;color:#7d7068;font:12px var(--sans);letter-spacing:1px;text-transform:uppercase}
.catalog-card-meta{display:grid;gap:6px;padding:14px}
.catalog-card button{min-height:44px}
.catalog-gallery{width:min(1180px,calc(100vw - 32px));height:min(820px,calc(100dvh - 32px));padding:0;border:0;background:#17100e;color:#fff;overflow:hidden}
.catalog-gallery::backdrop{background:rgba(18,12,10,.86);backdrop-filter:blur(7px)}
.gallery-layout{display:grid;grid-template-columns:minmax(0,1fr) clamp(300px,31vw,420px);height:100%}
.gallery-media{position:relative;min-width:0;min-height:0;margin:0;display:grid;place-items:center;background:#0d0908;overflow:hidden}
.gallery-media img{max-width:100%;max-height:100%;object-fit:contain}
.gallery-panel{position:relative;overflow:auto;padding:clamp(34px,5vw,64px) 28px;background:var(--cream);color:var(--ink)}
.gallery-primary,.gallery-secondary{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px}
.gallery-media button:focus-visible{outline:3px solid #fff;outline-offset:4px}
.gallery-panel a:focus-visible,.gallery-panel button:focus-visible,.catalog-favorites a:focus-visible,.catalog-favorites button:focus-visible{outline:3px solid var(--ruby);outline-offset:4px}
@media(max-width:900px){.catalog-intro{grid-template-columns:1fr}.catalog-tools{position:relative;top:auto}.catalog-primary-filters{grid-template-columns:1fr}.gallery-layout{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.gallery-panel{max-height:42dvh}}
@media(max-width:680px){.catalog-intro{padding:30px 14px 18px}.catalog-shortcuts{display:flex;overflow-x:auto}.catalog-shortcut{flex:0 0 44%}.catalog-results{padding:18px 10px 78px}.catalog-grid,.catalog-skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.catalog-card-meta{padding:10px}.gallery-panel{padding:22px 16px;max-height:46dvh}}
@media(max-height:600px){.gallery-panel{max-height:34dvh;padding-block:14px}.gallery-panel #gallery-specs,.gallery-panel .gallery-note{display:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
```

O painel permanece fora de `.gallery-media`; não usar texto ou CTA central sobre a foto. Em viewport baixo, reduzir o painel e ocultar apenas detalhes secundários, mantendo título, código, unidade e CTAs acessíveis sem cobrir a imagem.

- [ ] **Step 5: Criar App mínimo com loading, erro, vazio, grade e paginação**

Criar `kl-catalog-app.js` com o mesmo wrapper UMD dos módulos puros. No Node, apenas exportar a API sem tocar `document`; no navegador, registrar `init()` no `DOMContentLoaded`. Expor `KLCatalog.App.init()` e `getSnapshot()` para QA. Nesta tarefa:

Exportar e usar internamente:

```javascript
function classifyData(raw, validate, phase) {
  if (phase === 'loading') return 'loading';
  if (!Array.isArray(raw)) return 'data-error';
  var report = validate(raw);
  if (!report || !report.ok) return 'data-error';
  return raw.length ? 'ready' : 'empty';
}

function pageWindow(total, page, batchSize) {
  total = Math.max(0, total || 0);
  page = Math.max(1, page || 1);
  batchSize = Math.max(1, batchSize || 12);
  var visible = Math.min(total, page * batchSize);
  return { page: page, visible: visible, hasMore: visible < total };
}

function createPagingController(options) {
  if (!options || typeof options.onRequestMore !== 'function') throw new TypeError('onRequestMore is required');
  var observer = null;
  return {
    requestManual: function () { return options.onRequestMore('manual'); },
    connect: function (sentinel) {
      if (typeof options.observerFactory !== 'function') return 'manual';
      observer = options.observerFactory(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) options.onRequestMore('observer');
      });
      observer.observe(sentinel);
      return 'automatic';
    },
    destroy: function () { if (observer) observer.disconnect(); },
  };
}

function gridImageFailurePolicy() {
  return { showPlaceholder: true, requestOriginal: false };
}
```

1. iniciar em `loading`; validar `window.KL_DATA` com `Core.validateProducts` antes de criar estado, favoritos ou cartões;
2. se a fonte não for array ou o relatório tiver qualquer erro, renderizar `data-error` com **Tentar novamente** (`location.reload()`) e link para `unidades.html`, emitir o diagnóstico agregado sem expor dados pessoais e não escrever no storage;
3. se a base validada for vazia, renderizar `empty`; se a base for válida mas os filtros produzirem zero, renderizar `no-results`, sem confundir nenhum dos dois com erro;
4. criar cartões apenas com `document.createElement`/`textContent`;
5. manter âncora real `Core.productDetailUrl(product)` na foto e no título;
6. usar somente `Core.thumbUrl(product)` na grade;
7. em erro da miniatura, aplicar `gridImageFailurePolicy()`, adicionar `.is-image-error`, remover o `src` e nunca usar `product.u`;
8. renderizar pelo resultado de `pageWindow(derived.products.length, state.page, Core.BATCH_SIZE)`;
9. criar no App uma única `requestMore(source)`: derivar o estado atual, retornar `false` se `hasMore` for falso e, caso contrário, substituir `state.page` por `state.page + 1`, fazer `history.replaceState`, renderizar grade/botão/`aria-live` e retornar `true`;
10. o botão chama `pagingController.requestManual()` e continua disponível mesmo com observer;
11. se `IntersectionObserver` existir, injetá-lo em `createPagingController` e observar o sentinel; se não existir, o modo `manual` permanece funcional;
12. `createPagingController` nunca guarda `page`, total, produtos ou URL: ele emite apenas `manual|observer` para `requestMore`; filtro/atalho redefine `state.page = 1` pelo pipeline canônico e `popstate` deriva exclusivamente de `pg`;
13. depois do primeiro render `ready` com cartões, chamar uma única vez `performance.mark('kl-catalog-first-grid')` quando a API existir; esse mark alimenta a comparação da Task 10 e não participa de tracking.

Estrutura obrigatória do cartão:

```javascript
function createCard(product, index) {
  var article = document.createElement('article');
  article.className = 'catalog-card';
  article.dataset.code = product.k;
  article.dataset.index = String(index);

  var photo = document.createElement('a');
  photo.className = 'catalog-card-photo';
  photo.href = Core.productDetailUrl(product);
  photo.setAttribute('aria-label', 'Ver peça ' + product.k);

  var image = document.createElement('img');
  image.alt = (product.l || 'Peça') + ' ' + product.k;
  image.loading = 'lazy';
  image.decoding = 'async';
  var thumb = Core.thumbUrl(product);
  if (thumb) image.src = thumb;
  else article.classList.add('is-image-error');
  image.addEventListener('error', function () {
    image.removeAttribute('src');
    article.classList.add('is-image-error');
  }, { once: true });
  photo.appendChild(image);

  var meta = document.createElement('div');
  meta.className = 'catalog-card-meta';
  var titleLink = document.createElement('a');
  titleLink.href = photo.href;
  titleLink.textContent = product.l || 'Peça';
  var code = document.createElement('span');
  var unit = Core.unitOf(product);
  if (!unit) throw new TypeError('createCard requires a validated product');
  var unitLabels = { barra: 'Barra da Tijuca', sf: 'São Francisco' };
  code.textContent = product.k + ' · ' + unitLabels[unit];
  var favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.dataset.favoriteCode = product.k;
  favorite.textContent = 'Salvar peça';
  meta.append(titleLink, code, favorite);
  article.append(photo, meta);
  return article;
}
```

- [ ] **Step 6: Rodar gates e abrir o primeiro preview**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-app.js
git diff --check
python3 -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173/catalogo.html`. Confirmar: loading some; pelo menos 12 cartões aparecem; links abrem `peca.html`; nenhuma imagem original é solicitada pela grade; botão manual carrega o lote seguinte.

- [ ] **Step 7: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/test_site_contract.py tests/catalog-app.test.cjs kl-catalog.css kl-catalog-app.js catalogo.html
git add tests/test_site_contract.py tests/catalog-app.test.cjs kl-catalog.css kl-catalog-app.js catalogo.html
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): monta shell editorial e grade progressiva" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: Busca, categorias, filtros e URL no App

**Files:**
- Modify: `tests/catalog-core.test.cjs`
- Modify: `tests/catalog-app.test.cjs`
- Modify: `kl-catalog-app.js`
- Modify: `kl-catalog.css`

- [ ] **Step 1: Adicionar casos de regressão sobre a base real**

Em `tests/catalog-core.test.cjs`, carregar `kl-catalog-data.js` sem rede usando `node:vm` e verificar:

```javascript
const fs = require('node:fs');
const vm = require('node:vm');

function realCatalog() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../kl-catalog-data.js'), 'utf8'), context);
  return context.window.KL_DATA;
}

test('base real mantém as 768 peças validadas, sete categorias e duas unidades', () => {
  const data = realCatalog();
  const report = Core.validateProducts(data);
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.equal(data.length, 768);
  assert.equal(new Set(data.map(item => item.k.trim().toUpperCase())).size, 768);
  assert.deepEqual(new Set(data.map(item => item.c)), new Set(Core.CATEGORY_ORDER));
  assert.deepEqual(new Set(data.map(item => item.un)), new Set(['barra', 'sf']));
  assert.equal(data.filter(item => item.un === 'barra').length, 551);
  assert.equal(data.filter(item => item.un === 'sf').length, 217);
});

test('base real expõe numerações de calçados e tamanhos altos', () => {
  const sizes = Core.derive(realCatalog(), Core.readState('', realCatalog())).facets.sizes;
  ['33', '39', '63', '66'].forEach(size => assert.ok(sizes[size] > 0));
});
```

Adicionar a `tests/catalog-app.test.cjs` um contrato do mesmo pipeline usado pelo observer e botão:

```javascript
test('requestMore atualiza o state externo e chama um único commit canônico', () => {
  let state = { page: 1 };
  const commits = [];
  const callbacks = [];
  const requestMore = App.createRequestMore({
    getState: () => state,
    getTotal: () => 25,
    batchSize: 12,
    commit: (next, meta) => { state = next; commits.push({ next, meta }); },
  });
  const paging = App.createPagingController({
    onRequestMore: requestMore,
    observerFactory: callback => ({ observe: () => callbacks.push(callback), disconnect() {} }),
  });
  paging.connect({});
  callbacks[0]([{ isIntersecting: true }]);
  assert.equal(state.page, 2);
  assert.deepEqual(commits[0].meta, { source: 'observer', replaceHistory: true });
  paging.requestManual();
  assert.equal(state.page, 3);
  callbacks[0]([{ isIntersecting: true }]);
  assert.equal(commits.length, 2);
});
```

- [ ] **Step 2: Rodar os testes Core e confirmar o comportamento da base**

Run: `node --test tests/catalog-core.test.cjs`

Expected: os novos testes podem revelar normalização ausente; corrigir Core somente se necessário, sem editar os dados.

- [ ] **Step 3: Fazer o App ser o único dono de estado e URL**

Manter uma única variável:

```javascript
var state = Core.readState(location.search, products);

function urlFor(nextState) {
  var query = Core.serializeState(nextState);
  return location.pathname + (query ? '?' + query : '') + location.hash;
}

function replaceState(nextState) {
  state = nextState;
  history.replaceState(history.state, '', urlFor(state));
  renderDerived();
}

function patchFilters(patch) {
  var previous = state;
  var requested = Object.assign({}, state, patch, { page: 1, openProduct: null });
  var derived = Core.derive(products, requested);
  state = derived.state;
  history.replaceState(history.state, '', urlFor(state));
  render(derived);
  announceRemovedSelections(previous, state);
}

function createRequestMore(options) {
  return function requestMore(source) {
    var current = options.getState();
    var windowState = pageWindow(options.getTotal(), current.page, options.batchSize);
    if (!windowState.hasMore) return false;
    var next = Object.assign({}, current, { page: current.page + 1 });
    options.commit(next, { source: source, replaceHistory: true });
    return true;
  };
}
```

`renderDerived()` deve sempre chamar `Core.derive(products, state)`, aceitar a versão sanitizada de `derived.state`, atribuir esse objeto a `currentDerived` antes do DOM e reescrever a URL se Core removeu parâmetros incompatíveis. Inicializar `currentDerived` no primeiro render. Exportar e usar `createRequestMore` com `getState: () => state`, `getTotal: () => currentDerived.products.length` e `commit(next, meta)` como o único ponto que atribui `state`, faz `history.replaceState(urlFor(state))`, recalcula `currentDerived` e chama `render(currentDerived, { loadSource: meta.source })`. Instanciar `createPagingController({ onRequestMore: requestMore, observerFactory })`; não criar contador paralelo. O retorno `false` impede tracking e rerender quando já chegou ao fim.

- [ ] **Step 4: Conectar todas as entradas ao mesmo estado**

- Busca: debounce de 180 ms; alterar somente `query`; não enviar termo ao tracking.
- Atalhos: alterar `category` pelo mesmo caminho do `<select>`.
- Categoria: `Todas` usa `null`; todas as sete opções ficam acessíveis.
- Unidade: botões atualizam `aria-pressed`; `Todas` usa `null`.
- Cores e tamanhos: renderizar dinamicamente a partir de `derived.facets`; OR dentro da faceta e AND entre facetas já vêm do Core.
- Chips ativos: cada botão remove exatamente um valor; incluir **Limpar refinamentos**.
- Seleções removidas automaticamente: anunciar em região `aria-live` sem repetir a cada render.
- `catalog-count`: usar número real de `derived.products`.
- Não chamar `window.scrollTo({top:0})`; o refinamento não pode arrancar a cliente do ponto atual.
- Toda alteração de busca/filtro/atalho usa `patchFilters`, redefine `page: 1` e atualiza o mesmo controller somente por render; `popstate` lê `pg` e jamais reaproveita estado interno do observer.
- Emitir após cada derivação:

```javascript
document.dispatchEvent(new CustomEvent('kl:catalog-state', {
  detail: {
    status: 'success',
    unit: state.unit,
    openProduct: state.openProduct,
    resultCount: derived.products.length,
  },
}));
```

- [ ] **Step 5: Restaurar lotes e rolagem sem colocar posição na URL**

- `pg` fica na URL e determina quantos lotes materializar.
- Em `pagehide`, guardar `{ y, focusCode }` no `sessionStorage` com chave baseada na URL sem `p`.
- Em carga sem `p`, restaurar rolagem após a grade atingir `pg` lotes.
- Se o código focado não estiver materializado, focar `#catalog-title`.
- Não alterar `history.scrollRestoration`; preservar o comportamento nativo do browser ao voltar de `peca.html`.

- [ ] **Step 6: Confirmar manualmente URLs e filtros**

Verificar no preview:

```text
catalogo.html?un=sf
catalogo.html?cat=ternos
catalogo.html?cat=calcados&tam=33
catalogo.html?q=vinho&co=vinho
catalogo.html?cat=invalida&un=invalida&co=invalida
```

Expected: controle visual e URL concordam; inválidos somem; tamanhos numéricos aparecem; nenhuma opção habilitada produz zero inevitável.

- [ ] **Step 7: Rodar gate completo e commit**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-app.js
git diff --check
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/catalog-core.test.cjs tests/catalog-app.test.cjs kl-catalog-app.js kl-catalog.css
git add tests/catalog-core.test.cjs tests/catalog-app.test.cjs kl-catalog-app.js kl-catalog.css
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): conecta busca filtros e URL" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Galeria imersiva, history e retorno exato

**Files:**
- Modify: `tests/helpers/fake-browser.cjs`
- Modify: `tests/catalog-gallery.test.cjs`
- Modify: `tests/catalog-app.test.cjs`
- Modify: `kl-catalog-gallery.js`
- Modify: `kl-catalog-app.js`
- Modify: `kl-catalog.css`

- [ ] **Step 1: Testar a máquina de history antes da integração**

Adicionar rastreamento de operações ao fake history (`push`, `replace`, `back`) e uma factory `createScrollEnvironment({ scrollY, innerWidth, clientWidth, paddingRight })` em `tests/helpers/fake-browser.cjs`. A factory retorna body/root com estilos inline mutáveis, `getComputedStyle`, `window.scrollTo` capturado, `initialStyles` e `snapshotStyles`, sem simular layout. Escrever `tests/catalog-app.test.cjs`. `createHistoryController(adapter)` e `createScrollLock(environment)` pertencem ao export UMD de `kl-catalog-app.js`; Gallery continua sem ler/escrever history ou scroll de fundo. Os testes devem provar exatamente:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, createScrollEnvironment } = require('./helpers/fake-browser.cjs');
const App = require('../kl-catalog-app.js');

test('grid usa push, troca usa replace e popstate nunca escreve', () => {
  const history = createHistory('/catalogo.html?un=sf');
  const controller = App.createHistoryController(history);
  controller.openFromGrid('/catalogo.html?un=sf&p=DB-010');
  assert.equal(history.snapshot().entries.length, 2);
  controller.replaceProduct('/catalogo.html?un=sf&p=NV-002');
  assert.equal(history.snapshot().entries.length, 2);
  assert.equal(controller.requestClose(), 'back');
  assert.equal(history.snapshot().index, 0);
  const before = history.snapshot().operations.length;
  controller.onPopState(null);
  assert.equal(history.snapshot().operations.length, before);
});

test('deep-link inicial fecha por replace sem sair do catálogo', () => {
  const history = createHistory('/catalogo.html?cat=vestidos-noiva&p=NV-001');
  const controller = App.createHistoryController(history, { initialDeepLink: true });
  controller.replaceProduct('/catalogo.html?cat=vestidos-noiva&p=NV-002');
  assert.equal(controller.requestClose('/catalogo.html?cat=vestidos-noiva'), 'replace');
  assert.equal(history.snapshot().entries.length, 1);
  assert.equal(history.snapshot().entries[0].url, '/catalogo.html?cat=vestidos-noiva');
});

test('popstate usa o mesmo pipeline de derive/render e nunca escreve history', () => {
  const history = createHistory('/catalogo.html?un=sf&p=DB-010');
  const controller = App.createHistoryController(history, { initialDeepLink: true });
  const renders = [];
  const galleryStates = [];
  const handler = App.createPopStateHandler({
    historyController: controller,
    readState: () => ({ openProduct: null, unit: 'sf' }),
    derive: state => ({ state, products: [] }),
    render: (derived, meta) => renders.push({ derived, meta }),
    syncGallery: code => galleryStates.push(code),
  });
  const before = history.snapshot().operations.length;
  handler({ state: null });
  assert.equal(history.snapshot().operations.length, before);
  assert.equal(renders.length, 1);
  assert.deepEqual(renders[0].meta, { fromPopState: true });
  assert.deepEqual(galleryStates, [null]);
});

test('scroll lock compensa scrollbar e restaura estilos e posição exatos', () => {
  const fake = createScrollEnvironment({ scrollY: 640, innerWidth: 1200, clientWidth: 1180, paddingRight: 4 });
  const lock = App.createScrollLock(fake.environment);
  assert.equal(lock.lock(), true);
  assert.equal(lock.lock(), false);
  assert.equal(fake.environment.body.style.position, 'fixed');
  assert.equal(fake.environment.body.style.top, '-640px');
  assert.equal(fake.environment.body.style.paddingRight, '24px');
  assert.equal(fake.environment.documentElement.style.overflow, 'hidden');
  assert.equal(lock.unlock(), true);
  assert.equal(lock.unlock(), false);
  assert.deepEqual(fake.scrollCalls, [[0, 640]]);
  assert.deepEqual(fake.snapshotStyles(), fake.initialStyles);
});
```

Adicionar separadamente a `tests/catalog-gallery.test.cjs`, importando `fixtures`, `createImageLoader` e `Gallery`:

```javascript
const fixtures = require('./helpers/catalog-fixtures.cjs');
const { createImageLoader } = require('./helpers/fake-browser.cjs');
const Gallery = require('../kl-catalog-gallery.js');

test('imagem ativa carrega antes de no máximo uma vizinha por lado', async () => {
  const loader = createImageLoader();
  const displayed = [];
  const policy = Gallery.createImageCoordinator({ load: loader.load, display: product => displayed.push(product.k) });
  const pending = policy.show(fixtures.slice(0, 3), 1);
  assert.equal(loader.requests.length, 1);
  loader.requests[0].resolve();
  await pending;
  assert.equal(displayed.at(-1), fixtures[1].k);
  assert.equal(loader.requests.length, 3);
});

test('resposta antiga não substitui produto mais recente', async () => {
  const loader = createImageLoader();
  const displayed = [];
  const policy = Gallery.createImageCoordinator({ load: loader.load, display: product => displayed.push(product.k) });
  const first = policy.show(fixtures.slice(0, 3), 0);
  const second = policy.show(fixtures.slice(0, 3), 1);
  loader.requests[0].resolve();
  await first;
  assert.deepEqual(displayed, []);
  loader.requests[1].resolve();
  await second;
  assert.equal(displayed.at(-1), fixtures[1].k);
});

test('falha da original mostra erro da galeria sem iniciar vizinhas', async () => {
  const loader = createImageLoader();
  const failed = [];
  const policy = Gallery.createImageCoordinator({ load: loader.load, display() {}, fail: product => failed.push(product.k) });
  const pending = policy.show(fixtures.slice(0, 3), 1);
  loader.requests[0].reject(new Error('synthetic'));
  await pending;
  assert.deepEqual(failed, [fixtures[1].k]);
  assert.equal(loader.requests.length, 1);
});

test('teclado e retorno de foco têm fallback determinístico', () => {
  assert.equal(Gallery.keyboardAction('ArrowLeft'), 'previous');
  assert.equal(Gallery.keyboardAction('ArrowRight'), 'next');
  assert.equal(Gallery.keyboardAction('Escape'), 'close');
  assert.equal(Gallery.keyboardAction('Enter'), null);
  const origin = { isConnected: false, id: 'origin' };
  const card = { isConnected: true, id: 'card' };
  const title = { isConnected: true, id: 'title' };
  assert.equal(Gallery.focusReturnTarget(origin, card, title), card);
  assert.equal(Gallery.focusReturnTarget(null, null, title), title);
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `node --test tests/catalog-app.test.cjs tests/catalog-gallery.test.cjs`

Expected: FAIL por `App.createHistoryController` e `Gallery.createImageCoordinator` ausentes.

- [ ] **Step 3: Implementar o controller testável dentro do App UMD**

Adicionar e exportar em `kl-catalog-app.js`:

```javascript
function createHistoryController(adapter, options) {
  options = options || {};
  var owned = !options.initialDeepLink && Boolean(adapter.getState() && adapter.getState().klCatalog && adapter.getState().klCatalog.gallery);

  function markedState() {
    return Object.assign({}, adapter.getState() || {}, { klCatalog: { gallery: true } });
  }

  function cleanState() {
    var next = Object.assign({}, adapter.getState() || {});
    delete next.klCatalog;
    return next;
  }

  return {
    openFromGrid: function (url) {
      adapter.pushState(markedState(), '', url);
      owned = true;
    },
    replaceProduct: function (url) {
      adapter.replaceState(markedState(), '', url);
    },
    requestClose: function (cleanUrl) {
      var action = owned ? 'back' : 'replace';
      if (action === 'back') adapter.back();
      else adapter.replaceState(cleanState(), '', cleanUrl);
      owned = false;
      return action;
    },
    onPopState: function (state) {
      owned = Boolean(state && state.klCatalog && state.klCatalog.gallery);
    },
  };
}

function createPopStateHandler(options) {
  return function (event) {
    options.historyController.onPopState(event.state);
    var derived = options.derive(options.readState());
    options.render(derived, { fromPopState: true });
    options.syncGallery(derived.state.openProduct || null);
    return derived;
  };
}

function createScrollLock(environment) {
  var locked = false;
  var saved = null;
  var bodyKeys = ['position', 'top', 'left', 'right', 'width', 'paddingRight', 'overflow'];

  function bodySnapshot() {
    return bodyKeys.reduce(function (out, key) {
      out[key] = environment.body.style[key] || '';
      return out;
    }, {});
  }

  return {
    lock: function () {
      if (locked) return false;
      var y = Math.max(0, environment.window.scrollY || 0);
      var gap = Math.max(0, (environment.window.innerWidth || 0) - (environment.documentElement.clientWidth || 0));
      var computed = environment.getComputedStyle(environment.body);
      var basePadding = parseFloat(computed.paddingRight) || 0;
      saved = { y: y, body: bodySnapshot(), rootOverflow: environment.documentElement.style.overflow || '' };
      environment.body.style.position = 'fixed';
      environment.body.style.top = '-' + y + 'px';
      environment.body.style.left = '0';
      environment.body.style.right = '0';
      environment.body.style.width = '100%';
      environment.body.style.overflow = 'hidden';
      if (gap) environment.body.style.paddingRight = String(basePadding + gap) + 'px';
      environment.documentElement.style.overflow = 'hidden';
      locked = true;
      return true;
    },
    unlock: function (options) {
      if (!locked) return false;
      bodyKeys.forEach(function (key) { environment.body.style[key] = saved.body[key]; });
      environment.documentElement.style.overflow = saved.rootOverflow;
      var y = saved.y;
      saved = null;
      locked = false;
      if (!options || options.restoreScroll !== false) environment.window.scrollTo(0, y);
      return true;
    },
    isLocked: function () { return locked; },
  };
}
```

No navegador, criar um adapter com `getState: () => history.state` e os três métodos nativos ligados a `history`. O App usa esse controller, `createPopStateHandler` e `createScrollLock`; não manter uma segunda implementação paralela. Exportar os três para o teste Node. O lock captura e restaura os estilos inline existentes, calcula a compensação pela largura real da scrollbar e é idempotente.

- [ ] **Step 4: Completar `Gallery.create(options)` sem ownership de history**

`options` obrigatório:

```text
dialog, image, products, core, actions,
onNavigate(code), onRequestClose(), onFavorite(code), isFavorite(code), onTrack(name, payload)
```

Implementar:

- `dialog.showModal()` e `dialog.close()`; o `<dialog>` nativo mantém foco contido;
- evento `cancel`: `preventDefault()` e `onRequestClose()`;
- clique no backdrop: somente quando `event.target === dialog`;
- setas esquerda/direita: navegar; Escape usa o `cancel`/request close;
- touch: registrar `pointerdown` e `pointerup`; trocar somente com deslocamento horizontal mínimo de 48 px e predominante sobre o vertical;
- guardar o elemento originador; App decide a restauração;
- preencher dados com `textContent` e helpers de Actions;
- ocultar `gallery-try-on` quando `Actions.tryOnHref(product)` for `null`;
- WhatsApp individual sempre via `Actions.productWhatsAppHref(product, Actions.CONTACTS)`;
- `isReady()` só fica true depois de todos os elementos e callbacks serem validados.

Implementar e exportar `keyboardAction(key)` e `focusReturnTarget(origin, materializedCard, title)`. O primeiro é a única tabela de teclas usada pelos listeners; o segundo retorna o primeiro elemento conectado entre origem, cartão rematerializado e `#catalog-title`. Tab/Shift+Tab continuam sob o `<dialog>` nativo e são validados em navegador real.

```javascript
function keyboardAction(key) {
  return ({ ArrowLeft: 'previous', ArrowRight: 'next', Escape: 'close' })[key] || null;
}

function focusReturnTarget(origin, materializedCard, title) {
  return [origin, materializedCard, title].find(function (element) {
    return element && element.isConnected;
  }) || null;
}
```

- [ ] **Step 5: Implementar a política de imagens com token de corrida**

Dentro de Gallery, implementar e exportar `createImageCoordinator`. `load(url)` é injetável nos testes e, no navegador, usa uma Promise em torno de `new Image()`:

```javascript
function createImageCoordinator(options) {
  var guard = createRequestGuard();
  var cache = new Map();

  function request(url) {
    if (!cache.has(url)) cache.set(url, options.load(url));
    return cache.get(url);
  }

  function show(products, index) {
    var product = products[index];
    var token = guard.next(product.k);
    return request(product.u).then(function () {
      if (!guard.isCurrent(token, product.k)) return;
      options.display(product);
      neighborIndexes(index, products.length).forEach(function (neighbor) {
        request(products[neighbor].u).catch(function () {});
      });
    }).catch(function () {
      if (guard.isCurrent(token, product.k) && options.fail) options.fail(product);
    });
  }

  return { show: show };
}
```

Gallery mostra a miniatura imediatamente e chama o coordinator para a original. Se a original falhar, `options.fail` aplica um placeholder nomeado “Foto indisponível”, mantém código/ações da peça e não inicia preload de vizinhas. Nunca iterar todas as peças para criar `Image`.

- [ ] **Step 6: Integrar history somente no App**

Fluxo obrigatório:

```javascript
var historyController = createHistoryController({
  getState: function () { return history.state; },
  pushState: history.pushState.bind(history),
  replaceState: history.replaceState.bind(history),
  back: history.back.bind(history),
}, { initialDeepLink: Boolean(state.openProduct) });

var scrollLock = createScrollLock({
  window: window,
  body: document.body,
  documentElement: document.documentElement,
  getComputedStyle: window.getComputedStyle.bind(window),
});

function openFromGrid(code, origin) {
  galleryOrigin = origin;
  var next = Object.assign({}, state, { openProduct: code });
  historyController.openFromGrid(urlFor(next));
  state = next;
  scrollLock.lock();
  try { gallery.open(code, origin); }
  catch (error) { scrollLock.unlock(); throw error; }
}

function replaceGalleryProduct(code) {
  state = Object.assign({}, state, { openProduct: code });
  historyController.replaceProduct(urlFor(state));
  gallery.update(code);
}

function requestGalleryClose() {
  var next = Object.assign({}, state, { openProduct: null });
  var action = historyController.requestClose(urlFor(next));
  if (action === 'replace') {
    state = next;
    gallery.close();
    scrollLock.unlock();
    focusAfterDirectLink();
  }
}

var onPopState = createPopStateHandler({
  historyController: historyController,
  readState: function () { return Core.readState(location.search, products); },
  derive: function (next) { state = next; var out = Core.derive(products, state); state = out.state; return out; },
  render: render,
  syncGallery: function (code) {
    if (code) {
      scrollLock.lock();
      gallery.open(code, null);
    } else {
      gallery.close();
      scrollLock.unlock();
      restoreGalleryOrigin();
    }
  },
});
window.addEventListener('popstate', onPopState);
window.addEventListener('pagehide', function () { scrollLock.unlock({ restoreScroll: false }); }, { once: true });
```

No bootstrap, se `state.openProduct` vier de deep-link, chamar `scrollLock.lock()` imediatamente antes de `gallery.open(...)`. `render(..., { fromPopState: true })` é proibido de chamar `pushState` ou `replaceState`. Anterior/próxima chama `replaceGalleryProduct`. Clique na âncora só chama `preventDefault()` se `Gallery.shouldInterceptProductLink(event, gallery.isReady())` retornar true. Toda saída da galeria — fechar, Escape, backdrop, Voltar, deep-link por replace, erro durante abertura e `pagehide` — deve liberar o lock exatamente uma vez; navegar entre peças não libera nem recria o lock.

- [ ] **Step 7: Validar deep-link, foco, teclado e requisições**

No navegador:

1. abrir por clique e confirmar que Voltar fecha sem sair do catálogo;
2. avançar três peças e confirmar que o histórico continua com somente uma entrada de galeria;
3. abrir diretamente `?cat=vestidos-noiva&p=NV-001` e fechar sem sair da página;
4. testar Escape, setas, Tab e Shift+Tab;
5. fechar e confirmar foco no cartão originador; em deep-link, cartão materializado ou título;
6. Cmd/Ctrl+clique e clique do meio continuam abrindo `peca.html`;
7. após abrir uma peça, contar no máximo três originais solicitadas antes de qualquer navegação manual;
8. trocar rápido e confirmar que imagem atrasada não sobrescreve a atual.
9. com página rolada, confirmar que wheel/touch não move a grade sob o modal e que abrir não causa salto horizontal;
10. fechar por botão, Escape, backdrop e Voltar, verificando `scrollY` restaurado (tolerância de 1 px), estilos inline originais recuperados e foco no alvo correto.

- [ ] **Step 8: Rodar gates e commit**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-gallery.js
node --check kl-catalog-app.js
git diff --check
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/helpers/fake-browser.cjs tests/catalog-gallery.test.cjs tests/catalog-app.test.cjs kl-catalog-gallery.js kl-catalog-app.js kl-catalog.css
git add tests/helpers/fake-browser.cjs tests/catalog-gallery.test.cjs tests/catalog-app.test.cjs kl-catalog-gallery.js kl-catalog-app.js kl-catalog.css
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): entrega galeria imersiva acessível" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Visualização dedicada de favoritos

**Files:**
- Modify: `tests/catalog-actions.test.cjs`
- Modify: `kl-catalog-app.js`
- Modify: `kl-catalog.css`

- [ ] **Step 1: Completar testes de grupos, códigos órfãos e múltiplos lotes**

Adicionar:

```javascript
test('groups preserva unidades e expõe órfãos até limpeza consentida', () => {
  const storage = createStorage({ 'kl-favoritos-v1': JSON.stringify(['NV-001', 'NV-002', 'NAO-EXISTE']) });
  const favorites = Actions.createFavorites(storage, fixtures);
  const groups = favorites.groups();
  assert.deepEqual(groups.barra.map(item => item.k), ['NV-001']);
  assert.deepEqual(groups.sf.map(item => item.k), ['NV-002']);
  assert.deepEqual(favorites.orphans(), ['NAO-EXISTE']);
  assert.deepEqual(favorites.codes(), ['NAO-EXISTE', 'NV-001', 'NV-002']);
  favorites.cleanupOrphans();
  assert.deepEqual(favorites.codes(), ['NV-001', 'NV-002']);
});

test('cada lote mantém numeração e destino da própria unidade', () => {
  const items = Array.from({ length: 180 }, (_, index) => ({ ...fixtures[index % fixtures.length], k: 'F-' + index, un: index < 90 ? 'barra' : 'sf' }));
  const batches = Actions.buildFavoriteBatches(items, contacts, 420);
  batches.forEach(batch => {
    assert.ok(batch.index >= 1 && batch.index <= batch.total);
    assert.match(batch.href, new RegExp('wa.me/' + contacts[batch.unit]));
  });
});
```

- [ ] **Step 2: Confirmar testes Actions verdes antes do DOM**

Run: `node --test tests/catalog-actions.test.cjs`

Expected: todos passam; corrigir somente Actions se algum contrato ainda não estiver atendido.

- [ ] **Step 3: Instanciar um único repositório de favoritos no App**

```javascript
var favorites = Actions.createFavorites(window.localStorage, products);

function syncFavoriteControls() {
  var codes = new Set(favorites.items().map(function (item) { return item.k; }));
  document.getElementById('catalog-favorite-count').textContent = String(codes.size);
  document.querySelectorAll('[data-favorite-code]').forEach(function (button) {
    var saved = codes.has(button.dataset.favoriteCode);
    button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    button.textContent = saved ? 'Peça salva' : 'Salvar peça';
  });
}
```

Delegar clique da grade e da galeria para o mesmo `favorites.toggle(code)`, depois chamar `syncFavoriteControls()`, atualizar Gallery e emitir tracking sem acessar `fbq` diretamente.

- [ ] **Step 4: Renderizar o diálogo agrupado por unidade**

`renderFavorites()` deve:

1. limpar por `replaceChildren()`;
2. mostrar estado vazio com link de volta ao catálogo;
3. criar uma seção **Barra da Tijuca** e outra **São Francisco** somente quando tiverem itens;
4. listar foto miniatura, código e botão remover, usando `textContent`;
5. criar um botão por lote retornado por `Actions.buildFavoriteBatches(group, Actions.CONTACTS, 1800)`;
6. rotular `Enviar lista 1 de N — Barra da Tijuca` ou equivalente;
7. chamar `window.open(batch.href, '_blank', 'noopener')` somente no clique explícito;
8. manter o aviso de confirmação de disponibilidade;
9. nunca criar uma ação única que misture unidades;
10. quando `favorites.orphans().length > 0`, mostrar “X referências antigas não estão mais no catálogo” e um botão **Limpar referências antigas**;
11. chamar `favorites.cleanupOrphans()` somente após o clique nesse botão, renderizar novamente e anunciar a limpeza em `aria-live`.

Abrir com `favoritesDialog.showModal()` e fechar por botão ou `cancel`. Ao fechar, devolver foco para `#catalog-open-favorites`.

- [ ] **Step 5: Refinar CSS sem criar uma terceira linguagem visual**

Usar Ruby/Baunilha/dourado, bordas e famílias existentes. O diálogo deve funcionar como uma folha clara:

```css
.catalog-favorites{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px);border:0;padding:0;background:var(--cream);color:var(--ink)}
.catalog-favorites::backdrop{background:rgba(18,12,10,.72)}
.favorites-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:20px 22px;background:var(--cream);border-bottom:1px solid var(--line)}
.favorites-group{padding:22px;border-bottom:1px solid var(--line)}
.favorites-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.favorites-item img{width:100%;aspect-ratio:3/4;object-fit:cover;background:#efe6d8}
.favorites-batches{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.favorites-batches a,.favorites-batches button{min-height:48px}
```

- [ ] **Step 6: Validar fluxo misto no navegador**

Salvar pelo menos uma peça de cada unidade, recarregar, abrir favoritos, remover uma, abrir novamente e confirmar:

- persistência v1;
- grupos separados;
- aviso de referência antiga preservada e limpeza somente após clique explícito;
- botões separados;
- unidade correta em cada URL;
- foco volta ao gatilho;
- nenhuma URL maior que 1.800 caracteres.

- [ ] **Step 7: Rodar gates e commit**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-actions.js
node --check kl-catalog-app.js
git diff --check
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/catalog-actions.test.cjs kl-catalog-app.js kl-catalog.css
git add tests/catalog-actions.test.cjs kl-catalog-app.js kl-catalog.css
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(catalogo): organiza favoritos por unidade" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 9: Tracking explícito, CTA compartilhado e fallback de detalhe

**Files:**
- Modify: `tests/test_site_contract.py`
- Create: `tests/helpers/fake-tracking-browser.cjs`
- Create: `tests/catalog-tracking.test.cjs`
- Create: `tests/site-enhance-routing.test.cjs`
- Modify: `tests/catalog-app.test.cjs`
- Modify: `kl-tracking.js`
- Modify: `kl-site-enhance.js`
- Modify: `kl-catalog-app.js`
- Modify: `peca.html:3-24`
- Modify mechanically: `index.html`, `sobre.html`, `catalogo.html`, `como-chegar.html`, `servicos.html`, `unidades.html`, `noivas.html`, `debutantes.html`, `madrinhas.html`, `peca.html`
- Modify: `ternos.html` (duas rotas explícitas auditadas + versões compartilhadas)
- Modify: `provar.html` (fallback local de atendimento + versões compartilhadas)

- [ ] **Step 1: Escrever contratos falhos para a integração compartilhada**

Adicionar aos testes Python:

```python
SHARED_SCRIPT_PAGES = (
    "index.html", "sobre.html", "catalogo.html", "como-chegar.html",
    "servicos.html", "unidades.html", "noivas.html", "debutantes.html",
    "madrinhas.html", "ternos.html", "peca.html", "provar.html",
)

class CatalogIntegrationContractTest(unittest.TestCase):
    def test_tracking_uses_real_catalog_source_and_explicit_api(self):
        js = page("kl-tracking.js")
        self.assertIn("window.KL_DATA", js)
        self.assertNotIn("window.DATA", js)
        self.assertNotIn("window.filtered", js)
        self.assertIn("window.KLTracking", js)
        self.assertIn("catalog:", js)
        self.assertNotIn("query_text", js)
        self.assertNotIn("query_value", js)

    def test_shared_cta_has_no_catalog_or_detail_store_fallback(self):
        js = page("kl-site-enhance.js")
        self.assertIn("kl:catalog-state", js)
        self.assertIn("unidades.html", js)
        self.assertNotRegex(js, r"k==='catalogo'\|\|k==='peca'\?'\d+")

    def test_detail_uses_shared_modules_and_exact_try_on_allowlist(self):
        html = page("peca.html")
        self.assertIn('src="kl-catalog-core.js?v=20260715catalog1"', html)
        self.assertIn('src="kl-catalog-actions.js?v=20260715catalog1"', html)
        self.assertIn("Actions.tryOnHref", html)
        self.assertNotIn("d.c.indexOf('vestidos')===0", html)
        self.assertIn("Core.thumbUrl", html)

    def test_every_shared_page_uses_new_cache_versions(self):
        for name in SHARED_SCRIPT_PAGES:
            with self.subTest(page=name):
                html = page(name)
                self.assertIn('src="kl-tracking.js?v=20260715catalog1"', html)
                self.assertIn('src="kl-site-enhance.js?v=20260715catalog1"', html)
```

Criar `tests/helpers/fake-tracking-browser.cjs` com `node:vm`. A factory `loadTracking({ search, products })` deve:

- ler `kl-tracking.js` com `fs.readFileSync`;
- fornecer `window`, `document`, `location`, `sessionStorage` opcionalmente semeado, `URL`, `URLSearchParams`, timers inertes e `requestAnimationFrame`;
- manter `document.readyState = 'loading'` e registrar, sem disparar, o callback de `DOMContentLoaded`, evitando efeitos de scroll/intervalo no teste;
- expor `window.KL_DATA = products`;
- substituir `window.fbq` por uma função que captura argumentos;
- retornar `{ window, fbqCalls, storage }`.

Criar `tests/catalog-tracking.test.cjs` e executar o arquivo real, não uma cópia do sanitizer:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTracking } = require('./helpers/fake-tracking-browser.cjs');

const ALLOWED_EVENTS = [
  'KL_Catalog_Loaded', 'KL_Catalog_Error', 'KL_Catalog_Search',
  'KL_Filter_Change', 'KL_Catalog_Load_More', 'KL_Product_Open',
  'KL_Product_Navigate', 'KL_Favorite_Toggle', 'KL_Favorites_View',
  'KL_WhatsApp_Click', 'KL_Try_On_Click', 'KL_Catalog_Empty',
];

test('KLTracking.catalog envia toda a matriz permitida e rejeita evento desconhecido', () => {
  const rawEmail = 'nome' + '@' + 'example.invalid';
  const rawPhone = '101' + '202' + '3030';
  const env = loadTracking({
    search: '?q=' + encodeURIComponent(rawEmail + ' ' + rawPhone) + '&utm_source=instagram',
    products: [{ c: 'vestidos-noiva', l: 'Noivas', k: 'NV-001', un: 'barra', t: 'M', co: 'off-white', u: 'https://img.test/NV-001.jpg' }],
  });
  ALLOWED_EVENTS.forEach(name => env.window.KLTracking.catalog(name, {
    productCode: 'NV-001', resultCount: 1, category: 'vestidos-noiva', unit: 'barra',
    queryLength: 6, queryHasProductCode: 'yes', favoriteCount: 1,
    source: name === 'KL_Catalog_Loaded' ? rawEmail : 'catalog',
    query: rawEmail, term: rawPhone, email: rawEmail, phone: rawPhone,
  }));
  env.window.KLTracking.catalog('KL_Not_Allowed', { productCode: 'NV-001' });

  const custom = env.fbqCalls.filter(args => args[0] === 'trackCustom');
  assert.deepEqual(custom.map(args => args[1]), ALLOWED_EVENTS);
  const serialized = JSON.stringify(custom);
  assert.doesNotMatch(serialized, new RegExp(rawEmail.replace('.', '\\.')));
  assert.doesNotMatch(serialized, new RegExp(rawPhone));
  custom.forEach(args => {
    assert.equal(args[2].page_path, '/catalogo.html');
    assert.equal(args[2].landing_path, '/catalogo.html');
    assert.ok(!JSON.stringify(args[2]).includes('?q='));
  });
});

test('migra landing_path legado removendo query antes do envio', () => {
  const rawEmail = 'legado' + '@' + 'example.invalid';
  const env = loadTracking({
    search: '',
    storage: { kl_landing_path: '/catalogo.html?q=' + encodeURIComponent(rawEmail) },
    products: [],
  });
  env.window.KLTracking.catalog('KL_Catalog_Empty', { resultCount: 0, source: 'data' });
  const payload = env.fbqCalls.find(args => args[1] === 'KL_Catalog_Empty')[2];
  assert.equal(payload.landing_path, '/catalogo.html');
  assert.doesNotMatch(JSON.stringify(payload), /legado|example\.invalid/i);
  assert.equal(env.storage.getItem('kl_landing_path'), '/catalogo.html');
});
```

Agora, e somente agora, retirar os hashes antigos de `kl-tracking.js` e `kl-site-enhance.js` do contrato de Home. Substituí-los pelos contratos semânticos acima e manter o hash de `kl-catalog-data.js`.

- [ ] **Step 2: Rodar e confirmar RED**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_site_contract.CatalogIntegrationContractTest -v
node --test tests/catalog-tracking.test.cjs
```

Expected: Python falha por API/versões ausentes e referências a `window.DATA/window.filtered`; Node falha porque `window.KLTracking.catalog` ainda não existe.

- [ ] **Step 3: Expor `KLTracking.catalog` sem mudar o Pixel**

Em `kl-tracking.js`:

1. trocar a fonte primária por `window.KL_DATA`;
2. usar `data-code` do cartão antes de inferência por texto;
3. remover dependência de `window.filtered`;
4. em `productParams`, aceitar unidade somente quando for `barra` ou `sf`; não usar `d.un || 'barra'`;
5. remover a classificação histórica `itaborai` de `getStoreFromHref`, mantendo apenas as duas unidades ativas;
6. preservar `track()` e seu uso de `fbq('trackCustom', ...)`;
7. preservar `fbq('init', ...)`, PageView, atribuição, fila, scroll e engajamento;
8. ignorar clique delegado quando o elemento tiver `data-kl-track-manual="true"`;
9. em `bindSearch`, retornar sem listener quando o input tiver `data-kl-track-manual="true"`;
10. em `bindCatalogFilterPatches`, não criar `MutationObserver` quando o App explícito estiver ativo;
11. em `getPersistedAttribution`, nunca guardar `location.search` dentro de `landing_path`; persistir somente `clean(location.pathname, 160)`. Ao ler um valor legado, remover tudo a partir de `?` ou `#`, regravar a forma limpa e só então adicioná-la ao payload. Os campos UTM existentes continuam sanitizados individualmente, mas `q`, `cat`, `un`, `co`, `tam`, `p` e `pg` jamais entram indiretamente no payload;
12. sanitizar `baseParams.catalog_category` e `baseParams.catalog_unit` pelas mesmas allowlists do catálogo, sem copiar atributo DOM arbitrário;
13. expor:

```javascript
function catalog(eventName, context) {
  context = context || {};
  var allowed = {
    KL_Catalog_Loaded: true,
    KL_Catalog_Error: true,
    KL_Catalog_Search: true,
    KL_Filter_Change: true,
    KL_Catalog_Load_More: true,
    KL_Product_Open: true,
    KL_Product_Navigate: true,
    KL_Favorite_Toggle: true,
    KL_Favorites_View: true,
    KL_WhatsApp_Click: true,
    KL_Try_On_Click: true,
    KL_Catalog_Empty: true,
  };
  if (!allowed[eventName]) return;
  var product = context.productCode ? getProductByCode(context.productCode) : null;
  var categories = ['vestidos-noiva', 'vestidos-debutante', 'vestidos-madrinha', 'ternos', 'bolsas', 'calcados', 'acessorios'];
  var sources = ['bootstrap', 'data-source', 'catalog', 'manual', 'observer', 'grid', 'deep-link', 'previous', 'next', 'swipe', 'gallery', 'favorites', 'data', 'filters', 'category', 'unit', 'color', 'size', 'shortcut', 'chip', 'clear'];
  function enumValue(value, allowedValues) {
    value = String(value || '');
    return allowedValues.indexOf(value) > -1 ? value : '';
  }
  function count(value, max) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : undefined;
  }
  var params = Object.assign({}, productParams(product), {
    result_count: count(context.resultCount, 100000),
    catalog_category: enumValue(context.category, categories),
    catalog_unit: enumValue(context.unit, ['barra', 'sf']),
    query_length: count(context.queryLength, 80),
    query_has_product_code: context.queryHasProductCode === 'yes' ? 'yes' : 'no',
    favorite_count: count(context.favoriteCount, 10000),
    source: enumValue(context.source, sources),
  });
  if (eventName === 'KL_Catalog_Search' && context.productCode && product) {
    params.product_code = product.k;
  }
  track(eventName, params);
}

window.KLTracking = Object.freeze({ catalog: catalog });
```

Não aceitar `query`, `term`, `email`, `phone` ou texto livre no contexto. O App usa `Core.buildSearchTelemetry(...)` e mapeia somente os campos estruturados.

O teste runtime deve passar depois dessa mudança e provar o payload **final**, já combinado com `baseParams` e atribuição. Não expor uma API de teste alternativa que contorne `track()`.

- [ ] **Step 4: Centralizar emissões do App e eliminar duplicidade**

Criar no App:

```javascript
function trackCatalog(name, context) {
  if (window.KLTracking && typeof window.KLTracking.catalog === 'function') {
    window.KLTracking.catalog(name, context || {});
  }
}
```

Marcar botões/links que o App mede manualmente com `data-kl-track-manual="true"`. Não chamar `fbq` diretamente em App, Gallery ou Actions. Eventos de busca recebem o resultado de `Core.buildSearchTelemetry`, nunca `state.query`.

Conectar e verificar esta matriz completa; cada linha tem um único dono:

| Evento | Gatilho único | Contexto permitido |
|---|---|---|
| `KL_Catalog_Loaded` | uma vez após base validada e primeiro render pronto | `resultCount`, `category`, `unit`, `source=bootstrap` |
| `KL_Catalog_Error` | uma vez ao entrar em `data-error` | `source=data-source` sem conteúdo do erro |
| `KL_Catalog_Search` | após debounce de busca não vazia e derivação concluída | saída de `buildSearchTelemetry` mapeada campo a campo |
| `KL_Filter_Change` | clique/alteração em atalho, categoria, unidade, cor, tamanho, chip ou limpar | `category`, `unit`, `resultCount`, `source` em enum fixa |
| `KL_Catalog_Load_More` | um evento por incremento real de página, manual ou observer | `resultCount`, `source=manual|observer` |
| `KL_Product_Open` | galeria aberta a partir da grade ou deep-link materializado | `productCode`, `source=grid|deep-link` |
| `KL_Product_Navigate` | código ativo muda por seta, teclado ou swipe | `productCode`, `source=previous|next|swipe` |
| `KL_Favorite_Toggle` | salvar/remover concluído | `productCode`, `favoriteCount`, `source=grid|gallery|favorites` |
| `KL_Favorites_View` | diálogo de salvos aberto | `favoriteCount`, `source=favorites` |
| `KL_WhatsApp_Click` | clique explícito em CTA de peça ou lote dentro do catálogo | `productCode` quando houver, `unit`, `favoriteCount`, `source=gallery|favorites` |
| `KL_Try_On_Click` | clique em **Provar em mim** | `productCode`, `source=gallery` |
| `KL_Catalog_Empty` | transição para base vazia ou filtros sem resultado | `resultCount=0`, `category`, `unit`, `source=data|filters` |

Adicionar a `tests/catalog-app.test.cjs` uma fake `KLTracking.catalog` e exercitar as ações públicas/controladores correspondentes, provando que cada ação emite exatamente o nome da linha e que re-render sem ação, `popstate` e clique delegado marcado não duplicam evento. O teste runtime de `tests/catalog-tracking.test.cjs` continua sendo o gate do payload final.

- [ ] **Step 5: Corrigir o CTA compartilhado pela matriz aprovada**

Refatorar `kl-site-enhance.js` para UMD leve: no Node exporta `resolveStickyCta(context, contacts)` sem tocar DOM; no navegador expõe `window.KLSiteEnhance`, monta o sticky e preserva fechar/persistência/evento `KL_Sticky_CTA_Click`. O mount deve aguardar `DOMContentLoaded` quando necessário, garantindo que Data/Core/Actions carregados com `defer` estejam disponíveis antes de resolver `peca.html` e `provar.html`. Manter os dois contatos públicos existentes sem alterar valores.

Aplicar a matriz auditada rota por rota:

| Rota | Destino compartilhado | Motivo/contrato |
|---|---|---|
| `catalogo.html?un=barra|sf` | WhatsApp da unidade selecionada | escolha explícita da cliente |
| `catalogo.html` sem unidade ou em erro | `unidades.html` | catálogo misto, sem presunção |
| `peca.html?codigo=...` | WhatsApp de `product.un` validado | peça real define unidade |
| `provar.html?p=...` | WhatsApp de `product.un` validado | peça real define unidade |
| `peca.html`/`provar.html` sem peça válida | `unidades.html` | sem presunção |
| `noivas.html` | Barra | preservar a rota pública de campanha já existente |
| `debutantes.html` | Barra | preservar a campanha e todas as 72 peças atuais estão na Barra |
| `madrinhas.html` | São Francisco | preservar a rota pública de campanha já existente |
| `ternos.html` | Barra | corrigir divergência: as 7 peças atuais estão na Barra, não em São Francisco |
| `index.html`, `sobre.html`, `servicos.html` | `unidades.html` | páginas institucionais sem unidade inequívoca |
| `unidades.html`, `como-chegar.html` | `unidades.html` | a própria cliente escolhe entre as duas lojas |

Não inferir unidade por categoria fora das quatro rotas de campanha explicitamente auditadas. Corrigir os dois CTAs explícitos de `ternos.html` para o contato da Barra; preservar sem alteração os CTAs explícitos de Noivas, Debutantes e Madrinhas.

Criar `tests/site-enhance-routing.test.cjs`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const Site = require('../kl-site-enhance.js');
const contacts = { barra: '101', sf: '202' };

test('matriz pública preserva campanhas e não presume loja no catálogo misto', () => {
  assert.match(Site.resolveStickyCta({ page: 'noivas' }, contacts).href, /wa\.me\/101/);
  assert.match(Site.resolveStickyCta({ page: 'debutantes' }, contacts).href, /wa\.me\/101/);
  assert.match(Site.resolveStickyCta({ page: 'madrinhas' }, contacts).href, /wa\.me\/202/);
  assert.match(Site.resolveStickyCta({ page: 'ternos' }, contacts).href, /wa\.me\/101/);
  assert.equal(Site.resolveStickyCta({ page: 'catalogo', unit: null }, contacts).href, 'unidades.html');
  assert.match(Site.resolveStickyCta({ page: 'catalogo', unit: 'sf' }, contacts).href, /wa\.me\/202/);
  assert.equal(Site.resolveStickyCta({ page: 'index' }, contacts).href, 'unidades.html');
});

test('detalhe e prova usam somente unidade válida da peça', () => {
  assert.match(Site.resolveStickyCta({ page: 'peca', product: { k: 'NV-001', un: 'barra' } }, contacts).href, /wa\.me\/101/);
  assert.match(Site.resolveStickyCta({ page: 'provar', product: { k: 'NV-002', un: 'sf' } }, contacts).href, /wa\.me\/202/);
  assert.equal(Site.resolveStickyCta({ page: 'peca', product: { k: 'X', un: 'invalida' } }, contacts).href, 'unidades.html');
});
```

Adicionar ao Python contratos que confirmem os contatos explícitos de `noivas.html`, `debutantes.html`, `madrinhas.html` e `ternos.html`, além de provar na base real que as categorias Debutantes e Ternos continuam 100% Barra. Mudança futura nessa distribuição deve falhar e forçar nova decisão, não trocar a loja silenciosamente.

Em `provar.html`, manter toda a jornada/Worker intactos e mudar somente `waLink()`: resolver `UNITS[picked.un]` quando `picked` e unidade forem válidos; caso contrário retornar `unidades.html`. Adicionar contrato Python que proíba `: UNITS.barra` nessa função e preserve os dois números públicos no arquivo.

O listener:

```javascript
document.addEventListener('kl:catalog-state', function (event) {
  var detail = event.detail || {};
  updateDestination({ page: 'catalogo', unit: detail.unit, status: detail.status });
});
```

- [ ] **Step 6: Fazer `peca.html` consumir os helpers compartilhados**

Carregar Data, Core, Actions e Tracking com `defer`, nessa ordem. No renderer:

- obter `Core` e `Actions` de `window.KLCatalog`;
- distinguir `window.KL_DATA` ausente de código não encontrado e exigir `Core.validateProducts(window.KL_DATA).ok` antes de resolver a peça;
- usar `Actions.productWhatsAppHref(d, Actions.CONTACTS)`;
- usar `Actions.tryOnHref(d)` e só renderizar se não for `null`;
- usar `Core.thumbUrl(x)` nas quatro relacionadas; falha vira placeholder, nunca original automática;
- manter a imagem principal original da peça;
- manter `catalogo.html?cat=<categoria>&p=<código>`;
- preservar exatamente uma chamada padrão `fbq('track','ViewContent', ...)` no detalhe, porque removê-la mudaria a medição existente;
- não emitir `KL_Product_Open` adicional em `peca.html`; o hook existente transforma esse `ViewContent` em um único `KL_Product_View` com o produto real. `KL_Product_Open` explícito fica reservado à galeria do catálogo.

- [ ] **Step 7: Atualizar versões mecanicamente nas 12 páginas**

Trocar apenas:

```text
kl-tracking.js?v=20260710deep3 -> kl-tracking.js?v=20260715catalog1
kl-site-enhance.js?v=20260713r3 -> kl-site-enhance.js?v=20260715catalog1
```

Não reformatar os HTMLs de uma linha nem mudar copy. Não tocar nos links explícitos de Noivas, Debutantes ou Madrinhas; as únicas exceções funcionais são a correção dos dois links de Ternos e o fallback de `waLink()` em Provar já especificados na Step 5.

Atualizar também os contratos preexistentes que ainda procuram `v=20260710deep3` e `v=20260713r3`, fazendo-os exigir as versões finais nas 12 páginas. Isso inclui explicitamente: a tupla `assets` de `CatalogHybridContractTest.test_catalog_loads_split_assets_in_dependency_order`, `HomeHeroContractTest.test_home_keeps_critical_routes_and_integrations`, `AboutBrandContractTest.test_about_keeps_tracking_and_enhancement_scripts` e `VisiblePagesContractTest.test_visible_pages_keep_shared_scripts_one_h1_and_approved_whatsapps`. Não deixar dois testes com expectativas de versão diferentes. O contrato de `kl-catalog-data.js?v=20260715db` e o hash reparado na Task 0 permanecem inalterados.

- [ ] **Step 8: Rodar gates e verificar Meta/contatos por contrato**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --test tests/catalog-tracking.test.cjs tests/site-enhance-routing.test.cjs
node --check kl-tracking.js
node --check kl-site-enhance.js
node --check kl-catalog-app.js
git diff --check
```

Confirmar no diff que o bootstrap do Pixel e os dois contatos públicos não mudaram; somente o roteamento contextual mudou.

- [ ] **Step 9: Fazer commit isolado**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs tests/test_site_contract.py tests/helpers/fake-tracking-browser.cjs tests/catalog-tracking.test.cjs tests/site-enhance-routing.test.cjs tests/catalog-app.test.cjs kl-tracking.js kl-site-enhance.js kl-catalog-app.js peca.html index.html sobre.html catalogo.html como-chegar.html servicos.html unidades.html noivas.html debutantes.html madrinhas.html ternos.html provar.html
git add tests/test_site_contract.py tests/helpers/fake-tracking-browser.cjs tests/catalog-tracking.test.cjs tests/site-enhance-routing.test.cjs tests/catalog-app.test.cjs kl-tracking.js kl-site-enhance.js kl-catalog-app.js peca.html index.html sobre.html catalogo.html como-chegar.html servicos.html unidades.html noivas.html debutantes.html madrinhas.html ternos.html provar.html
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "fix(catalogo): roteia atendimento e tracking pelo contexto" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: QA funcional, visual e pacote de aprovação

**Files:**
- Create: `docs/qa/2026-07-15-catalogo-hibrido.md`
- Modify only if a verified defect is found: files from Tasks 1-9

- [ ] **Step 1: Rodar o gate automatizado final em estado limpo**

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
node --check kl-catalog-core.js
node --check kl-catalog-actions.js
node --check kl-catalog-gallery.js
node --check kl-catalog-app.js
node --check kl-tracking.js
node --check kl-site-enhance.js
git diff --check
git status --short
```

Expected: todas as suítes verdes, nenhum erro de sintaxe e nenhum arquivo inesperado.

- [ ] **Step 2: Iniciar preview local persistente para a sessão**

Run: `python3 -m http.server 4173 --bind 127.0.0.1`

Abrir `http://127.0.0.1:4173/catalogo.html` usando `@browser:control-in-app-browser`. Não abrir o site online para QA desta branch.

- [ ] **Step 3: Executar a matriz visual obrigatória**

Usar larguras 320, 375, 768, 1024 e 1440 px. Em cada largura registrar no documento de QA:

- primeira fileira de peças aparece cedo;
- duas colunas em 320/375 sem corte de controles;
- tipografia, Ruby, Baunilha, dourado e respiro preservam a essência da marca;
- texto/controles nunca cobrem rosto, colo, vestido ou gesto principal;
- atalhos mantêm texto em área separada da foto;
- filtros e chips não estouram horizontalmente;
- painel da galeria fica separado da fotografia;
- favoritos e estados cabem no viewport;
- alvos têm pelo menos 44 px, preferindo 48 px;
- foco é visível em superfícies claras e escuras.

Capturar uma evidência visual por largura e referenciar o caminho no QA; não adicionar screenshots pesados ao repo sem necessidade.

- [ ] **Step 4: Executar a matriz funcional**

Validar:

1. padrão mistura categorias e duas unidades;
2. todos os sete deep-links de categoria;
3. `?un=barra` e `?un=sf` com controle visual correto;
4. busca por código, categoria, cor e tamanho;
5. OR em duas cores/tamanhos e AND entre facetas;
6. tamanhos 33, 39, 63 e 66;
7. filtro impossível não permanece habilitado;
8. parâmetros inválidos são removidos sem apagar os válidos;
9. carregamento automático e botão manual;
10. simulação sem `IntersectionObserver` mantém botão funcional;
11. link normal abre galeria; Cmd/Ctrl/Shift/clique médio abre detalhe;
12. Voltar/Escape/fechar restauram URL, rolagem e foco;
13. galeria trava o fundo com compensação de scrollbar e restaura estilos/`scrollY` por todos os fechamentos;
14. deep-link válido materializa a peça; incompatível remove só `p`;
15. setas, swipe e Tab/Shift+Tab;
16. no máximo ativa + duas vizinhas originais antes de navegar;
17. resposta atrasada não troca a imagem atual;
18. thumbnail quebrada não baixa original na grade;
19. favoritos persistem e ficam separados por unidade;
20. favorito órfão permanece até clique explícito em **Limpar referências antigas**;
21. lotes de WhatsApp respeitam 1.800 caracteres;
22. CTA individual/compartilhado e matriz Noivas/Debutantes/Madrinhas/Ternos usam o destino auditado;
23. **Provar em mim** só nas três categorias elegíveis;
24. loading, base vazia, filtro sem resultado, erro de dados e erro de imagem são distintos;
25. nenhum erro novo no console;
26. os 12 eventos de catálogo têm um único disparo por ação e nenhum disparo em re-render/popstate;
27. tracking debug recebe metadados reais sem termo bruto, telefone, e-mail ou query indireta em `landing_path`.

- [ ] **Step 5: Comparar performance antes/depois, reduced motion e política de recursos**

Usar o commit de baseline registrado na Task 0. Criar um worktree detached temporário, sem tocar no checkout principal, e servir baseline/feature em portas distintas:

```bash
git worktree add --detach /tmp/koisa-linda-catalog-baseline <BASELINE_COMMIT>
python3 -m http.server 4172 --bind 127.0.0.1 --directory /tmp/koisa-linda-catalog-baseline
python3 -m http.server 4173 --bind 127.0.0.1
```

Com cache desabilitado, executar três cargas novas de cada versão na mesma largura (375 e 1440) e registrar a mediana de:

1. bytes transferidos até a primeira grade, somando `transferSize` (ou `encodedBodySize` quando zero) dos resources;
2. tempo de `navigationStart` até o primeiro cartão visível, usando o mesmo cronômetro do navegador e os seletores `.card` (baseline) / `.catalog-card` (feature); conferir também o mark `kl-catalog-first-grid` na feature;
3. responsividade de uma sequência idêntica de busca, cinco mudanças de filtro, carregar mais, abrir galeria e navegar três peças: duração total e quantidade/duração de `longtask` quando suportado.

Documentar números brutos, ambiente e mediana; não estimar. Regressão superior a 20% em tempo até primeira grade ou interação, ou aumento de transferência não explicado pelos três assets editoriais locais, bloqueia aprovação até investigação/correção.

Com `prefers-reduced-motion: reduce`, confirmar que entrada/saída/troca não animam. No console da feature, depois de recarregar e abrir uma única peça, inspecionar:

```javascript
performance.getEntriesByType('resource')
  .map(function (entry) { return entry.name; })
  .filter(function (url) { return /koisa-catalogo-barra/.test(url) && !/-thumb\.jpg/.test(url); });
```

Expected antes de navegar manualmente: no máximo três URLs originais atribuíveis à galeria, além de imagens editoriais locais que não pertencem ao bucket do catálogo.

Parar os servidores e remover apenas o worktree temporário com `git worktree remove /tmp/koisa-linda-catalog-baseline` depois que as evidências estiverem registradas.

- [ ] **Step 6: Corrigir somente defeitos reproduzidos**

Se algum item falhar:

1. registrar reprodução no documento QA;
2. escrever/ajustar um teste RED quando automatizável;
3. implementar a correção mínima;
4. rodar gate completo;
5. repetir a largura/fluxo afetado;
6. fazer commit separado com `fix(catalogo): ...` e gate `@commit-seguro`.

Não ampliar escopo para Clariai, nova copy, nova campanha ou deploy.

- [ ] **Step 7: Criar o documento de evidência**

Criar `docs/qa/2026-07-15-catalogo-hibrido.md` com:

```markdown
# QA — catálogo híbrido editorial

## Ambiente
- Branch/commit:
- URL local:
- Navegador:

## Gates automatizados
- Python:
- Node:
- Sintaxe:
- Diff:

## Matriz visual
| Largura | Resultado | Evidência | Observações |
|---|---|---|---|

## Matriz funcional
| Fluxo | Resultado | Evidência/observação |
|---|---|---|

## Performance e acessibilidade
- Baseline commit:
- Medianas antes/depois (375 e 1440):
| Métrica | Baseline | Feature | Variação | Veredito |
|---|---:|---:|---:|---|
- Bytes até primeira grade:
- Tempo até primeira grade:
- Interação/long tasks:
- Imagens originais ao abrir:
- Reduced motion:
- Teclado/foco:
- Console:

## Pendências fora da fase 1
- Reconciliação Clariai e enriquecimento de dados.

## Veredito
- Pronto ou não para aprovação visual do Guilherme:
```

- [ ] **Step 8: Submeter a revisão técnica independente**

Usar `@requesting-code-review` sobre o diff completo `origin/main...HEAD`. Resolver somente issues reais de corretude, regressão, segurança, acessibilidade ou divergência da especificação. Rodar novamente `@verification-before-completion`.

- [ ] **Step 9: Commitar somente a evidência final**

```bash
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs docs/qa/2026-07-15-catalogo-hibrido.md
git add docs/qa/2026-07-15-catalogo-hibrido.md
node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "docs(catalogo): registra QA da experiência híbrida" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Parar no gate de aprovação visual**

Entregar ao Guilherme:

- URL local;
- resumo do que mudou;
- resultados dos testes;
- imagens de 375, 768 e 1440 px no mínimo;
- link para o QA;
- lista curta de qualquer limitação real.

Pedir aprovação visual explícita. **Não fazer push, merge ou deploy** nesta tarefa.

## Fase 2 registrada, mas não executada

Depois da fase 1 aprovada e publicada por um fluxo separado:

- reconciliar códigos/unidades da Barra com Clariai;
- definir fonte de verdade e relatório de divergências;
- enriquecer ocasião, estilo, tecido, coleção, disponibilidade e atualização somente com dados validados;
- atualizar `scripts/kl-site-thumbs.py` para `kl-catalog-data.js` e remover o clone histórico;
- criar novo plano e novo gate de produção.

Nenhum item desta seção autoriza escrita no Clariai, banco, cron ou produção.
