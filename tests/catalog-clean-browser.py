"""Local read-only browser acceptance: never creates leads or appointments.
Run after python tools/build-site.py, with _site served on port 4195.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:4195'
OUT = Path('/tmp/kl-clean-qa'); OUT.mkdir(exist_ok=True)
reports = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width,height in [(375,667),(390,844),(1440,1000)]:
        ctx = browser.new_context(viewport={'width':width,'height':height}, is_mobile=width<700, has_touch=True)
        # External tracking and real lead submissions are never part of this QA.
        ctx.route('**/*', lambda route: route.continue_() if route.request.method in ('GET','HEAD') and (route.request.url.startswith(BASE) or route.request.resource_type in ('image','font','stylesheet')) else route.abort())
        page = ctx.new_page(); errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(BASE+'/catalogo/',wait_until='networkidle')
        page.wait_for_selector('#catalog-grid a')
        assert not page.locator('#kl-capture-dialog').evaluate('e=>e.open')
        assert page.locator('.catalog-clean-footer').is_visible()
        assert not page.locator('#catalog-facets').is_visible()
        assert page.locator('#catalog-grid').bounding_box()['y'] < 430
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT/f'catalog-{width}.png'))
        page.locator('.catalog-extra-filters summary').click()
        assert page.locator('#catalog-search').is_visible()
        page.locator('#catalog-search').fill('NV-001')
        page.wait_for_timeout(400)
        assert 'NV-001' in page.locator('#catalog-grid').inner_text()
        page.locator('#catalog-search').fill('')
        page.wait_for_timeout(400)
        page.locator('.catalog-extra-filters summary').click()
        page.locator('#catalog-category').select_option('vestidos-noiva')
        assert 'ocasiao=noiva' in page.locator('.catalog-clean-footer>a').get_attribute('href')
        page.locator('#catalog-grid a').first.click()
        assert page.locator('#catalog-gallery').evaluate('e=>e.open')
        code=page.locator('#gallery-title').inner_text()
        href=page.locator('#gallery-schedule').get_attribute('href')
        assert 'modelo='+code in href and 'ocasiao=noiva' in href
        page.locator('#gallery-favorite').click()
        assert page.locator('#gallery-favorite').get_attribute('aria-pressed')=='true'
        page.wait_for_function("document.querySelector('#gallery-image').complete && document.querySelector('#gallery-image').naturalWidth > 0")
        page.screenshot(path=str(OUT/f'gallery-{width}.png'))
        page.locator('#gallery-zoom-open').click()
        assert page.locator('#catalog-photo-zoom').evaluate('e=>e.open')
        page.locator('[data-zoom="in"]').click()
        assert float(page.locator('#catalog-photo-zoom').get_attribute('data-scale'))>1
        page.locator('[data-zoom="reset"]').click()
        stage=page.locator('.photo-zoom-stage'); box=stage.bounding_box()
        # Trusted touch events through CDP exercise the real PointerEvent handlers.
        cdp=ctx.new_cdp_session(page)
        cx=box['x']+box['width']/2; cy=box['y']+box['height']/2
        def touch(kind,span):
            cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':cx-span,'y':cy,'id':1},{'x':cx+span,'y':cy,'id':2}]})
        touch('touchStart',35);touch('touchMove',80);touch('touchEnd',0)
        assert float(page.locator('#catalog-photo-zoom').get_attribute('data-scale'))>1.5
        page.screenshot(path=str(OUT/f'zoom-{width}.png'))
        page.keyboard.press('Escape')
        assert not page.locator('#catalog-photo-zoom').evaluate('e=>e.open')
        assert page.locator('#catalog-gallery').evaluate('e=>e.open')
        assert page.locator('#gallery-favorite').get_attribute('aria-pressed')=='true'
        page.locator('.gallery-close').click()
        page.locator('.catalog-selection').click()
        assert page.locator('#catalog-favorites').evaluate('e=>e.open')
        booking=page.locator('.favorites-schedule').first
        assert 'modelo='+code in booking.get_attribute('href')
        page.screenshot(path=str(OUT/f'selection-{width}.png'))
        booking.click()
        assert '/agendar/' in page.url and 'modelo='+code in page.url
        assert 'NV-001' in page.url
        page.wait_for_timeout(500)
        assert not errors, errors
        reports.append({'viewport':f'{width}x{height}','checks':'filters, gallery, favorite, pinch zoom, Escape, selection, internal scheduling','page_errors':errors})
        ctx.close()
    browser.close()
print(json.dumps(reports,ensure_ascii=False,indent=2))
