"""Checks the published artifact, not merely source spelling."""
import importlib.util, unittest, re, json
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('build_site',ROOT/'tools/build-site.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
class Page(HTMLParser):
 def __init__(self,s):super().__init__();self.urls=[];self.ids=set();self.canonicals=[];self.base=None;self.feed(s)
 def handle_starttag(self,t,items):
  a=dict(items)
  if a.get('id'):self.ids.add(a['id'])
  if t=='base':self.base=a.get('href')
  if t=='link' and a.get('rel')=='canonical':self.canonicals.append(a['href'])
  if t=='a' and a.get('href'):self.urls.append(a['href'])
  if t in ('img','script','source') and a.get('src'):self.urls.append(a['src'])
  if t=='link' and a.get('rel') in ('stylesheet','icon','preload'):self.urls.append(a.get('href',''))
class URLBuildTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.output=ROOT/'_site'
  if not (cls.output/'routes.json').exists():raise RuntimeError('Run python3 tools/build-site.py first')
  cls.pages={p:Page(p.read_text()) for p in cls.output.rglob('*.html')}
 def test_all_internal_assets_links_and_fragments_resolve(self):
  failures=[]
  for p,d in self.pages.items():
   for value in d.urls:
    u=urlsplit(urljoin(build.ORIGIN+(d.base or '/'+p.relative_to(self.output).as_posix()),value))
    if u.netloc!='koisalinda.com.br' or u.scheme not in ('http','https'):continue
    target=self.output/unquote(u.path).lstrip('/')
    if target.is_dir():target=target/'index.html'
    if not target.exists():failures.append((str(p),value))
    elif u.fragment and target in self.pages and unquote(u.fragment) not in self.pages[target].ids:failures.append((str(p),value,'fragment'))
  self.assertEqual(failures,[])
 def test_clean_urls_are_real_html_and_have_one_canonical(self):
  for source,path in build.ROUTES.items():
   if source=='provar.html':continue
   with self.subTest(path=path):
    file=self.output/(path.strip('/')+'/index.html' if path!='/' else 'index.html')
    self.assertIn('<h1' if source!='peca.html' else 'id="app"',file.read_text())
    self.assertEqual(self.pages[file].canonicals,[build.ORIGIN+path])
 def test_source_and_legacy_aliases_are_light_redirects_without_trackers(self):
  for alias in list(build.ALIASES)+['/'+x for x in build.ROUTES if x!='index.html']:
   with self.subTest(alias=alias):
    s=(self.output/alias.lstrip('/')).read_text()
    self.assertIn('id="kl-redirect"',s);self.assertIn('/kl-redirect.js',s)
    self.assertNotIn('fbq(',s);self.assertNotIn('http-equiv="refresh"',s)
 def test_schema_urls_and_canonicals_agree(self):
  for p in self.pages:
   s=p.read_text()
   for name in build.ROUTES:
    self.assertNotIn('https://koisalinda.com.br/'+name,s,p.name)
 def test_sitemap_only_has_unique_indexable_canonical_content(self):
  values=re.findall(r'<loc>(.*?)</loc>',(self.output/'sitemap.xml').read_text())
  self.assertEqual(len(values),len(set(values)))
  self.assertIn(build.ORIGIN+'/agendar/',values)
  self.assertNotIn(build.ORIGIN+'/provar.html',values)
  self.assertNotIn(build.ORIGIN+'/peca/',values)
  for value in values:self.assertNotIn('?',value)
 def test_rewrite_preserves_external_links_and_context(self):
  self.assertEqual(build.public_url('catalogo.html?cat=ternos&un=sf#catalog-grid'),'/catalogo/?cat=ternos&un=sf#catalog-grid')
  self.assertEqual(build.public_url('../catalogo.html','p/NV-001.html'),'/catalogo/')
  self.assertEqual(build.public_url('https://wa.me/123?text=hello'),'https://wa.me/123?text=hello')
 def test_no_animation_vendor_or_infinite_home_motion(self):
  for path in ['index.html','noivas/experiencia/index.html']:
   s=(self.output/path).read_text()
   self.assertNotRegex(s,r'<script[^>]*src="[^"]*(gsap|lenis|ScrollTrigger)')
   self.assertNotIn('setInterval(',s)
 def test_preview_sends_no_pageview(self):
  s=(ROOT/'_preview/index.html').read_text()
  self.assertNotIn('fbq(',s);self.assertNotIn('src="/kl-tracking.js',s);self.assertNotIn('src="/kl-ga.js',s)
if __name__=='__main__':unittest.main()
