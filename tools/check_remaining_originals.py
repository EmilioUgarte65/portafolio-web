"""Verifica navegación y acciones reales de los siete frontends recuperados."""
import asyncio,json,re,sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:4173/'
APPS=['myaccountant','ourway','festo','mundial','radar','totem','marquesina']

async def main():
    results=[]
    record=ROOT/'docs/VERIFICACION-PROYECTOS-RESTANTES.json'
    if sys.argv[1:] and record.exists():
        results=[x for x in json.loads(record.read_text(encoding='utf-8'))['frontends'] if x['app'] not in sys.argv[1:]]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='C:/Users/carlo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless=True,args=['--enable-unsafe-swiftshader'])
        for app in (sys.argv[1:] or APPS):
            page=await browser.new_page(viewport={'width':1440,'height':960},accept_downloads=True)
            errors=[];bad=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('response',lambda r:bad.append(r.url) if r.status>=400 else None)
            await page.goto(BASE+'demos/'+app+'/',wait_until='domcontentloaded')
            await page.wait_for_timeout(1800)
            checks=[]
            if app=='myaccountant':
                await page.get_by_role('button',name='Nosotros',exact=True).click()
                assert await page.locator('body').inner_text();checks.append('Navegación al espacio compartido original')
            elif app=='ourway':
                await page.get_by_role('button',name='Explorar el mapa',exact=True).click()
                await page.wait_for_timeout(1000);assert await page.locator('canvas').count()>0
                checks.append('Escena 3D y navegación al mapa original')
            elif app=='festo':
                await page.get_by_role('button',name='Enviar Mensaje',exact=False).first.click()
                await page.wait_for_timeout(300);assert 'simulado' in (await page.locator('body').inner_text()).lower()
                async with page.expect_download() as download:
                    await page.get_by_role('button',name='Descargar Imagen',exact=False).first.click()
                image=await download.value;assert image.suggested_filename.endswith('.png')
                checks.append('Envío local simulado y descarga de felicitación PNG')
            elif app=='mundial':
                await page.get_by_role('tab',name=re.compile('Grupos')).first.click()
                assert 'Grupo' in await page.locator('body').inner_text()
                await page.get_by_role('tab',name=re.compile('Favoritos')).first.click()
                checks.append('Vistas de grupos y favoritos originales')
            elif app=='radar':
                assert not await page.locator('.empty.red').count()
                for button in await page.locator('.sidebar [data-view]').all():await button.click()
                await page.locator('.sidebar [data-view="client"]').click()
                await page.locator('[data-client="DEMO-01"]:visible').first.click()
                assert 'Cliente de ejemplo 1' in await page.locator('#customerResult').inner_text()
                checks.append('Doce vistas y ficha de cliente ficticio sin errores')
            elif app=='totem':
                await page.get_by_role('link',name='Agregar texto').click()
                await page.locator('textarea').fill('Mensaje de prueba local')
                await page.get_by_role('button',name='Guardar',exact=True).click()
                await page.wait_for_timeout(300)
                assert 'Mensaje de prueba local' in await page.locator('body').inner_text()
                checks.append('Creación y listado de texto en memoria')
            elif app=='marquesina':
                await page.locator('#catalog .card').first.click()
                await page.wait_for_timeout(500)
                assert await page.locator('#modalPlayer video').count()==1
                assert await page.locator('#modalPlayer video').evaluate('(v)=>v.readyState>=2')
                await page.locator('.modal-close').click();checks.append('Reproducción de video propio en el modal original')
            assert not errors,(app,errors)
            assert not bad,(app,bad)
            results.append({'app':app,'checks':checks,'javascript_errors':errors,'http_errors':bad})
            (ROOT/'docs/VERIFICACION-PROYECTOS-RESTANTES.json').write_text(json.dumps({'frontends':results},ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(results[-1],ensure_ascii=True),flush=True)
            await page.close()
        for width in [1440,390]:
            page=await browser.new_page(viewport={'width':width,'height':900})
            for path in ['', 'en/']+[f'proyectos/{app}/' for app in APPS+['juego-construccion','inferencia','criatura']]:
                await page.goto(BASE+path,wait_until='domcontentloaded')
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(path,width,'overflow')
                for a in await page.locator('a[href*="demos/"]').all():
                    target=await a.get_attribute('href');assert (ROOT/'demos'/target.split('demos/')[1]/'index.html').exists()
            await page.close()
        await browser.close()
    (ROOT/'docs/VERIFICACION-PROYECTOS-RESTANTES.json').write_text(json.dumps({'frontends':results,'showcases_responsive':[1440,390]},ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':asyncio.run(main())
