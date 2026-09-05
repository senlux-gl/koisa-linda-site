#!/usr/bin/env python3
"""Build the existing static site with canonical directory URLs. No dependencies.
HTML sources remain at the root. Publish the output directory, never the source tree.
"""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, urljoin, unquote
from html import escape, unescape
import argparse, json, re, shutil

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://koisalinda.com.br'
PUBLIC_ROOT_FILES = frozenset(['2e6a8e0fffab111a0cbe5ae7b36fb00f.txt', 'CNAME', 'apple-touch-icon.png', 'favicon.ico', 'kl-agendar.js', 'kl-catalog-actions.js', 'kl-catalog-app.js', 'kl-catalog-atributos.json', 'kl-catalog-core.js', 'kl-catalog-data.js', 'kl-catalog-gallery.js', 'kl-catalog-tryon.css', 'kl-catalog-tryon.js', 'kl-catalog.css', 'kl-fonts.css', 'kl-ga.js', 'kl-redirect.js', 'kl-refine.css', 'kl-site-enhance.css', 'kl-site-enhance.js', 'kl-tracking.js', 'kl-ui.js', 'robots.txt'])
BASE_ROUTES = {
 'index.html':'/', 'catalogo.html':'/catalogo/', 'agendar.html':'/agendar/',
 'noivas.html':'/noivas/', 'noivas-experiencia.html':'/noivas/experiencia/',
 'debutantes.html':'/debutantes/', 'madrinhas.html':'/madrinhas/', 'ternos.html':'/ternos/',
 'sobre.html':'/sobre/', 'servicos.html':'/servicos/', 'unidades.html':'/unidades/',
 'como-chegar.html':'/como-chegar/', 'privacidade.html':'/privacidade/',
 'peca.html':'/peca/', 'provar.html':'/catalogo/?prova=1',
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
  if name=='provar.html':continue # Its special query must be merged, never concatenated.
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

def render(s, source, canonical, preview=False):
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
 s=s.replace('<head>','<head><script src="/kl-urls.js"></script>',1)
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
  if source=='provar.html':
   write(source,redirect_page(dest));continue
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
 write('provar/index.html',redirect_page('/catalogo/?prova=1'))
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
 print(json.dumps({'output':str(output),'pages':len(ROUTES)-1,'product_pages':len(list((ROOT/'p').glob('*.html'))),'legacy_aliases':len(ALIASES),'sitemap_urls':len(set(sitemap)),'preview':preview},ensure_ascii=False))
 return output

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'_site'));parser.add_argument('--preview',action='store_true');args=parser.parse_args()
 build(args.output,args.preview)
