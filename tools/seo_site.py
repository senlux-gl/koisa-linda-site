"""SEO for the public artifact: visible navigation and source-backed metadata.

Does not change catalogue data, inventory, tracking, booking or existing URLs.
The old page generators remain historical inputs; this is the publication layer.
"""
import json
import re
from functools import lru_cache
from html import escape, unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://koisalinda.com.br'
STYLES = {
 'princesa': ('princesa', 'corte', ('princesa',), 'O volume da saia e a estrutura do corpo são os pontos para observar durante a prova.'),
 'sereia': ('sereia', 'corte', ('sereia',), 'Observe o ajuste no quadril e a liberdade para caminhar e sentar com o vestido.'),
 'corte-a': ('corte A (evasê)', 'corte', ('corte-a',), 'A saia se abre a partir da cintura. Na prova, compare o volume e o movimento de cada modelo.'),
 'com-manga': ('com manga', 'manga', ('manga-longa','manga-3-4','manga-bufante'), 'Compare o comprimento da manga, o acabamento e o conforto ao movimentar os braços.'),
 'renda': ('de renda', 'tecido', ('renda',), 'Veja de perto o desenho da renda, a transparência e o acabamento sobre o corpo.'),
 'minimalista': ('minimalista', 'estilo', ('minimalista',), 'O tecido, o corte e o caimento ganham destaque. A prova ajuda a perceber esses detalhes.'),
 'decote-v': ('com decote V', 'decote', ('v',), 'Observe a profundidade do decote e a sustentação. A equipe orienta os ajustes possíveis na prova.'),
}
CATEGORIES = {
 'vestidos-noiva': ('Noivas', '/noivas/', 'noivas'),
 'vestidos-debutante': ('Debutantes', '/debutantes/', 'debutantes'),
 'vestidos-madrinha': ('Madrinhas e festa', '/madrinhas/', 'madrinhas-festa'),
 'ternos': ('Ternos', '/ternos/', 'ternos'),
 'bolsas': ('Bolsas', '/catalogo/', 'bolsas'),
 'calcados': ('Calçados', '/catalogo/', 'calcados'),
 'acessorios': ('Acessórios', '/catalogo/', 'acessorios'),
}
META = {
 'index.html': ('Vestidos de noiva e festa em Niterói e Barra | Koisa Linda', 'Aluguel e sob medida de vestidos de noiva, debutante e festa, além de ternos. Conheça o ateliê e as lojas em São Francisco, Niterói, e Barra da Tijuca.', None),
 'noivas.html': ('Vestidos de noiva em Niterói e Barra da Tijuca | Koisa Linda', 'Encontre seu vestido de noiva para aluguel ou sob medida. Conheça os estilos do acervo e agende sua prova em São Francisco, Niterói, ou Barra da Tijuca.', 'Vestidos de noiva para o seu dia'),
 'debutantes.html': ('Vestidos de debutante e 15 anos | Koisa Linda Niterói e Barra', 'Vestidos de debutante para a valsa e a recepção, com ajustes no ateliê. Agende sua prova de 15 anos em São Francisco, Niterói, ou Barra da Tijuca.', 'Vestidos de debutante para a sua história'),
 'madrinhas.html': ('Aluguel de vestidos de festa e madrinha | Koisa Linda', 'Vestidos para madrinhas, convidadas e formandas em Niterói e Barra da Tijuca. Explore o catálogo e visite a loja sem agendamento para provar.', 'Vestidos de festa para estar presente'),
 'ternos.html': ('Aluguel de ternos em Niterói e Barra da Tijuca | Koisa Linda', 'Ternos para noivos, pais, padrinhos e convidados, com ajustes no ateliê. Visite São Francisco, Niterói, ou Barra da Tijuca; não precisa agendar.', 'Ternos para o seu grande momento'),
 'catalogo.html': ('Catálogo de vestidos, ternos e acessórios | Koisa Linda', 'Explore vestidos de noiva, debutante e festa, ternos e acessórios. Filtre por unidade, cor e tamanho e confirme a disponibilidade com a loja.', None),
 'agendar.html': ('Agendar prova de noiva ou debutante | Koisa Linda', 'Escolha a unidade, o dia e o horário da prova de noiva ou debutante em Niterói ou Barra da Tijuca. A confirmação final é feita pela equipe da loja.', None),
 'unidades.html': ('Lojas em Niterói e Barra da Tijuca | Koisa Linda', 'Endereços e horários da Koisa Linda em São Francisco, Niterói, e no Shopping Downtown, Barra da Tijuca. Veja onde provar e como chegar.', 'Lojas em Niterói e Barra da Tijuca'),
}

def plain(value):
 return ' '.join(unescape(re.sub(r'<[^>]+>', '', value)).split())

def ld(value):
 return '<script type="application/ld+json">'+json.dumps(value, ensure_ascii=False).replace('<','\\u003c')+'</script>'

def schemas(s):
 return [json.loads(v) for v in re.findall(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',s,re.S)]

@lru_cache(maxsize=1)
def context():
 data=json.loads(re.search(r'\[\s*\{.*\}\s*\]', (ROOT/'kl-catalog-data.js').read_text(),re.S)[0])
 products={p['k']:p for p in data}
 attrs={a['k']:a for a in json.loads((ROOT/'kl-catalog-atributos.json').read_text())}
 pages={}
 for p in sorted((ROOT/'p').glob('*.html')):
  if p.stem=='index':continue
  s=p.read_text();product=next(x for x in schemas(s) if x.get('@type')=='Product')
  name=plain(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S)[1])
  # Preserve descriptive attributes already visible in the approved source.
  label=name if p.stem in name else name+' · '+p.stem
  pages[p.stem]={'name':label,'image':product['image'],'category':products.get(p.stem,{}).get('c'), 'path':'/p/'+p.name}
 return products,attrs,pages

def category_links():
 return '<section class="kl-seo-section"><h2>Encontre seu look por ocasião</h2><nav class="kl-seo-links" aria-label="Coleções por ocasião">'+''.join('<a href="'+path+'">'+label+'</a>' for label,path,_ in list(CATEGORIES.values())[:4])+'</nav><p>Conheça os modelos e o atendimento de cada ocasião. Veja também <a href="/unidades/">os endereços e horários das lojas</a>.</p></section>'

def style_links(city):
 return '<nav class="kl-seo-links" aria-label="Estilos de noiva em '+('Niterói' if city=='niteroi' else 'Barra da Tijuca')+'">'+''.join(f'<a href="/noivas/{slug}-{city}/">{escape(label)}</a>' for slug,(label,*_) in STYLES.items())+'</nav>'

def cards(codes, pages):
 return '<div class="kl-seo-products">'+''.join(f'<a href="{pages[k]["path"]}" aria-label="{escape(pages[k]["name"],quote=True)}"><img src="{escape(pages[k]["image"],quote=True)}" alt="{escape(pages[k]["name"],quote=True)}" loading="lazy" decoding="async" width="300" height="400"><span>{escape(pages[k]["name"])}</span></a>' for k in codes)+'</div>'

def insert_end(s, block):
 return s.replace('</main>',block+'</main>',1) if '</main>' in s else s.replace('<footer',block+'<footer',1)

def metadata(s,title,description,image):
 s=re.sub(r'<title>.*?</title>','<title>'+escape(title)+'</title>',s,count=1,flags=re.S)
 s=re.sub(r'<meta\b(?=[^>]*(?:name|property)=["\'](?:description|og:title|og:description|og:image|og:image:alt|twitter:card|twitter:title|twitter:description|twitter:image)["\'])[^>]*>','',s)
 tags=[('name','description',description),('property','og:title',title),('property','og:description',description),('property','og:image',image),('property','og:image:alt',title),('name','twitter:card','summary_large_image'),('name','twitter:title',title),('name','twitter:description',description),('name','twitter:image',image)]
 return s.replace('</head>',''.join(f'<meta {kind}="{key}" content="{escape(value,quote=True)}">' for kind,key,value in tags)+'</head>',1)

def refine(s,source,canonical):
 products,attrs,pages=context()
 title=plain(re.search(r'<title>(.*?)</title>',s,re.S)[1])
 m=re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)',s)
 description=unescape(m[1]) if m else title
 image_match=re.search(r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"',s)
 image=unescape(image_match[1]) if image_match else ORIGIN+'/img/logo-kl-main.png'
 crumbs=[('Início','/')]
 name=plain(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S)[1]) if re.search(r'<h1\b',s) else title
 page_type='WebPage'
 if source in META:
  title,description,h1=META[source]
  if h1:s=re.sub(r'(<h1[^>]*>).*?</h1>',lambda m:m[1]+escape(h1)+'</h1>',s,count=1,flags=re.S);name=h1
 if source.startswith('p/') and source!='p/index.html':
  code=Path(source).stem;item=pages[code];name=item['name'];title=name+' | Koisa Linda'
  description=f'{name}. Conheça a peça do acervo Koisa Linda e confirme disponibilidade, condições e prova com a equipe da loja.'
  image=item['image'];crumbs.append(('Catálogo','/catalogo/'))
  current=products.get(code)
  if current:
   if current.get('t'):s=re.sub(r'(<dt>Tamanho</dt>\s*<dd>).*?</dd>',lambda m:m[1]+escape(str(current['t']))+'</dd>',s,count=1,flags=re.S)
   unit=current.get('un')
   if unit in ('sf','barra'):
    location='São Francisco (Niterói)' if unit=='sf' else 'Barra da Tijuca'
    s=re.sub(r'<dt>Onde provar</dt>\s*<dd>.*?</dd>','<dt>Unidade no catálogo</dt><dd><a href="/unidades/#'+unit+'">'+location+'</a></dd>',s,count=1,flags=re.S)
   # The interactive detail uses the current unit routing; historical pages had one old phone.
   s=re.sub(r'<a class="btn" href="https://wa\.me/[^"]*"[^>]*>.*?</a>', '<a class="btn" href="/peca/?codigo='+escape(code,quote=True)+'">Consultar esta peça</a>',s,count=1,flags=re.S)
  else:
   s=re.sub(r'<a class="btn" href="https://wa\.me/[^"]*"[^>]*>.*?</a>', '<a class="btn" href="/unidades/">Consultar as lojas</a>',s,count=1,flags=re.S)
  category=CATEGORIES.get(item['category'])
  if category and category[1]!='/catalogo/':crumbs.append((category[0],category[1]))
  s=re.sub(r'<p class="crumb">.*?</p>','',s,flags=re.S)
  similar=[k for k,v in pages.items() if k!=code and item['category'] and v['category']==item['category']][:4]
  if similar:s=insert_end(s,'<section class="kl-seo-section"><h2>Continue explorando o acervo</h2><ul class="kl-seo-links">'+''.join(f'<li><a href="{pages[k]["path"]}">{escape(pages[k]["name"])}</a></li>' for k in similar)+'</ul><p><a href="/p/index.html">Ver o índice completo de peças</a></p></section>')
 elif source.startswith('vestido-de-noiva-'):
  city='niteroi' if source.endswith('-niteroi.html') else 'barra-da-tijuca'
  unit='sf' if city=='niteroi' else 'barra'
  slug=source.removeprefix('vestido-de-noiva-').removesuffix('-'+city+'.html')
  label,field,values,advice=STYLES[slug]
  location='em Niterói' if unit=='sf' else 'na Barra da Tijuca'
  name='Vestidos de noiva '+label+' '+location;title=name+' | Koisa Linda'
  description=f'Conheça vestidos de noiva {label} {location}. Veja a seleção do catálogo, orientações para a prova e como visitar a Koisa Linda.'
  selected=sorted(k for k,a in attrs.items() if a.get(field) in values and k in pages and products.get(k,{}).get('un')==unit and products[k].get('c')=='vestidos-noiva')
  # These are catalogue associations, never a claim of live stock.
  s=re.sub(r'<h1[^>]*>.*?</h1>','<h1>'+escape(name)+'</h1>',s,count=1,flags=re.S)
  intro=f'Seleção de modelos vinculados à unidade de {"São Francisco, em Niterói" if unit=="sf" else "Barra da Tijuca"} no catálogo. Confirme com a equipe a disponibilidade para a sua data e agende a prova.'
  s=re.sub(r'<p class="sub">.*?</p>','<p class="sub">'+intro+'</p><p class="kl-seo-intro">'+advice+'</p>',s,count=1,flags=re.S)
  visit='<p class="kl-seo-intro"><a class="btn" href="/agendar/?ocasiao=noiva&amp;un='+unit+'">Agendar nesta unidade</a></p>'
  s=re.sub(r'<div class="grid">.*?</div>',visit+cards(selected[:24],pages),s,count=1,flags=re.S)
  address='Av. Presidente Roosevelt, 37, São Francisco. Segunda a sexta, 9h–18h; sábado, 9h–14h.' if unit=='sf' else 'Shopping Downtown, Av. das Américas, 500, Bloco 8, Loja 130. Segunda a sábado, 9h–19h.'
  local='<section class="kl-seo-section"><h2>Sua prova '+location+'</h2><p>'+address+'</p><p>Noivas são atendidas com hora marcada. <a href="/agendar/?ocasiao=noiva&amp;un='+unit+'">Escolher o horário nesta unidade</a> ou <a href="/unidades/#'+unit+'">ver informações da loja</a>.</p><h2>Outros estilos para conhecer</h2>'+style_links(city)+'</section>'
  s=insert_end(s,local);crumbs.append(('Noivas','/noivas/'));page_type='CollectionPage'
  image=pages[selected[0]]['image'] if selected else image
  s=re.sub(r'href="/agendar/\?ocasiao=noiva"','href="/agendar/?ocasiao=noiva&amp;un='+unit+'"',s)
 elif source=='p/index.html':
  name='Índice de vestidos, ternos e acessórios';title=name+' | Koisa Linda';description='Explore as fichas do acervo Koisa Linda por categoria e código. Veja vestidos, ternos e acessórios e confirme a disponibilidade com a loja.'
  s=re.sub(r'<h1[^>]*>.*?</h1>','<h1>'+name+'</h1>',s,count=1,flags=re.S)
  def index_label(m):
   code=Path(m[1]).stem
   return '<a href="'+m[1]+'">'+escape(pages[code]['name'])+'</a>' if code in pages else m[0]
  s=re.sub(r'<a href="(/p/[^"/]+\.html)">[^<]*</a>',index_label,s)
  crumbs.append(('Catálogo','/catalogo/'));page_type='CollectionPage'
 elif source in ['noivas.html','debutantes.html','madrinhas.html','ternos.html']:
  category=next(k for k,v in CATEGORIES.items() if v[1]==canonical)
  by_unit={unit:[k for k,v in pages.items() if v['category']==category and products.get(k,{}).get('un')==unit] for unit in ('sf','barra')}
  selected=[by_unit[unit][i] for i in range(6) for unit in ('sf','barra') if i<len(by_unit[unit])][:6]
  block='<section class="kl-seo-section"><h2>Explore os modelos do acervo</h2><p>Abra uma ficha para conhecer a peça. A equipe confirma disponibilidade e condições da prova.</p>'+cards(selected,pages)+'<p><a href="/p/index.html">Explorar todas as fichas do acervo</a> · <a href="/catalogo/?cat='+category+'">Filtrar esta coleção no catálogo</a></p></section>'
  s=insert_end(s,block);page_type='CollectionPage'
  if source=='noivas.html':
   s=re.sub(r'<section class="kl-cortes">.*?</section>','<section class="kl-seo-section"><h2>Encontre seu estilo de vestido de noiva</h2><p>Escolha a unidade para conhecer os modelos do catálogo e preparar a sua prova.</p><h3>São Francisco · Niterói</h3>'+style_links('niteroi')+'<h3>Barra da Tijuca</h3>'+style_links('barra-da-tijuca')+'</section>',s,count=1,flags=re.S)
 elif source=='noivas-experiencia.html':crumbs.append(('Noivas','/noivas/'))
 if source in ('index.html','catalogo.html','unidades.html'):s=insert_end(s,category_links())
 if source=='catalogo.html':page_type='CollectionPage'
 if source=='unidades.html':
  for unit,label in [('sf','São Francisco'),('barra','Barra da Tijuca')]:
   s=re.sub(r'(<div class="unit")(>.*?<h3>'+label+'</h3>)',lambda m:m[1]+' id="'+unit+'"'+m[2],s,count=1,flags=re.S)
 if source!='index.html':
  short={'noivas.html':'Noivas','debutantes.html':'Debutantes','madrinhas.html':'Madrinhas e festa','ternos.html':'Ternos','catalogo.html':'Catálogo','unidades.html':'Lojas','agendar.html':'Agendar prova','p/index.html':'Índice do acervo','noivas-experiencia.html':'Experiência noiva'}.get(source,name)
  if source.startswith('p/') and source!='p/index.html':short='Peça '+Path(source).stem
  if source.startswith('vestido-de-noiva-'):short=label+' '+location
  crumbs.append((short,canonical))
 # Use visible breadcrumbs; the markup and data share the exact same trail.
 if len(crumbs)>1:
  nav='<nav class="kl-seo-crumbs" aria-label="Você está aqui"><ol>'+''.join('<li>'+('<a href="'+path+'">'+escape(label)+'</a>' if i<len(crumbs)-1 else '<span aria-current="page">'+escape(label)+'</span>')+'</li>' for i,(label,path) in enumerate(crumbs))+'</ol></nav>'
  s=s.replace('</header>','</header>'+nav,1)
  trail={'@context':'https://schema.org','@type':'BreadcrumbList','@id':ORIGIN+canonical+'#breadcrumb','itemListElement':[{'@type':'ListItem','position':i+1,'name':label,'item':ORIGIN+path} for i,(label,path) in enumerate(crumbs)]}
  s=s.replace('</head>',ld(trail)+'</head>',1)
 # Correct false stock claims and align existing entities with visible page content.
 def normalize(m):
  data=json.loads(m[1])
  if data.get("@type")=="CollectionPage":return ""
  def walk(node):
   if isinstance(node,list):return [walk(x) for x in node]
   if not isinstance(node,dict):return node
   node={k:walk(v) for k,v in node.items()}
   if node.get('@type')=='Product':
    node.pop('offers',None)
    if source.startswith('p/'):
     node.update({'name':name,'description':description,'url':ORIGIN+canonical,'@id':ORIGIN+canonical+'#product'})
   if node.get('@type')=='CollectionPage':
    node.pop('about',None);node.update({'name':name,'description':description,'url':ORIGIN+canonical})
   if node.get('@type')=='ClothingStore' and '#loja-' in node.get('@id',''):
    node['url']=ORIGIN+'/unidades/#'+('sf' if 'sao-francisco' in node['@id'] else 'barra')
   return node
  return ld(walk(data))
 s=re.sub(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',normalize,s,flags=re.S)
 webpage={'@context':'https://schema.org','@type':page_type,'@id':ORIGIN+canonical+'#webpage','url':ORIGIN+canonical,'name':title,'description':description,'inLanguage':'pt-BR','isPartOf':{'@id':ORIGIN+'/#website'}}
 if source.startswith('p/') and source!='p/index.html':webpage['mainEntity']={'@id':ORIGIN+canonical+'#product'}
 if len(crumbs)>1:webpage['breadcrumb']={'@id':ORIGIN+canonical+'#breadcrumb'}
 s=s.replace('</head>',ld(webpage)+'<link rel="stylesheet" href="/kl-seo.css?v=20260905"></head>',1)
 return metadata(s,title,description,image)
