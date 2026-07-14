# Koisa Linda - evolução editorial do site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a direção C face-safe na home e a nova plataforma de marca na página Sobre e nos seis rodapés, preservando integralmente catálogo, prova virtual, lojas, WhatsApps e tracking.

**Architecture:** A implementação permanece em HTML/CSS/JavaScript vanilla e mantém os estilos específicos dentro de cada HTML, seguindo a arquitetura atual. Um teste de contrato em Python stdlib, aceito como único arquivo técnico fora da allowlist de páginas visíveis, protege copy, estrutura face-safe, destinos dos CTAs, acessibilidade mínima e integrações críticas antes de cada mudança. O trabalho acontece somente na branch isolada `codex/kl-site-editorial-brand-20260714`; não há push, merge ou deploy neste plano.

**Tech Stack:** HTML5, CSS3, JavaScript vanilla, Python 3 `unittest`, servidor HTTP da stdlib e QA visual em navegador.

---

## Mapa de arquivos

- Criar `tests/test_site_contract.py`: contratos automatizados do hero, plataforma de marca, rodapés, Meta Pixel e integrações preservadas.
- Modificar `index.html`: novo hero editorial, motion face-safe, foco visível, fallback do Pixel no `body` e rodapé novo.
- Modificar `sobre.html`: história ajustada, nova seção de propósito/missão/valores com fotografia separada, foco visível, fallback do Pixel no `body` e rodapé novo.
- Modificar `catalogo.html`, `como-chegar.html`, `servicos.html`, `unidades.html`: somente rodapé aprovado, foco visível e correção local do fallback do Pixel.
- Não modificar `kl-site-enhance.js`, `kl-site-enhance.css`, `kl-tracking.js`, `provar.html`, Worker, dados do catálogo, URLs ou números de WhatsApp.

## Comandos compartilhados

Executar a partir do worktree:

```bash
cd /Users/guilhermepessanha/.config/superpowers/worktrees/koisa-linda-site/kl-site-editorial-brand-20260714
python3 -m unittest -v tests/test_site_contract.py
git diff --check
```

Antes de cada commit, executar o gate de conteúdo:

```bash
/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
```

Resultado obrigatório: `LIMPO`.

### Task 1: Hero editorial C face-safe

**Files:**
- Create: `tests/test_site_contract.py`
- Modify: `index.html:7,28-31,56-66,137,169-180,200-210,341`

- [ ] **Step 1: Criar o primeiro contrato falho para a home**

Criar `tests/test_site_contract.py` com o helper e a classe abaixo:

```python
from pathlib import Path
import hashlib
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def page(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def sha256(name: str) -> str:
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def balanced_css_block(css: str, marker: str) -> str:
    start = css.index(marker)
    opening = css.index("{", start)
    depth = 0
    for index in range(opening, len(css)):
        if css[index] == "{":
            depth += 1
        elif css[index] == "}":
            depth -= 1
            if depth == 0:
                return css[start : index + 1]
    raise AssertionError(f"bloco CSS não fechado: {marker}")


def section_with_class(html: str, class_name: str) -> str:
    match = re.search(
        rf'<section[^>]*class="[^"]*\b{re.escape(class_name)}\b[^"]*"[^>]*>.*?</section>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        raise AssertionError(f"section .{class_name} não encontrada")
    return match.group(0)


class HomeHeroContractTest(unittest.TestCase):
    def test_home_uses_face_safe_editorial_hero(self):
        html = page("index.html")
        hero = section_with_class(html, "hero-editorial")

        self.assertIn('class="hero-copy"', hero)
        self.assertIn('class="hero-media"', hero)
        self.assertLess(hero.index('class="hero-media"'), hero.index('class="hero-copy"'))
        self.assertIn('src="img/hero-noiva.webp"', hero)
        self.assertIn('fetchpriority="high"', hero)
        self.assertNotIn('class="panels"', hero)
        self.assertNotIn('class="scrim"', hero)
        self.assertIn("Aluguel · sob medida · ajustes", hero)
        self.assertIn("Seu momento começa na prova.", hero)
        self.assertIn(
            "Encontre o vestido, escolha a unidade e fale direto com quem vai te atender.",
            hero,
        )
        self.assertIn('href="catalogo.html">Encontrar meu vestido</a>', hero)
        self.assertIn('href="unidades.html">Agendar minha prova</a>', hero)

    def test_home_motion_has_static_reduced_motion_fallback(self):
        html = page("index.html")
        for animation in ("kl-hero-curtain", "kl-hero-reveal", "kl-hero-breathe"):
            block = balanced_css_block(html, f"@keyframes {animation}")
            properties = set(re.findall(r"(?<![-\w])([a-z-]+)\s*:", block))
            self.assertLessEqual(properties, {"transform", "opacity"})
        self.assertIn("@media (prefers-reduced-motion: reduce)", html)
        self.assertRegex(html, r"\.hero-media::after\{[^}]*transform:")
        reduced = balanced_css_block(html, "@media (prefers-reduced-motion: reduce)")
        for declaration in ("animation:none", "transition:none", "transform:none", "opacity:1"):
            self.assertIn(declaration, reduced.replace(" ", ""))

    def test_home_keeps_critical_routes_and_integrations(self):
        html = page("index.html")
        for required in (
            'href="catalogo.html"',
            'href="unidades.html"',
            'href="https://wa.me/',
            'src="kl-tracking.js?v=20260710deep3"',
            'src="kl-site-enhance.js?v=20260713r3"',
        ):
            self.assertIn(required, html)
        protected = {
            "kl-site-enhance.js": "2e53a86eca815bb59d325a469ee47179a36afd41f8848b69f90cd650985950b3",
            "kl-tracking.js": "1d5342d13b9da051c85e783722dbcd353675b48c119277f970a6bad350f32f39",
            "kl-catalog-data.js": "c0c86a995c02606c6531cb894e57a52c0f340e1bf9705a5ea0e9ca5b22ff64ed",
        }
        for name, expected in protected.items():
            self.assertEqual(expected, sha256(name), name)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar o teste e confirmar RED**

Run: `python3 -m unittest -v tests.test_site_contract.HomeHeroContractTest`

Expected: `test_home_uses_face_safe_editorial_hero` falha porque `.hero-editorial` ainda não existe; o teste de motion também falha porque as animações novas ainda não existem. O teste de integrações passa e funciona como caracterização do fluxo existente.

- [ ] **Step 3: Implementar o hero mínimo que satisfaz o contrato**

Em `index.html`:

1. mover o `<noscript><img ...></noscript>` do Pixel da linha 7 para imediatamente depois de `<body>`;
2. adicionar uma regra de foco visível compartilhada para links e botão do menu;
3. substituir o CSS de `.hero`, `.panels`, `.panel`, `.scrim` e `.inner` por um grid `.hero.hero-editorial` com `.hero-copy` e `.hero-media`;
4. usar `<img src="img/hero-noiva.webp" ... fetchpriority="high">` em vez de `background-image`;
5. manter copy e CTAs em bloco separado da foto;
6. manter `.hero-media` antes de `.hero-copy` no DOM; no desktop usar `grid-area` para copy à esquerda e foto à direita, e no mobile empilhar naturalmente foto primeiro e copy abaixo;
7. criar o wipe com `.hero-media::after`, animando somente `transform`, e a respiração da imagem com `transform`;
8. escalonar eyebrow, H1, apoio e CTAs com `opacity` e `transform`;
9. em `prefers-reduced-motion: reduce`, remover animações e garantir opacidade/transform estáticos;
10. declarar `--kl-tap-target:48px` e garantir no mobile pelo menos 48 px para menu, botão do Instagram, CTAs e links sociais;
11. trocar o rodapé por `Unindo famílias. Realizando sonhos.` e manter `Costuramos sonhos desde 1994.` em linha própria, sem `Beleza Consciente`.

Markup alvo do hero:

```html
<section class="hero hero-editorial" aria-labelledby="hero-title">
  <div class="hero-media">
    <img src="img/hero-noiva.webp" alt="Noiva usando vestido da Koisa Linda" width="820" height="1230" fetchpriority="high">
  </div>
  <div class="hero-copy">
    <div class="eyebrow">Aluguel · sob medida · ajustes</div>
    <h1 id="hero-title">Seu momento começa na prova.</h1>
    <p>Encontre o vestido, escolha a unidade e fale direto com quem vai te atender.</p>
    <div class="cta">
      <a class="btn-pri" href="catalogo.html">Encontrar meu vestido</a>
      <a class="btn-out" href="unidades.html">Agendar minha prova</a>
    </div>
  </div>
</section>
```

CSS-base do hero, refinável apenas durante o QA de crop e espaçamento:

```css
:root{--kl-tap-target:48px}
a:focus-visible,button:focus-visible{outline:3px solid var(--gold);outline-offset:4px;border-radius:4px}
.hero.hero-editorial{display:grid;grid-template-columns:minmax(0,.88fr) minmax(0,1.12fr);grid-template-areas:"copy media";min-height:clamp(620px,calc(100svh - 71px),860px);overflow:hidden;background:var(--cream);text-align:left;isolation:isolate}
.hero-copy{grid-area:copy;min-width:0;padding:clamp(56px,7vw,112px) clamp(32px,6vw,96px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center}
.hero-copy .eyebrow{color:var(--gold)}
.hero-copy h1{max-width:620px;margin:18px 0 20px;font-family:var(--serif);font-size:clamp(52px,5.2vw,84px);font-style:italic;font-weight:400;letter-spacing:-1.8px;line-height:.96;color:var(--ruby);text-shadow:none}
.hero-copy p{max-width:540px;margin:0 0 30px;font-family:var(--body);font-size:clamp(18px,1.6vw,22px);line-height:1.55;color:#5f534b;opacity:1}
.hero-copy .cta{display:flex;gap:14px;justify-content:flex-start;flex-wrap:wrap}
.hero-copy .btn-out{color:var(--ruby);border-color:var(--ruby)}
.hero-media{grid-area:media;position:relative;min-width:0;overflow:hidden;background:#eadbc5}
.hero-media img{width:100%;height:100%;object-fit:cover;object-position:center top;transform:scale(1.001)}
.hero-media::after{content:"";position:absolute;inset:0;z-index:1;background:var(--ruby);pointer-events:none;transform:translateX(101%)}
@media (prefers-reduced-motion: no-preference){
 .hero-media::after{animation:kl-hero-curtain 1.05s cubic-bezier(.72,0,.2,1) .08s both}
 .hero-media img{animation:kl-hero-breathe 18s ease-in-out 1.1s infinite alternate}
 .hero-copy>*{animation:kl-hero-reveal .72s cubic-bezier(.22,.7,.2,1) both}
 .hero-copy>*:nth-child(1){animation-delay:.28s}.hero-copy>*:nth-child(2){animation-delay:.38s}.hero-copy>*:nth-child(3){animation-delay:.48s}.hero-copy>*:nth-child(4){animation-delay:.58s}
 @keyframes kl-hero-curtain{from{transform:translateX(0)}to{transform:translateX(101%)}}
 @keyframes kl-hero-reveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
 @keyframes kl-hero-breathe{from{transform:scale(1.001)}to{transform:scale(1.035)}}
}
@media (prefers-reduced-motion: reduce){
 .hero-media::after{display:none;animation:none!important;transition:none!important;transform:none!important;opacity:1!important}
 .hero-media img,.hero-copy>*{animation:none!important;transition:none!important;transform:none!important;opacity:1!important}
}
@media(max-width:860px){
 .hero.hero-editorial{grid-template-columns:1fr;grid-template-areas:"media" "copy";min-height:0;height:auto}
 .hero-media{min-height:0;aspect-ratio:2/3}
 .hero-copy{padding:48px 22px 58px}
 .hero-copy h1{font-size:clamp(44px,14vw,60px);letter-spacing:-1.2px}
 .hero-copy p{font-size:18px}
 .hero-copy .cta{width:100%;flex-direction:column}
 .hero-copy .btn-pri,.hero-copy .btn-out{width:100%}
 .mtog,.mnav a,.ig-btn,.btn-pri,.btn-out,.mini,.mini-cta,.fsoc a{min-height:var(--kl-tap-target)}
}
```

Remover do bloco de motion antigo as animações `.hero .panel`; manter o reveal de seções e o header. Ao montar `els`, filtrar os elementos internos da nova `.hero` para que o `IntersectionObserver` não dispute `transform` ou `opacity` com a sequência própria.

- [ ] **Step 4: Rodar os testes e confirmar GREEN**

Run: `python3 -m unittest -v tests.test_site_contract.HomeHeroContractTest`

Expected: `3 tests`, `OK`.

- [ ] **Step 5: Revisar visualmente a estrutura sem depender de JavaScript**

Run: `python3 -m http.server 4173 --bind 127.0.0.1`

Abrir `http://127.0.0.1:4173/index.html`, desabilitar JavaScript e confirmar que foto, H1 e dois CTAs continuam visíveis.

- [ ] **Step 6: Fazer commit isolado**

```bash
git add tests/test_site_contract.py index.html
/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(home): aplica hero editorial face-safe"
```

### Task 2: Página Sobre com propósito, missão e valores

**Files:**
- Modify: `tests/test_site_contract.py`
- Modify: `sobre.html:7,28-31,104-134,136-160`

- [ ] **Step 1: Adicionar contratos falhos da página Sobre**

Adicionar à suíte:

```python
class AboutBrandContractTest(unittest.TestCase):
    def test_about_uses_approved_brand_platform(self):
        html = page("sobre.html")
        for required in (
            "Há mais de três décadas, vestimos os momentos que aproximam pessoas e ficam na memória.",
            "A roupa é parte do momento. Nosso trabalho é acolher cada história, cuidar de cada detalhe e ajudar famílias a viverem celebrações que ficam na memória.",
            "Unir famílias. Realizar sonhos. Transformar vidas.",
            "Unir famílias e realizar sonhos, transformando os grandes momentos da vida em memórias que atravessam gerações.",
            "Acolher cada pessoa, entender a sua história e vestir sua celebração com cuidado e excelência, da primeira prova ao grande dia.",
        ):
            self.assertIn(required, html)

    def test_about_has_all_five_values_with_descriptions(self):
        html = page("sobre.html")
        values = {
            "Família no centro": "Celebramos os vínculos e lembramos que cada escolha envolve pessoas que se amam.",
            "Cada sonho é único": "Escutamos antes de orientar. A cliente não entra em um molde; o atendimento se adapta à história dela.",
            "Cuidado em cada detalhe": "Da prova ao ajuste, do prazo à entrega: tratamos cada etapa com atenção e responsabilidade.",
            "Respeito por cada história": "Acolhemos corpos, estilos, gerações e trajetórias diferentes com dignidade e verdade.",
            "Confiança de geração em geração": "Honramos nossa palavra e os relacionamentos construídos pela Koisa Linda desde 1994.",
        }
        self.assertEqual(5, html.count('class="brand-value"'))
        for title, description in values.items():
            self.assertIn(title, html)
            self.assertIn(description, html)
            self.assertRegex(html, rf"<h3[^>]*>{re.escape(title)}</h3>")

    def test_about_purpose_composition_is_face_safe(self):
        html = page("sobre.html")
        purpose = section_with_class(html, "purpose-section")
        self.assertIn('src="img/cliente-noiva-3.webp"', purpose)
        self.assertIn('class="purpose-photo"', purpose)
        self.assertIn('class="purpose-content"', purpose)
        self.assertLess(purpose.index('class="purpose-photo"'), purpose.index('class="purpose-content"'))
        media = re.search(r'<div class="purpose-photo"[^>]*>(.*?)</div>', purpose, re.DOTALL).group(1)
        self.assertNotRegex(media, r"<(?:h[1-6]|p|a|button)\b")
        self.assertRegex(purpose, r"<h2[^>]*>Unir famílias\. Realizar sonhos\. Transformar vidas\.</h2>")
        self.assertRegex(purpose, r"<h3[^>]*>Propósito</h3>")
        self.assertRegex(purpose, r"<h3[^>]*>Missão</h3>")
```

- [ ] **Step 2: Rodar a classe e confirmar RED**

Run: `python3 -m unittest -v tests.test_site_contract.AboutBrandContractTest`

Expected: três falhas por copy, valores e `.purpose-section` ausentes.

- [ ] **Step 3: Implementar a página Sobre sem apagar a história**

Em `sobre.html`:

1. mover o fallback do Pixel para o começo do `body`;
2. adicionar `:focus-visible`;
3. substituir somente a frase introdutória antiga pela intro aprovada;
4. preservar nascimento em 1994 e Jussara Pessanha;
5. substituir o último parágrafo histórico pela copy aprovada;
6. substituir a seção antiga por `<section class="section alt purpose-section">`;
7. usar `img/cliente-noiva-3.webp` dentro de `.purpose-photo`, antes de `.purpose-content` no DOM;
8. renderizar propósito, missão e cinco `<article class="brand-value">` com títulos e descrições literais do `BRAND.md`;
9. no mobile, manter fotografia primeiro e conteúdo abaixo, sem sobreposição;
10. declarar o mesmo alvo móvel de 48 px para menu, botão do Instagram, CTAs e links sociais;
11. atualizar o rodapé aprovado.

Markup alvo da nova seção:

```html
<section class="section alt purpose-section" aria-labelledby="purpose-title">
  <div class="purpose-grid">
    <div class="purpose-photo">
      <img src="img/cliente-noiva-3.webp" alt="Noiva e sua mãe vivendo juntas o momento da celebração" loading="lazy" width="800" height="1200">
    </div>
    <div class="purpose-content">
      <div class="eyebrow">Nosso propósito</div>
      <h2 id="purpose-title">Unir famílias. Realizar sonhos. Transformar vidas.</h2>
      <div class="brand-foundations">
        <div class="brand-foundation"><h3>Propósito</h3><p>Unir famílias e realizar sonhos, transformando os grandes momentos da vida em memórias que atravessam gerações.</p></div>
        <div class="brand-foundation"><h3>Missão</h3><p>Acolher cada pessoa, entender a sua história e vestir sua celebração com cuidado e excelência, da primeira prova ao grande dia.</p></div>
      </div>
      <div class="brand-values" aria-label="Valores da Koisa Linda">
        <article class="brand-value"><span aria-hidden="true">01</span><div><h3>Família no centro</h3><p>Celebramos os vínculos e lembramos que cada escolha envolve pessoas que se amam.</p></div></article>
        <article class="brand-value"><span aria-hidden="true">02</span><div><h3>Cada sonho é único</h3><p>Escutamos antes de orientar. A cliente não entra em um molde; o atendimento se adapta à história dela.</p></div></article>
        <article class="brand-value"><span aria-hidden="true">03</span><div><h3>Cuidado em cada detalhe</h3><p>Da prova ao ajuste, do prazo à entrega: tratamos cada etapa com atenção e responsabilidade.</p></div></article>
        <article class="brand-value"><span aria-hidden="true">04</span><div><h3>Respeito por cada história</h3><p>Acolhemos corpos, estilos, gerações e trajetórias diferentes com dignidade e verdade.</p></div></article>
        <article class="brand-value"><span aria-hidden="true">05</span><div><h3>Confiança de geração em geração</h3><p>Honramos nossa palavra e os relacionamentos construídos pela Koisa Linda desde 1994.</p></div></article>
      </div>
    </div>
  </div>
</section>
```

CSS-base da seção:

```css
:root{--kl-tap-target:48px}
.purpose-section{padding-top:96px;padding-bottom:96px}
.purpose-grid{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:clamp(44px,6vw,88px);align-items:start;text-align:left}
.purpose-photo{min-width:0;overflow:hidden;border-radius:8px;background:var(--baunilha)}
.purpose-photo img{width:100%;aspect-ratio:2/3;object-fit:cover;object-position:center top}
.purpose-content>h2{max-width:720px;margin:14px 0 30px;font-family:var(--serif);font-size:clamp(42px,4.2vw,66px);font-style:italic;font-weight:400;letter-spacing:-1.2px;line-height:1;color:var(--ruby)}
.brand-foundations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-bottom:34px}
.brand-foundation{padding:24px;border:1px solid var(--line);border-radius:8px;background:#fff}
.brand-foundation h3,.brand-value h3{font-family:var(--serif);font-size:24px;font-weight:400;color:var(--ruby)}
.brand-foundation p,.brand-value p{margin-top:8px;font-family:var(--body);font-size:17px;line-height:1.58;color:#5f534b}
.brand-values{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.brand-value{display:grid;grid-template-columns:48px 1fr;gap:16px;padding:22px 24px;background:var(--cream)}
.brand-value>span{font-family:var(--sans);font-size:11px;letter-spacing:2px;color:var(--gold);padding-top:7px}
@media(max-width:860px){.purpose-section{padding:0 0 68px}.purpose-grid{grid-template-columns:1fr;gap:0}.purpose-photo{border-radius:0}.purpose-content{padding:48px 22px 0}.brand-foundations{grid-template-columns:1fr}.brand-value{grid-template-columns:38px 1fr;padding:20px 18px}.mtog,.mnav a,.ig-btn,.btn-pri,.btn-out,.mini,.fsoc a{min-height:var(--kl-tap-target)}}
```

- [ ] **Step 4: Confirmar GREEN e regressão da home**

Run: `python3 -m unittest -v tests/test_site_contract.py`

Expected: `6 tests`, `OK`.

- [ ] **Step 5: Fazer commit isolado**

```bash
git add tests/test_site_contract.py sobre.html
/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "feat(sobre): registra propósito missão e valores"
```

### Task 3: Consistência verbal, foco e HTML válido nas seis páginas

**Files:**
- Modify: `tests/test_site_contract.py`
- Modify: `catalogo.html:8,103,331`
- Modify: `como-chegar.html:7,104,243`
- Modify: `servicos.html:7,104,160`
- Modify: `unidades.html:7,105,145`
- Verify: `index.html`, `sobre.html`

- [ ] **Step 1: Adicionar contratos falhos das seis páginas**

Adicionar:

```python
VISIBLE_PAGES = (
    "index.html",
    "sobre.html",
    "catalogo.html",
    "como-chegar.html",
    "servicos.html",
    "unidades.html",
)

RETIRED = (
    "beleza consciente",
    "onde cada escolha faz o mundo melhor",
    "moda como ferramenta de empoderamento feminino",
    "não vendemos um vestido",
    "facilitamos uma transformação",
    "essa é a nossa beleza consciente",
)


class SiteWideCommunicationContractTest(unittest.TestCase):
    def test_retired_language_is_absent_and_footer_is_current(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                folded = html.casefold()
                for phrase in RETIRED:
                    self.assertNotIn(phrase, folded)
                self.assertIn('<div class="fphrase">Unindo famílias. Realizando sonhos.</div>', html)
                self.assertIn("Costuramos sonhos desde 1994.", html)

    def test_pixel_fallback_is_inside_body(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name).lower()
                self.assertLess(html.index("</head>"), html.index("<noscript>"))
                self.assertLess(html.index("<body"), html.index("<noscript>"))
                self.assertEqual(1, html.count("<noscript>"))
                pixel = re.search(r"tr\?id=(\d+)&ev=pageview&noscript=1", html)
                self.assertIsNotNone(pixel)
                self.assertEqual("f536a36777ecb8647edd02332a1c9d785006f6b4bd47eec226a06fc6a7e03333", digest(pixel.group(1)))

    def test_touched_pages_have_visible_keyboard_focus(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                self.assertRegex(html, r":focus-visible[^{]*\{[^}]*outline\s*:[^;}]+")

    def test_mobile_controls_declare_48px_tap_target(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                compact = re.sub(r"\s+", "", html)
                self.assertIn("--kl-tap-target:48px", compact)
                self.assertRegex(compact, r"@media\(max-width:860px\)\{.*min-height:var\(--kl-tap-target\)")
                if 'class="ig-btn"' in html:
                    self.assertRegex(compact, r"\.ig-btn[^{}]*\{[^}]*min-height:var\(--kl-tap-target\)")

    def test_shared_tracking_and_enhancement_remain_loaded(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                self.assertIn('src="kl-tracking.js?v=20260710deep3"', html)
                self.assertIn('src="kl-site-enhance.js?v=20260713r3"', html)

    def test_pages_keep_one_h1_and_only_approved_whatsapp_numbers(self):
        all_html = "\n".join(page(name) for name in VISIBLE_PAGES)
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                self.assertEqual(1, len(re.findall(r"<h1\b", page(name), re.IGNORECASE)))
        numbers = set(re.findall(r"wa\.me/(55\d+)", all_html))
        number_hashes = {digest(number) for number in numbers}
        self.assertEqual({
            "a2613c0f61c3dcf35b472a5f1d5b03904ccbbc5b78acfbc3f578b15701a74f79",
            "dcc97840afbc12fcab7911d36037a59fadcd8f6c714b86a2c8c8b3a960d2ba99",
        }, number_hashes)
```

- [ ] **Step 2: Confirmar RED somente nas quatro páginas restantes**

Run: `python3 -m unittest -v tests.test_site_contract.SiteWideCommunicationContractTest`

Expected: os subtests de `catalogo.html`, `como-chegar.html`, `servicos.html` e `unidades.html` falham por copy antiga, fallback no `head` e falta de foco visível; home e Sobre já passam.

- [ ] **Step 3: Fazer as quatro migrações cirúrgicas**

Em cada uma das quatro páginas:

1. mover o mesmo `<noscript><img ...></noscript>` para imediatamente depois de `<body>`;
2. incluir `a:focus-visible,button:focus-visible` com outline Ruby Wine, offset legível e sem remover foco nativo sem substituição;
3. declarar `--kl-tap-target:48px` e, no breakpoint móvel, aplicar `min-height:var(--kl-tap-target)` aos controles interativos realmente presentes (`.mtog`, `.mnav a`, `.ig-btn`, `.btn-pri`, `.btn-out`, `.mini`, `.mini-cta`, `.fsoc a`, botões, selects e inputs de filtro quando existirem); não aumentar links corridos dentro de parágrafos;
4. trocar apenas `.fphrase` para `Unindo famílias. Realizando sonhos.`;
5. trocar o `<small>` para começar por `Costuramos sonhos desde 1994.` e preservar CNPJ, copyright e observações já existentes;
6. não alterar qualquer URL, telefone, catálogo, filtro, vídeo, mapa ou script.

- [ ] **Step 4: Confirmar GREEN completo**

Run: `python3 -m unittest -v tests/test_site_contract.py`

Expected: `12 tests`, `OK`.

Run adicional:

```bash
rg -n -i "beleza consciente|onde cada escolha faz o mundo melhor|moda como ferramenta de empoderamento feminino|não vendemos um vestido|facilitamos uma transformação|essa é a nossa beleza consciente" \
  index.html sobre.html catalogo.html como-chegar.html servicos.html unidades.html
```

Expected: sem saída, exit code `1` do `rg` por ausência de ocorrências.

- [ ] **Step 5: Fazer commit isolado**

```bash
git add tests/test_site_contract.py catalogo.html como-chegar.html servicos.html unidades.html
/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/guilhermepessanha/.claude/skills/commit-seguro/scan.mjs
git diff --cached --check
git commit -m "fix(site): alinha rodapés e acessibilidade local"
```

### Task 4: QA funcional, visual e de escopo

**Files:**
- Verify only: `index.html`, `sobre.html`, `catalogo.html`, `como-chegar.html`, `servicos.html`, `unidades.html`, `tests/test_site_contract.py`

- [ ] **Step 1: Atualizar a referência remota e reconciliar concorrência**

```bash
git fetch origin --prune
git log --oneline HEAD..origin/main
if ! git merge-base --is-ancestor origin/main HEAD; then
  git diff --stat HEAD..origin/main
  printf '%s\n' 'STOP: origin/main avançou; inspecionar semanticamente os commits acima antes de rebasear.'
  exit 42
fi
```

Expected: o log fica vazio e `origin/main` já é ancestral. Se o comando sair com `42`, parar, ler o diff/commits novos e verificar especialmente os seis HTMLs da allowlist. Só depois dessa inspeção semântica executar `git rebase origin/main`; se surgir conflito, reconciliar sem sobrescrever o trabalho concorrente. Depois do rebase, reiniciar o Task 4 desde o Step 1.

- [ ] **Step 2: Rodar a suíte e verificações estáticas**

```bash
BASE_SHA=$(git rev-parse origin/main)
python3 -m unittest -v tests/test_site_contract.py
git diff --check "$BASE_SHA"...HEAD
git diff --name-only "$BASE_SHA"...HEAD
```

Expected: testes em `OK`; diff sem whitespace; arquivos alterados limitados ao plano mais o plano de implementação.

- [ ] **Step 3: Confirmar que integrações críticas não mudaram**

```bash
BASE_SHA=$(git rev-parse origin/main)
git diff "$BASE_SHA"...HEAD -- kl-site-enhance.js kl-site-enhance.css kl-tracking.js provar.html kl-catalog-data.js
git diff "$BASE_SHA"...HEAD -- index.html sobre.html catalogo.html como-chegar.html servicos.html unidades.html | rg "^[+-].*(wa\.me|whatsapp|kl-tracking|kl-site-enhance|provar\.html)"
```

Expected: os dois comandos sem saída; os novos CTAs do hero são rotas internas e nenhum número ou integração deve mudar.

- [ ] **Step 4: Servir localmente e verificar respostas**

```bash
set -e
python3 -m http.server 4173 --bind 127.0.0.1 >/tmp/kl-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT
for page in index.html sobre.html catalogo.html provar.html; do
  curl -fsSI "http://127.0.0.1:4173/$page" >/dev/null
done
kill "$PREVIEW_PID"
wait "$PREVIEW_PID" 2>/dev/null || true
```

Expected: `HTTP/1.0 200 OK` nas quatro páginas.

- [ ] **Step 5: Comparar Lighthouse de LCP e CLS com a base**

Criar um worktree temporário somente leitura no commit-base e servir as duas versões:

```bash
set -e
BASE_SHA=$(git rev-parse origin/main)
git worktree add --detach /tmp/kl-site-baseline-c099bb5 "$BASE_SHA"
(cd /tmp/kl-site-baseline-c099bb5 && python3 -m http.server 4172 --bind 127.0.0.1 >/tmp/kl-baseline.log 2>&1) &
BASELINE_PID=$!
python3 -m http.server 4173 --bind 127.0.0.1 >/tmp/kl-preview.log 2>&1 &
PREVIEW_PID=$!
cleanup(){
  rc=$?
  kill "$PREVIEW_PID" "$BASELINE_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" "$BASELINE_PID" 2>/dev/null || true
  git worktree remove --force /tmp/kl-site-baseline-c099bb5 2>/dev/null || true
  return "$rc"
}
trap cleanup EXIT
NODE_BIN=/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
PNPM=/Users/guilhermepessanha/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm
PATH="$NODE_BIN:$PATH" "$PNPM" dlx lighthouse http://127.0.0.1:4172/index.html --only-categories=performance --output=json --output-path=/tmp/kl-lighthouse-before.json --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --chrome-flags="--headless=new"
PATH="$NODE_BIN:$PATH" "$PNPM" dlx lighthouse http://127.0.0.1:4173/index.html --only-categories=performance --output=json --output-path=/tmp/kl-lighthouse-after.json --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --chrome-flags="--headless=new"
python3 - <<'PY'
import json
from pathlib import Path

def metrics(path):
    report = json.loads(Path(path).read_text())
    audits = report["audits"]
    return {
        "lcp": audits["largest-contentful-paint"]["numericValue"],
        "cls": audits["cumulative-layout-shift"]["numericValue"],
    }

before = metrics("/tmp/kl-lighthouse-before.json")
after = metrics("/tmp/kl-lighthouse-after.json")
print({"before": before, "after": after})
assert after["lcp"] <= min(before["lcp"] * 1.10, before["lcp"] + 250), "LCP regrediu além da tolerância"
assert after["cls"] <= min(0.10, before["cls"] + 0.02), "CLS regrediu além da tolerância"
PY
```

Expected: métricas antes/depois registradas; LCP não piora mais que 10% ou 250 ms e CLS não aumenta mais que 0,02 nem ultrapassa 0,10. Se falhar, corrigir antes de continuar.

- [ ] **Step 6: Fazer QA visual nos cinco viewports**

Verificar `320x800`, `375x812`, `768x1024`, `1024x768` e `1440x1000`:

- hero: foto primeiro no mobile; copy à esquerda e foto à direita no desktop;
- rosto, olhos, vestido e gesto sem qualquer overlay;
- H1 e CTAs totalmente visíveis; sem overflow horizontal;
- seção de propósito: foto e conteúdo separados; cinco valores legíveis;
- header, menu móvel, sticky CTA e rodapés preservados;
- animações suaves quando permitidas e página estática com reduced motion.

- [ ] **Step 7: Fazer QA funcional**

Testar manualmente:

- `Encontrar meu vestido` abre `catalogo.html`;
- `Agendar minha prova` abre `unidades.html`;
- menu desktop e móvel;
- catálogo, filtros e abertura de uma peça;
- link para prova virtual;
- unidades e WhatsApps existentes;
- console sem erro e rede sem 404 local.

- [ ] **Step 8: Rodar revisão final independente**

Solicitar revisão de conformidade com a spec e depois revisão de qualidade do diff completo. Corrigir e revalidar qualquer issue antes de apresentar o preview.

- [ ] **Step 9: Parar antes de produção**

Entregar ao Guilherme:

- URL do preview local;
- screenshots desktop/mobile;
- resumo do diff e testes;
- branch e commits.

Não fazer `push`, merge em `main`, alteração de DNS ou deploy sem novo OK explícito.
