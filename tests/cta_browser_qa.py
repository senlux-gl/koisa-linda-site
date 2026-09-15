"""Read-only local browser QA. Outbound traffic is blocked; no lead/booking submission."""
import json, re, sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'qa-cta';OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:8768'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.ctx={};self.links=[];self.capture=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='body':self.ctx=a
  if tag=='a':self.links.append(a.get('href',''))
  if a.get('id')=='kl-capture':self.capture=True
rows=[];static_fail=[]
for path in sorted((ROOT/'_site').rglob('*.html')):
 p=Page();p.feed(path.read_text())
 occasion=p.ctx.get('data-kl-booking-occasion')
 if occasion:
  bookings=[h for h in p.links if urlsplit(h).path=='/agendar/']
  bad=[h for h in p.links if 'wa.me/' in h]
  if bad or p.capture or not bookings:static_fail.append(str(path))
  assert all(parse_qs(urlsplit(h).query).get('ocasiao')==[occasion] for h in bookings),path
  rows.append({'page':str(path.relative_to(ROOT/'_site')),'occasion':occasion,'booking_links':len(bookings),'whatsapp':bad,'capture':p.capture})
assert not static_fail,static_fail
checks=[];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 for width in [375,390,1440]:
  ctx=browser.new_context(viewport={'width':width,'height':900})
  ctx.route('**/*',lambda route: route.continue_() if route.request.method=='GET' and (route.request.url.startswith(BASE) or route.request.url.startswith('https://vguwohpsbodrxbrtrqkm.supabase.co/storage/v1/object/public/')) else route.abort())
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  for route in ['/','/noivas/?un=sf&utm_source=qa','/debutantes/?un=barra','/noivas/experiencia/','/noivas/princesa-niteroi/','/p/NV-001.html','/peca/?codigo=NV-001']:
   response=page.goto(BASE+route);assert response and response.status==200
   page.wait_for_load_state('networkidle')
   assert page.locator('#kl-capture-dialog[open]').count()==0
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),route
   if '/peca/' in route:
    assert '/agendar/' in (page.locator('.actions .primary').get_attribute('href') or '')
    assert page.locator('#app img').first.evaluate('(el)=>el.complete && el.naturalWidth > 0')
   if '/noivas/?' in route:
    link=page.get_by_role('link',name='Escolher horário',exact=True).first
    u=parse_qs(urlsplit(link.get_attribute('href') or '').query);assert u['un']==['sf'] and u['utm_source']==['qa']
   checks.append({'width':width,'page':route,'ok':True})
  page.goto(BASE+'/catalogo/');page.wait_for_load_state('networkidle')
  products=page.evaluate("['vestidos-noiva','vestidos-debutante'].flatMap(c=>['sf','barra'].map(un=>KL_DATA.find(p=>p.c===c&&p.un===un)))")
  for product in products:
   code=product['k'];cat=product['c'];unit=product['un']
   page.goto(BASE+'/catalogo/?cat='+cat+'&un='+unit+'&p='+code);page.wait_for_load_state('networkidle')
   assert page.locator('#catalog-gallery').evaluate('(e)=>e.open')
   assert not page.locator('#gallery-whatsapp').is_visible()
   href=page.locator('#gallery-schedule').get_attribute('href') or '';q=parse_qs(urlsplit(href).query)
   assert q['modelo']==[code] and q['un']==[unit]
   page.locator('#gallery-zoom-open').click()
   assert page.locator('#catalog-photo-zoom').evaluate('(e)=>e.open')
   page.locator('[data-zoom="in"]').click()
   assert float(page.locator('#catalog-photo-zoom').get_attribute('data-scale') or '0')>1
   page.locator('[data-zoom="close"]').click()
   page.locator('#gallery-favorite').click();page.locator('.gallery-close').click()
   page.locator('.catalog-selection').click()
   assert page.locator('.favorites-send').count()==0
   assert '/agendar/' in (page.locator('.favorites-schedule').first.get_attribute('href') or '')
   page.evaluate('localStorage.clear()')
   page.goto(BASE+href+'&variant=a');page.wait_for_load_state('networkidle')
   assert code in page.locator('body').inner_text(), 'model reference not shown in booking form'
   checks.append({'width':width,'gallery_selection':code,'ok':True})
  # Result/error destinations are tested through the real exported helper, no paid generation.
  for product in products:
   page.goto(BASE+'/catalogo/');page.wait_for_load_state('networkidle')
   href=page.evaluate('(p)=>KLCatalog.TryOn.resultWhatsAppHref(p,KLCatalog.Actions)',product)
   assert '/agendar/' in href and 'modelo='+product['k'] in href
  page.goto(BASE+'/catalogo/?cat=vestidos-noiva');page.wait_for_load_state('networkidle')
  page.screenshot(path=str(OUT/f'catalog-{width}.png'),full_page=False)
  ctx.close()
 browser.close()
assert not errors,errors
report={'static_pages':len(rows),'static':rows,'browser_checks':checks,'page_errors':errors,'no_outbound_submissions':True,'virtual_generation':'not executed; helper verified'}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'static_pages':len(rows),'browser_checks':len(checks),'page_errors':errors}))
