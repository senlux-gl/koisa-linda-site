from pathlib import Path
import hashlib
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def page(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def sha256(name: str) -> str:
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def catalog_products() -> list[dict]:
    source = page("kl-catalog-data.js")
    payload = re.split(r"window\.KL_DATA\s*=\s*", source, maxsplit=1)[1].strip().removesuffix(";")
    return json.loads(payload)


SHARED_SCRIPT_PAGES = (
    "index.html", "sobre.html", "catalogo.html", "como-chegar.html",
    "servicos.html", "unidades.html", "noivas.html", "debutantes.html",
    "madrinhas.html", "ternos.html", "peca.html",
)

STATIC_TRYON_LINK_COUNTS = {
    "index.html": 3,
    "sobre.html": 2,
    "catalogo.html": 2,
    "como-chegar.html": 3,
    "servicos.html": 2,
    "unidades.html": 2,
    "noivas.html": 1,
    "debutantes.html": 1,
    "madrinhas.html": 1,
    "ternos.html": 1,
    "peca.html": 1,
}


def balanced_css_block(css: str, marker: str) -> str:
    if marker not in css:
        raise AssertionError(f"bloco CSS não encontrado: {marker}")
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


def css_declarations_for_exact_selector(css: str, selector: str) -> list[str]:
    declarations_by_rule = []
    for selector_group, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        selectors = {
            re.sub(r"/\*.*?\*/", "", item, flags=re.DOTALL).strip()
            for item in selector_group.split(",")
        }
        if selector in selectors:
            declarations_by_rule.append(declarations)
    return declarations_by_rule


def css_property_values(css: str, selector: str, property_name: str) -> list[str]:
    values = []
    pattern = re.compile(
        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*([^;]+)"
    )
    for declarations in css_declarations_for_exact_selector(css, selector):
        values.extend(
            match.group(1).strip() for match in pattern.finditer(declarations)
        )
    return values


def css_blocks(css: str, marker: str) -> list[str]:
    blocks = []
    offset = 0
    while True:
        start = css.find(marker, offset)
        if start == -1:
            return blocks
        opening = css.index("{", start)
        depth = 0
        for index in range(opening, len(css)):
            if css[index] == "{":
                depth += 1
            elif css[index] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(css[start : index + 1])
                    offset = index + 1
                    break
        else:
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
    def test_home_focus_indicator_is_white_on_every_dark_surface(self):
        html = page("index.html")
        selector = (
            "footer a:focus-visible,.band a:focus-visible,"
            ".kl-sticky-cta a:focus-visible,.kl-sticky-cta button:focus-visible"
        )
        dark_surface_rule = balanced_css_block(html, selector).replace(" ", "")

        self.assertIn(selector.replace(" ", ""), dark_surface_rule)
        self.assertIn("outline-color:#fff", dark_surface_rule)

    def test_home_focus_indicator_contrasts_with_light_and_ruby_backgrounds(self):
        html = page("index.html")
        focus_rule = balanced_css_block(
            html, "a:focus-visible,button:focus-visible"
        ).replace(" ", "")

        self.assertIn("outline:3pxsolidvar(--ruby)", focus_rule)
        footer_rule = balanced_css_block(html, "footer a:focus-visible").replace(
            " ", ""
        )
        self.assertIn("outline-color:#fff", footer_rule)

    def test_home_stacks_hero_only_below_680px(self):
        html = page("index.html")
        mobile_blocks = css_blocks(html, "@media(max-width:680px)")
        tablet_blocks = css_blocks(html, "@media(max-width:860px)")

        self.assertTrue(
            any(
                ".hero.hero-editorial" in block
                and 'grid-template-areas:"media" "copy"' in block
                and ".hero-copy .cta" in block
                for block in mobile_blocks
            ),
            "stack, tipografia e CTAs do hero devem mudar somente abaixo de 680px",
        )
        self.assertTrue(
            any(
                ".mtog,.mnav a,.ig-btn,.btn-pri,.btn-out,.mini,.mini-cta,.fsoc a"
                in block
                and "min-height:var(--kl-tap-target)" in block
                for block in tablet_blocks
            ),
            "tap targets de 48px devem continuar ativos abaixo de 860px",
        )
        for block in tablet_blocks:
            self.assertNotIn(".hero.hero-editorial", block)

    def test_home_footer_social_links_wrap_on_narrow_screens(self):
        html = page("index.html")
        social_rule = balanced_css_block(html, ".fsoc").replace(" ", "")

        self.assertIn("flex-wrap:wrap", social_rule)

    def test_home_hero_media_image_does_not_expand_grid_row(self):
        html = page("index.html")
        image_rule = balanced_css_block(html, ".hero-media img").replace(" ", "")

        self.assertIn("position:absolute", image_rule)
        self.assertIn("inset:0", image_rule)

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
            'src="kl-tracking.js?v=20260715catalog1"',
            'src="kl-site-enhance.js?v=20260716catalog2"',
        ):
            self.assertIn(required, html)
        protected = {
            "kl-catalog-data.js": "592d9540486561934ef302f57d75e0ff9c143f64621dce5364d5fdec90f37301",
        }
        for name, expected in protected.items():
            self.assertEqual(expected, sha256(name), name)


class AboutBrandContractTest(unittest.TestCase):
    def test_about_uses_approved_brand_platform(self):
        html = page("sobre.html")
        for required in (
            "Há mais de três décadas, vestimos os momentos que aproximam pessoas e ficam na memória.",
            "A roupa é parte do momento. Nosso trabalho é acolher cada história, cuidar de cada detalhe e ajudar famílias a viverem celebrações que ficam na memória.",
            "Unir famílias. Realizar sonhos. Transformar vidas.",
            "Unir famílias e realizar sonhos, transformando os grandes momentos da vida em memórias que atravessam gerações.",
            "Acolher cada pessoa, entender a sua história e vestir sua celebração com cuidado e excelência, da primeira prova ao grande dia.",
            '<div class="fphrase">Unindo famílias. Realizando sonhos.</div>',
        ):
            self.assertIn(required, html)
        self.assertRegex(
            html,
            r"<small>\s*Costuramos sonhos desde 1994\.<br>"
            r"CNPJ 02\.504\.054/0001-10 · © 2026 Koisa Linda · Protótipo para avaliação</small>",
        )

    def test_about_has_all_five_values_with_descriptions(self):
        html = page("sobre.html")
        values = {
            "Família no centro": "Celebramos os vínculos e lembramos que cada escolha envolve pessoas que se amam.",
            "Cada sonho é único": "Escutamos antes de orientar. A cliente não entra em um molde; o atendimento se adapta à história dela.",
            "Cuidado em cada detalhe": "Da prova ao ajuste, do prazo à entrega: tratamos cada etapa com atenção e responsabilidade.",
            "Respeito por cada história": "Acolhemos corpos, estilos, gerações e trajetórias diferentes com dignidade e verdade.",
            "Confiança de geração em geração": "Honramos nossa palavra e os relacionamentos construídos pela Koisa Linda desde 1994.",
        }
        articles = re.findall(
            r'<article[^>]*class="[^"]*\bbrand-value\b[^"]*"[^>]*>.*?</article>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        self.assertEqual(5, len(articles))
        for title, description in values.items():
            matching = [article for article in articles if title in article]
            self.assertEqual(1, len(matching), title)
            article = matching[0]
            self.assertRegex(article, rf"<h3[^>]*>{re.escape(title)}</h3>")
            self.assertIn(description, article)

    def test_about_purpose_composition_is_face_safe(self):
        html = page("sobre.html")
        purpose = section_with_class(html, "purpose-section")

        self.assertIn('src="img/cliente-noiva-3.webp"', purpose)
        self.assertIn('class="purpose-photo"', purpose)
        self.assertIn('class="purpose-content"', purpose)
        self.assertLess(
            purpose.index('class="purpose-photo"'),
            purpose.index('class="purpose-content"'),
        )
        media = re.search(
            r'<div class="purpose-photo"[^>]*>(.*?)</div>',
            purpose,
            flags=re.IGNORECASE | re.DOTALL,
        )
        self.assertIsNotNone(media)
        self.assertNotRegex(media.group(1), r"<(?:h[1-6]|p|a|button)\b")
        self.assertRegex(
            purpose,
            r'<h2[^>]*>Unir famílias\. Realizar sonhos\. Transformar vidas\.</h2>',
        )
        self.assertRegex(purpose, r"<h3[^>]*>Propósito</h3>")
        self.assertRegex(purpose, r"<h3[^>]*>Missão</h3>")

    def test_about_retires_the_six_old_brand_phrases(self):
        folded = page("sobre.html").casefold()
        for retired in (
            "beleza consciente",
            "onde cada escolha faz o mundo melhor",
            "moda como ferramenta de empoderamento feminino",
            "não vendemos um vestido",
            "facilitamos uma transformação",
            "essa é a nossa beleza consciente",
        ):
            self.assertNotIn(retired.casefold(), folded)

    def test_about_pixel_fallback_is_valid_and_preserved(self):
        html = page("sobre.html")
        noscript_blocks = re.findall(
            r"<noscript\b[^>]*>.*?</noscript>",
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )

        self.assertEqual(1, len(noscript_blocks))
        self.assertRegex(html, r"<body[^>]*>\s*<noscript\b")
        self.assertNotIn("<noscript", html[: html.lower().index("</head>")].lower())
        self.assertIn(
            "https://www.facebook.com/tr?id=1720591949105146&ev=PageView&noscript=1",
            noscript_blocks[0],
        )
        self.assertIn("fbq('init','1720591949105146')", html)
        self.assertIn("fbq('track','PageView')", html)

    def test_about_focus_and_mobile_controls_match_home_accessibility(self):
        html = page("sobre.html")
        focus_rule = balanced_css_block(
            html, "a:focus-visible,button:focus-visible"
        ).replace(" ", "")
        self.assertIn("outline:3pxsolidvar(--ruby)", focus_rule)

        dark_selector = (
            "footer a:focus-visible,.band a:focus-visible,"
            ".kl-sticky-cta a:focus-visible,.kl-sticky-cta button:focus-visible"
        )
        dark_rule = balanced_css_block(html, dark_selector).replace(" ", "")
        self.assertIn("outline-color:#fff", dark_rule)
        self.assertIn("--kl-tap-target:48px", html.replace(" ", ""))

        social_rule = balanced_css_block(html, ".fsoc").replace(" ", "")
        self.assertIn("flex-wrap:wrap", social_rule)

        tablet_blocks = css_blocks(html, "@media(max-width:860px)")
        mobile_controls = (
            ".mtog,.mnav a,.ig-btn,.btn-pri,.btn-out,.mini,.mini-cta,.fsoc a"
        )
        self.assertTrue(
            any(
                mobile_controls.replace(" ", "") in block.replace(" ", "")
                and "min-height:var(--kl-tap-target)" in block.replace(" ", "")
                for block in tablet_blocks
            ),
            "todos os controles móveis devem manter alvo mínimo de 48px",
        )

    def test_about_purpose_layout_stacks_only_below_680px(self):
        html = page("sobre.html")
        photo_rule = balanced_css_block(html, ".purpose-photo img").replace(" ", "")
        for declaration in (
            "height:auto",
            "aspect-ratio:2/3",
            "object-fit:cover",
            "object-position:centertop",
        ):
            self.assertIn(declaration, photo_rule)

        mobile_blocks = css_blocks(html, "@media(max-width:680px)")
        self.assertTrue(
            any(
                ".section.purpose-section" in block
                and "padding:0068px" in block.replace(" ", "")
                and
                ".purpose-grid" in block
                and "grid-template-columns:1fr" in block.replace(" ", "")
                for block in mobile_blocks
            ),
            "foto e copy devem empilhar apenas abaixo de 680px",
        )
        for block in css_blocks(html, "@media(max-width:860px)"):
            self.assertFalse(
                ".purpose-grid" in block
                and "grid-template-columns:1fr" in block.replace(" ", ""),
                "o tablet deve preservar o grid em dois planos",
            )
        self.assertNotRegex(
            html,
            r"\.purpose(?:-photo|-content)[^{]*\{[^}]*(?:opacity\s*:\s*0|visibility\s*:\s*hidden)",
        )

    def test_about_keeps_tracking_and_enhancement_scripts(self):
        html = page("sobre.html")
        for required in (
            'src="kl-tracking.js?v=20260715catalog1"',
            'src="kl-site-enhance.js?v=20260716catalog2"',
        ):
            self.assertIn(required, html)


VISIBLE_PAGES = (
    "index.html",
    "sobre.html",
    "catalogo.html",
    "como-chegar.html",
    "servicos.html",
    "unidades.html",
)

RETIRED_PHRASES = (
    "beleza consciente",
    "onde cada escolha faz o mundo melhor",
    "moda como ferramenta de empoderamento feminino",
    "não vendemos um vestido",
    "facilitamos uma transformação",
    "essa é a nossa beleza consciente",
)


class VisiblePagesContractTest(unittest.TestCase):
    def test_visible_pages_use_current_footer_and_retire_old_language(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                folded = html.casefold()
                for retired in RETIRED_PHRASES:
                    self.assertNotIn(retired.casefold(), folded)
                self.assertIn(
                    '<div class="fphrase">Unindo famílias. Realizando sonhos.</div>',
                    html,
                )
                self.assertRegex(
                    html,
                    r"<small>\s*Costuramos sonhos desde 1994\.<br>[^<]+</small>",
                )

    def test_visible_pages_keep_one_valid_pixel_fallback_at_body_start(self):
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                noscript_blocks = re.findall(
                    r"<noscript\b[^>]*>.*?</noscript>",
                    html,
                    flags=re.IGNORECASE | re.DOTALL,
                )
                self.assertEqual(1, len(noscript_blocks))
                self.assertRegex(html, r"<body[^>]*>\s*<noscript\b")
                head = html[: html.lower().index("</head>")]
                self.assertNotIn("<noscript", head.casefold())
                pixel = re.search(
                    r"tr\?id=(\d+)&ev=PageView&noscript=1",
                    noscript_blocks[0],
                )
                self.assertIsNotNone(pixel)
                self.assertEqual(
                    "f536a36777ecb8647edd02332a1c9d785006f6b4bd47eec226a06fc6a7e03333",
                    digest(pixel.group(1)),
                )
                initializer = re.search(r"fbq\('init','(\d+)'\)", html)
                self.assertIsNotNone(initializer)
                self.assertEqual(
                    "f536a36777ecb8647edd02332a1c9d785006f6b4bd47eec226a06fc6a7e03333",
                    digest(initializer.group(1)),
                )
                self.assertIn("fbq('track','PageView')", html)

    def test_visible_pages_have_contrasting_keyboard_focus(self):
        light_selector = "a:focus-visible,button:focus-visible"
        dark_selector = (
            "footer a:focus-visible,.band a:focus-visible,"
            ".kl-sticky-cta a:focus-visible,.kl-sticky-cta button:focus-visible"
        )
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                light_rule = balanced_css_block(html, light_selector).replace(" ", "")
                dark_rule = balanced_css_block(html, dark_selector).replace(" ", "")
                self.assertIn("outline:3pxsolidvar(--ruby)", light_rule)
                self.assertIn("outline-color:#fff", dark_rule)

    def test_visible_pages_wrap_social_links_and_keep_mobile_tap_targets(self):
        standard_controls = (
            ".mtog,.mnav a,.ig-btn,.btn-pri,.btn-out,.mini,.mini-cta,.fsoc a"
        )
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                compact = re.sub(r"\s+", "", html)
                self.assertIn("--kl-tap-target:48px", compact)
                social_rule = balanced_css_block(html, ".fsoc").replace(" ", "")
                self.assertIn("flex-wrap:wrap", social_rule)
                tablet_blocks = css_blocks(html, "@media(max-width:860px)")
                self.assertTrue(
                    any(
                        standard_controls.replace(" ", "")
                        in block.replace(" ", "")
                        and "min-height:var(--kl-tap-target)"
                        in block.replace(" ", "")
                        for block in tablet_blocks
                    ),
                    "controles móveis devem declarar alvo mínimo de 48px",
                )
                if 'class="ig-btn"' in html:
                    self.assertIn(".ig-btn", standard_controls)

    def test_units_mobile_cta_override_matches_the_base_rule_specificity(self):
        html = page("unidades.html")
        compact = re.sub(r"\s+", "", html)
        override = ".unit.mini{min-height:var(--kl-tap-target)}"
        override_index = compact.rfind(override)

        self.assertGreaterEqual(
            override_index,
            0,
            "o CTA de cada unidade precisa de override com a mesma especificidade",
        )
        tablet_blocks = css_blocks(html, "@media(max-width:860px)")
        self.assertTrue(
            any(override in re.sub(r"\s+", "", block) for block in tablet_blocks),
            "o override específico deve valer somente no layout móvel/tablet",
        )
        self.assertGreater(
            override_index,
            compact.rfind(".unit.mini{display:inline-flex"),
            "o override de 48px deve vir depois da regra base de 46px",
        )

    def test_visible_pages_keep_shared_scripts_one_h1_and_approved_whatsapps(self):
        all_html = []
        for name in VISIBLE_PAGES:
            with self.subTest(page=name):
                html = page(name)
                all_html.append(html)
                self.assertIn('src="kl-tracking.js?v=20260715catalog1"', html)
                self.assertIn('src="kl-site-enhance.js?v=20260716catalog2"', html)
                self.assertEqual(1, len(re.findall(r"<h1\b", html, re.IGNORECASE)))

        numbers = set(re.findall(r"wa\.me/(55\d+)", "\n".join(all_html)))
        self.assertEqual(
            {
                "a2613c0f61c3dcf35b472a5f1d5b03904ccbbc5b78acfbc3f578b15701a74f79",
                "dcc97840afbc12fcab7911d36037a59fadcd8f6c714b86a2c8c8b3a960d2ba99",
            },
            {digest(number) for number in numbers},
        )


class CatalogIntegrationContractTest(unittest.TestCase):
    def test_catalog_mobile_menu_link_closes_visual_and_accessibility_state(self):
        html = re.sub(r"\s+", "", page("catalogo.html"))

        self.assertIn(
            'document.body.classList.remove("mopen");'
            'b.setAttribute("aria-expanded","false")',
            html,
        )

    def test_shared_header_hamburger_is_vertical_and_touch_safe_through_1100(self):
        css = re.sub(r"\s+", "", page("kl-site-enhance.css"))
        self.assertIn(
            "@media(max-width:1100px){header.menu{display:none}",
            css,
        )
        self.assertIn(
            "header.mtog{display:flex;min-width:48px;min-height:48px;",
            css,
        )
        self.assertIn("header.mtog.mtog-icon{flex-direction:column}", css)
        self.assertIn('class="mtog mtog-icon"', page("catalogo.html"))

    def test_try_on_bridge_is_minimal_same_brand_and_has_a_manual_fallback(self):
        html = page("provar.html")
        self.assertIn("<title>Prova Virtual — Koisa Linda</title>", html)
        self.assertRegex(
            html,
            r'<meta\s+name="robots"\s+content="noindex(?:,\s*follow)?">',
        )
        for favicon in (
            '<link rel="icon" href="img/favicon.ico" sizes="any">',
            '<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">',
            '<link rel="icon" type="image/png" sizes="16x16" href="img/favicon-16.png">',
            '<link rel="apple-touch-icon" href="img/apple-touch-icon.png">',
        ):
            self.assertIn(favicon, html)
        self.assertRegex(
            html,
            r'<a\b[^>]*id="catalog-tryon-link"[^>]*'
            r'href="catalogo\.html\?prova=1"[^>]*>',
        )
        self.assertRegex(
            html,
            r'<noscript>\s*<p>.*?'
            r'href="catalogo\.html\?prova=1".*?</p>\s*</noscript>',
        )
        self.assertEqual(1, html.count("location.replace("))
        self.assertNotRegex(html, r'<meta\s+http-equiv="refresh"')

        folded = html.casefold()
        for forbidden in (
            "meta pixel", "fbq(", "kl-tracking", "kl-site-enhance",
            "kl-catalog-", "workers.dev", "fetch(", "localstorage",
            'type="file"', "wa.me/",
        ):
            self.assertNotIn(forbidden, folded)

    def test_all_static_try_on_links_open_the_catalog_dialog(self):
        total = 0
        for name, expected_count in STATIC_TRYON_LINK_COUNTS.items():
            with self.subTest(page=name):
                html = page(name)
                self.assertNotIn('href="provar.html"', html)
                count = html.count('href="catalogo.html?prova=1"')
                self.assertEqual(expected_count, count)
                total += count
        self.assertEqual(19, total)

    def test_try_on_bridge_is_not_indexed_in_sitemap(self):
        sitemap = page("sitemap.xml")
        self.assertNotIn("provar.html", sitemap)
        self.assertNotIn("?prova=1", sitemap)
        self.assertEqual(1, sitemap.count("https://koisalinda.com.br/catalogo.html"))

    def test_shared_sticky_close_keeps_a_real_touch_target(self):
        css = re.sub(r"\s+", "", page("kl-site-enhance.css"))
        self.assertIn(
            ".kl-sticky-cta.kl-sticky-x{min-width:44px;min-height:44px;",
            css,
        )

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
        self.assertIn("resolveStickyCta", js)
        self.assertNotRegex(js, r"k==='catalogo'\|\|k==='peca'\?'\d+")

    def test_detail_uses_shared_modules_and_exact_try_on_allowlist(self):
        html = page("peca.html")
        self.assertIn('src="kl-catalog-core.js?v=20260716tryon1"', html)
        self.assertIn('src="kl-catalog-actions.js?v=20260716tryon1"', html)
        self.assertIn("Core.validateProducts", html)
        self.assertIn("Actions.productWhatsAppHref", html)
        self.assertIn("Actions.tryOnHref", html)
        self.assertNotIn("d.c.indexOf('vestidos')===0", html)
        self.assertIn("Core.thumbUrl", html)
        self.assertEqual(1, html.count("fbq('track','ViewContent'"))

    def test_every_shared_page_uses_new_cache_versions(self):
        for name in SHARED_SCRIPT_PAGES:
            with self.subTest(page=name):
                html = page(name)
                self.assertIn('src="kl-tracking.js?v=20260715catalog1"', html)
                self.assertIn('src="kl-site-enhance.js?v=20260716catalog2"', html)
                self.assertIn('href="kl-site-enhance.css?v=20260716tryon1"', html)
                self.assertNotIn("20260710deep3", html)
                self.assertNotIn("20260713r3", html)
                self.assertNotIn("20260715hdr", html)

    def test_campaign_whatsapps_match_the_audited_units(self):
        expected = {
            "noivas.html": "dcc97840afbc12fcab7911d36037a59fadcd8f6c714b86a2c8c8b3a960d2ba99",
            "debutantes.html": "dcc97840afbc12fcab7911d36037a59fadcd8f6c714b86a2c8c8b3a960d2ba99",
            "madrinhas.html": "a2613c0f61c3dcf35b472a5f1d5b03904ccbbc5b78acfbc3f578b15701a74f79",
            "ternos.html": "dcc97840afbc12fcab7911d36037a59fadcd8f6c714b86a2c8c8b3a960d2ba99",
        }
        for name, expected_digest in expected.items():
            with self.subTest(page=name):
                numbers = re.findall(r"wa\.me/(55\d+)", page(name))
                self.assertGreaterEqual(len(numbers), 2)
                self.assertEqual({expected_digest}, {digest(number) for number in numbers})

    def test_debutantes_and_ternos_remain_entirely_in_barra(self):
        products = catalog_products()
        expected_counts = {"vestidos-debutante": 72, "ternos": 7}
        for category, expected_count in expected_counts.items():
            with self.subTest(category=category):
                category_products = [item for item in products if item["c"] == category]
                self.assertEqual(expected_count, len(category_products))
                self.assertEqual({"barra"}, {item["un"] for item in category_products})

class CatalogHybridContractTest(unittest.TestCase):
    def _assert_catalog_rail_override_contract(self, css: str):
        exact_properties = (
            ("position", "sticky"),
            ("top", "var(--catalog-header-offset,71px)"),
            ("z-index", "40"),
        )
        for property_name, expected in exact_properties:
            values = css_property_values(
                css, ".catalog-filter-rail", property_name
            )
            self.assertTrue(values, property_name)
            for value in values:
                self.assertEqual(expected, re.sub(r"\s+", "", value.lower()))

        outline_values = css_property_values(
            css, ".catalog-filter-rail button:focus-visible", "outline"
        )
        self.assertTrue(outline_values)
        normalized_outlines = []
        for value in outline_values:
            normalized = re.sub(r"\s*!important\s*$", "", value.lower()).strip()
            normalized_outlines.append(re.sub(r"\s+", "", normalized))
            first_token = normalized.split(maxsplit=1)[0]
            self.assertNotEqual("none", first_token)
            self.assertNotRegex(first_token, r"^0(?:[a-z%]+)?$")
        self.assertIn("3pxsolidvar(--ruby)", normalized_outlines)

        for value in css_property_values(
            css, ".catalog-filter-rail button:focus-visible", "outline-width"
        ):
            normalized = re.sub(r"\s*!important\s*$", "", value.lower()).strip()
            self.assertNotRegex(normalized, r"^0(?:[a-z%]+)?$")

        min_heights = css_property_values(
            css, ".catalog-filter-rail button", "min-height"
        )
        self.assertTrue(min_heights)
        for value in min_heights:
            normalized = re.sub(r"\s*!important\s*$", "", value.lower()).strip()
            match = re.fullmatch(r"(\d+(?:\.\d+)?)px", normalized)
            self.assertIsNotNone(match, normalized)
            self.assertGreaterEqual(float(match.group(1)), 44, normalized)

    def test_catalog_css_contract_rejects_later_invalid_overrides(self):
        css = page("kl-catalog.css")
        mutations = {
            "position": (
                "@media(max-width:680px){"
                ".catalog-filter-rail,.mutation-probe{position:static;}}"
            ),
            "top": ".mutation-probe,.catalog-filter-rail{top:0;}",
            "z-index": ".catalog-filter-rail{z-index:0;}",
            "outline": (
                "@media(prefers-contrast:more){.mutation-probe,"
                ".catalog-filter-rail button:focus-visible{outline:none;}}"
            ),
            "outline width": (
                ".catalog-filter-rail button:focus-visible{outline-width:0;}"
            ),
            "tap target": (
                "@media(max-width:680px){.catalog-filter-rail button,"
                ".mutation-probe{min-height:40px;}}"
            ),
        }
        for name, override in mutations.items():
            with self.subTest(mutation=name):
                with self.assertRaises(AssertionError):
                    self._assert_catalog_rail_override_contract(css + override)

    def test_catalog_full_filters_end_with_sentinel_and_precede_compact_rail(self):
        html = page("catalogo.html")
        tools_match = re.search(
            r'<section id="catalog-filters" class="catalog-tools"[^>]*>.*?</section>',
            html,
            flags=re.DOTALL,
        )
        rail_match = re.search(
            r'<section id="catalog-filter-rail" class="catalog-filter-rail"[^>]*\bhidden\b[^>]*>.*?</section>',
            html,
            flags=re.DOTALL,
        )

        self.assertIsNotNone(tools_match)
        self.assertIsNotNone(rail_match)
        tools = tools_match.group(0)
        self.assertRegex(
            tools,
            r'<p id="catalog-count" class="catalog-count" aria-live="polite">'
            r'Carregando catálogo…</p>\s*'
            r'<div id="catalog-filter-sentinel" aria-hidden="true"></div>\s*</section>$',
        )
        results_start = html.index('<section id="catalog-results"', rail_match.end())
        self.assertEqual("", html[tools_match.end() : rail_match.start()].strip())
        self.assertEqual("", html[rail_match.end() : results_start].strip())

    def test_catalog_compact_rail_has_mirrored_static_controls(self):
        html = page("catalogo.html")
        rail = section_with_class(html, "catalog-filter-rail")

        self.assertRegex(
            rail,
            r'<div class="catalog-filter-rail-summary">\s*'
            r'<span id="catalog-filter-rail-count">Carregando catálogo…</span>\s*'
            r'<span id="catalog-filter-rail-category">Todas as categorias</span>\s*'
            r'</div>',
        )
        self.assertNotIn("aria-live", rail)
        self.assertNotRegex(rail, r"<select\b")
        self.assertNotIn('name="rail-cat"', rail)
        self.assertRegex(
            rail,
            r'(?s)<fieldset id="catalog-filter-rail-units" class="catalog-filter-rail-units">'
            r'.*?<button type="button" data-unit="" aria-pressed="true">Todas</button>'
            r'.*?<button type="button" data-unit="barra" aria-pressed="false">Barra da Tijuca</button>'
            r'.*?<button type="button" data-unit="sf" aria-pressed="false">São Francisco</button>'
            r'.*?</fieldset>',
        )
        self.assertRegex(
            rail,
            r'<button id="catalog-adjust-filters"[^>]*aria-controls="catalog-filters"[^>]*>'
            r'\s*Ajustar filtros\s*</button>',
        )

    def test_catalog_full_panel_scrolls_while_compact_rail_is_sticky(self):
        css = page("kl-catalog.css")
        self._assert_catalog_rail_override_contract(css)
        tools = balanced_css_block(css, ".catalog-tools").replace(" ", "")
        tools_rules = [
            declarations.replace(" ", "")
            for declarations in css_declarations_for_exact_selector(
                css, ".catalog-tools"
            )
        ]
        hidden = balanced_css_block(css, ".catalog-filter-rail[hidden]").replace(" ", "")

        self.assertTrue(tools_rules)
        for declarations in tools_rules:
            self.assertNotRegex(declarations, r"(?<![-\w])position:")
            self.assertNotRegex(declarations, r"(?<![-\w])top:")
            self.assertNotIn("z-index:", declarations)
        self.assertIn(
            "scroll-margin-top:calc(var(--catalog-header-offset,71px)+16px)",
            tools,
        )
        self.assertIn("display:none", hidden)

    def test_catalog_compact_controls_are_touch_and_keyboard_accessible(self):
        css = page("kl-catalog.css")
        self._assert_catalog_rail_override_contract(css)
        pressed = balanced_css_block(
            css, '.catalog-filter-rail-units button[aria-pressed="true"]'
        ).replace(" ", "")
        reduced_transparency = balanced_css_block(
            css, "@media(prefers-reduced-transparency:reduce)"
        )
        rail_transparency_fallback = re.sub(
            r"\s+",
            "",
            balanced_css_block(reduced_transparency, ".catalog-tools,"),
        )

        self.assertNotIn(".catalog-filter-rail select", css)
        self.assertIn("background:var(--ruby)", pressed)
        self.assertIn("border-color:var(--ruby)", pressed)
        self.assertIn("color:#fff", pressed)
        self.assertIn(".catalog-tools,.catalog-filter-rail", rail_transparency_fallback)
        self.assertIn("background:var(--cream)", rail_transparency_fallback)
        self.assertIn("-webkit-backdrop-filter:none", rail_transparency_fallback)
        self.assertIn("backdrop-filter:none", rail_transparency_fallback)

    def test_catalog_mobile_hides_only_compact_category_and_units(self):
        css = page("kl-catalog.css")
        mobile = balanced_css_block(css, "@media(max-width:680px)")
        hidden_selectors = set()
        for selector_group, declarations in re.findall(
            r"([^{}]+)\{([^{}]*)\}", mobile
        ):
            if re.search(r"display\s*:\s*none\b", declarations):
                hidden_selectors.update(
                    selector.strip() for selector in selector_group.split(",")
                )

        self.assertIn("#catalog-filter-rail-category", hidden_selectors)
        self.assertIn(".catalog-filter-rail-units", hidden_selectors)
        for visible_rail_selector in (
            "#catalog-filter-rail-count",
            "#catalog-adjust-filters",
            ".catalog-filter-rail-summary",
            ".catalog-filter-rail-inner",
            ".catalog-filter-rail",
        ):
            self.assertNotIn(visible_rail_selector, hidden_selectors)
        for full_filter_selector in (
            ".catalog-tools",
            ".catalog-units",
            ".catalog-facets",
            ".catalog-facet-group",
            ".catalog-facet-options",
            ".catalog-active-filters",
        ):
            self.assertNotIn(full_filter_selector, hidden_selectors)

    def test_catalog_loads_split_assets_in_dependency_order(self):
        html = page("catalogo.html")
        assets = (
            "kl-catalog-data.js?v=20260715db",
            "kl-catalog-core.js?v=20260716tryon1",
            "kl-catalog-actions.js?v=20260716tryon1",
            "kl-catalog-gallery.js?v=20260715catalog1",
            "kl-tracking.js?v=20260715catalog1",
            "kl-catalog-tryon.js?v=20260716tryon1",
            "kl-catalog-app.js?v=20260716tryon1",
        )
        for asset in assets:
            self.assertIn(asset, html, asset)
        positions = [html.index(asset) for asset in assets]
        self.assertEqual(positions, sorted(positions))
        for asset in assets:
            self.assertRegex(
                html,
                rf'<script\s+defer\s+src="{re.escape(asset)}"></script>',
            )
        self.assertIn('href="kl-catalog.css?v=20260716tryon1"', html)
        catalog_css = html.index('href="kl-catalog.css?v=20260716tryon1"')
        tryon_css = html.index('href="kl-catalog-tryon.css?v=20260716tryon1"')
        enhance_css = html.index('href="kl-site-enhance.css?v=20260716tryon1"')
        self.assertLess(catalog_css, tryon_css)
        self.assertLess(tryon_css, enhance_css)
        self.assertNotIn("const DATA=window.KL_DATA", html)
        self.assertNotIn("let cat=new URLSearchParams", html)

    def test_catalog_tryon_dialog_has_accessible_static_structure(self):
        html = page("catalogo.html")
        dialogs = list(re.finditer(
            r'<dialog\b[^>]*\bid="(catalog-(?:gallery|favorites|tryon))"[^>]*>'
            r'.*?</dialog>',
            html,
            flags=re.DOTALL,
        ))
        self.assertEqual(
            ["catalog-gallery", "catalog-favorites", "catalog-tryon"],
            [dialog.group(1) for dialog in dialogs],
        )
        match = re.search(
            r'<dialog\s+id="catalog-tryon"\s+class="catalog-tryon"\s+'
            r'aria-labelledby="tryon-title"\s+'
            r'aria-describedby="tryon-description">(.*?)</dialog>',
            html,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(match)
        dialog = match.group(1)

        self.assertRegex(dialog, r'<h2\s+id="tryon-title"\s+tabindex="-1">')
        self.assertRegex(
            dialog,
            r'<button[^>]+id="tryon-close"[^>]+type="button"[^>]+'
            r'aria-label="Fechar Prova Virtual"',
        )
        self.assertRegex(dialog, r'<label[^>]+for="tryon-search"')
        self.assertRegex(dialog, r'<input[^>]+id="tryon-search"[^>]+type="search"')
        self.assertRegex(dialog, r'<label[^>]+for="tryon-file"')
        self.assertRegex(dialog, r'<input[^>]+id="tryon-file"[^>]+type="file"')
        self.assertIn('src="img/prova-virtual-exemplo.webp"', dialog)

        required_ids = (
            "tryon-title", "tryon-description", "tryon-close", "tryon-sizes",
            "tryon-categories", "tryon-search", "tryon-dresses", "tryon-more",
            "tryon-clear-selection", "tryon-photo", "tryon-file",
            "tryon-preview", "tryon-submit", "tryon-form", "tryon-loading",
            "tryon-result", "tryon-result-image", "tryon-again", "tryon-error",
            "tryon-error-message", "tryon-whatsapp",
        )
        for element_id in required_ids:
            self.assertEqual(1, dialog.count(f'id="{element_id}"'), element_id)

    def test_catalog_tryon_form_covers_selection_upload_and_disclaimer(self):
        html = page("catalogo.html")
        dialog = re.search(
            r'<dialog\s+id="catalog-tryon".*?>(.*?)</dialog>',
            html,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(dialog)
        source = dialog.group(1)
        form = re.search(
            r'<form[^>]+id="tryon-form"[^>]*>(.*?)</form>',
            source,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(form)
        form_source = form.group(1)

        sizes = re.search(
            r'<fieldset[^>]+id="tryon-sizes"[^>]*>(.*?)</fieldset>',
            form_source,
            flags=re.DOTALL,
        )
        categories = re.search(
            r'<fieldset[^>]+id="tryon-categories"[^>]*>(.*?)</fieldset>',
            form_source,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(sizes)
        self.assertIsNotNone(categories)
        for size in ("PP", "P", "M", "G", "GG"):
            self.assertRegex(
                sizes.group(1),
                rf'<button[^>]+data-size="{size}"[^>]*>{size}</button>',
            )
        self.assertIn("Não sei meu tamanho", sizes.group(1))
        self.assertIn('id="tryon-clear-size"', sizes.group(1))
        for category in (
            "all", "vestidos-noiva", "vestidos-madrinha", "vestidos-debutante",
        ):
            self.assertIn(f'data-category="{category}"', categories.group(1))

        self.assertRegex(
            form_source,
            r'<button[^>]+id="tryon-submit"[^>]+type="submit"[^>]+disabled',
        )
        self.assertRegex(
            form_source,
            r'<input[^>]+id="tryon-file"[^>]+accept="image/[^">]+"',
        )
        self.assertRegex(
            form_source,
            re.compile(
                r'<figure[^>]+class="[^"]*tryon-photo-guide[^"]*"[^>]*>.*?'
                r'<img[^>]+id="tryon-photo"[^>]*>\s*<figcaption>',
                flags=re.DOTALL,
            ),
        )
        self.assertIn('class="tryon-disclaimer"', form_source)
        self.assertNotRegex(source, r'\b(?:onclick|style)\s*=')

    def test_catalog_tryon_photo_guide_explains_input_and_result(self):
        html = page("catalogo.html")
        guide = re.search(
            r'<figure\s+class="tryon-photo-guide">\s*'
            r'<img[^>]+alt="([^"]+)"[^>]*>\s*'
            r'<figcaption>(.*?)</figcaption>',
            html,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(guide)
        self.assertEqual(
            "Comparação lado a lado entre a foto de corpo inteiro enviada e o "
            "resultado com a mesma pessoa usando um vestido longo",
            guide.group(1),
        )
        self.assertEqual(
            "À esquerda, a foto enviada. À direita, a simulação com o vestido. "
            "Prefira fundo simples e boa iluminação.",
            guide.group(2).strip(),
        )

    def test_catalog_tryon_states_use_one_live_region_per_announcement(self):
        html = page("catalogo.html")
        dialog = re.search(
            r'<dialog\s+id="catalog-tryon".*?>(.*?)</dialog>',
            html,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(dialog)
        source = dialog.group(1)

        form = re.search(r'<form[^>]+id="tryon-form".*?</form>', source, re.DOTALL)
        loading = re.search(r'<section[^>]+id="tryon-loading"[^>]*>', source)
        result = re.search(r'<section[^>]+id="tryon-result"[^>]*>', source)
        error = re.search(r'<section[^>]+id="tryon-error"[^>]*>', source)
        for state in (form, loading, result, error):
            self.assertIsNotNone(state)

        self.assertNotIn("aria-live", form.group(0).split(">", 1)[0])
        self.assertIn('role="status"', loading.group(0))
        self.assertIn('aria-live="polite"', loading.group(0))
        self.assertIn('aria-live="polite"', result.group(0))
        self.assertIn('role="alert"', error.group(0))
        self.assertNotIn("aria-live", error.group(0))
        self.assertNotRegex(source, r'role="alert"[^>]+aria-live=')
        self.assertRegex(loading.group(0), r'\bhidden\b')
        self.assertRegex(result.group(0), r'\bhidden\b')
        self.assertRegex(error.group(0), r'\bhidden\b')

    def test_catalog_tryon_css_is_mobile_safe_and_never_covers_actions(self):
        self.assertTrue(
            (ROOT / "kl-catalog-tryon.css").is_file(),
            "kl-catalog-tryon.css precisa existir",
        )
        css = page("kl-catalog-tryon.css")
        dialog = balanced_css_block(css, ".catalog-tryon").replace(" ", "")
        scroll = balanced_css_block(css, ".tryon-scroll").replace(" ", "")
        mobile = balanced_css_block(css, "@media(max-width:680px)")
        mobile_dialog = balanced_css_block(
            mobile, ".catalog-tryon"
        ).replace(" ", "")

        self.assertIn("overflow-x:hidden", dialog)
        self.assertIn("overflow-y:auto", scroll)
        self.assertIn("overscroll-behavior:contain", scroll)
        self.assertIn("width:100vw", mobile_dialog)
        self.assertIn("height:100dvh", mobile_dialog)
        self.assertIn("max-height:none", mobile_dialog)
        self.assertIn("border-radius:0", mobile_dialog)

        for selector_group, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
            if "tryon" not in selector_group:
                continue
            self.assertNotRegex(
                declarations,
                r"(?:^|;)\s*position\s*:\s*(?:fixed|sticky)\b",
                selector_group.strip(),
            )

    def test_catalog_tryon_centers_desktop_and_resets_margin_on_mobile(self):
        css = page("kl-catalog-tryon.css")
        margins = [
            re.sub(r"\s+", "", value.lower())
            for value in css_property_values(css, ".catalog-tryon", "margin")
        ]
        mobile = balanced_css_block(css, "@media(max-width:680px)")
        mobile_dialog = balanced_css_block(
            mobile, ".catalog-tryon"
        ).replace(" ", "")

        self.assertEqual(["auto", "0"], margins)
        self.assertIn("margin:0", mobile_dialog)

    def test_catalog_tryon_upload_label_exposes_the_hidden_input_focus(self):
        css = page("kl-catalog-tryon.css")
        upload_focus = balanced_css_block(
            css, ".tryon-upload-field:focus-within .tryon-upload-label"
        ).replace(" ", "")

        self.assertIn("outline:3pxsolidvar(--ruby)", upload_focus)
        self.assertIn("outline-offset:3px", upload_focus)

    def test_catalog_tryon_controls_focus_and_motion_contract(self):
        self.assertTrue(
            (ROOT / "kl-catalog-tryon.css").is_file(),
            "kl-catalog-tryon.css precisa existir",
        )
        css = page("kl-catalog-tryon.css")
        close = balanced_css_block(css, "#tryon-close").replace(" ", "")
        controls = balanced_css_block(
            css, ".catalog-tryon button,"
        ).replace(" ", "")
        focus = balanced_css_block(
            css, ".catalog-tryon :focus-visible"
        ).replace(" ", "")
        reduced = balanced_css_block(
            css, "@media(prefers-reduced-motion:reduce)"
        ).replace(" ", "")

        self.assertIn("width:48px", close)
        self.assertIn("height:48px", close)
        self.assertRegex(controls, r"min-height:(?:44|48)px")
        self.assertIn("outline:3pxsolidvar(--ruby)", focus)
        self.assertIn("transition:none", reduced)
        self.assertIn("animation:none", reduced)

        for value in re.findall(r"transition(?:-property)?\s*:\s*([^;}]+)", css):
            normalized = re.sub(
                r"\s*!important\b", "", value.strip().lower()
            ).strip()
            if normalized == "none":
                continue
            self.assertNotIn("all", normalized)
            properties = re.findall(r"(?:^|,)\s*([a-z-]+)", normalized)
            self.assertTrue(properties)
            self.assertTrue(
                set(properties).issubset({"transform", "opacity"}),
                normalized,
            )

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
            'id="catalog-count" class="catalog-count" aria-live="polite"',
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
        buttons = re.findall(
            r'<button class="catalog-shortcut".*?</button>',
            shortcuts,
            flags=re.DOTALL,
        )
        self.assertEqual(3, len(buttons))
        for button in buttons:
            self.assertRegex(button, r'<img\b[^>]*alt=""[^>]*>\s*<span>[^<]+</span>')
        self.assertNotRegex(shortcuts, r'<(?:span|label)[^>]*class="[^"]*overlay')

    def test_catalog_css_has_two_mobile_columns_and_reduced_motion(self):
        css = page("kl-catalog.css")
        mobile = balanced_css_block(css, "@media(max-width:680px)").replace(" ", "")
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", mobile)
        self.assertIn("scrollbar-width:none", mobile)
        self.assertIn("::-webkit-scrollbar", mobile)
        self.assertIn("display:none", mobile)
        reduced = balanced_css_block(
            css, "@media(prefers-reduced-motion:reduce)"
        ).replace(" ", "")
        self.assertIn("animation:none", reduced)
        self.assertIn("transition:none", reduced)
        low = balanced_css_block(css, "@media(max-height:600px)").replace(" ", "")
        self.assertIn("max-height:34dvh", low)
        self.assertIn("display:none", low)

    def test_catalog_dialogs_are_named_and_face_safe(self):
        html = page("catalogo.html")
        self.assertRegex(
            html,
            r'<dialog[^>]+id="catalog-gallery"[^>]+aria-labelledby="gallery-title"',
        )
        self.assertRegex(
            html,
            r'<dialog[^>]+id="catalog-favorites"[^>]+aria-labelledby="favorites-title"',
        )
        self.assertIn('class="gallery-media"', html)
        self.assertIn('class="gallery-panel"', html)
        self.assertLess(
            html.index('class="gallery-media"'),
            html.index('class="gallery-panel"'),
        )
        media = re.search(
            r'<figure class="gallery-media"[^>]*>(.*?)</figure>',
            html,
            re.DOTALL,
        )
        self.assertIsNotNone(media)
        self.assertNotRegex(media.group(1), r"<(?:h[1-6]|p|a)\b")

    def test_catalog_grid_preserves_lazy_thumbnails_without_original_fallback(self):
        js = page("kl-catalog-app.js")
        self.assertIn("image.loading = 'lazy'", js)
        self.assertNotIn("image.loading = 'eager'", js)
        self.assertIn("gridImageFailurePolicy", js)
        self.assertIn("requestOriginal: false", js)
        self.assertNotIn("image.src = product.u", js)
        request_more = re.search(
            r"function requestMore\(source\) \{(.*?)\n  \}",
            js,
            re.DOTALL,
        )
        self.assertIsNotNone(request_more)
        self.assertIn("return true;", request_more.group(1))
        self.assertNotIn("return source ===", request_more.group(1))

    def test_catalog_external_css_replaces_old_focus_and_tap_contracts(self):
        css = page("kl-catalog.css")
        dark = balanced_css_block(
            css, ".gallery-media button:focus-visible"
        ).replace(" ", "")
        light = balanced_css_block(
            css, ".gallery-panel a:focus-visible"
        ).replace(" ", "")
        self.assertIn("outline:3pxsolid#fff", dark)
        self.assertIn("outline:3pxsolidvar(--ruby)", light)
        for selector in (
            ".catalog-units button", ".catalog-favorites-trigger",
            ".catalog-load-more", ".gallery-primary", ".gallery-secondary",
        ):
            rule = balanced_css_block(css, selector).replace(" ", "")
            self.assertRegex(rule, r"min-height:(?:44|48)px")

    def test_catalog_card_photo_focus_ring_stays_inside_clipped_media(self):
        css = page("kl-catalog.css")
        rule = balanced_css_block(
            css, ".catalog-card-photo:focus-visible"
        ).replace(" ", "")
        self.assertIn("outline-offset:-", rule)
        overlay = balanced_css_block(
            css, ".catalog-card-photo:focus-visible::after"
        ).replace(" ", "")
        self.assertIn("position:absolute", overlay)
        self.assertIn("inset:0", overlay)
        self.assertIn("z-index:2", overlay)
        self.assertIn("pointer-events:none", overlay)
        self.assertGreaterEqual(overlay.count("inset"), 2)
        self.assertIn("#fff", overlay)
        self.assertIn("var(--ruby)", overlay)

    def test_catalog_seo_titles_do_not_use_long_dashes(self):
        html = page("catalogo.html")
        title = re.search(r"<title>(.*?)</title>", html)
        og_title = re.search(
            r'<meta\s+property="og:title"\s+content="([^"]+)">', html
        )
        self.assertIsNotNone(title)
        self.assertIsNotNone(og_title)
        self.assertEqual(title.group(1), "Catálogo - Koisa Linda")
        self.assertEqual(og_title.group(1), "Catálogo - Koisa Linda")
        for value in (title.group(1), og_title.group(1)):
            self.assertNotRegex(value, r"[—–]")


if __name__ == "__main__":
    unittest.main()
