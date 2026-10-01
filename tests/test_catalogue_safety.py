import importlib.util,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('safety',ROOT/'tools/catalogue_safety.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class CatalogueSafetyTest(unittest.TestCase):
 def test_public_export_keeps_references_and_real_sizes_without_inventing_prices(self):
  original=s.parse((ROOT/'kl-catalog-data.js').read_text());clean=s.parse((ROOT/'_site/kl-catalog-data.js').read_text())
  self.assertEqual(len(original),len(clean));self.assertEqual([i['k'] for i in original],[i['k'] for i in clean])
  for old,new in zip(original,clean):
   self.assertEqual(new['t'],'A confirmar' if old['t']=='Único' else old['t'])
   self.assertEqual(old['u'],new['u']);self.assertEqual(old['un'],new['un'])
   if old['k']!='BL-001':
    for k in ('pa','pv','cod','co','n'):self.assertEqual(old.get(k),new.get(k))
  bag=next(i for i in clean if i['k']=='BL-001');self.assertEqual(bag['n'],'Bolsa');self.assertNotIn('pa',bag);self.assertNotIn('co',bag)
 def test_verified_future_bag_record_is_preserved(self):
  good={'k':'BL-001','n':'Bolsa preta','t':'Pequena','pa':75,'co':'Preto'};self.assertEqual(s.normalize([good]),[good]);self.assertEqual(good['n'],'Bolsa preta')
