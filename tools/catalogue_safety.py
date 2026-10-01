"""Keep generated placeholders and a confirmed bad photo/item association off the storefront.
Does not change inventory records. Real measurements require operational curation.
"""
import json

def normalize(items):
 cleaned=[]
 for raw in items:
  item=dict(raw)
  # gerar-catalogo.py currently emits Único when its size join returns NULL.
  # Published export cannot distinguish that fallback from a verified one-size item.
  if item.get('t')=='Único':item['t']='A confirmar'
  if item.get('k')=='BL-001' and item.get('n')=='Brinco gota':
   item['n']='Bolsa'
   for field in ('co','tp','pa','pv','cod'):item.pop(field,None)
  cleaned.append(item)
 return cleaned

def parse(source):
 return json.loads(source[source.index('['):source.rindex(']')+1])

def public_source(source):
 return '// Catalogue with unverified generated placeholders withheld.\nwindow.KL_DATA = '+json.dumps(normalize(parse(source)),ensure_ascii=False)+';\n'
