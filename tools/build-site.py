#!/usr/bin/env python3
"""Build the existing static site with canonical directory URLs. No dependencies.
HTML sources remain at the root. Publish the output directory, never the source tree.
"""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, urljoin, unquote
from html import escape, unescape
import argparse, json, re, shutil, importlib.util

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://koisalinda.com.br'
_seo_spec = importlib.util.spec_from_file_location('kl_seo_site', ROOT/'tools/seo_site.py')
seo = importlib.util.module_from_spec(_seo_spec)
_seo_spec.loader.exec_module(seo)
_cta_spec = importlib.util.spec_from_file_location('kl_cta_agenda', ROOT/'tools/cta_agenda.py')
assert _cta_spec is not None and _cta_spec.loader is not None
cta_agenda = importlib.util.module_from_spec(_cta_spec)
_cta_spec.loader.exec_module(cta_agenda)
PUBLIC_ROOT_FILES = frozenset(['2e6a8e0fffab111a0cbe5ae7b36fb00f.txt', 'CNAME', 'apple-touch-icon.png', 'favicon.ico', 'kl-agendar.js', 'kl-schedule-context.js', 'kl-schedule-experience.css', 'kl-capture.js', 'kl-capture.css', 'kl-catalog-actions.js', 'kl-catalog-app.js', 'kl-catalog-atributos.json', 'kl-catalog-core.js', 'kl-catalog-data.js', 'kl-catalog-gallery.js', 'kl-catalog-tryon.css', 'kl-catalog-tryon.js', 'kl-catalog.css', 'kl-fonts.css', 'kl-ga.js', 'kl-redirect.js', 'kl-refine.css', 'kl-seo.css', 'kl-site-enhance.css', 'kl-site-enhance.js', 'kl-tracking.js', 'kl-ui.js', 'robots.txt'])
PUBLIC_ROOT_FILES = PUBLIC_ROOT_FILES | {'kl-catalog-clean.js', 'kl-catalog-clean.css', 'kl-capture-popup.js', 'kl-layout.css', 'kl-route-normalize.js', 'kl-prova-virtual.js', 'kl-prova-virtual.css'}
CAPTURE_VERSION = '20260906google1'
PUBLIC_ROOT_FILES = PUBLIC_ROOT_FILES | {'kl-booking-links.js', 'kl-consultoria.css', 'kl-consultoria.js', 'kl-consultoria-config.json'}
CAPTURE_EXCLUDED = frozenset(('consultoria.html', 'agendar.html', 'privacidade.html', 'peca.html', 'provar.html', '404.html'))
CAPTURE_CATEGORIES = {
 'noivas.html':'vestidos-noiva', 'noivas-experiencia.html':'vestidos-noiva',
 'debutantes.html':'vestidos-debutante', 'madrinhas.html':'vestidos-madrinha', 'ternos.html':'ternos',
}
BASE_ROUTES = {
 'consultoria.html':'/consultoria/', 'index.html':'/', 'catalogo.html':'/catalogo/', 'agendar.html':'/agendar/',
 'noivas.html':'/noivas/', 'noivas-experiencia.html':'/noivas/experiencia/',
 'debutantes.html':'/debutantes/', 'madrinhas.html':'/madrinhas/', 'ternos.html':'/ternos/',
 'sobre.html':'/sobre/', 'servicos.html':'/servicos/', 'unidades.html':'/unidades/',
 'como-chegar.html':'/como-chegar/', 'privacidade.html':'/privacidade/',
 'peca.html':'/peca/', 'provar.html':'/prova-virtual/',
}
ROUTES = dict(BASE_ROUTES)
for p in sorted(ROOT.glob('vestido-de-noiva-*.html')):
 ROUTES[p.name] = '/noivas/' + p.stem.replace('vestido-de-noiva-', '', 1) + '/'
# Existing aliases are explicitly inventoried, not guessed from unknown 404s.
ALIASES = {}
for p in sorted(ROOT.rglob('*')):
 if p.is_file()  and p.suffix.lower() in ('.html','.htm','.php'):
  if p.relative_to(ROOT).as_posix() in ROUTES or p.name=='404.html' or any(x.startswith('.') or x in ('_site','_preview','tools','tests','docs','p') for x in p.relative_to(ROOT).parts): continue
  s=p.read_text()
  if len(s)<2000:
   m=re.search(r'location\.replace\([\'"]([^\'"]+)',s)
   if m: ALIASES['/'+p.relative_to(ROOT).as_posix()] = m.group(1)

def public_url(value, source='index.html'):
 """Resolve local references from their source file, then map known pages only."""
 value=unescape(value)
 if not value or value.startswith(('#','data:','mailto:','tel:','javascript:')):return value
 u=urlsplit(value)
 if u.netloc and u.netloc not in ('koisalinda.com.br','www.koisalinda.com.br'):return value
 if u.scheme and u.scheme not in ('http','https'):return value
 resolved=urlsplit(urljoin(ORIGIN+'/'+source,value))
 path=resolved.path
 target=ROUTES.get(path.lstrip('/'),path)
 if target.rstrip('/')=='/catalogo' and 'prova=1' in resolved.query.split('&'):
  from urllib.parse import parse_qsl, urlencode
  target='/prova-virtual/'
  resolved=resolved._replace(query=urlencode([(k,v) for k,v in parse_qsl(resolved.query,keep_blank_values=True) if k!='prova']))
 t=urlsplit(target)
 query=resolved.query
 if t.query:
  # Default parameters from the destination must coexist with origin/filter parameters.
  from urllib.parse import parse_qsl, urlencode
  values=dict(parse_qsl(query,keep_blank_values=True));values.update(dict(parse_qsl(t.query)))
  query=urlencode(values)
 result=urlunsplit(('', '',t.path,query,resolved.fragment))
 return ORIGIN+result if u.netloc else result

def rewrite_text_urls(s, source):
 # HTML URL attributes, srcsets, and CSS url() are resolved relative to original source.
 s=re.sub(r'\b(href|src|poster|action|data-src)=("|\')([^"\']*)\2',lambda m:m[1]+'='+m[2]+escape(public_url(m[3],source),quote=True)+m[2],s)
 def srcset(m):
  value=', '.join(' '.join([public_url(pair.split()[0],source)]+pair.split()[1:]) for pair in m[3].split(',') if pair.strip())
  return m[1]+'='+m[2]+escape(value,quote=True)+m[2]
 s=re.sub(r'\b(srcset|data-srcset)=("|\')([^"\']*)\2',srcset,s)
 s=re.sub(r'url\((\s*[\'"]?)([^\)\'"\s]+)([\'"]?\s*)\)',lambda m:'url('+m[1]+public_url(m[2],source)+m[3]+')',s)
 # JS string builders and structured data also produce links. Use exact known basenames.
 for name,dest in sorted(ROUTES.items(),key=lambda x:-len(x[0])):
  s=re.sub(r'(?P<q>[\'"`])(?:\.\./|/)?'+re.escape(name)+r'(?=[?\#\'"`])',lambda m:m['q']+dest,s)
  s=s.replace(ORIGIN+'/'+name,ORIGIN+dest)
 return s

def redirect_page(destination):
 return '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Este endereço mudou | Koisa Linda</title>
<link rel="canonical" href="'''+escape(ORIGIN+destination,quote=True)+'''">
<meta name="robots" content="noindex,follow">
<script src="/kl-redirect.js" defer></script>
<style>body{margin:0;padding:15vh 24px;background:#fbf7ef;color:#2c2326;font:20px/1.6 Georgia,serif;text-align:center}a{display:inline-block;padding:14px 24px;color:#722f37}a:focus-visible{outline:2px solid #722f37}</style>
</head><body><h1>Seu momento continua por aqui.</h1><p>O endereço desta página mudou.</p>
<a id="kl-redirect" href="'''+escape(destination,quote=True)+'''">Continuar para a Koisa Linda</a></body></html>'''

def add_capture(s, source):
 """Share one capture form; booking, privacy, shells and redirects stay separate."""
 if source in CAPTURE_EXCLUDED or not (source in ROUTES or source.startswith('p/')):
  return s
 category=CAPTURE_CATEGORIES.get(source,'');unit=''
 if source.startswith('vestido-de-noiva-'):
  category='vestidos-noiva'
  unit='sf' if source.endswith('-niteroi.html') else 'barra' if source.endswith('-barra-da-tijuca.html') else ''
 elif source.startswith('p/'):
  product=seo.context()[0].get(Path(source).stem,{})
  category=product.get('c','');unit=product.get('un','')
 invitation=cta_agenda.capture_invitation(source,seo)
 if invitation is not None:
  s=re.sub(r'<script\b[^>]*src=["\'][^"\']*\bkl-capture(?:-popup)?\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>','',s)
  s=re.sub(r'<link\b[^>]*href=["\'][^"\']*\bkl-capture\.css(?:\?[^"\']*)?["\'][^>]*>','',s)
  s=s.replace('<!-- kl-capture -->',invitation,1) if '<!-- kl-capture -->' in s else seo.insert_end(s,invitation)
  # Booking replaces capture, not attribution: preserve the existing tracking dependency.
  if not re.search(r'<script\b[^>]*src=["\'][^"\']*\bkl-tracking\.js(?:\?[^"\']*)?["\']',s):
   s=s.replace('</head>','<script defer src="/kl-tracking.js?v=20260906google1"></script></head>',1)
  return s
 template=(ROOT/'tools/partials/capture.html').read_text()
 template=template.replace('{{category}}',escape(category,quote=True)).replace('{{unit}}',escape(unit,quote=True))
 if '<!-- kl-capture -->' in s:
  s=s.replace('<!-- kl-capture -->',template,1)
 else:
  s=seo.insert_end(s,template)
 # Keep the catalogue Actions dependency in its original order; every other page
 # needs only its contacts/helper module, not the catalogue App or its data.
 if not re.search(r'<script\b[^>]*src=["\'][^"\']*\bkl-catalog-actions\.js(?:\?[^"\']*)?["\']',s):
  s=s.replace('</head>','<script defer src="/kl-catalog-actions.js?v=20260906agenda1"></script></head>',1)
 # Static product/style entries also need first/last attribution before capture.
 # Keep any existing tracking tag and version; never add an extra GA loader.
 if not re.search(r'<script\b[^>]*src=["\'][^"\']*\bkl-tracking\.js(?:\?[^"\']*)?["\']',s):
  s=s.replace('</head>','<script defer src="/kl-tracking.js?v=20260906agenda1"></script></head>',1)
 # A single managed bundle also refreshes any older source-page capture tags.
 s=re.sub(r'<script\b[^>]*src=["\'][^"\']*\bkl-capture(?:-popup)?\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>','',s)
 s=re.sub(r'<link\b[^>]*href=["\'][^"\']*\bkl-capture\.css(?:\?[^"\']*)?["\'][^>]*>','',s)
 assets=f'<link rel="stylesheet" href="/kl-capture.css?v={CAPTURE_VERSION}">'
 assets+=''.join(f'<script defer src="/{asset}?v={CAPTURE_VERSION}"></script>' for asset in ('kl-capture-popup.js','kl-capture.js'))
 return s.replace('</head>',assets+'</head>',1)

def add_consultoria_navigation(s, source):
 # Integrate the new tab into existing full navigation without changing store routes.
 def add(m):
  body=m[2]
  if re.search(r'href=["\'][^"\']*(?:/consultoria/|consultoria\.html)', body):return m[0]
  current=' class="cur" aria-current="page"' if source=='consultoria.html' else ''
  return m[1]+body+'<a href="/consultoria/"'+current+'>Consultoria</a>'+m[3]
 return re.sub(r'(<nav\b[^>]*class=["\'](?:menu|mnav)["\'][^>]*>)(.*?)(</nav>)',add,s,flags=re.S)

def render(s, source, canonical, preview=False):
 s=add_consultoria_navigation(s,source)
 s=add_capture(s,source)
 # The tracking fallback is decorative, never a content image.
 s=re.sub(r'<img(?=[^>]*facebook\.com/tr)(?![^>]*\balt=)', '<img alt=""',s)
 s=rewrite_text_urls(s,source)
 # Font files stay on the same origin and use font-display: swap.
 s=re.sub(r'<link\b[^>]*href=["\'][^"\']*fonts\.(?:googleapis|gstatic)\.com[^>]*>', '', s)
 s=s.replace('</head>', '<link rel="stylesheet" href="/kl-fonts.css"></head>', 1)
 # Metadata is based on the content URL, never UTM, filter, or experiment query strings.
 absolute=ORIGIN+urlsplit(canonical).path
 s=re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>','',s)
 s=re.sub(r'<meta\b[^>]*property=["\']og:url["\'][^>]*>','',s)
 s=s.replace('</head>',f'<link rel="canonical" href="{absolute}"><meta property="og:url" content="{absolute}"></head>',1)
 # Resolve inline fetch/image builders against root while explicit hash links stay local.
 s=s.replace('<head>','<head><base href="/">',1)
 s=re.sub(r'href=(["\'])#([^"\']+)\1',lambda m:'href='+m[1]+urlsplit(canonical).path+'#'+m[2]+m[1],s)
 s=s.replace('<head>','<head><script src="/kl-route-normalize.js"></script><script src="/kl-urls.js"></script>',1)
 s=seo.refine(s,source,canonical)
 s=cta_agenda.refine(s,source,seo)
 s=s.replace('</head>','<script defer src="/kl-booking-links.js?v=20260915agenda"></script></head>',1)
 # One shared, final layout layer for main pages, styles and indexed products.
 family='produto' if source.startswith('p/') and source!='p/index.html' else 'estilo' if source.startswith('vestido-de-noiva-') else Path(source).stem
 booking_context=cta_agenda.context(source,seo)
 booking_attrs=''.join(' data-kl-booking-'+k+'="'+escape(v,quote=True)+'"' for k,v in booking_context.items() if v)
 s=re.sub(r'<body\b', '<body data-kl-page="'+family+'"'+booking_attrs, s, count=1)
 if family in ('produto','estilo') or source=='p/index.html':
  s=s.replace('</header>', '<nav class="kl-entry-nav" aria-label="Navegação principal"><a href="/catalogo/">Catálogo</a><a href="/unidades/">Lojas</a></nav></header>', 1)
 s=s.replace('</head>', '<link rel="stylesheet" href="/kl-layout.css?v=20260908aida"></head>', 1)
 if source=='consultoria.html':
  s=s.replace('</head>', '<link rel="stylesheet" href="/kl-consultoria.css"></head>', 1)
 s=re.sub(r'(kl-(?:catalog-actions|catalog-tryon|catalog-gallery|catalog-app|site-enhance|schedule-context|agendar)\.js)(?:\?[^"\'<>\s]*)?',r'\1?v=20260915agenda',s)
 s=re.sub(r'(kl-(?:tracking)\.js)(?:\?[^"\'<>\s]*)?',r'\1?v=20260906google1',s)
 s=re.sub(r'(kl-catalog\.css)(?:\?[^"\'<>\s]*)?',r'\1?v=20260915agenda',s)
 if preview:
  s=s.replace('<head>', '<head><script src="/qa-metrics.js"></script>',1)
  s=re.sub(r'<script\b[^>]*src=["\'][^"\']*(?:kl-ga\.js|kl-tracking\.js)[^>]*></script>','',s)
  s=re.sub(r'<script>\s*!function\(f,b,e,v,n,t,s\).*?</script>','',s,flags=re.S)
  s=re.sub(r'<noscript><img\b[^>]*facebook\.com[^>]*>\s*</noscript>','',s)
  s=s.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>')
 return s

def build(output, preview=False):
 output=Path(output).resolve()
 if output==ROOT or ROOT in output.parents and output.name not in ('_site','_preview'):
  raise ValueError('Use _site, _preview, or a directory outside the source tree.')
 output.mkdir(parents=True,exist_ok=True)
 def write(rel,s):
  p=output/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
 # Allowlist of public assets. No backups, credentials, tests or source documentation.
 for directory in ('img','videos','fonts'):
  if (ROOT/directory).exists():shutil.copytree(ROOT/directory,output/directory,dirs_exist_ok=True,ignore=shutil.ignore_patterns('_originais-antes-otimizacao'))
 for p in ROOT.iterdir():
  if p.is_file() and p.name in PUBLIC_ROOT_FILES:
   if p.suffix in ('.css','.js','.txt','.json'):
    write(p.name,rewrite_text_urls(p.read_text(),p.name))
   else:shutil.copy2(p,output/p.name)
 write('.nojekyll','')
 if preview:shutil.copy2(ROOT/'tools/preview-metrics.js',output/'qa-metrics.js')
 for source,dest in ROUTES.items():
  path=urlsplit(dest).path
  rel=path.strip('/')+'/index.html' if path!='/' else 'index.html'
  write(rel,render((ROOT/source).read_text(),source,dest,preview))
  if source!='index.html':write(source,redirect_page(dest))
 # Keep indexed product identities stable; improve only navigation and relative assets.
 for p in (ROOT/'p').glob('*.html'):
  rel=p.relative_to(ROOT).as_posix();write(rel,render(p.read_text(),rel,'/'+rel,preview))
 for alias,target in ALIASES.items():
  destination=public_url(target,alias.lstrip('/'))
  write(alias.lstrip('/'),redirect_page(destination))
 write('provar/index.html',redirect_page('/prova-virtual/'))
 write('404.html',render((ROOT/'404.html').read_text(),'404.html','/404.html',preview))
 # A single redirect module: query + fragment survive, and redirect targets cannot leave the site.
 shutil.copy2(ROOT/'kl-redirect.js',output/'kl-redirect.js')
 sitemap=[]
 for p in sorted(output.rglob('*.html')):
  s=p.read_text()
  if re.search(r'<meta\b[^>]*name=["\']robots["\'][^>]*noindex',s,re.I):continue
  m=re.search(r'<link rel="canonical" href="([^"]+)"',s)
  if m:sitemap.append(m[1])
 # Preview has no indexable sitemap. Production includes agendar and excludes provar/peca shells.
 write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('  <url><loc>'+escape(u)+'</loc></url>\n' for u in sorted(set(sitemap)))+'</urlset>\n')
 page_ids={v.rstrip('/') or '/': k.removesuffix('.html') for k,v in ROUTES.items() if '?' not in v}
 urls_js="""(function(root){'use strict';var pages=MAP;root.KLUrls={pageKind:function(path){path=String(path||'/').replace(/\\/index\\.html$/,'/').replace(/\\/$/,'')||'/';return pages[path]||(path.split('/').pop()||'index').replace(/\\.html$/,'');}};}(window));""".replace('MAP',json.dumps(page_ids,ensure_ascii=False))
 write('kl-urls.js',urls_js)
 write('routes.json',json.dumps({'pages':ROUTES,'legacy':ALIASES},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'output':str(output),'pages':len(ROUTES),'product_pages':len(list((ROOT/'p').glob('*.html'))),'legacy_aliases':len(ALIASES),'sitemap_urls':len(set(sitemap)),'preview':preview},ensure_ascii=False))
 return output

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'_site'));parser.add_argument('--preview',action='store_true');args=parser.parse_args()
 build(args.output,args.preview)
