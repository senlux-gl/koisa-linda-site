"""Contracts for visible SEO, entity truth and the public site's crawl paths."""
import collections
import importlib.util
import json
import re
import unittest
from html import unescape
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('seo',ROOT/'tools/seo_site.py')
seo=importlib.util.module_from_spec(spec);spec.loader.exec_module(seo)

class SEOBuildTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pages={p.relative_to(ROOT/'_site').as_posix():p.read_text() for p in (ROOT/'_site').rglob('*.html')}
  cls.indexable={p:s for p,s in cls.pages.items() if not re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex',s)}

 def test_all_indexable_titles_are_unique_and_descriptions_consistent(self):
  titles=[]
  for p,s in self.indexable.items():
   title=unescape(re.search(r'<title>(.*?)</title>',s)[1]);titles.append(title)
   descriptions=re.findall(r'<meta name="description" content="([^"]+)">',s)
   self.assertEqual(len(descriptions),1,p)
   self.assertIn('<meta property="og:description" content="'+descriptions[0]+'">',s,p)
   self.assertEqual(len(re.findall(r'<h1\b',s)),1,p)
  self.assertEqual([title for title,n in collections.Counter(titles).items() if n>1],[])

 def test_breadcrumb_entities_match_the_visible_trail_and_page_url(self):
  for p,s in self.indexable.items():
   if p=='index.html':continue
   trail=[x for x in seo.schemas(s) if x.get('@type')=='BreadcrumbList']
   self.assertEqual(len(trail),1,p)
   visible=re.search(r'<nav class="kl-seo-crumbs".*?</nav>',s,re.S)[0]
   items=trail[0]['itemListElement']
   canonical=re.search(r'<link rel="canonical" href="([^"]+)"',s)[1]
   self.assertEqual(items[-1]['item'],canonical,p)
   for i,item in enumerate(items):
    self.assertEqual(item['position'],i+1,p)
    self.assertIn(item['name'],seo.plain(visible),p)

 def test_products_have_identity_without_unverified_stock_price_or_reviews(self):
  for p,s in self.indexable.items():
   if not p.startswith('p/') or p=='p/index.html':continue
   product=next(x for x in seo.schemas(s) if x.get('@type')=='Product')
   self.assertEqual(product['sku'],Path(p).stem)
   self.assertIn(product['sku'],unescape(re.search(r'<title>(.*?)</title>',s)[1]))
   for key in ['offers','aggregateRating','review']:self.assertNotIn(key,product,p)
   self.assertEqual(product['url'],seo.ORIGIN+'/'+p)

 def test_city_style_selections_match_catalogue_unit_and_existing_attributes(self):
  products,attrs,pages=seo.context()
  for slug,(_,field,values,_) in seo.STYLES.items():
   for city,unit in [('niteroi','sf'),('barra-da-tijuca','barra')]:
    s=self.pages[f'noivas/{slug}-{city}/index.html']
    grid=re.search(r'<div class="kl-seo-products">(.*?)</div>',s,re.S)[1]
    codes=re.findall(r'href="/p/([^/]+)\.html"',grid)
    self.assertTrue(codes,(slug,unit))
    for code in codes:
     self.assertEqual(products[code]['un'],unit)
     self.assertIn(attrs[code][field],values)
    self.assertIn('/agendar/?ocasiao=noiva&amp;un='+unit,s)
    self.assertIn('Confirme com a equipe a disponibilidade',s)

 def test_categories_expose_crawlable_product_links_and_both_city_style_groups(self):
  for path in ['noivas/','debutantes/','madrinhas/','ternos/']:
   s=self.pages[path+'index.html']
   self.assertGreaterEqual(len(re.findall(r'<a href="/p/[^/]+\.html"',s)),6)
  noivas=self.pages['noivas/index.html']
  for slug in seo.STYLES:
   for city in ['niteroi','barra-da-tijuca']:self.assertIn(f'href="/noivas/{slug}-{city}/"',noivas)

 def test_index_links_describe_every_existing_product(self):
  _,_,products=seo.context();index=self.pages['p/index.html']
  for code,p in products.items():
   match=re.search(r'<a href="'+re.escape(p['path'])+'">([^<]+)</a>',index)
   self.assertIsNotNone(match,code)
   self.assertNotEqual(unescape(match[1]).strip(),code)

 def test_store_entities_link_to_correct_visible_addresses(self):
  s=self.pages['unidades/index.html']
  self.assertIn('id="sf"',s);self.assertIn('id="barra"',s)
  stores=[n for block in seo.schemas(s) for n in block.get('@graph',[block]) if n.get('@type')=='ClothingStore']
  self.assertEqual({n['url'] for n in stores},{seo.ORIGIN+'/unidades/#sf',seo.ORIGIN+'/unidades/#barra'})

 def test_static_products_route_to_current_detail_and_current_catalogue_size(self):
  products,_,pages=seo.context()
  for code in pages:
   s=self.pages['p/'+code+'.html']
   self.assertNotIn('https://wa.me/',s,code)
   if code in products:
    self.assertIn('href="/peca/?codigo='+code+'"',s,code)
    self.assertIn('<dt>Unidade no catálogo</dt><dd><a href="/unidades/#'+products[code]['un']+'">',s,code)
    if products[code].get('t'):
     self.assertEqual(unescape(re.search(r'<dt>Tamanho</dt>\s*<dd>(.*?)</dd>',s,re.S)[1]),str(products[code]['t']))
   else:self.assertIn('Consultar as lojas',s)

 def test_changes_add_no_browser_runtime_or_tracking_work(self):
  self.assertNotIn('<script',seo.category_links())
  self.assertNotIn('@keyframes',(ROOT/'kl-seo.css').read_text())
  self.assertNotIn('fbq(', (ROOT/'_preview/noivas/index.html').read_text())

if __name__=='__main__':unittest.main()
