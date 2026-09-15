"""Build-time CTA policy: conversion is booking; navigation is not conversion."""
from html import escape, unescape
from urllib.parse import urlsplit, parse_qsl, urlencode
import re

OCCASIONS = {'vestidos-noiva':'noiva', 'vestidos-debutante':'debutante'}

def context(source, seo):
    category = {'noivas.html':'vestidos-noiva','noivas-experiencia.html':'vestidos-noiva',
                'debutantes.html':'vestidos-debutante','madrinhas.html':'vestidos-madrinha','ternos.html':'ternos'}.get(source,'')
    unit = ''; code = ''
    if source.startswith('vestido-de-noiva-'):
        category='vestidos-noiva'; unit='sf' if source.endswith('-niteroi.html') else 'barra'
    if source.startswith('p/') and source != 'p/index.html':
        code=source.split('/')[-1].removesuffix('.html')
        products, _, pages = seo.context()
        current=products.get(code,{})
        category=current.get('c') or pages.get(code,{}).get('category','')
        unit=current.get('un','')
        if not current: code='' # Never promise an unavailable historical reference.
    return {'occasion':OCCASIONS.get(category,''),'unit':unit,'code':code,'category':category}

def href(ctx, source='site_cta'):
    q={'ui_source':source}
    for k,v in [('ocasiao',ctx['occasion']),('un',ctx['unit']),('modelo',ctx['code'])]:
        if v:q[k]=v
    return '/agendar/?'+urlencode(q)

def refine(s, source, seo):
    ctx=context(source,seo)
    if not ctx['occasion']: return s
    def anchor(m):
        attr,text=m[1],m[2]
        h=re.search(r'\bhref=([\'"])(.*?)\1',attr)
        if not h:return m[0]
        raw=unescape(h[2]); parsed=urlsplit(raw)
        is_whatsapp=parsed.netloc in ('wa.me','api.whatsapp.com')
        is_detail=source.startswith('p/') and parsed.path in ('/peca/','/unidades/') and 'class="btn"' in attr
        is_schedule=parsed.path in ('/agendar/','agendar.html','/agendar.html')
        if not (is_whatsapp or is_detail or is_schedule):return m[0]
        q=dict(parse_qsl(parsed.query)) if is_schedule else {}
        q.setdefault('ocasiao',ctx['occasion']);q.setdefault('ui_source','site_'+source.removesuffix('.html').replace('/','_'))
        if ctx['unit']:q.setdefault('un',ctx['unit'])
        if ctx['code']:q.setdefault('modelo',ctx['code'])
        if is_whatsapp:
            # Existing explicit store link wins over page context, never guessed by area.
            if parsed.path.strip('/')=='5521970858787':q['un']='sf'
            elif parsed.path.strip('/')=='5521966475383':q['un']='barra'
        destination='/agendar/?'+urlencode(q)
        attr=attr[:h.start(2)]+escape(destination,quote=True)+attr[h.end(2):]
        attr=re.sub(r'\s+target=([\'"]).*?\1','',attr)
        if is_whatsapp or is_detail:
            text='Agendar prova'+(' · Niterói' if q.get('un')=='sf' else ' · Barra' if q.get('un')=='barra' else '')
        return '<a'+attr+'>'+text+'</a>'
    return re.sub(r'<a\b([^>]*)>(.*?)</a>',anchor,s,flags=re.S)

def capture_invitation(source, seo):
    ctx=context(source,seo)
    if ctx['category'] and not ctx['occasion']:return None # Visit-free journeys stay intact.
    # Existing booking CTAs already serve these pages. Remove the competing capture
    # rather than inserting another block above the product photos.
    return ''
