"""Visit-free party-dress navigation, with public store addresses in one source."""
from pathlib import Path
from html import escape
from urllib.parse import urlencode
import json, re

ROOT = Path(__file__).resolve().parent.parent
STORES = json.loads((ROOT / 'kl-visit-stores.json').read_text())
OFFER = ('<aside class="kl-festa-offer"><strong>3 acessórios incluídos no aluguel de festa</strong>'
         '<p>Bolsa, brinco e sandália, sem custo adicional no aluguel do vestido.</p>'
         '<small>Devolução ao final do aluguel. Modelos e tamanhos conforme disponibilidade na loja.</small></aside>')

def maps_href(unit):
    return 'https://www.google.com/maps/dir/?' + urlencode({'api':'1', 'destination':STORES[unit]['map_query']})

def store_card(unit):
    store=STORES[unit]
    return ('<article class="kl-visit-store" id="kl-visit-'+unit+'"><h3>'+escape(store['name'])+'</h3>'
            '<p>'+escape(store['address'])+'</p><small>'+escape(store['hours'])+'</small>'
            '<a class="kl-visit-route" href="'+escape(maps_href(unit),quote=True)+'" target="_blank" rel="noopener">Abrir rota · '+('Barra' if unit=='barra' else 'Niterói')+'</a></article>')

def refine(s, source, ctx):
    footer_links='<div class="kl-footer-stores">'+''.join(
        '<a href="'+escape(maps_href(u),quote=True)+'" target="_blank" rel="noopener"><strong>'+escape(v['name'])+'</strong><span>'+escape(v['address'])+'</span><span>Como chegar →</span></a>'
        for u,v in STORES.items())+'</div><p class="kl-footer-visit">Vestidos de festa: venha sem agendar, no horário de funcionamento.<br>Noivas e debutantes: agende sua prova.</p>'
    s,footer_count=re.subn(r'<div class="funits">.*?</div>',footer_links,s,count=1,flags=re.S)
    if not footer_count:
        s,footer_count=re.subn(r'(<footer\b[^>]*>)',lambda m:m[1]+footer_links,s,count=1)
    eligible = source in ('catalogo.html','madrinhas.html','peca.html','provar.html') or (source.startswith('p/') and ctx.get('category')=='vestidos-madrinha')
    if not eligible:
        return s.replace('</head>','<link rel="stylesheet" href="/kl-visit-free.css?v=20260928"></head>',1) if footer_count else s
    units=[ctx['unit']] if ctx.get('unit') in STORES else ['barra','sf']
    block=('<section class="kl-visit-free" id="kl-festa-visita" aria-labelledby="kl-visit-title">'
           '<div class="kl-visit-intro"><span>Festa · madrinhas · convidadas</span>'
           '<h2 id="kl-visit-title">Venha à loja. Não precisa agendar.</h2>'
           '<p>Confira a unidade de cada peça e venha provar.</p></div>'+OFFER+
           '<details class="kl-visit-details"'+('' if source=='catalogo.html' else ' open')+'><summary>'+('Endereço e horário da loja' if len(units)==1 else 'Endereços e horários · Barra e Niterói')+'</summary>'
           '<div class="kl-visit-stores">'+''.join(store_card(u) for u in units)+'</div></details></section>')
    if source=='catalogo.html':s=s.replace('<section id="catalog-filters"',block+'<section id="catalog-filters"',1)
    elif source=='madrinhas.html':s=s.replace('<section class="kl-seo-section kl-collection-preview"',block+'<section class="kl-seo-section kl-collection-preview"',1)
    elif source != 'peca.html':
        s=s.replace('</main>',block+'</main>',1) if '</main>' in s else s.replace('</header>','</header>'+block,1)
    stores=json.dumps(STORES,ensure_ascii=False).replace('<','\\u003c')
    tags=('<link rel="stylesheet" href="/kl-visit-free.css?v=20260928b">'
          '<script>window.KL_VISIT_STORES='+stores+';</script>'
          '<script defer src="/kl-visit-free.js?v=20261007festa"></script>')
    return s.replace('</head>',tags+'</head>',1)
