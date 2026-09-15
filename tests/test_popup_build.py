"""Capture appears once on discovery pages with its existing consent contract."""
import importlib.util
import re
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('popup_build', ROOT/'tools/build-site.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
EXCLUDED = {'agendar.html', 'privacidade.html', 'peca.html', 'provar.html'}


class Page(HTMLParser):
 def __init__(self, html):
  super().__init__()
  self.ids = Counter()
  self.scripts = []
  self.styles = []
  self.capture = None
  self.inputs = {}
  self.feed(html)

 def handle_starttag(self, tag, attrs):
  attrs = dict(attrs)
  if attrs.get('id'):
   self.ids[attrs['id']] += 1
  if attrs.get('id') == 'kl-capture':
   self.capture = attrs
  if tag == 'script' and attrs.get('src'):
   self.scripts.append(attrs)
  if tag == 'link' and attrs.get('rel') == 'stylesheet':
   self.styles.append(attrs['href'])
  if tag == 'input':
   self.inputs[attrs.get('id')] = attrs


class PopupBuildTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pages = {p.relative_to(ROOT/'_site').as_posix():p.read_text()
               for p in (ROOT/'_site').rglob('*.html')}
  cls.eligible = {}
  for source, path in build.ROUTES.items():
   if source not in EXCLUDED:
    cls.eligible[source] = path.strip('/')+'/index.html' if path != '/' else 'index.html'
  cls.eligible.update({p.relative_to(ROOT).as_posix():p.relative_to(ROOT).as_posix()
                       for p in (ROOT/'p').glob('*.html')})
  products, _, historical = build.seo.context()
  def visit_free(source):
   if source in ('madrinhas.html', 'ternos.html'):return True
   if not source.startswith('p/'):return False
   code=Path(source).stem
   category=products.get(code,{}).get('c') or historical.get(code,{}).get('category','')
   return bool(category) and category not in ('vestidos-noiva','vestidos-debutante')
  cls.eligible={s:p for s,p in cls.eligible.items() if visit_free(s)}
  assert cls.eligible, 'Capture regression coverage must remain non-empty'

 def test_every_discovery_page_has_one_capture_and_ordered_dependencies(self):
  for source, path in self.eligible.items():
   page = Page(self.pages[path])
   self.assertEqual(page.ids['kl-capture'], 1, path)
   self.assertEqual([key for key, count in page.ids.items() if key.startswith('kl-capture') and count != 1], [], path)
   script_paths = [urlsplit(tag['src']).path for tag in page.scripts]
   expected = ['/kl-catalog-actions.js', '/kl-capture-popup.js', '/kl-capture.js']
   for asset in expected:
    self.assertEqual(script_paths.count(asset), 1, (path, asset))
    self.assertIn('defer', page.scripts[script_paths.index(asset)], (path, asset))
   self.assertLess(script_paths.index(expected[0]), script_paths.index(expected[2]), path)
   self.assertLess(script_paths.index(expected[1]), script_paths.index(expected[2]), path)
   capture_assets = [tag['src'] for tag in page.scripts if urlsplit(tag['src']).path in expected[1:]]
   capture_styles = [url for url in page.styles if urlsplit(url).path == '/kl-capture.css']
   self.assertEqual(capture_styles, ['/kl-capture.css?v=20260906google1'], path)
   self.assertTrue(all(url.endswith('?v=20260906google1') for url in capture_assets), path)

 def test_booking_privacy_errors_shells_and_redirects_do_not_receive_capture(self):
  for path, html in self.pages.items():
   if path in self.eligible.values():
    continue
   self.assertNotIn('id="kl-capture"', html, path)
   self.assertNotRegex(html, r'(?:src|href)=["\'][^"\']*kl-capture(?:-popup)?\.(?:js|css)', path)

 def test_catalog_removes_competing_capture_but_visit_free_keeps_consent(self):
  source = (ROOT/'catalogo.html').read_text()
  self.assertTrue('<!-- kl-capture -->' in source, 'Catalog must use the shared capture marker')
  self.assertNotIn('id="kl-capture-form"', source)
  catalog = self.pages['catalogo/index.html']
  self.assertNotIn('id="kl-capture"', catalog)
  self.assertNotIn('href="/catalogo/#kl-capture"', catalog)
  self.assertIn('id="catalog-schedule-link"', catalog)
  for path in self.eligible.values():
   self.assertIn('<h2 id="kl-capture-title">Receba modelos no seu WhatsApp.</h2>', self.pages[path], path)
   self.assertIn('<p>Continue sua escolha com a Koisa Linda.</p>', self.pages[path], path)
   self.assertLess(self.pages[path].index('id="kl-capture"'), self.pages[path].index('<footer'), path)

 def test_page_category_comes_from_known_route_or_canonical_catalog(self):
  categories = {'noivas.html':'vestidos-noiva', 'noivas-experiencia.html':'vestidos-noiva',
                'debutantes.html':'vestidos-debutante', 'madrinhas.html':'vestidos-madrinha', 'ternos.html':'ternos'}
  products, _, _ = build.seo.context()
  for source, path in self.eligible.items():
   expected = categories.get(source, '')
   if source.startswith('vestido-de-noiva-'):
    expected = 'vestidos-noiva'
   elif source.startswith('p/'):
    expected = products.get(Path(source).stem, {}).get('c', '')
   page = Page(self.pages[path])
   self.assertIsNotNone(page.capture, path)
   self.assertEqual(page.capture.get('data-capture-category'), expected, path)

 def test_unit_is_set_only_for_known_product_or_city_style(self):
  products, _, _ = build.seo.context()
  for source, path in self.eligible.items():
   expected = ''
   if source.startswith('p/'):
    expected = products.get(Path(source).stem, {}).get('un', '')
   elif source.startswith('vestido-de-noiva-'):
    expected = 'sf' if source.endswith('-niteroi.html') else 'barra'
   page = Page(self.pages[path])
   self.assertIsNotNone(page.capture, path)
   self.assertEqual(page.capture.get('data-capture-unit'), expected, path)

 def test_capture_preserves_existing_consent_and_does_not_duplicate_tracking(self):
  for source, path in self.eligible.items():
   page = Page(self.pages[path])
   self.assertIn('required', page.inputs.get('kl-capture-phone', {}), path)
   self.assertNotIn('checked', page.inputs.get('kl-capture-marketing', {}), path)
   self.assertIn('kl-capture-measurement', page.inputs, path)
   self.assertNotIn('checked', page.inputs['kl-capture-measurement'], path)
   self.assertNotIn('required', page.inputs['kl-capture-measurement'], path)
   self.assertIn('Usaremos seu número para entregar os modelos que você pedir. Na próxima etapa, envie a mensagem preparada no seu WhatsApp para confirmar.', self.pages[path], path)
   self.assertIn('Também quero receber novidades e dicas da Koisa Linda pelo WhatsApp. Posso cancelar quando quiser.', self.pages[path], path)
   self.assertIn('href="/privacidade/">Como cuidamos dos seus dados</a>', self.pages[path], path)
   before = Page((ROOT/source).read_text())
   for asset in ('kl-tracking.js', 'kl-ga.js'):
    count = lambda p: sum(Path(urlsplit(tag['src']).path).name == asset for tag in p.scripts)
    expected = max(1, count(before)) if asset == 'kl-tracking.js' else count(before)
    self.assertEqual(count(page), expected, (path, asset))
    before_urls = [build.public_url(tag['src'], source) for tag in before.scripts
                   if Path(urlsplit(tag['src']).path).name == asset]
    after_urls = [tag['src'] for tag in page.scripts if Path(urlsplit(tag['src']).path).name == asset]
    expected_urls = before_urls or (['/kl-tracking.js?v=20260906agenda1'] if asset == 'kl-tracking.js' else [])
    if asset == 'kl-tracking.js':
     expected_urls = [urlsplit(url).path+'?v=20260906google1' for url in expected_urls]
    self.assertEqual(after_urls, expected_urls, (path, asset))
   script_paths = [urlsplit(tag['src']).path for tag in page.scripts]
   self.assertLess(script_paths.index('/kl-tracking.js'), script_paths.index('/kl-capture.js'), path)


if __name__ == '__main__':
 unittest.main()
