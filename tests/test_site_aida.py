"""Business contracts for the revised discovery and local-store journey."""
import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('seo_aida', ROOT/'tools/seo_site.py')
seo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seo)


class AidaSiteTest(unittest.TestCase):
 def test_every_current_product_has_a_descriptive_discovery_link(self):
  products, _, pages = seo.context()
  self.assertEqual(set(products) - set(pages), set())
  index = (ROOT/'_site/p/index.html').read_text()
  sitemap = (ROOT/'_site/sitemap.xml').read_text()
  for code in products:
   self.assertIn('href="/p/'+code+'.html"', index)
   self.assertIn(seo.ORIGIN+'/p/'+code+'.html', sitemap)
  for code in set(pages) - set(products):
   self.assertNotIn(seo.ORIGIN+'/p/'+code+'.html', sitemap)
   self.assertIn('noindex,follow', (ROOT/'_site/p'/f'{code}.html').read_text())

 def test_virtual_experience_is_crawlable_without_running_the_catalog(self):
  html = (ROOT/'_site/prova-virtual/index.html').read_text()
  self.assertEqual(len(re.findall('<h1\\b',html)), 1)
  self.assertIn('href="'+seo.ORIGIN+'/prova-virtual/"',html)
  self.assertIn('inteligência artificial',html)
  self.assertIn('referência visual',html)
  self.assertIn('id="virtual-start"',html)
  self.assertNotIn('kl-catalog-app.js',html)
  self.assertNotIn('noindex',html)

 def test_collection_faqs_match_visible_copy_and_keep_the_store_in_booking_links(self):
  for name in ['noivas','debutantes','madrinhas','ternos']:
   html = (ROOT/'_site'/name/'index.html').read_text()
   faq = next(s for s in seo.schemas(html) if s.get('@type')=='FAQPage')
   for q in faq['mainEntity']:
    self.assertIn(q['name'],seo.plain(html))
    self.assertIn(q['acceptedAnswer']['text'],seo.plain(html))
   if name in ['noivas','debutantes']:
    occasion = 'noiva' if name=='noivas' else 'debutante'
    for unit in ['sf','barra']:
     self.assertIn('/agendar/?ocasiao='+occasion+'&amp;un='+unit,html)
   else:
    self.assertIn('Não precisa agendar.',html)
   for promise in ['qualquer peça pronta','seja qual for o seu','ajustes inclusos']:
    self.assertNotIn(promise,seo.plain(html).lower())
