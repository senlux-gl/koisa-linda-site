#!/usr/bin/env python3
"""Páginas de intenção — onde a noiva realmente entra.

As 807 páginas de peça são cauda longa: cada uma responde por uma busca
rara. O volume está em "vestido de noiva princesa niterói", e é isso que
este gerador cria: uma página por corte, por estilo e por praça, agrupando
as peças que casam.

Depende de kl-catalog-atributos.json (corte/decote/manga/tecido/estilo),
produzido pela leitura das fotos.

Uso:  python3 tools/gera-paginas-intencao.py [--apply]
"""
import json, pathlib, re, sys, html

RAIZ = pathlib.Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv
SITE = "https://koisalinda.com.br"

# (slug, rótulo humano, campo, valor)  — a busca real da noiva
EIXOS = [
    ("princesa",     "corte princesa",     "corte",  "princesa"),
    ("sereia",       "corte sereia",       "corte",  "sereia"),
    ("corte-a",      "corte A (evasê)",    "corte",  "corte-a"),
    ("com-manga",    "com manga",          "manga",  ("manga-longa","manga-3-4","manga-bufante")),
    ("renda",        "de renda",           "tecido", "renda"),
    ("minimalista",  "minimalista",        "estilo", "minimalista"),
    ("decote-v",     "com decote V",       "decote", "v"),
]
PRACAS = [("niteroi","Niterói","São Francisco, em Niterói"),
          ("barra-da-tijuca","Barra da Tijuca","Barra da Tijuca, no Rio")]

def carrega():
    d = RAIZ/"kl-catalog-atributos.json"
    if not d.exists():
        raise SystemExit("kl-catalog-atributos.json ainda não existe — rode a leitura das fotos antes")
    attrs = {a["k"]: a for a in json.loads(d.read_text())}
    t = (RAIZ/"kl-catalog-data.js").read_text()
    prods = json.loads(re.search(r"\[\s*\{.*\}\s*\]", t, re.S).group(0))
    base = {p["k"]: p for p in prods if p.get("k")}
    return attrs, base

def casa(a, campo, valor):
    v = a.get(campo)
    return v in valor if isinstance(valor, tuple) else v == valor

def pagina(slug, rotulo, praca_slug, praca_nome, praca_desc, pecas, base):
    titulo = f"Vestido de Noiva {rotulo.capitalize()} em {praca_nome} | Koisa Linda"
    desc = (f"Vestidos de noiva {rotulo} para alugar ou comprar em {praca_nome}. "
            f"{len(pecas)} modelos no acervo da Koisa Linda, com ajuste no ateliê próprio "
            f"desde 1994. Agende sua prova.")
    cards = "".join(
        f'<a class="pc" href="p/{k}.html"><img src="{html.escape(base[k]["u"])}" alt="Vestido de noiva {rotulo} {k}" loading="lazy" width="400" height="533"><span>{k}</span></a>'
        for k in pecas[:60] if k in base)
    schema = {"@context":"https://schema.org","@type":"CollectionPage",
              "name": titulo, "description": desc,
              "url": f"{SITE}/vestido-de-noiva-{slug}-{praca_slug}.html",
              "about":{"@type":"Product","category":f"Vestido de noiva {rotulo}"}}
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(titulo)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{SITE}/vestido-de-noiva-{slug}-{praca_slug}.html">
<link rel="icon" href="img/favicon.ico" sizes="any">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Arapey&family=Playfair+Display:ital,wght@1,400;1,500&family=Questrial&display=swap" rel="stylesheet">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>
:root{{--ruby:#722F37;--gold:#C89F3C;--baunilha:#F4E5C4;--cream:#FBF7EF;--ink:#2c2326;
--muted:#9a8d80;--line:#e9e0d2;--serif:'Playfair Display',Georgia,serif;
--body:'Arapey',Georgia,serif;--sans:'Questrial',system-ui,sans-serif}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:var(--body);background:var(--cream);color:var(--ink);line-height:1.6}}
header{{background:rgba(251,247,239,.96);border-bottom:1px solid var(--line);padding:16px 32px}}
header a{{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--ruby);text-decoration:none}}
.wrap{{max-width:1240px;margin:0 auto;padding:46px 32px}}
h1{{font-family:var(--serif);font-style:italic;font-weight:500;font-size:clamp(30px,4.2vw,46px);
color:var(--ruby);line-height:1.12;max-width:20ch;text-wrap:balance}}
.sub{{max-width:60ch;margin-top:14px;color:#6b5c57}}
.rule{{width:54px;height:1px;background:var(--gold);margin:22px 0 32px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:18px}}
.pc{{display:block;text-decoration:none;color:inherit}}
.pc img{{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px;background:#eadbc5;display:block}}
.pc span{{display:block;font-family:var(--sans);font-size:11px;letter-spacing:1.8px;
color:var(--muted);margin-top:7px}}
.cta{{background:#F7EFDF;padding:60px 32px;text-align:center;margin-top:50px}}
.cta p{{font-family:var(--serif);font-style:italic;color:var(--ruby);font-size:clamp(22px,2.8vw,30px);
max-width:24ch;margin:0 auto;text-wrap:balance}}
.cta small{{display:block;font-family:var(--body);font-style:normal;font-size:16.5px;color:#6b5c57;
max-width:52ch;margin:16px auto 22px}}
.btn{{display:inline-block;font-family:var(--sans);font-size:12px;letter-spacing:2px;
text-transform:uppercase;padding:14px 30px;border-radius:30px;background:var(--ruby);
color:var(--baunilha);text-decoration:none}}
footer{{background:var(--ruby);color:var(--baunilha);text-align:center;padding:44px 32px}}
footer .v{{font-family:var(--serif);font-style:italic;font-size:18px;opacity:.9;max-width:34ch;margin:0 auto}}
footer .c{{font-family:var(--sans);font-size:9.5px;letter-spacing:2.6px;text-transform:uppercase;
color:var(--gold);margin-top:10px}}
@media(max-width:860px){{.wrap{{padding:30px 20px}}}}
</style></head><body>
<header><a href="index.html">Koisa Linda</a></header>
<div class="wrap">
  <h1>Vestido de noiva {html.escape(rotulo)} em {html.escape(praca_nome)}</h1>
  <p class="sub">São <strong>{len(pecas)} modelos</strong> {html.escape(rotulo)} no acervo, para alugar
  ou comprar, com prova em {html.escape(praca_desc)}. Cada peça passa pelo ateliê antes de sair:
  o que você escolhe aqui é o começo, o caimento se resolve na prova.</p>
  <div class="rule"></div>
  <div class="grid">{cards}</div>
</div>
<section class="cta">
  <p>Antes do altar, o provador.</p>
  <small>Agende um horário e prove com atendimento reservado. A consultora acompanha da primeira
  prova ao grande dia.</small>
  <a class="btn" href="unidades.html">Escolher unidade</a>
</section>
<footer><p class="v">&ldquo;Tu és toda formosa, querida minha, e em ti não há defeito.&rdquo;</p>
<p class="c">Cânticos 4:7</p></footer>
</body></html>"""

def main():
    attrs, base = carrega()
    geradas = []
    for slug, rotulo, campo, valor in EIXOS:
        pecas = sorted(k for k, a in attrs.items() if casa(a, campo, valor))
        if len(pecas) < 6:
            print(f"  {slug}: só {len(pecas)} peças — pulado (página magra não rankeia)")
            continue
        for pslug, pnome, pdesc in PRACAS:
            nome = f"vestido-de-noiva-{slug}-{pslug}.html"
            if APPLY:
                (RAIZ/nome).write_text(pagina(slug, rotulo, pslug, pnome, pdesc, pecas, base))
            geradas.append((nome, len(pecas)))
    print(f"\n  {len(geradas)} páginas de intenção {'geradas' if APPLY else 'seriam geradas'}:")
    for n, q in geradas: print(f"    {n:52s} {q} peças")

    if APPLY and geradas:
        sm = (RAIZ/"sitemap.xml").read_text()
        novas = "".join(f"  <url><loc>{SITE}/{n}</loc></url>\n" for n, _ in geradas
                        if f"{SITE}/{n}" not in sm)
        (RAIZ/"sitemap.xml").write_text(sm.replace("</urlset>", novas + "</urlset>"))
        print(f"  sitemap atualizado")

if __name__ == "__main__":
    main()
