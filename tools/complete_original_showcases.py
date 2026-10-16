"""Integra fuentes originales; nunca genera sustitutos de las aplicaciones."""
from pathlib import Path
from html import escape
import re, shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path('C:/Users/carlo/Documents/CV-IA-Full-Stack-2026-10-14/tmp')
PUBLISHED_PERSONAL_DEMOS = {
 'ourway': 'https://emiliougarte65.github.io/web-dev-eyes-personal-demos/ourway/',
 'myaccountant': 'https://emiliougarte65.github.io/web-dev-eyes-personal-demos/myaccountant/',
}
# Slug, name, palette, category, title, copy, features.
PROJECTS = [
 ('myaccountant','MyAccountant','#437D72','Finanzas personales','Tus finanzas, con su interfaz original.','Explora el presupuesto, las cuentas, los movimientos y la mascota de la aplicación original. Todos los importes y las cuentas pertenecen al conjunto de prueba del proyecto.', [('Presupuesto','Resumen de quincena, gastos y ahorro con cifras de ejemplo.'),('Cuentas y movimientos','Navega por las vistas originales y prueba cambios locales.'),('Mascota','Conserva las ilustraciones y la experiencia de cuidado originales.')]),
 ('ourway','Ourway','#CF816D','Atlas y viajes 3D','El mundo visto desde tu propio atlas.','La escena orbital, los planetas, las texturas y la navegación son los originales. El viaje de ejemplo está vacío; no contiene fotografías, ubicaciones ni recuerdos personales. La conexión a álbumes privados no está habilitada.', [('Escena orbital','Explora el sistema solar 3D y sus texturas originales.'),('Mapa y viajes','Abre las vistas originales de mapa y recuerdos.'),('Privacidad','La demostración no conecta cuentas ni álbumes reales.')]),
 ('mundial','Mundial 2026','#A37C30','Machine learning deportivo','Predicción, simulación y un cuadro para explorar.','Frontend original del proyecto de predicción del Mundial: cuadro de eliminatorias, grupos, favoritos, estadísticas y validación. Conserva el conjunto público de resultados del propio proyecto y su fecha de corte.', [('Cuadro interactivo','Abre partidos y cambia entre los modelos disponibles.'),('Datos deportivos','Explora grupos, equipos, estadísticas y probabilidades.'),('Validación','Consulta los resultados de evaluación incluidos en el proyecto; no son predicciones actualizadas en vivo.')]),
 ('radar','Radar','#417E79','Analítica comercial','Oportunidades y métricas en el tablero original.','Conserva la navegación y los paneles del tablero original, con clientes, cotizaciones y series mensuales inventados. Los módulos sin una muestra cargada permanecen vacíos; no se consulta ningún ERP ni base empresarial.', [('Operación','Explora clientes de ejemplo y cotizaciones ficticias.'),('Análisis','Consulta las gráficas mensuales y recorre los paneles originales.'),('Datos locales','La demostración usa un proveedor en memoria, sin datos comerciales reales.')]),
 ('marquesina','Marquesina','#2A9D8F','Frontend audiovisual','Un catálogo audiovisual que conserva su diseño.','Web desarrollada para un portafolio creativo: mantiene la composición cinematográfica, filas de tarjetas y reproductor originales. El perfil es ficticio y los videos son escenas propias de Web Dev-Eyes; no representan la trayectoria ni el trabajo audiovisual de otra persona.', [('Catálogo por filas','Explora tarjetas, vistas previas y navegación del diseño original.'),('Reproductor','Abre un video de ejemplo y utiliza los controles de reproducción.'),('Perfil ficticio','Nombres, contacto, trayectoria y recursos de clientes se sustituyeron por ejemplos.')]),
 ('festo','Festo','#B88738','Celebraciones','El diseño original, listo para celebrar.','La interfaz de cumpleaños conserva sus tarjetas, controles y plantilla de felicitación. Las personas y los teléfonos son ficticios. Los botones de envío muestran una simulación local y no mandan mensajes.', [('Cumpleaños','Consulta las tarjetas de hoy y las próximas fechas.'),('Felicitación','Descarga la imagen con la plantilla original adaptada a Web Dev-Eyes.'),('Envío simulado','Prueba la respuesta de los controles sin contactar personas.')]),
 ('totem','Totem','#7C3AED','Cartelería digital','Administra contenidos con el panel original.','Explora textos, videos, horarios y actividad en la interfaz original de administración de pantallas. Las acciones modifican datos de ejemplo en memoria; no controlan dispositivos ni servicios reales.', [('Textos','Crea y edita mensajes de demostración con los controles originales.'),('Videos y horarios','Explora las vistas originales de contenido y programación.'),('Estado local','El interruptor y las acciones son simulaciones locales explícitas.')]),
 ('inferencia','Inferencia eficiente','#6462A7','Investigación en IA','Medir antes de optimizar.','Laboratorio de inferencia y cuantización en hardware limitado. El showcase documenta mediciones de la línea base del proyecto y su alcance; no ejecuta modelos ni presenta una interfaz inventada como si fuera original.', [('Línea base','Mediciones registradas con la API local de Ollama.'),('Hardware limitado','Experimentos con una GPU de 4 GB de VRAM.'),('Evaluación','Comparación de velocidad, memoria y calidad; los resultados dependen del entorno.')]),
 ('juego-construccion','Juego de construcción','#A65F40','Unity · C# · WebGL','Construcción y plataformas en un mundo 2D.','Proyecto desarrollado en Unity con construcción, progresión e interacción. Su build original contiene identidad empresarial y todavía requiere una versión sin esas marcas antes de ofrecer una demo pública.', [('Juego original','Mecánicas y presentación desarrolladas en Unity.'),('Distribución web','El proyecto cuenta con una compilación WebGL original.'),('Demo pendiente','La compilación con marcas no se incluye en este portafolio. No se sustituye por otro juego.')]),
]

EN = {
 'myaccountant': ('Personal finance','Your finances in the original interface.','Explore the original budget, accounts, transactions and pet with fictional test data. Cloud accounts are disconnected.', [('Budget','Review sample fortnightly income, expenses and savings.'),('Accounts and transactions','Explore the original views and try local changes.'),('Pet','The original illustrations and pet care experience are preserved.')]),
 'ourway': ('3D travel atlas','The world, through your own atlas.','Explore the original orbital scene, planets, textures and navigation. The sample trip contains no private photos or locations. Private album connections are disabled.', [('Orbital scene','Explore the original 3D solar system and textures.'),('Maps and trips','Open the original map and memories views.'),('Privacy','No real accounts or albums are connected.')]),
 'mundial': ('Sports machine learning','Prediction, simulation and an interactive bracket.','The original World Cup prediction frontend includes brackets, groups, favorites, statistics and validation. It retains the project’s public dataset and cutoff date.', [('Interactive bracket','Open matches and switch prediction models.'),('Sports data','Explore groups, teams, statistics and probabilities.'),('Validation','Review the evaluation included in the project; predictions are not updated live.')]),
 'radar': ('Commercial analytics','Opportunities in the original dashboard.','Explore the original navigation and panels with fictional customers, quotes and monthly series. Modules without sample data remain empty. No ERP or company database is connected.', [('Operations','Explore sample customers and fictional quotes.'),('Analysis','Review monthly charts and navigate the original panels.'),('Local data','An in-memory provider replaces company services.')]),
 'marquesina': ('Audiovisual frontend','An audiovisual catalog with its original design.','A website developed for a creative portfolio. The cinematic layout, card rows and player are original. The profile is fictional and videos are Web Dev-Eyes scenes; another person’s career and audiovisual work are not included.', [('Catalog rows','Explore the original cards, previews and navigation.'),('Video player','Open a sample clip and use the playback controls.'),('Fictional profile','Client names, contact details, career and assets have been replaced.')]),
 'festo': ('Celebrations','The original design, ready to celebrate.','The birthday interface retains its original cards, controls and greeting template. People and phone numbers are fictional. Send buttons simulate a response locally and do not send messages.', [('Birthdays','Review today’s cards and upcoming dates.'),('Greeting image','Download the original template adapted to Web Dev-Eyes.'),('Simulated sending','Try the controls without contacting people.')]),
 'totem': ('Digital signage','Manage content in the original panel.','Explore text, videos, schedules and activity in the original screen-management interface. Actions modify in-memory sample data and do not control real devices or services.', [('Text','Create and edit sample messages with the original controls.'),('Videos and schedules','Explore the original content and scheduling views.'),('Local status','The switch and actions are explicitly local simulations.')]),
 'criatura': ('Reinforcement learning','Learning to move in a simulated world.','An authentic recording of a locomotion experiment from the project. It shows the original simulation as a training video, rather than a reconstructed browser game.', [('Original simulation','An agent moving within its physical environment.'),('Experiment','Reinforcement learning and behavior evaluation.'),('Recording','The video comes from a saved project training run.')]),
 'inferencia': ('AI research','Measure before optimizing.','An inference and quantization laboratory for limited hardware. This showcase documents project baseline measurements and their scope. It does not run models or present an invented interface.', [('Baseline','Measurements recorded using the local Ollama API.'),('Limited hardware','Experiments on a GPU with 4 GB of VRAM.'),('Evaluation','Speed, memory and quality depend on the environment.')]),
 'juego-construccion': ('Unity · C# · WebGL','Building and platforming in a 2D world.','A Unity project with building, progression and interaction. Its original build still contains company branding and requires a clean version before a public playable demo can be included.', [('Original game','Mechanics and presentation developed in Unity.'),('Web distribution','The project has an original WebGL build.'),('Demo pending','The branded build is excluded. It has not been replaced with another game.')]),
}

def main():
    previews=ROOT/'assets/previews'
    for slug,*_ in PROJECTS:
        screenshot=PRIVATE/'portfolio-preview/restored'/f'{slug}-latest.png'
        if screenshot.exists():
            Image.open(screenshot).convert('RGB').save(previews/f'{slug}.jpg',quality=90)
    shutil.copy2(PRIVATE/'criatura-frame.jpg',previews/'criatura.jpg')
    media=ROOT/'assets/media';media.mkdir(exist_ok=True)
    shutil.copy2(Path('C:/Users/carlo/Pictures/criatura/videos/criatura_4003840.mp4'),media/'criatura-entrenamiento.mp4')
    template=(ROOT/'proyectos/web-studio/index.html').read_text(encoding='utf-8')
    for en in (False,True):
        rel='../../../' if en else '../../'
        for slug,name,color,kind,title,description,features in PROJECTS:
            if en: kind,title,description,features=EN[slug]
            s=template.replace('../../',rel).replace('lang="es"',f'lang="{"en" if en else "es"}"')
            s=s.replace('Web Studio',name).replace('#8B5FC7',color)
            s=re.sub(r'<title>.*?</title>',f'<title>{name} · Web Dev-Eyes</title>',s)
            s=re.sub(r'<meta name="description"[^>]+>',f'<meta name="description" content="{escape(description,quote=True)}">',s)
            s=re.sub(r'<h1>.*?</h1>',f'<h1>{title}</h1>',s)
            s=re.sub(r'<p class="lead">.*?</p>',f'<p class="lead">{description}</p>',s)
            s=s.replace('<span class="eyebrow">Editor de video</span>',f'<span class="eyebrow">{kind}</span>')
            s=s.replace('demos/web-studio/',f'demos/{slug}/').replace('previews/web-studio.jpg',f'previews/{slug}.jpg').replace('projects/web-studio/',f'projects/{slug}/').replace('proyectos/web-studio/',f'proyectos/{slug}/')
            cells=''.join(f'<div class="cell{" wide" if i==0 else ""}"><div class="ic"><img src="{rel}assets/web-dev-eyes.svg" width="32" height="32" alt=""></div><h3>{a}</h3><p>{b}</p></div>' for i,(a,b) in enumerate(features))
            start=s.index('<div class="bento">')+len('<div class="bento">');end=s.index('</section>',start)
            s=s[:start]+cells+'</div></div>'+s[end:]
            if en:
                s=s.replace('Volver a los proyectos','Back to projects').replace('Iniciar demo','Launch demo').replace('Qué hace','Explore').replace('Ver qué hace','Explore').replace('Explora la aplicación','Explore the project').replace('Prueba la interfaz','Explore the original interface')
                s=s.replace(f'href="{rel}en/projects/{slug}/"',f'href="{rel}proyectos/{slug}/"').replace('>EN</a>','>ES</a>')
                s=s.replace(f'href="{rel}">←',f'href="{rel}en/">←')
            if slug in ('juego-construccion','inferencia','criatura','festo'):
                label=({'juego-construccion':'Demo status','inferencia':'View results','criatura':'Watch training','festo':'How it works'} if en else {'juego-construccion':'Estado de la demo','inferencia':'Ver resultados','criatura':'Ver entrenamiento','festo':'Cómo funciona'})[slug]
                s=re.sub(fr'href="{re.escape(rel)}demos/{slug}/" target="_blank" rel="noopener"','href="#que-hace"',s)
                s=s.replace('Launch demo' if en else 'Iniciar demo',label)
                s=s.replace('Demo del frontend · datos ficticios · sin servicios empresariales conectados.','Automatización desatendida · Node.js · sin servicios empresariales conectados.' if slug=='festo' else 'Material original del proyecto · sin conexión a servicios empresariales.')
                s=s.replace('Explora la aplicación','Conoce el proyecto').replace('Prueba la interfaz','Conoce el proyecto').replace('Explore the original interface','Explore the project')
                if slug in ('juego-construccion','inferencia'):
                    s=s.replace(f'assets/previews/{slug}.jpg','assets/web-dev-eyes.svg')
                if slug=='criatura':
                    extra=f'<section id="material-original"><div class="wrap"><h2>Grabación del entrenamiento</h2><video controls preload="metadata" poster="{rel}assets/previews/criatura.jpg" style="width:100%;border-radius:18px"><source src="{rel}assets/media/criatura-entrenamiento.mp4" type="video/mp4"></video></div></section>'
                elif slug=='inferencia':
                    extra='<section id="material-original"><div class="wrap"><h2>Línea base registrada</h2><p>RTX 3050 Laptop · 4 GB VRAM · Ollama. Resultados del banco de pruebas del proyecto, sujetos al modelo, configuración y hardware.</p><table style="width:100%;text-align:left;margin:24px 0"><thead><tr><th>Modelo</th><th>Tamaño</th><th>Generación</th></tr></thead><tbody><tr><td>gemma3:1b</td><td>1B</td><td>129.6 tokens/s</td></tr><tr><td>llama3.2</td><td>3B</td><td>82.6 tokens/s</td></tr></tbody></table><p>Estas cifras son mediciones de la línea base, no una garantía de rendimiento ni una validación de todas las técnicas experimentales.</p></div></section>'
                elif slug=='juego-construccion':
                    extra='<section id="material-original"><div class="wrap"><h2>La demo requiere una compilación limpia</h2><p>La build original conserva marcas y recursos empresariales. Este showcase documenta el proyecto sin distribuir esa compilación. Falta preparar y verificar una build con identidad Web Dev-Eyes.</p></div></section>'
                    s=s.replace('<footer>',extra+'<footer>')
            if en:
                translations={
                  'Demo del frontend · datos ficticios · sin servicios empresariales conectados.':'Frontend demo · fictional data · no connected company services.',
                  'Material original del proyecto · sin conexión a servicios empresariales.':'Original project material · no connected company services.',
                  'Grabación del entrenamiento':'Training recording',
                  'Línea base registrada':'Recorded baseline',
                  'RTX 3050 Laptop · 4 GB VRAM · Ollama. Resultados del banco de pruebas del proyecto, sujetos al modelo, configuración y hardware.':'RTX 3050 Laptop · 4 GB VRAM · Ollama. Project benchmark results depend on the model, configuration and hardware.',
                  '<th>Modelo</th><th>Tamaño</th><th>Generación</th>':'<th>Model</th><th>Size</th><th>Generation</th>',
                  'Estas cifras son mediciones de la línea base, no una garantía de rendimiento ni una validación de todas las técnicas experimentales.':'These are baseline measurements, not a performance guarantee or validation of every experimental technique.',
                  'La demo requiere una compilación limpia':'A clean build is required',
                  'La build original conserva marcas y recursos empresariales. Este showcase documenta el proyecto sin distribuir esa compilación. Falta preparar y verificar una build con identidad Web Dev-Eyes.':'The original build contains company branding and assets. This showcase documents the project without distributing that build. A verified Web Dev-Eyes build is still required.',
                  'interfaz original':'original interface',
                }
                for a,b in translations.items():s=s.replace(a,b)
            if slug in PUBLISHED_PERSONAL_DEMOS:
                s=s.replace(f'href="{rel}demos/{slug}/"',f'href="{PUBLISHED_PERSONAL_DEMOS[slug]}"')
            out=ROOT/('en/projects' if en else 'proyectos')/slug;out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(s,encoding='utf-8')
        # Activate existing cards while retaining their original layout and illustrations.
        path=ROOT/('en/index.html' if en else 'index.html');s=path.read_text(encoding='utf-8');base='projects/' if en else 'proyectos/'
        s=re.sub(r'href="https://(?:emiliougarte65\.github\.io/prediccion-mundial-2026-demo/?|almacast\.github\.io/portafolio/?)"',lambda m:f'href="{base}{"marquesina" if "almacast" in m[0] else "mundial"}/"',s,flags=re.I)
        if f'href="{base}myaccountant/"' not in s:
            start=s.index('<div class="card">',s.index('Vitrina ·'))
            end=s.index('<a class="card"',start)
            block=s[start:end];close=block.rfind('</div>');block=block[:close]+'</a>'+block[close+6:];block=block.replace('<div class="card">',f'<a class="card" href="{base}myaccountant/">',1)
            block=block.replace('● En desarrollo','● Demo').replace('● In development','● Demo');s=s[:start]+block+s[end:]
        # Existing portfolio includes two cards pointing to Nexo; retain the first.
        seen=False
        def dedupe(m):
            nonlocal seen
            if f'{base}nexo/' not in m[0]:return m[0]
            if seen:return ''
            seen=True;return m[0]
        s=re.sub(r'<a class="card"[^>]*>.*?</a>',dedupe,s,flags=re.S)
        missing=['ourway','radar','criatura','inferencia','juego-construccion']
        s=re.sub(r'<!-- remaining-original-projects -->.*?<!-- /remaining-original-projects -->','',s,flags=re.S)
        cards=[]
        for slug,name,color,kind,title,description,features in PROJECTS:
            if slug not in missing:continue
            if en:kind,title,description,features=EN[slug]
            image=f'assets/previews/{slug}.jpg' if slug not in ('juego-construccion','inferencia') else 'assets/web-dev-eyes.svg'
            cards.append(f'<a class="card" href="{base}{slug}/"><span class="live">● {"Demo" if slug in ("radar","ourway") else "Showcase"}</span><div class="preview"><img src="{"../" if en else ""}{image}" alt="{name}" loading="lazy" style="width:100%;height:100%;object-fit:contain"></div><div class="card-body"><span class="tag">{kind}</span><h3>{name}</h3><p>{description}</p><span class="go">{"View showcase" if en else "Ver showcase"} →</span></div></a>')
        addition='<!-- remaining-original-projects --><div class="cat-title">'+('More original projects' if en else 'Más proyectos originales')+'</div><div class="grid">'+''.join(cards)+'</div><!-- /remaining-original-projects -->'
        marker='  <section id="skills"';idx=s.index(marker);end=s.rfind('    </div>',0,idx);s=s[:end]+addition+s[end:]
        path.write_text(s,encoding='utf-8')
    print('Ten showcases integrated, original cards preserved.')

if __name__=='__main__': main()
