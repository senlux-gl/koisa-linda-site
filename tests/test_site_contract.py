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
