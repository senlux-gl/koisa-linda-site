"""Keep generated placeholders and a confirmed bad photo/item association off the storefront.
Does not change inventory records. Real measurements require operational curation.
"""
import json

# 07/10/2026: alfaiataria de São Francisco cadastrada como festa no sistema
# (kl_produto_foto.categoria_site). Abria a vitrine de festa de SF com sapato,
# calça e terno. A peça continua no catálogo, só muda de categoria. Fica aqui,
# na exportação, para sobreviver à próxima geração do kl-catalog-data.js
# enquanto o cadastro de origem não for corrigido.
CATEGORY_FIX={
 '020008':('calcados','Calçados'),   # Sapato preto bico fino
 '020047':('ternos','Ternos'),       # Calça preta elastano
 '020086':('ternos','Ternos'),       # Terno preto prada de brilho
}

def normalize(items):
 cleaned=[]
 for raw in items:
  item=dict(raw)
  # gerar-catalogo.py currently emits Único when its size join returns NULL.
  # Published export cannot distinguish that fallback from a verified one-size item.
  if item.get('t')=='Único':item['t']='A confirmar'
  fix=CATEGORY_FIX.get(item.get('k'))
  if fix and item.get('c')=='vestidos-madrinha':item['c'],item['l']=fix
  if item.get('k')=='BL-001' and item.get('n')=='Brinco gota':
   item['n']='Bolsa'
   for field in ('co','tp','pa','pv','cod'):item.pop(field,None)
  cleaned.append(item)
 return cleaned

def parse(source):
 return json.loads(source[source.index('['):source.rindex(']')+1])

def public_source(source):
 return '// Catalogue with unverified generated placeholders withheld.\nwindow.KL_DATA = '+json.dumps(normalize(parse(source)),ensure_ascii=False)+';\n'
