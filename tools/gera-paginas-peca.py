#!/usr/bin/env python3
"""Gera uma página estática por peça do catálogo.

O catálogo da Koisa Linda é montado por JavaScript: o HTML servido não traz
nenhum produto, e nenhuma peça está no sitemap. Para o Googlebot a loja tem
11 páginas, e por isso ela some das buscas específicas ("vestido de noiva
sereia com renda") mesmo aparecendo bem nas genéricas.

Este gerador cria /p/<CODIGO>.html com o conteúdo real em HTML — os motores
extraem HTML visível, não JSON-LD — mais schema Product para resolução de
entidade, e alimenta o sitemap.

Regra do catálogo respeitada: NÃO promete em qual loja a peça está. A
unidade entra só como sugestão de contato; a cliente escolhe com quem falar.

Uso:  python3 tools/gera-paginas-peca.py [--apply]
"""
import json, pathlib, re, sys, html

RAIZ = pathlib.Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv
SITE = "https://koisalinda.com.br"

CATEGORIA = {
    "vestidos-noiva":     ("Vestido de noiva",     "noivas.html",     "noiva"),
    "vestidos-madrinha":  ("Vestido de festa",     "madrinhas.html",  "madrinha, convidada ou formanda"),
    "vestidos-debutante": ("Vestido de debutante", "debutantes.html", "debutante"),
    "ternos":             ("Terno",                "ternos.html",     "noivo, padrinho ou convidado"),
    "acessorios":         ("Acessório",            "catalogo.html",   "compor o look"),
    "bolsas":             ("Bolsa",                "catalogo.html",   "compor o look"),
    "calcados":           ("Calçado",              "catalogo.html",   "compor o look"),
}
COR_LEGIVEL = {
    "azul-claro":"azul claro","azul-marinho":"azul marinho","off-white":"off white",
    "rosa-claro":"rosa claro","verde-agua":"verde água","vinho":"vinho","nude":"nude",
}

ATTR_PATH = "kl-catalog-atributos.json"

# o vocabulário que a noiva digita, na ordem em que ela digita
ROTULO = {
 "corte": {"princesa":"princesa","corte-a":"corte A","sereia":"sereia",
           "semi-sereia":"semi-sereia","reto":"reto","imperio":"império","mullet":"mullet"},
 "decote": {"v":"decote V","tomara-que-caia":"tomara que caia","coracao":"decote coração",
            "ombro-a-ombro":"ombro a ombro","redondo":"decote redondo","canoa":"decote canoa",
            "quadrado":"decote quadrado","halter":"decote halter"},
 "manga": {"manga-longa":"manga longa","manga-3-4":"manga 3/4","manga-bufante":"manga bufante",
           "capa":"capa","alca-fina":"alça fina","alca-larga":"alça larga","sem-manga":""},
 "tecido": {"renda":"de renda","tule":"de tule","cetim":"de cetim","crepe":"de crepe",
            "zibeline":"de zibeline","bordado":"bordado","pedraria":"com pedraria","liso":""},
 "estilo": {"minimalista":"minimalista","classico":"clássico","romantico":"romântico",
            "boho":"boho","moderno":"moderno"},
}
DETALHE = {"cauda":"com cauda","fenda":"com fenda","transparencia":"com transparência",
           "drapeado":"drapeado","laco":"com laço","flores-3d":"com flores 3D",
           "costas-nuas":"de costas nuas","brilho":"com brilho"}

def atributos():
    f = RAIZ/ATTR_PATH
    if not f.exists(): return {}
    import json as _j
    return {a["k"]: a for a in _j.loads(f.read_text())}

def carrega():
    t = (RAIZ/"kl-catalog-data.js").read_text()
    m = re.search(r"\[\s*\{.*\}\s*\]", t, re.S)
    if not m:
        raise SystemExit("não achei o array de produtos em kl-catalog-data.js")
    return json.loads(m.group(0))

def frase(a):
    """Monta o nome da peça com as palavras da busca real."""
    if not a: return "", ""
    partes = [ROTULO["corte"].get(a.get("corte"),"")]
    d = ROTULO["decote"].get(a.get("decote"),"")
    m = ROTULO["manga"].get(a.get("manga"),"")
    tec = ROTULO["tecido"].get(a.get("tecido"),"")
    if tec: partes.append(tec)
    if m: partes.append(m)
    if d: partes.append(d)
    curto = " ".join(x for x in partes[:3] if x)
    det = [DETALHE[x] for x in (a.get("detalhes") or []) if x in DETALHE][:2]
    longo = " ".join(x for x in partes if x) + (" " + " ".join(det) if det else "")
    est = ROTULO["estilo"].get(a.get("estilo"),"")
    return curto, (longo + (f", estilo {est}" if est else ""))

def pagina(p, a=None):
    cod = p["k"]
    cat, volta, ocasiao = CATEGORIA.get(p.get("c",""), ("Peça","catalogo.html","sua festa"))
    cor = COR_LEGIVEL.get(p.get("co",""), (p.get("co") or "").replace("-", " "))
    img = p.get("u","")
    tam = p.get("t") or "Único"

    titulo_cor = f" {cor}" if cor else ""
    curto, longo = frase(a)
    if curto:
        h1 = f"{cat} {curto}"
        title = f"{cat} {curto} em Niterói e Barra da Tijuca | Koisa Linda"
        desc = (f"{cat} {longo}. Código {cod} do acervo da Koisa Linda: aluguel e venda "
                f"com ajuste no ateliê próprio, em Niterói (São Francisco) e na Barra da "
                f"Tijuca. Agende sua prova.")
    else:
        h1 = f"{cat}{titulo_cor} · {cod}"
        title = f"{cat}{titulo_cor} {cod} | Koisa Linda Niterói e Barra da Tijuca"
        desc = (f"{cat}{titulo_cor} código {cod} do acervo da Koisa Linda. "
                f"Aluguel e venda com ajuste no ateliê, em Niterói (São Francisco) "
                f"e na Barra da Tijuca. Agende sua prova.")

    schema = {
        "@context":"https://schema.org","@type":"Product",
        "name": h1, "sku": cod, "image": img, "description": desc,
        "category": cat,
        "brand": {"@type":"Brand","name":"Koisa Linda"},
        "offers": {"@type":"Offer","availability":"https://schema.org/InStock",
                   "priceCurrency":"BRL","seller":{"@type":"ClothingStore","name":"Koisa Linda"},
                   "url": f"{SITE}/p/{cod}.html"},
    }
    if cor: schema["color"] = cor

    wa = ("https://wa.me/5521975227584?text=" +
          f"Ol%C3%A1%21%20Vi%20a%20pe%C3%A7a%20{cod}%20no%20site%20e%20quero%20saber%20mais.")

    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{SITE}/p/{cod}.html">
<link rel="icon" href="../img/favicon.ico" sizes="any">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{html.escape(img)}">
<meta property="og:type" content="product">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Arapey:ital@0;1&family=Playfair+Display:ital,wght@0,400;1,400;1,500&family=Questrial&display=swap" rel="stylesheet">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>
:root{{--ruby:#722F37;--ruby-dark:#5a242b;--gold:#C89F3C;--baunilha:#F4E5C4;
--cream:#FBF7EF;--paper:#fff;--ink:#2c2326;--muted:#9a8d80;--line:#e9e0d2;
--serif:'Playfair Display',Georgia,serif;--body:'Arapey',Georgia,serif;--sans:'Questrial',system-ui,sans-serif}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:var(--body);background:var(--cream);color:var(--ink);line-height:1.6}}
a{{color:inherit}}
header{{background:rgba(251,247,239,.96);border-bottom:1px solid var(--line);padding:16px 32px;
position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}}
header a{{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--ruby);text-decoration:none}}
.wrap{{max-width:1100px;margin:0 auto;padding:44px 32px}}
.crumb{{font-family:var(--sans);font-size:11px;letter-spacing:2.4px;text-transform:uppercase;
color:var(--muted);margin-bottom:22px}}
.crumb a{{text-decoration:none}}
.peca{{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:start}}
.foto{{border-radius:4px;overflow:hidden;background:#eadbc5;aspect-ratio:3/4}}
.foto img{{width:100%;height:100%;object-fit:cover;display:block}}
h1{{font-family:var(--serif);font-style:italic;font-weight:500;font-size:clamp(28px,3.6vw,40px);
color:var(--ruby);line-height:1.14;text-wrap:balance}}
.rule{{width:54px;height:1px;background:var(--gold);margin:18px 0}}
dl{{margin:22px 0}}
dt{{font-family:var(--sans);font-size:10.5px;letter-spacing:2.6px;text-transform:uppercase;
color:var(--muted);margin-top:14px}}
dd{{font-size:17px}}
.btn{{display:inline-block;font-family:var(--sans);font-size:12px;letter-spacing:2px;
text-transform:uppercase;padding:14px 30px;border-radius:30px;background:var(--ruby);
color:var(--baunilha);text-decoration:none;margin-top:8px}}
.btn.out{{background:transparent;border:1px solid var(--ruby);color:var(--ruby);margin-left:8px}}
.nota{{font-size:16px;color:#6b5c57;margin-top:26px;max-width:46ch}}
.nota em{{font-style:italic;color:var(--ruby)}}
footer{{background:var(--ruby);color:var(--baunilha);text-align:center;padding:46px 32px;margin-top:56px}}
footer .v{{font-family:var(--serif);font-style:italic;font-size:18px;opacity:.9;max-width:34ch;margin:0 auto}}
footer .c{{font-family:var(--sans);font-size:9.5px;letter-spacing:2.6px;text-transform:uppercase;
color:var(--gold);margin-top:10px}}
footer small{{display:block;font-size:13px;opacity:.72;margin-top:16px}}
@media(max-width:860px){{.peca{{grid-template-columns:1fr;gap:26px}}.wrap{{padding:30px 20px}}}}
</style></head><body>
<header><a href="../index.html">Koisa Linda</a></header>
<div class="wrap">
  <p class="crumb"><a href="../index.html">Início</a> · <a href="../catalogo.html">Catálogo</a> · <a href="../{volta}">{html.escape(cat)}</a> · {cod}</p>
  <div class="peca">
    <div class="foto"><img src="{html.escape(img)}" alt="{html.escape(h1)} da Koisa Linda" width="900" height="1200" loading="eager"></div>
    <div>
      <h1>{html.escape(h1)}</h1>
      <div class="rule"></div>
      <dl>
        <dt>Código</dt><dd>{cod}</dd>
        {f'<dt>Cor</dt><dd>{html.escape(cor)}</dd>' if cor else ''}
        <dt>Tamanho</dt><dd>{html.escape(tam)}</dd>
        {f'<dt>Corte</dt><dd>{html.escape(ROTULO["corte"].get(a.get("corte"),""))}</dd>' if a else ''}
        {f'<dt>Decote</dt><dd>{html.escape(ROTULO["decote"].get(a.get("decote"),""))}</dd>' if a and ROTULO["decote"].get(a.get("decote")) else ''}
        {f'<dt>Tecido</dt><dd>{html.escape(ROTULO["tecido"].get(a.get("tecido"),"").replace("de ",""))}</dd>' if a and ROTULO["tecido"].get(a.get("tecido")) else ''}
        <dt>Ocasião</dt><dd>Para {html.escape(ocasiao)}</dd>
        <dt>Onde provar</dt><dd>São Francisco (Niterói) e Barra da Tijuca</dd>
      </dl>
      <a class="btn" href="{wa}" target="_blank" rel="noopener">Falar com a loja</a>
      <a class="btn out" href="../catalogo.html">Ver o catálogo</a>
      <p class="nota">Esta peça passa pelo <em>ateliê</em> antes de sair. Manga, decote,
      comprimento e caimento se ajustam no seu corpo, na prova. Fale com a unidade para
      confirmar disponibilidade e reservar um horário.</p>
    </div>
  </div>
</div>
<footer>
  <p class="v">&ldquo;Os teus renovos são um pomar de romãs, com frutos excelentes.&rdquo;</p>
  <p class="c">Cânticos 4:13</p>
  <small>Koisa Linda &middot; costuramos sonhos desde 1994 &middot; Niterói e Barra da Tijuca</small>
</footer>
</body></html>"""

def main():
    produtos = carrega()
    attrs = atributos()
    destino = RAIZ/"p"
    print(f"  {len(produtos)} peças no catálogo")
    if APPLY:
        destino.mkdir(exist_ok=True)
    escritas, vistos = 0, set()
    for p in produtos:
        cod = p.get("k")
        if not cod or cod in vistos or not p.get("u"):
            continue
        vistos.add(cod)
        if APPLY:
            (destino/f"{cod}.html").write_text(pagina(p, attrs.get(cod)))
        escritas += 1
    print(f"  {escritas} páginas {'geradas em /p/' if APPLY else 'seriam geradas'}")

    # sitemap: institucionais que já existiam + uma entrada por peça
    if APPLY:
        sm = (RAIZ/"sitemap.xml").read_text()
        base = [u for u in re.findall(r"<loc>([^<]+)</loc>", sm) if "/p/" not in u]
        urls = base + [f"{SITE}/p/{c}.html" for c in sorted(vistos)]
        corpo = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
        (RAIZ/"sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{corpo}\n</urlset>\n")
        print(f"  sitemap.xml: {len(base)} institucionais + {len(vistos)} peças = {len(urls)} URLs")

if __name__ == "__main__":
    main()
