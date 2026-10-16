import os
import json
import re
from project_meta import PROJECT_META

cards_es = json.load(open("tools/projects_data.json", encoding="utf-8"))
cards_en = json.load(open("tools/projects_data_en.json", encoding="utf-8"))

def get_slug(href):
    return href.strip("/").split("/")[-1]

lookup_es = {get_slug(c["href"]): c for c in cards_es}
lookup_en = {get_slug(c["href"]): c for c in cards_en}

previews_extracted = {}
if os.path.exists("tools/previews_extracted.json"):
    with open("tools/previews_extracted.json", "r", encoding="utf-8") as f:
        previews_extracted = json.load(f)

# Standout projects order
SLUG_ORDER = [
    "juego-construccion", "web-studio", "inferencia", "myaccountant",
    "cora", "ourway", "ruta-clara", "radar", "distrito", "dino-ai", "mundial",
    "dexter", "nucleo", "lumen", "vertice", "vitrina",
    "nexo", "brujula", "festo", "pulso", "totem", "marquesina"
]

def build_page(lang="es"):
    is_es = (lang == "es")
    lookup = lookup_es if is_es else lookup_en
    root_prefix = "" if is_es else "../"
    
    i18n = {
        "title": "Emilio Fonseca — Código, físicas e interactividad" if is_es else "Emilio Fonseca — Code, Physics & Interactivity",
        "description": "Portafolio y catálogo de Emilio Fonseca: videojuegos con físicas en WebGL, herramientas multimedia creativas, plataformas web de producción e inferencia de IA local en GPUs de consumo." if is_es else "Portfolio and catalog of Emilio Fonseca: WebGL physics games, creative multimedia tools, production web platforms, and local AI inference on consumer GPUs.",
        "hero_pill": "Ingeniería de Software · Físicas & Creatividad Interactiva" if is_es else "Software Engineering · Physics & Interactive Creativity",
        "hero_h1": "Código, físicas e interactividad." if is_es else "Code, physics and interactivity.",
        "hero_lead": "Hola, soy Emilio Fonseca. Desarrollador full-stack y creador técnico. Construyo software donde la ingeniería profunda y el diseño visual convergen: videojuegos con físicas reales en WebGL, suites de autor multimedia, plataformas en producción e inferencia local de IA en hardware de consumo." if is_es else "Hi, I'm Emilio Fonseca. Full-stack developer and creative technologist. I build software where deep engineering and interactive visual design converge: WebGL physics games, multimedia authoring suites, production platforms, and local AI inference on consumer GPUs.",
        "btn_explore_creations": "Explorar obras destacadas" if is_es else "Explore flagship projects",
        "btn_explore_archive": "Archivo completo (22)" if is_es else "Complete archive (22)",
        "btn_view_index_1screen": "Índice en 1 pantalla" if is_es else "1-screen index",
        "bento_title": "Creatividad técnica y proyectos insignia" if is_es else "Technical creativity & flagship projects",
        "bento_desc": "Una muestra de flexibilidad: motores de físicas en el navegador, suites multimedia, modelos de IA a bajo nivel y apps offline-first." if is_es else "A showcase of versatility: in-browser physics engines, multimedia suites, low-level AI models, and offline-first apps.",
        "bento_mn_badge": "Videojuego WebGL" if is_es else "WebGL Game",
        "bento_mn_desc": "Videojuego 2D con motor de físicas personalizado, recolección de materiales y coladas de concreto. Desarrollado en Unity con WebAssembly para jugar al instante en el navegador sin descargas." if is_es else "2D game featuring a custom physics engine, material harvesting, and concrete pouring. Built in Unity and compiled to WebAssembly for instant in-browser play with zero downloads.",
        "bento_studio_badge": "Suite Multimedia" if is_es else "Multimedia Suite",
        "bento_studio_desc": "Editor de video y composición multipista en el navegador con renderizado en Canvas WebGL y herramientas asistidas por IA generativa." if is_es else "In-browser multitrack video editor and compositor accelerated by Canvas WebGL with generative AI assistant workflows.",
        "bento_studio_btn": "Probar editor demo" if is_es else "Launch editor demo",
        "bento_ai_badge": "IA Local CUDA" if is_es else "Local CUDA AI",
        "bento_ai_desc": "Ruptura de barreras de memoria: modelos LLM de 7B (Mistral) corriendo a 23.4 tokens/seg en GPUs de 4 GB con cuantización INT4 GPTQ." if is_es else "Breaking hardware limits: 7B parameter LLMs running at 23.4 tokens/sec on 4 GB consumer GPUs using INT4 GPTQ low-rank quantization.",
        "bento_ai_btn": "Ver investigación y demo" if is_es else "View research & demo",
        "bento_acc_badge": "Finanzas PWA" if is_es else "Offline PWA",
        "bento_acc_desc": "Sistema de gestión financiera y contabilidad personal con arquitectura 100% offline-first. Cero servidores externos y cero nube: almacenamiento local cifrado en IndexedDB, balances mensuales automatizados y control de gastos privado." if is_es else "Personal finance and accounting system with 100% offline-first architecture. Zero external servers and zero cloud: encrypted local storage in IndexedDB, automated monthly balance sheets, and private expense tracking.",
        "bento_acc_btn": "Probar app demo" if is_es else "Launch app demo",
        "catalog_title": "Archivo completo de proyectos" if is_es else "Complete project archive",
        "catalog_desc": "Explora las 22 implementaciones en producción por categoría, busca por tecnología o activa el índice compacto para escanear todo en una sola pantalla sin scroll infinito." if is_es else "Explore all 22 production projects by category, search by technology, or switch to the compact index table to scan everything in one screen without endless scrolling.",
        "search_placeholder": "Buscar por tecnología, nombre o caso de uso (ej. Python, React, Unity, ERP, Docker)..." if is_es else "Search by technology, name, or use case (e.g. Python, React, Unity, ERP, Docker)...",
        "view_grid": "Cuadrícula" if is_es else "Grid",
        "view_index": "Índice en tabla" if is_es else "Table index",
        "tab_all": "Todos" if is_es else "All",
        "tab_demos": "Demos en vivo" if is_es else "Live demos",
        "showing_text": "Mostrando" if is_es else "Showing",
        "of_text": "de 22 proyectos" if is_es else "of 22 projects",
        "no_results": "No se encontraron proyectos con ese criterio de búsqueda." if is_es else "No projects found matching that search criteria.",
        "btn_clear_search": "Restablecer filtros" if is_es else "Reset filters",
        "card_btn_preview": "Ficha técnica" if is_es else "Quick view",
        "card_btn_showcase": "Ver presentación" if is_es else "View showcase",
        "card_btn_demo": "Probar demo" if is_es else "Open demo",
        "table_col_project": "Proyecto" if is_es else "Project",
        "table_col_category": "Categoría" if is_es else "Category",
        "table_col_tech": "Tecnologías" if is_es else "Technologies",
        "table_col_status": "Modalidad" if is_es else "Status",
        "table_col_action": "Acción" if is_es else "Action",
        "modal_title": "Ficha técnica de proyecto" if is_es else "Project technical overview",
        "modal_close": "Cerrar" if is_es else "Close",
        "modal_btn_demo": "Abrir demo en vivo" if is_es else "Launch live demo",
        "modal_btn_play": "Jugar demo en navegador" if is_es else "Play web demo",
        "modal_btn_showcase": "Ver presentación completa" if is_es else "View in-depth showcase",
        "skills_title": "Herramientas de ingeniería" if is_es else "Engineering tools",
        "skills_lead": "Tecnologías que utilizo para construir productos de alta fidelidad desde la arquitectura hasta el despliegue." if is_es else "Technologies I use to build high-fidelity products from initial architecture to final deployment.",
        "contact_title": "¿Tienes un proyecto o idea en mente?" if is_es else "Have a project or idea in mind?",
        "contact_lead": "Hablemos sobre cómo construir o escalar tu próximo videojuego, plataforma web, herramienta creativa o pipeline de IA." if is_es else "Let's discuss building or scaling your next game, web platform, creative tool, or AI pipeline.",
        "contact_wa": "Escríbeme por WhatsApp" if is_es else "Message on WhatsApp",
        "contact_cv_interactive": "CV Interactivo" if is_es else "Interactive Resume",
        "contact_cv_pdf": "Descargar CV (PDF)" if is_es else "Download Resume (PDF)",
        "contact_meta_remote": "Disponible para contratos y trabajo remoto" if is_es else "Available for contracts & remote work",
        "jump_bottom": "Contacto y CV" if is_es else "Contact & CV",
        "jump_top": "Subir al inicio" if is_es else "Back to top",
        "nav_destacados": "Destacados" if is_es else "Flagships",
        "nav_projects": "Catálogo" if is_es else "Catalog",
        "nav_skills": "Habilidades" if is_es else "Skills",
        "nav_contact": "Contacto" if is_es else "Contact",
        "lang_switch_url": "en/" if is_es else "../",
        "lang_switch_label": "English" if is_es else "Español",
        "lang_switch_title": "Switch to English" if is_es else "Cambiar a Español",
    }
    
    grid_cards_html = []
    index_rows_html = []
    modal_data = {}
    
    for slug in SLUG_ORDER:
        card = lookup[slug]
        meta = PROJECT_META[slug]
        
        jpg_filename = f"{slug}.jpg"
        jpg_path = os.path.join("assets", "previews", jpg_filename)
        title_escaped = card["title"].replace('"', '&quot;')
        
        if os.path.exists(jpg_path):
            img_src = f"{root_prefix}assets/previews/{jpg_filename}"
            preview_inner = f'<img src="{img_src}" alt="{title_escaped}" loading="lazy" width="320" height="200" />'
        elif slug == "dino-ai" and "dino" in previews_extracted:
            preview_inner = previews_extracted["dino"]
        elif slug == "inferencia":
            preview_inner = '<svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="320" height="168" fill="#0d1320"/><rect x="20" y="20" width="280" height="128" rx="10" fill="#151d2f"/><text x="36" y="46" font-size="11" fill="#38bdf8" font-family="system-ui, sans-serif" font-weight="700">CUDA / VRAM OPTIMIZER</text><text x="36" y="68" font-size="20" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="800">2.4 GB / 4.0 GB</text><rect x="36" y="82" width="248" height="10" rx="5" fill="#1b2540"/><rect x="36" y="82" width="148" height="10" rx="5" fill="#38bdf8"/><text x="36" y="112" font-size="9" fill="#94a3b8" font-family="system-ui, sans-serif">INT4 GPTQ + Low-Rank Quantization</text><text x="36" y="128" font-size="9" fill="#34d399" font-family="system-ui, sans-serif">23.4 tokens/sec &middot; Mistral-7B</text></svg>'
        elif slug in previews_extracted:
            preview_inner = previews_extracted[slug]
        else:
            preview_inner = f'<svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="320" height="168" fill="#0d1320"/><rect x="20" y="20" width="280" height="128" rx="8" fill="#151d2f"/><text x="160" y="90" font-size="14" fill="#94a3b8" text-anchor="middle" font-family="system-ui, sans-serif">{slug}</text></svg>'
        
        showcase_url = card["href"]
        is_live_demo = (meta["demo_type"] == "demo")
        
        demo_url = showcase_url
        if slug == "juego-construccion":
            demo_url = "https://mnlaobramaestra.netlify.app/"
        elif slug == "cora":
            demo_url = "https://emiliougarte65.github.io/cora-showcase/" if is_es else "https://emiliougarte65.github.io/cora-showcase/en/"
        elif slug in ["mundial", "nexo", "lumen", "nucleo", "vertice", "vitrina", "myaccountant", "marquesina", "pulso", "totem", "web-studio", "distrito", "ruta-clara", "ourway", "radar"]:
            demo_url = f"{root_prefix}demos/{slug}/"
            
        badge_label = "Demo en vivo" if is_live_demo else "Showcase"
        if not is_es:
            badge_label = "Live demo" if is_live_demo else "Showcase"
        if slug == "juego-construccion":
            badge_label = "Demo jugable" if is_es else "Playable demo"
            
        cat_key = meta["cat"]
        cat_name = meta["cat_name_es"] if is_es else meta["cat_name_en"]
        metric = meta["metric_es"] if is_es else meta["metric_en"]
        
        top_stack = meta["stack"][:3]
        stack_chips = "".join([f'<span class="chip">{s}</span>' for s in top_stack])
        search_terms = f"{card['title']} {card['tag']} {cat_name} {' '.join(meta['stack'])} {card['description']}".lower()
        
        modal_data[slug] = {
            "title": card["title"],
            "tag": card["tag"],
            "badge": badge_label,
            "cat": cat_name,
            "description": card["description"],
            "metric": metric,
            "stack": meta["stack"],
            "showcase_url": showcase_url,
            "demo_url": demo_url,
            "is_live": is_live_demo,
            "is_game": (slug == "juego-construccion")
        }
        
        badge_class = "badge-demo" if is_live_demo else "badge-showcase"
        live_dot_html = '<span class="beacon-pulse"></span>' if is_live_demo else ''
        
        card_action_btn_text = i18n["card_btn_demo"] if is_live_demo else i18n["card_btn_showcase"]
        if slug == "juego-construccion":
            card_action_btn_text = i18n["modal_btn_play"]
        card_action_href = demo_url if is_live_demo else showcase_url
        card_target_attr = 'target="_blank" rel="noopener"' if (slug in ["juego-construccion", "cora"]) else ""
        
        card_html = f'''
        <div class="card catalog-item" data-slug="{slug}" data-category="{cat_key}" data-live="{str(is_live_demo).lower()}" data-search="{search_terms}" onclick="openProjectModal('{slug}')" tabindex="0" role="button" aria-label="Ver ficha técnica de {title_escaped}">
          <span class="live {badge_class}">{live_dot_html}{badge_label}</span>
          <div class="preview">
            {preview_inner}
          </div>
          <div class="card-body">
            <div class="card-header-row">
              <span class="cat-label">{cat_name}</span>
            </div>
            <h3>{card['title']}</h3>
            <p>{card['description']}</p>
            <div class="stack">{stack_chips}</div>
            <div class="card-actions" onclick="event.stopPropagation()">
              <a class="btn-micro btn-action" href="{card_action_href}" {card_target_attr}>
                {card_action_btn_text}
              </a>
              <button type="button" class="btn-micro btn-inspect" onclick="openProjectModal('{slug}')" aria-label="Abrir ficha técnica de {title_escaped}">
                {i18n['card_btn_preview']}
              </button>
            </div>
          </div>
        </div>
        '''.strip()
        grid_cards_html.append(card_html)
        
        action_btn_text = i18n["card_btn_demo"] if is_live_demo else i18n["card_btn_showcase"]
        action_btn_href = demo_url if is_live_demo else showcase_url
        target_attr = 'target="_blank" rel="noopener"' if (slug == "juego-construccion") else ""
        
        row_html = f'''
        <tr class="index-row catalog-item" data-slug="{slug}" data-category="{cat_key}" data-live="{str(is_live_demo).lower()}" data-search="{search_terms}" onclick="openProjectModal('{slug}')" tabindex="0" role="button" aria-label="Ver detalles de {title_escaped}">
          <td class="col-project">
            <div class="index-proj-cell">
              <div class="index-thumb-mini">{preview_inner}</div>
              <div>
                <strong class="index-title">{card['title']}</strong>
                <span class="index-summary">{card['description'][:95]}...</span>
              </div>
            </div>
          </td>
          <td class="col-cat">
            <span class="index-cat-badge cat-{cat_key}">{cat_name}</span>
          </td>
          <td class="col-stack">
            <div class="index-stack-wrap">{stack_chips}</div>
          </td>
          <td class="col-status">
            <span class="live {badge_class}">{badge_label}</span>
          </td>
          <td class="col-action" onclick="event.stopPropagation()">
            <a class="index-go-btn" href="{action_btn_href}" {target_attr}>{action_btn_text}</a>
          </td>
        </tr>
        '''.strip()
        index_rows_html.append(row_html)
        
    grid_all_html = "\n".join(grid_cards_html)
    index_all_html = "\n".join(index_rows_html)
    modal_json_escaped = json.dumps(modal_data, ensure_ascii=False).replace("</script>", "<\\/script>")

    page_html = f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{i18n['title']}</title>
  <meta name="description" content="{i18n['description']}" />
  <meta name="author" content="Emilio Fonseca" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#070b12" />
  <link rel="canonical" href="https://emiliougarte65.github.io/portafolio-web/{'' if is_es else 'en/'}" />
  <link rel="alternate" hreflang="es" href="https://emiliougarte65.github.io/portafolio-web/" />
  <link rel="alternate" hreflang="en" href="https://emiliougarte65.github.io/portafolio-web/en/" />
  <link rel="alternate" hreflang="x-default" href="https://emiliougarte65.github.io/portafolio-web/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Emilio Fonseca — Portfolio" />
  <meta property="og:title" content="{i18n['title']}" />
  <meta property="og:description" content="{i18n['description']}" />
  <meta property="og:url" content="https://emiliougarte65.github.io/portafolio-web/{'' if is_es else 'en/'}" />
  <meta property="og:image" content="https://emiliougarte65.github.io/portafolio-web/og-cover.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
  
  <style>
    :root {{
      --bg: #070b12;
      --surface-1: #0d1524;
      --surface-2: #142036;
      --surface-3: #1b2c4a;
      --ink: #f8fafc;
      --ink-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-ink: #07101f;
      --accent-green: #34d399;
      --accent-purple: #818cf8;
      --accent-amber: #f59e0b;
      
      --step-display: clamp(2.4rem, 6.2vw, 4.2rem);
      --step-h2: clamp(1.75rem, 3.6vw, 2.3rem);
      --step-h3: 1.25rem;
      --step-body: 1rem;
      --step-sm: 0.8125rem;
      
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
      --radius: 16px;
      --radius-sm: 8px;
    }}
    [data-theme="light"] {{
      --bg: #f8fafc;
      --surface-1: #f1f5f9;
      --surface-2: #e2e8f0;
      --surface-3: #cbd5e1;
      --ink: #0f172a;
      --ink-muted: #475569;
      --accent: #0284c7;
      --accent-ink: #ffffff;
      --accent-green: #059669;
      --accent-purple: #6366f1;
      --accent-amber: #d97706;
    }}
    
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--ink);
      font-size: var(--step-body);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      position: relative;
      transition: background .25s var(--ease-out), color .25s var(--ease-out);
    }}
    
    /* AMBIENT AURORA GLOW MESH */
    body::before {{
      content: ""; position: fixed; top: 0; left: 0; right: 0; height: 100vh;
      background: 
        radial-gradient(ellipse 65% 50% at 20% 15%, rgba(56, 189, 248, 0.12), transparent 70%),
        radial-gradient(ellipse 55% 45% at 85% 30%, rgba(129, 140, 248, 0.10), transparent 70%),
        radial-gradient(ellipse 50% 40% at 50% 80%, rgba(52, 211, 153, 0.06), transparent 70%);
      pointer-events: none; z-index: 0;
    }}
    
    a {{ color: inherit; text-decoration: none; }}
    button {{ font-family: inherit; }}
    .container {{ width: 100%; max-width: 1160px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 2; }}
    
    /* NAV */
    nav {{
      position: sticky; top: 0; z-index: 80;
      background: rgba(7, 11, 18, 0.90);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      transition: background .2s;
    }}
    [data-theme="light"] nav {{
      background: rgba(248, 250, 252, 0.94);
    }}
    nav .container {{ display: flex; align-items: center; justify-content: space-between; height: 68px; }}
    
    .brand {{
      display: inline-flex; align-items: center; gap: 11px;
      font-size: var(--step-body); font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
      transition: transform .15s var(--ease-out), opacity .15s;
    }}
    .brand:hover {{ opacity: 0.92; transform: translateY(-1px); }}
    .brand:active {{ transform: scale(0.97); }}
    .brand-terminal {{
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--surface-2); border: none;
      color: var(--accent); font-family: inherit; font-size: var(--step-sm); font-weight: 800;
    }}
    .brand-text b {{ color: var(--ink); font-weight: 800; margin-left: 1px; }}
    .brand-dot {{ color: var(--accent); font-weight: 700; }}
    
    .nav-links {{ display: flex; gap: 24px; align-items: center; }}
    .nav-links a {{
      color: var(--ink-muted); font-size: var(--step-sm); font-weight: 500;
      transition: color .15s var(--ease-out);
    }}
    .nav-links a:hover {{ color: var(--ink); }}
    .theme-toggle {{
      background: var(--surface-1); border: none; color: var(--ink);
      width: 36px; height: 36px; border-radius: 999px; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: var(--step-sm); transition: background .15s, transform .15s;
    }}
    .theme-toggle:hover {{ background: var(--surface-2); transform: scale(1.05); }}
    .theme-toggle:active {{ transform: scale(0.95); }}
    
    /* HERO WITH INTERACTIVE KINETIC CANVAS */
    .hero {{
      padding: 64px 0 52px; position: relative; overflow: hidden;
    }}
    .hero-canvas {{
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: auto; z-index: 1; opacity: 0.75; cursor: crosshair;
    }}
    .hero-box {{
      position: relative; z-index: 2; max-width: 920px; pointer-events: none;
    }}
    .hero-box a, .hero-box button {{ pointer-events: auto; }}
    
    .hero-pill {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px; border-radius: 999px;
      background: rgba(56, 189, 248, 0.12); border: none;
      color: var(--accent); font-size: var(--step-sm); font-weight: 600;
      margin-bottom: 20px;
    }}
    .beacon-pulse {{
      width: 7px; height: 7px; border-radius: 50%; background: var(--accent-green); flex: none;
      animation: beaconGlow 2s infinite;
    }}
    .beacon-pulse.amber {{ background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }}
    .beacon-pulse.blue {{ background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }}
    @keyframes beaconGlow {{
      0%, 100% {{ transform: scale(1); opacity: 1; }}
      50% {{ transform: scale(1.3); opacity: 0.7; }}
    }}
    
    .hero h1 {{
      font-size: var(--step-display); font-weight: 800;
      letter-spacing: -0.04em; line-height: 1.06; margin-bottom: 20px;
      color: var(--ink);
    }}
    .hero p.lead {{
      font-size: clamp(1rem, 2.2vw, 1.15rem); color: var(--ink-muted);
      max-width: 780px; margin-bottom: 30px; line-height: 1.65;
    }}
    
    .cta-row {{ display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }}
    .btn {{
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 13px 26px; border-radius: var(--radius-sm); font-weight: 600;
      font-size: var(--step-body); cursor: pointer; text-decoration: none; border: none;
      transition: transform .18s var(--ease-out), background .18s;
    }}
    .btn-primary {{
      background: var(--accent); color: var(--accent-ink); font-weight: 700;
    }}
    .btn-primary:hover {{
      background: #7dd3fc; transform: translateY(-2px);
    }}
    .btn-primary:active {{ transform: scale(0.97); }}
    
    .btn-ghost {{
      background: var(--surface-1); color: var(--ink); border: none;
    }}
    .btn-ghost:hover {{
      background: var(--surface-2); transform: translateY(-2px);
    }}
    .btn-ghost:active {{ transform: scale(0.97); }}
    
    .btn-text-link {{
      color: var(--ink-muted); font-size: var(--step-sm); font-weight: 600;
      padding: 8px 12px; cursor: pointer; background: none; border: none;
      transition: color .15s;
    }}
    .btn-text-link:hover {{ color: var(--accent); }}
    
    /* SECTION HEADERS */
    .section-head {{
      margin-bottom: 32px; position: relative;
    }}
    .section-head h2 {{
      font-size: var(--step-h2); font-weight: 800; letter-spacing: -0.03em; color: var(--ink);
    }}
    .section-head p {{
      color: var(--ink-muted); margin-top: 8px; max-width: 720px; font-size: var(--step-body);
    }}
    
    /* BENTO SHOWCASE (SELECTED WORKS WITH 3D DEPTH) */
    .featured-section {{
      padding: 36px 0 72px; position: relative;
    }}
    .bento-grid {{
      display: grid; grid-template-columns: repeat(12, 1fr); gap: 24px;
    }}
    .bento-card {{
      position: relative; background: var(--surface-1); border-radius: 20px;
      border: none; overflow: hidden; display: flex; flex-direction: column;
      transform-style: preserve-3d;
      transition: transform .25s var(--ease-out), background .25s var(--ease-out);
    }}
    .bento-card:hover {{
      background: #0f192b;
    }}
    
    .bento-card-game {{ grid-column: span 7; }}
    .bento-card-studio {{ grid-column: span 5; }}
    .bento-card-ai {{ grid-column: span 5; }}
    .bento-card-acc {{ grid-column: span 7; }}
    
    .bento-media {{
      position: relative; height: 260px; overflow: hidden; background: #000;
    }}
    .bento-media img {{
      width: 100%; height: 100%; object-fit: cover; display: block;
      transition: transform .5s var(--ease-out), filter .3s var(--ease-out);
    }}
    .bento-card:hover .bento-media img {{
      transform: scale(1.04); filter: brightness(1.05);
    }}
    
    /* ANIMATED HACKER TERMINAL IN INFERENCIA */
    .terminal-box {{
      width: 100%; height: 100%; background: #080d16; padding: 22px 20px;
      display: flex; flex-direction: column; font-family: inherit; font-size: var(--step-sm);
    }}
    .terminal-bar {{
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px; opacity: 0.75;
    }}
    .terminal-dots {{ display: flex; gap: 6px; }}
    .t-dot {{ width: 9px; height: 9px; border-radius: 50%; }}
    .dot-red {{ background: #ef4444; }}
    .dot-yellow {{ background: #f59e0b; }}
    .dot-green {{ background: #10b981; }}
    .terminal-label {{ font-size: var(--step-sm); color: #94a3b8; }}
    .terminal-content {{ display: flex; flex-direction: column; gap: 7px; line-height: 1.45; }}
    .term-line {{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .term-prompt {{ color: #38bdf8; font-weight: bold; }}
    .term-cmd {{ color: #f8fafc; font-weight: 600; }}
    .term-info {{ color: #94a3b8; }}
    .term-purple {{ color: #a78bfa; }}
    .term-green {{ color: #34d399; font-weight: 600; }}
    .term-cyan {{ color: #38bdf8; font-weight: 600; }}
    .term-cursor {{ animation: termBlink 1s infinite; color: #38bdf8; font-weight: bold; }}
    @keyframes termBlink {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0; }} }}
    
    /* ANIMATED CONTROLLER & SCRUBBER OVERLAYS */
    .game-overlay-tag {{
      position: absolute; bottom: 14px; left: 14px; z-index: 3;
      background: #0d1524;
      padding: 4px 11px; border-radius: 999px; font-size: var(--step-sm);
      color: #34d399; font-weight: 600;
    }}
    .studio-scrubber-track {{
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: rgba(255, 255, 255, 0.1); overflow: hidden; z-index: 3;
    }}
    .studio-scrubber-head {{
      height: 100%; width: 28%; background: var(--accent);
      animation: scrubberSlide 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }}
    @keyframes scrubberSlide {{
      0% {{ transform: translateX(-100%); }}
      100% {{ transform: translateX(360%); }}
    }}
    .acc-spark-bar {{
      position: absolute; bottom: 14px; left: 14px; display: flex; gap: 8px; z-index: 3;
    }}
    .acc-pill-mini {{
      background: #0d1524;
      padding: 4px 11px; border-radius: 999px; font-size: var(--step-sm);
      color: #fbbf24; font-weight: 600;
    }}
    
    .bento-body {{
      padding: 26px; display: flex; flex-direction: column; flex: 1;
    }}
    .bento-genre {{
      font-size: var(--step-sm); color: var(--accent); font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; margin-bottom: 8px; display: block;
    }}
    .bento-body h3 {{
      font-size: var(--step-h3); font-weight: 800; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 10px;
    }}
    .bento-body p {{
      color: var(--ink-muted); font-size: var(--step-body); line-height: 1.6; margin-bottom: 22px; flex: 1;
    }}
    .bento-actions {{
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: auto;
    }}
    
    .badge-game {{ background: #10b981; color: #022c22; }}
    .badge-demo {{ background: var(--accent); color: var(--accent-ink); }}
    .badge-showcase {{ background: #4338ca; color: #ffffff; font-weight: 700; }}
    .badge-acc {{ background: #f59e0b; color: #451a03; }}
    .text-amber {{ color: #f59e0b; }}
    .btn-amber {{ background: #f59e0b; color: #451a03; }}
    .btn-amber:hover {{ background: #fbbf24; }}
    
    /* CATALOG & COMPLETE ARCHIVE SECTION */
    #proyectos {{
      padding: 40px 0 88px; position: relative;
    }}
    
    .catalog-bar {{
      background: var(--surface-1); border-radius: var(--radius);
      border: none; padding: 16px 20px; margin-bottom: 32px;
      display: flex; flex-direction: column; gap: 14px;
    }}
    .catalog-top-row {{
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    }}
    .catalog-search-wrap {{ position: relative; flex: 1; min-width: 260px; }}
    .search-icon {{
      position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      width: 18px; height: 18px; color: var(--ink-muted); pointer-events: none;
    }}
    .catalog-search-input {{
      width: 100%; height: 46px; background: var(--surface-2); border: none;
      border-radius: var(--radius-sm); padding: 0 38px 0 44px; color: var(--ink);
      font-size: var(--step-body); font-family: inherit; outline: none;
      transition: background .15s;
    }}
    .catalog-search-input:focus {{
      background: var(--surface-3);
    }}
    .catalog-search-clear {{
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--ink-muted); cursor: pointer; font-size: var(--step-body);
      padding: 4px; display: none; line-height: 1;
    }}
    .catalog-search-clear:hover {{ color: var(--ink); }}
    
    .catalog-views {{ display: flex; gap: 6px; }}
    .view-btn {{
      display: inline-flex; align-items: center; gap: 6px;
      height: 44px; padding: 0 16px; border-radius: var(--radius-sm);
      background: var(--surface-2); border: none; color: var(--ink-muted);
      font-size: var(--step-sm); font-weight: 600; cursor: pointer;
      transition: all .18s var(--ease-out);
    }}
    .view-btn:hover {{ color: var(--ink); background: var(--surface-3); }}
    .view-btn.active {{
      background: var(--accent); color: var(--accent-ink);
    }}
    .view-btn:active {{ transform: scale(0.97); }}
    
    .catalog-filter-bar {{
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    }}
    .catalog-tabs {{ display: flex; gap: 8px; flex-wrap: wrap; }}
    .cat-pill {{
      display: inline-flex; align-items: center; gap: 7px;
      padding: 7px 15px; border-radius: 999px;
      background: var(--surface-2); border: none; color: var(--ink-muted);
      font-size: var(--step-sm); font-weight: 500; cursor: pointer;
      transition: all .18s var(--ease-out);
    }}
    .cat-pill:hover {{ color: var(--ink); background: var(--surface-3); transform: translateY(-1px); }}
    .cat-pill.active {{
      background: var(--accent); color: var(--accent-ink); font-weight: 700;
    }}
    .cat-pill:active {{ transform: scale(0.97); }}
    .pill-count {{
      font-size: var(--step-sm); opacity: 0.85; padding: 1px 6px; border-radius: 6px;
      background: rgba(0, 0, 0, 0.2); font-weight: 700;
    }}
    .cat-pill.active .pill-count {{ background: rgba(0, 0, 0, 0.28); color: #fff; }}
    .catalog-status-text {{ font-size: var(--step-sm); color: var(--ink-muted); font-weight: 500; }}
    
    /* REFINED GRID CARDS */
    .catalog-grid {{
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;
    }}
    .card {{
      position: relative; background: var(--surface-1); border-radius: var(--radius);
      border: none; overflow: hidden; display: flex; flex-direction: column; cursor: pointer;
      transition: transform .25s var(--ease-out), background .25s var(--ease-out);
    }}
    .card::before {{
      content: ""; position: absolute; inset: 0;
      background: radial-gradient(380px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), rgba(56, 189, 248, 0.12), transparent 45%);
      pointer-events: none; opacity: 0; transition: opacity .25s var(--ease-out);
      z-index: 2;
    }}
    .card:hover::before {{ opacity: 1; }}
    .card:hover {{
      transform: translateY(-5px); background: #0f192b;
    }}
    
    .card .preview {{
      height: 184px; position: relative; overflow: hidden; background: #000;
    }}
    .card .preview svg, .card .preview img {{
      width: 100%; height: 100%; display: block; object-fit: cover;
      transition: transform .5s var(--ease-out), filter .3s var(--ease-out);
    }}
    .card:hover .preview svg, .card:hover .preview img {{
      transform: scale(1.04); filter: brightness(1.05);
    }}
    
    .live {{
      position: absolute; top: 12px; right: 12px; z-index: 3;
      font-size: var(--step-sm); font-weight: 700; padding: 4px 11px; border-radius: 999px;
      display: inline-flex; align-items: center; gap: 6px;
    }}
    
    .card-body {{ padding: 22px; display: flex; flex-direction: column; flex: 1; position: relative; z-index: 3; }}
    .card-header-row {{
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
    }}
    .cat-label {{
      font-size: var(--step-sm); color: var(--accent); font-weight: 600;
    }}
    .card h3 {{
      font-size: var(--step-h3); font-weight: 700; margin: 6px 0 8px;
      letter-spacing: -0.02em; line-height: 1.3; color: var(--ink);
    }}
    .card p {{ color: var(--ink-muted); font-size: var(--step-body); line-height: 1.6; flex: 1; margin-bottom: 14px; }}
    
    .stack {{ display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }}
    .chip {{
      font-size: var(--step-sm); background: var(--surface-2); color: var(--ink-muted);
      padding: 3px 9px; border-radius: 6px; font-weight: 500;
    }}
    .card:hover .chip {{ color: var(--ink); }}
    
    .card-actions {{
      display: flex; gap: 10px; margin-top: auto;
    }}
    .btn-micro {{
      flex: 1; display: inline-flex; align-items: center; justify-content: center;
      padding: 9px 12px; border-radius: var(--radius-sm); font-size: var(--step-sm); font-weight: 600;
      transition: all .18s var(--ease-out); cursor: pointer; text-align: center; border: none;
    }}
    .btn-inspect {{
      background: var(--surface-2); color: var(--ink);
    }}
    .btn-inspect:hover {{ background: var(--surface-3); }}
    .btn-inspect:active {{ transform: scale(0.97); }}
    .btn-action {{
      background: var(--accent); color: var(--accent-ink); font-weight: 700;
    }}
    .btn-action:hover {{ background: #7dd3fc; }}
    .btn-action:active {{ transform: scale(0.97); }}
    
    /* COMPACT 1-SCREEN TABLE VIEW */
    .catalog-index-wrap {{
      display: none; width: 100%; border-radius: var(--radius);
      overflow-x: auto; background: var(--surface-1); border: none;
    }}
    .catalog-index-table {{
      width: 100%; border-collapse: collapse; text-align: left; font-size: var(--step-body);
    }}
    .catalog-index-table th {{
      padding: 16px 20px; background: var(--surface-2); color: var(--ink-muted);
      font-size: var(--step-sm); font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }}
    .index-row {{
      cursor: pointer; transition: background .12s var(--ease-out); border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }}
    .index-row:hover {{ background: var(--surface-2); }}
    .index-row td {{ padding: 16px 20px; vertical-align: middle; }}
    
    .index-proj-cell {{ display: flex; align-items: center; gap: 14px; min-width: 280px; }}
    .index-thumb-mini {{
      width: 56px; height: 40px; border-radius: 6px; overflow: hidden;
      background: #000; flex: none;
    }}
    .index-thumb-mini svg, .index-thumb-mini img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    .index-title {{ display: block; color: var(--ink); font-weight: 600; font-size: var(--step-body); }}
    .index-summary {{ display: block; color: var(--ink-muted); font-size: var(--step-sm); margin-top: 2px; }}
    .index-cat-badge {{
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: var(--step-sm); font-weight: 500; background: var(--surface-2); color: var(--ink);
    }}
    .index-stack-wrap {{ display: flex; flex-wrap: wrap; gap: 5px; max-width: 260px; }}
    .index-go-btn {{
      display: inline-flex; align-items: center; gap: 4px; padding: 7px 14px;
      border-radius: var(--radius-sm); background: var(--accent); color: var(--accent-ink);
      font-size: var(--step-sm); font-weight: 600; white-space: nowrap; transition: background .15s, transform .15s;
    }}
    .index-go-btn:hover {{ background: #7dd3fc; transform: translateY(-1px); }}
    .index-go-btn:active {{ transform: scale(0.97); }}
    
    .catalog-empty-msg {{
      display: none; padding: 64px 24px; text-align: center;
      background: var(--surface-1); border-radius: var(--radius); border: none;
    }}
    .catalog-empty-msg p {{ color: var(--ink-muted); font-size: var(--step-body); margin-bottom: 20px; }}
    
    /* MODAL */
    .catalog-modal {{
      position: fixed; inset: 0; z-index: 100;
      display: none; align-items: center; justify-content: center; padding: 20px;
    }}
    .catalog-modal.open {{ display: flex; }}
    .modal-backdrop {{
      position: absolute; inset: 0; background: rgba(7, 11, 18, 0.92);
    }}
    .modal-panel {{
      position: relative; z-index: 2; width: 100%; max-width: 740px;
      background: var(--surface-1); border: none;
      border-radius: 22px; overflow: hidden;
      transform: scale(0.95); opacity: 0;
      transition: transform .22s var(--ease-out), opacity .22s var(--ease-out);
    }}
    .catalog-modal.open .modal-panel {{ transform: scale(1); opacity: 1; }}
    .modal-head {{
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px; background: var(--surface-2); border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }}
    .modal-head-title {{ font-size: var(--step-body); font-weight: 600; color: var(--ink-muted); }}
    .modal-close-btn {{
      background: none; border: none; color: var(--ink-muted); font-size: var(--step-h3);
      cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;
      transition: color .15s, transform .15s;
    }}
    .modal-close-btn:hover {{ color: var(--ink); transform: scale(1.1); }}
    .modal-close-btn:active {{ transform: scale(0.95); }}
    
    .modal-body {{ padding: 26px; max-height: 80vh; overflow-y: auto; }}
    .modal-preview-box {{
      height: 240px; border-radius: var(--radius-sm); overflow: hidden; background: #000;
      margin-bottom: 22px; position: relative;
    }}
    .modal-preview-box svg, .modal-preview-box img {{
      width: 100%; height: 100%; object-fit: cover; display: block;
    }}
    .modal-badge-row {{ display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }}
    .modal-title {{ font-size: var(--step-h2); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 12px; color: var(--ink); }}
    .modal-desc {{ color: var(--ink-muted); font-size: var(--step-body); line-height: 1.65; margin-bottom: 18px; }}
    .modal-metric {{
      padding: 12px 16px; border-radius: var(--radius-sm); background: var(--surface-2); border: none;
      color: var(--accent); font-weight: 600; font-size: var(--step-sm); margin-bottom: 20px;
    }}
    .modal-stack-label {{ font-size: var(--step-sm); color: var(--ink-muted); font-weight: 600; margin-bottom: 8px; }}
    .modal-foot-actions {{
      display: flex; gap: 12px; margin-top: 26px; flex-wrap: wrap;
    }}
    
    /* FLOATING QUICK JUMP DOCK */
    .quick-jump-dock {{
      position: fixed; bottom: 26px; right: 26px; z-index: 70;
      display: flex; flex-direction: column; gap: 10px; align-items: flex-end;
    }}
    .dock-pill {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 18px; border-radius: 999px; font-size: var(--step-sm); font-weight: 600;
      background: var(--surface-2); color: var(--ink); border: none;
      cursor: pointer; transition: transform .18s var(--ease-out), background .18s;
    }}
    .dock-pill:hover {{
      background: var(--accent); color: var(--accent-ink); transform: translateY(-2px);
    }}
    .dock-pill:active {{ transform: scale(0.96); }}
    .dock-pill-top {{ display: none; opacity: 0; }}
    .dock-pill-top.visible {{ display: inline-flex; opacity: 1; }}
    
    /* SKILLS */
    #skills {{ padding: 76px 0; background: var(--surface-1); position: relative; }}
    .skills-grid {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 36px;
    }}
    .skill-card {{
      background: var(--bg); border: none; border-radius: var(--radius);
      padding: 24px; transition: transform .2s var(--ease-out), background .2s;
    }}
    .skill-card:nth-child(1), .skill-card:nth-child(2) {{ grid-column: span 2; }}
    .skill-card:hover {{ transform: translateY(-3px); background: #0c1422; }}
    .skill-card h3 {{ font-size: var(--step-h3); font-weight: 700; margin-bottom: 8px; color: var(--ink); }}
    .skill-card p {{ color: var(--ink-muted); font-size: var(--step-body); line-height: 1.55; margin-bottom: 14px; }}
    
    /* CONTACT */
    #contacto {{ padding: 88px 0 96px; }}
    .contact-box {{
      background: var(--surface-1); border: none;
      border-radius: 24px; padding: 56px 40px; text-align: center;
      position: relative; overflow: hidden;
    }}
    .contact-box::before {{
      content: ""; position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
      width: 450px; height: 250px;
      background: radial-gradient(50% 50% at 50% 50%, rgba(56, 189, 248, 0.12), transparent 100%);
      pointer-events: none;
    }}
    .contact-box h2 {{ font-size: var(--step-h2); font-weight: 800; margin-bottom: 12px; color: var(--ink); }}
    .contact-box p {{ color: var(--ink-muted); font-size: var(--step-body); max-width: 620px; margin: 0 auto 36px; }}
    .contact-links-grid {{
      display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px;
    }}
    .contact-meta-row {{
      display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; font-size: var(--step-sm); color: var(--ink-muted);
    }}
    .contact-meta-row a:hover {{ color: var(--accent); }}
    
    /* FOOTER */
    footer {{
      padding: 36px 0; text-align: center; color: var(--ink-muted); font-size: var(--step-sm);
    }}
    
    /* MOTION LAYER (EMIL KOWALSKI & TASTE-SKILL) */
    @keyframes heroEntrance {{
      from {{ opacity: 0; transform: translateY(16px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    @keyframes cardPop {{
      from {{ opacity: 0; transform: translateY(12px) scale(0.98); }}
      to {{ opacity: 1; transform: translateY(0) scale(1); }}
    }}
    
    .hero-box {{ animation: heroEntrance 0.5s var(--ease-out) both; }}
    .hero-pill {{ animation: heroEntrance 0.5s var(--ease-out) 0.05s both; }}
    .cta-row {{ animation: heroEntrance 0.5s var(--ease-out) 0.12s both; }}
    .bento-card:nth-child(1) {{ animation: heroEntrance 0.45s var(--ease-out) 0.10s both; }}
    .bento-card:nth-child(2) {{ animation: heroEntrance 0.45s var(--ease-out) 0.18s both; }}
    .bento-card:nth-child(3) {{ animation: heroEntrance 0.45s var(--ease-out) 0.26s both; }}
    .bento-card:nth-child(4) {{ animation: heroEntrance 0.45s var(--ease-out) 0.34s both; }}
    .catalog-bar {{ animation: heroEntrance 0.45s var(--ease-out) 0.20s both; }}
    .cat-pill:nth-child(1) {{ animation: heroEntrance 0.4s var(--ease-out) 0.24s both; }}
    .cat-pill:nth-child(2) {{ animation: heroEntrance 0.4s var(--ease-out) 0.28s both; }}
    .cat-pill:nth-child(3) {{ animation: heroEntrance 0.4s var(--ease-out) 0.32s both; }}
    .cat-pill:nth-child(4) {{ animation: heroEntrance 0.4s var(--ease-out) 0.36s both; }}
    .cat-pill:nth-child(5) {{ animation: heroEntrance 0.4s var(--ease-out) 0.40s both; }}
    .cat-pill:nth-child(6) {{ animation: heroEntrance 0.4s var(--ease-out) 0.44s both; }}
    .catalog-grid .card:nth-child(1) {{ animation: heroEntrance 0.4s var(--ease-out) 0.10s both; }}
    .catalog-grid .card:nth-child(2) {{ animation: heroEntrance 0.4s var(--ease-out) 0.16s both; }}
    .catalog-grid .card:nth-child(3) {{ animation: heroEntrance 0.4s var(--ease-out) 0.22s both; }}
    .catalog-grid .card:nth-child(4) {{ animation: heroEntrance 0.4s var(--ease-out) 0.28s both; }}
    .catalog-grid .card:nth-child(5) {{ animation: heroEntrance 0.4s var(--ease-out) 0.34s both; }}
    .catalog-grid .card:nth-child(6) {{ animation: heroEntrance 0.4s var(--ease-out) 0.40s both; }}
    
    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }}
      .hero-canvas {{ display: none !important; }}
      .studio-scrubber-head {{ animation: none !important; }}
      .term-cursor {{ animation: none !important; }}
      .beacon-pulse {{ animation: none !important; }}
    }}
    
    /* RESPONSIVE */
    @media (max-width: 900px) {{
      .bento-card-game, .bento-card-studio, .bento-card-ai, .bento-card-acc {{
        grid-column: span 12;
      }}
      .bento-media {{ height: 220px; }}
    }}
    @media (max-width: 768px) {{
      nav .nav-links {{ gap: 12px; font-size: var(--step-sm); }}
      nav .nav-links a[href="#destacados"], nav .nav-links a[href="#skills"], nav .nav-links a[href="#contacto"] {{ display: none; }}
      .brand-last {{ display: none; }}
      .hero {{ padding: 46px 0 38px; }}
      .catalog-bar {{ padding: 14px 16px; }}
      .catalog-top-row {{ flex-direction: column; align-items: stretch; }}
      .catalog-views {{ justify-content: flex-end; }}
      .quick-jump-dock {{ bottom: 16px; right: 16px; }}
      .dock-pill {{ padding: 9px 15px; font-size: var(--step-sm); }}
      .contact-box {{ padding: 42px 20px; }}
      .skill-card:nth-child(1), .skill-card:nth-child(2) {{ grid-column: span 1; }}
    }}
    @media (max-width: 480px) {{
      .hero h1 {{ font-size: 2.1rem; line-height: 1.12; }}
      .section-head h2 {{ font-size: 1.6rem; }}
    }}
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <div class="container">
      <a class="brand" href="{root_prefix}#">
        <span class="brand-terminal">&gt;_</span>
        <span class="brand-text">Emilio<b class="brand-last">Fonseca</b><span class="brand-dot">.dev</span></span>
      </a>
      <div class="nav-links">
        <a href="#destacados">{i18n['nav_destacados']}</a>
        <a href="#proyectos">{i18n['nav_projects']}</a>
        <a href="#skills">{i18n['nav_skills']}</a>
        <a href="#contacto">{i18n['nav_contact']}</a>
        <a href="{i18n['lang_switch_url']}" title="{i18n['lang_switch_title']}" style="color: var(--accent); font-weight: 600;">{i18n['lang_switch_label']}</a>
        <button class="theme-toggle" id="themeToggle" title="Cambiar tema" aria-label="Cambiar modo claro u oscuro">◐</button>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero">
    <canvas id="heroCanvas" class="hero-canvas" aria-hidden="true"></canvas>
    <div class="container hero-box">
      <div class="hero-pill">
        <span class="beacon-pulse"></span>
        <span>{i18n['hero_pill']}</span>
      </div>
      <h1>{i18n['hero_h1']}</h1>
      <p class="lead">{i18n['hero_lead']}</p>
      
      <div class="cta-row">
        <a class="btn btn-primary" href="#destacados">{i18n['btn_explore_creations']}</a>
        <a class="btn btn-ghost" href="#proyectos">{i18n['btn_explore_archive']}</a>
        <button type="button" class="btn-text-link" onclick="switchView('index')">→ {i18n['btn_view_index_1screen']}</button>
      </div>
    </div>
  </header>

  <!-- BENTO SHOWCASE (SELECTED WORKS) -->
  <section id="destacados" class="featured-section">
    <div class="container">
      <div class="section-head">
        <h2>{i18n['bento_title']}</h2>
        <p>{i18n['bento_desc']}</p>
      </div>
      
      <div class="bento-grid">
        <!-- 1. OBRA MAESTRA MN (Game & Physics) -->
        <article class="bento-card bento-card-game">
          <div class="bento-media">
            <img src="{root_prefix}assets/previews/juego-construccion.jpg" alt="Obra Maestra MN" loading="eager" width="640" height="360" />
            <span class="live badge-game"><span class="beacon-pulse"></span> {i18n['bento_mn_badge']}</span>
            <span class="game-overlay-tag">W/A/S/D · Motor Físicas 60 FPS</span>
          </div>
          <div class="bento-body">
            <span class="bento-genre">Unity · WebGL · WASM · 2D Physics</span>
            <h3>Obra Maestra MN</h3>
            <p>{i18n['bento_mn_desc']}</p>
            <div class="bento-actions">
              <a class="btn btn-primary" href="https://mnlaobramaestra.netlify.app/" target="_blank" rel="noopener">{i18n['modal_btn_play']}</a>
              <button type="button" class="btn btn-ghost" onclick="openProjectModal('juego-construccion')">{i18n['card_btn_preview']}</button>
            </div>
          </div>
        </article>

        <!-- 2. WEB STUDIO (Creative Studio) -->
        <article class="bento-card bento-card-studio">
          <div class="bento-media">
            <img src="{root_prefix}assets/previews/web-studio.jpg" alt="Web Studio" loading="eager" width="500" height="300" />
            <span class="live badge-demo"><span class="beacon-pulse blue"></span> {i18n['bento_studio_badge']}</span>
            <div class="studio-scrubber-track">
              <div class="studio-scrubber-head"></div>
            </div>
          </div>
          <div class="bento-body">
            <span class="bento-genre">Canvas WebGL · AI Multimedia</span>
            <h3>Web Studio</h3>
            <p>{i18n['bento_studio_desc']}</p>
            <div class="bento-actions">
              <a class="btn btn-primary" href="{root_prefix}demos/web-studio/">{i18n['bento_studio_btn']}</a>
              <button type="button" class="btn btn-ghost" onclick="openProjectModal('web-studio')">{i18n['card_btn_preview']}</button>
            </div>
          </div>
        </article>

        <!-- 3. INFERENCIA INT4 (Low-level AI & GPU Hacker Terminal) -->
        <article class="bento-card bento-card-ai">
          <div class="bento-media">
            <div class="terminal-box">
              <div class="terminal-bar">
                <div class="terminal-dots">
                  <span class="t-dot dot-red"></span>
                  <span class="t-dot dot-yellow"></span>
                  <span class="t-dot dot-green"></span>
                </div>
                <span class="terminal-label">vram_optimizer.py — cuda:0 (4096MB)</span>
              </div>
              <div class="terminal-content">
                <div class="term-line"><span class="term-prompt">$</span> <span class="term-cmd">python quantize.py --model mistral-7b --bits 4</span></div>
                <div class="term-line term-info">&gt; Target GPU: RTX 4.0 GB VRAM</div>
                <div class="term-line term-purple">&gt; GPTQ Low-Rank Quantization active...</div>
                <div class="term-line term-green">&gt; VRAM Footprint: <strong>2.4 GB / 4.0 GB</strong> (60%)</div>
                <div class="term-line term-cyan">&gt; Speed: <strong>23.4 tokens/sec</strong> <span class="term-cursor">_</span></div>
              </div>
            </div>
            <span class="live badge-showcase">{i18n['bento_ai_badge']}</span>
          </div>
          <div class="bento-body">
            <span class="bento-genre">PyTorch · CUDA · INT4 GPTQ</span>
            <h3>Inferencia en 4 GB VRAM</h3>
            <p>{i18n['bento_ai_desc']}</p>
            <div class="bento-actions">
              <a class="btn btn-primary" href="{lookup['inferencia']['href']}">{i18n['bento_ai_btn']}</a>
              <button type="button" class="btn btn-ghost" onclick="openProjectModal('inferencia')">{i18n['card_btn_preview']}</button>
            </div>
          </div>
        </article>

        <!-- 4. MYACCOUNTANT (Offline-First Financial PWA) -->
        <article class="bento-card bento-card-acc">
          <div class="bento-media">
            <img src="{root_prefix}assets/previews/myaccountant.jpg" alt="MyAccountant" loading="eager" width="640" height="360" />
            <span class="live badge-acc"><span class="beacon-pulse amber"></span> {i18n['bento_acc_badge']}</span>
            <div class="acc-spark-bar">
              <span class="acc-pill-mini">Offline SQLite</span>
              <span class="acc-pill-mini">Zero Cloud</span>
            </div>
          </div>
          <div class="bento-body">
            <span class="bento-genre text-amber">React · PWA · IndexedDB · Offline-First</span>
            <h3>MyAccountant</h3>
            <p>{i18n['bento_acc_desc']}</p>
            <div class="bento-actions">
              <a class="btn btn-primary btn-amber" href="{root_prefix}demos/myaccountant/">{i18n['bento_acc_btn']}</a>
              <button type="button" class="btn btn-ghost" onclick="openProjectModal('myaccountant')">{i18n['card_btn_preview']}</button>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- COMPLETE CATALOG & ARCHIVE (22 PROJECTS) -->
  <section id="proyectos">
    <div class="container">
      <div class="section-head">
        <h2>{i18n['catalog_title']}</h2>
        <p>{i18n['catalog_desc']}</p>
      </div>

      <!-- CONTROLS BAR -->
      <div class="catalog-bar">
        <div class="catalog-top-row">
          <div class="catalog-search-wrap">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
            <input type="text" id="catalogSearch" class="catalog-search-input" placeholder="{i18n['search_placeholder']}" aria-label="Buscar en el catálogo" />
            <button type="button" id="catalogSearchClear" class="catalog-search-clear" aria-label="Limpiar búsqueda">✕</button>
          </div>
          <div class="catalog-views">
            <button type="button" class="view-btn active" data-view="grid" aria-label="Vista cuadrícula">
              <span>{i18n['view_grid']}</span>
            </button>
            <button type="button" class="view-btn" data-view="index" aria-label="Vista tabla rápida">
              <span>{i18n['view_index']}</span>
            </button>
          </div>
        </div>

        <div class="catalog-filter-bar">
          <div class="catalog-tabs">
            <button type="button" class="cat-pill active" data-filter="all">
              <span>{i18n['tab_all']}</span>
              <span class="pill-count">22</span>
            </button>
            <button type="button" class="cat-pill" data-filter="demos">
              <span>{i18n['tab_demos']}</span>
              <span class="pill-count">18</span>
            </button>
            <button type="button" class="cat-pill" data-filter="ia">
              <span>IA &amp; ML</span>
              <span class="pill-count">7</span>
            </button>
            <button type="button" class="cat-pill" data-filter="web">
              <span>Web &amp; ERP</span>
              <span class="pill-count">5</span>
            </button>
            <button type="button" class="cat-pill" data-filter="hardware">
              <span>3D &amp; Juegos</span>
              <span class="pill-count">5</span>
            </button>
            <button type="button" class="cat-pill" data-filter="auto">
              <span>Automatización &amp; BI</span>
              <span class="pill-count">5</span>
            </button>
          </div>
          <div class="catalog-status-text">
            <span>{i18n['showing_text']} <strong id="catalogVisibleCount">22</strong> {i18n['of_text']}</span>
          </div>
        </div>
      </div>

      <!-- GRID CARDS -->
      <div class="catalog-grid" id="catalogGrid">
        {grid_all_html}
      </div>

      <!-- COMPACT INDEX (TABLE) -->
      <div class="catalog-index-wrap" id="catalogIndexWrap">
        <table class="catalog-index-table">
          <thead>
            <tr>
              <th scope="col">{i18n['table_col_project']}</th>
              <th scope="col">{i18n['table_col_category']}</th>
              <th scope="col">{i18n['table_col_tech']}</th>
              <th scope="col">{i18n['table_col_status']}</th>
              <th scope="col">{i18n['table_col_action']}</th>
            </tr>
          </thead>
          <tbody id="catalogIndexBody">
            {index_all_html}
          </tbody>
        </table>
      </div>

      <!-- EMPTY STATE -->
      <div class="catalog-empty-msg" id="catalogEmpty">
        <p>{i18n['no_results']}</p>
        <button type="button" class="btn btn-primary" onclick="resetFilters()">{i18n['btn_clear_search']}</button>
      </div>
    </div>
  </section>

  <!-- QUICK PREVIEW MODAL -->
  <div class="catalog-modal" id="catalogModal" aria-hidden="true" role="dialog" aria-labelledby="modalProjTitle">
    <div class="modal-backdrop" onclick="closeProjectModal()"></div>
    <div class="modal-panel">
      <div class="modal-head">
        <div class="modal-head-title">{i18n['modal_title']}</div>
        <button type="button" class="modal-close-btn" onclick="closeProjectModal()" aria-label="{i18n['modal_close']}">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-preview-box" id="modalPreview"></div>
        <div class="modal-badge-row">
          <span class="live" id="modalBadge">Demo</span>
          <span class="index-cat-badge" id="modalCat">Categoría</span>
        </div>
        <h3 class="modal-title" id="modalProjTitle">Título del proyecto</h3>
        <p class="modal-desc" id="modalDesc">Descripción completa del proyecto.</p>
        <div class="modal-metric" id="modalMetric">Métricas destacadas</div>
        <div class="modal-stack-label">Tecnologías utilizadas:</div>
        <div class="stack" id="modalStack"></div>
        <div class="modal-foot-actions">
          <a class="btn btn-primary" id="modalDemoBtn" href="#" target="_blank" rel="noopener">{i18n['modal_btn_demo']}</a>
          <a class="btn btn-ghost" id="modalShowcaseBtn" href="#">{i18n['modal_btn_showcase']}</a>
        </div>
      </div>
    </div>
  </div>

  <!-- FLOATING QUICK JUMP DOCK -->
  <div class="quick-jump-dock" id="quickJumpDock">
    <button type="button" class="dock-pill dock-pill-top" id="dockTopBtn" onclick="window.scrollTo({{top: 0, behavior: 'smooth'}})" aria-label="{i18n['jump_top']}">
      <span>↑ {i18n['jump_top']}</span>
    </button>
    <a class="dock-pill" href="#contacto" aria-label="{i18n['jump_bottom']}">
      <span>↓ {i18n['jump_bottom']}</span>
    </a>
  </div>

  <!-- SKILLS SECTION -->
  <section id="skills">
    <div class="container">
      <div class="section-head">
        <h2>{i18n['skills_title']}</h2>
        <p>{i18n['skills_lead']}</p>
      </div>
      <div class="skills-grid">
        <div class="skill-card">
          <h3>3D, Videojuegos y WebGL</h3>
          <p>Desarrollo con Unity en C#, compilación a WebAssembly/WebGL, shaders GLSL, Three.js para entornos inmersivos y modelado interactivo.</p>
          <div class="stack"><span class="chip">Unity</span><span class="chip">C#</span><span class="chip">Three.js</span><span class="chip">GLSL</span><span class="chip">WASM</span></div>
        </div>
        <div class="skill-card">
          <h3>Inteligencia Artificial y ML</h3>
          <p>Integración de LLMs, agentes autónomos, frameworks de inferencia local en GPU (vLLM, Ollama), INT4/GPTQ y computer vision con OpenCV.</p>
          <div class="stack"><span class="chip">PyTorch</span><span class="chip">OpenCV</span><span class="chip">HuggingFace</span><span class="chip">INT4 GPTQ</span></div>
        </div>
        <div class="skill-card">
          <h3>Frontend y PWAs</h3>
          <p>React, TypeScript, JavaScript moderno, Tailwind CSS, Service Workers, aplicaciones offline-first y gráficos reactivos.</p>
          <div class="stack"><span class="chip">React</span><span class="chip">TypeScript</span><span class="chip">PWA</span></div>
        </div>
        <div class="skill-card">
          <h3>Backend y APIs</h3>
          <p>Python, FastAPI, Node.js, Express, diseño de APIs RESTful, webhooks en tiempo real y microservicios orientados a eventos.</p>
          <div class="stack"><span class="chip">FastAPI</span><span class="chip">Node.js</span><span class="chip">Python</span></div>
        </div>
        <div class="skill-card">
          <h3>Bases de Datos &amp; Cache</h3>
          <p>PostgreSQL, Firebase Firestore, SQL Server, Redis, consultas optimizadas, ORMs y migraciones automáticas.</p>
          <div class="stack"><span class="chip">PostgreSQL</span><span class="chip">Firebase</span><span class="chip">Redis</span></div>
        </div>
        <div class="skill-card">
          <h3>Automatización y BI</h3>
          <p>WhatsApp Business API oficial, dashboards interactivos, pipelines de extracción de datos, sincronización con ERPs y bots 24/7.</p>
          <div class="stack"><span class="chip">WhatsApp API</span><span class="chip">BI</span><span class="chip">Dynamics 365</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTACT SECTION -->
  <section id="contacto">
    <div class="container">
      <div class="contact-box">
        <h2>{i18n['contact_title']}</h2>
        <p>{i18n['contact_lead']}</p>
        <div class="contact-links-grid">
          <a class="btn btn-primary" href="https://wa.me/528336817886?text=Hola%20Emilio%2C%20vi%20tu%20cat%C3%A1logo%20y%20me%20gustar%C3%ADa%20platicar%20sobre%20un%20proyecto." target="_blank" rel="noopener">{i18n['contact_wa']}</a>
          <a class="btn btn-ghost" href="{root_prefix}cv/">{i18n['contact_cv_interactive']}</a>
          <a class="btn btn-ghost" href="{root_prefix}cv/Emilio-Fonseca-CV-ES.pdf" download>{i18n['contact_cv_pdf']}</a>
          <a class="btn btn-ghost" href="https://www.linkedin.com/in/emilio-fonseca65" target="_blank" rel="noopener">LinkedIn</a>
          <a class="btn btn-ghost" href="https://github.com/EmilioUgarte65" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="contact-meta-row">
          <a href="mailto:emilio656565@outlook.com">emilio656565@outlook.com</a>
          <span>·</span>
          <span>Tampico, Tamps., México</span>
          <span>·</span>
          <span>{i18n['contact_meta_remote']}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="container">
      © <span id="year"></span> Emilio Fonseca · Construido con estándares de accesibilidad, rendimiento y diseño interactivo
    </div>
  </footer>

  <script>
    document.getElementById('year').textContent = new Date().getFullYear();

    // Theme toggle
    (function(){{
      var b = document.getElementById('themeToggle');
      if (b) {{
        b.addEventListener('click', function(){{
          var isLight = document.documentElement.getAttribute('data-theme') === 'light';
          if (isLight) {{
            document.documentElement.removeAttribute('data-theme');
            try {{ localStorage.setItem('site-theme', 'dark'); }} catch(e){{}}
          }} else {{
            document.documentElement.setAttribute('data-theme', 'light');
            try {{ localStorage.setItem('site-theme', 'light'); }} catch(e){{}}
          }}
        }});
      }}
      try {{
        if (localStorage.getItem('site-theme') === 'light') {{
          document.documentElement.setAttribute('data-theme', 'light');
        }}
      }} catch(e){{}}
    }})();

    // KINETIC INTERACTIVE HERO CANVAS (WITH RIPPLE IMPULSE ON CLICK)
    (function() {{
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var canvas = document.getElementById('heroCanvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;

      var width = 0, height = 0;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var points = [];
      var mouse = {{ x: -9999, y: -9999, active: false }};
      var numPoints = 32;
      var animId = null;
      var isVisible = true;

      function resize() {{
        var rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }}

      function initPoints() {{
        points = [];
        for (var i = 0; i < numPoints; i++) {{
          points.push({{
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            radius: Math.random() * 1.5 + 1.2,
            color: (i % 3 === 0) ? '#38bdf8' : ((i % 3 === 1) ? '#818cf8' : '#34d399')
          }});
        }}
      }}

      function draw() {{
        if (!isVisible) return;
        ctx.clearRect(0, 0, width, height);

        for (var i = 0; i < points.length; i++) {{
          var p = points[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          if (mouse.active) {{
            var dx = mouse.x - p.x;
            var dy = mouse.y - p.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140) {{
              var force = (140 - dist) / 140;
              p.x -= (dx / dist) * force * 1.3;
              p.y -= (dy / dist) * force * 1.3;
            }}
          }}

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.55;
          ctx.fill();

          for (var j = i + 1; j < points.length; j++) {{
            var p2 = points[j];
            var dxx = p.x - p2.x;
            var dyy = p.y - p2.y;
            var d = Math.sqrt(dxx * dxx + dyy * dyy);
            if (d < 115) {{
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = '#38bdf8';
              ctx.globalAlpha = (1 - d / 115) * 0.18;
              ctx.lineWidth = 1;
              ctx.stroke();
            }}
          }}
        }}

        ctx.globalAlpha = 1;
        animId = requestAnimationFrame(draw);
      }}

      resize();
      initPoints();
      draw();

      window.addEventListener('resize', function() {{
        resize();
      }});

      window.addEventListener('mousemove', function(e) {{
        var rect = canvas.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {{
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;
          mouse.active = true;
        }} else {{
          mouse.active = false;
        }}
      }});

      canvas.addEventListener('click', function(e) {{
        var rect = canvas.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        points.forEach(function(p) {{
          var dx = p.x - cx;
          var dy = p.y - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {{
            var force = (200 - dist) / 200;
            p.vx += (dx / Math.max(dist, 1)) * force * 2.2;
            p.vy += (dy / Math.max(dist, 1)) * force * 2.2;
          }}
        }});
      }});

      document.addEventListener('mouseleave', function() {{
        mouse.active = false;
      }});

      if ('IntersectionObserver' in window) {{
        var obs = new IntersectionObserver(function(entries) {{
          entries.forEach(function(entry) {{
            isVisible = entry.isIntersecting;
            if (isVisible && !animId) draw();
          }});
        }});
        obs.observe(canvas);
      }}
    }})();

    // 3D PARALLAX TILT ON BENTO CARDS (Tactile Spring Physics)
    document.querySelectorAll('.bento-card').forEach(function(card) {{
      card.addEventListener('mousemove', function(e) {{
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = ((y - centerY) / centerY) * -3.2;
        var rotateY = ((x - centerX) / centerX) * 3.2;
        card.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) translateY(-6px)';
      }});
      card.addEventListener('mouseleave', function() {{
        card.style.transform = '';
      }});
    }});

    // SPOTLIGHT EFFECT ON CARDS
    document.querySelectorAll('.card').forEach(function(card) {{
      card.addEventListener('mousemove', function(e) {{
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
      }});
      card.addEventListener('mouseleave', function() {{
        card.style.setProperty('--mouse-x', '-999px');
        card.style.setProperty('--mouse-y', '-999px');
      }});
    }});

    // CATALOG FILTERING & LIVE SEARCH
    var MODAL_DATA = {modal_json_escaped};
    var activeFilter = 'all';
    var activeSearch = '';
    var activeView = 'grid';

    var searchInput = document.getElementById('catalogSearch');
    var searchClear = document.getElementById('catalogSearchClear');
    var tabButtons = document.querySelectorAll('.cat-pill');
    var viewButtons = document.querySelectorAll('.view-btn');
    var catalogGrid = document.getElementById('catalogGrid');
    var catalogIndexWrap = document.getElementById('catalogIndexWrap');
    var catalogEmpty = document.getElementById('catalogEmpty');
    var visibleCountEl = document.getElementById('catalogVisibleCount');
    var dockTopBtn = document.getElementById('dockTopBtn');

    var gridItems = document.querySelectorAll('.catalog-grid .card');
    var indexRows = document.querySelectorAll('#catalogIndexBody tr');

    function applyCatalogFilters() {{
      var query = activeSearch.trim().toLowerCase();
      var visibleCount = 0;
      var delay = 0;

      gridItems.forEach(function(card) {{
        var cat = card.getAttribute('data-category');
        var isLive = card.getAttribute('data-live') === 'true';
        var searchStr = card.getAttribute('data-search') || '';

        var matchCat = (activeFilter === 'all') ||
                       (activeFilter === 'demos' && isLive) ||
                       (activeFilter === cat);
        var matchSearch = (!query) || (searchStr.indexOf(query) !== -1);

        if (matchCat && matchSearch) {{
          card.style.display = 'flex';
          visibleCount++;
          card.style.animation = 'none';
          void card.offsetWidth;
          card.style.animation = 'cardPop 0.35s var(--ease-out) ' + delay + 's both';
          delay = Math.min(delay + 0.02, 0.2);
        }} else {{
          card.style.display = 'none';
        }}
      }});

      indexRows.forEach(function(row) {{
        var cat = row.getAttribute('data-category');
        var isLive = row.getAttribute('data-live') === 'true';
        var searchStr = row.getAttribute('data-search') || '';

        var matchCat = (activeFilter === 'all') ||
                       (activeFilter === 'demos' && isLive) ||
                       (activeFilter === cat);
        var matchSearch = (!query) || (searchStr.indexOf(query) !== -1);

        if (matchCat && matchSearch) {{
          row.style.display = 'table-row';
        }} else {{
          row.style.display = 'none';
        }}
      }});

      if (visibleCountEl) visibleCountEl.textContent = visibleCount;
      if (catalogEmpty) {{
        if (visibleCount === 0) {{
          catalogEmpty.style.display = 'block';
          if (activeView === 'grid') catalogGrid.style.display = 'none';
          else catalogIndexWrap.style.display = 'none';
        }} else {{
          catalogEmpty.style.display = 'none';
          if (activeView === 'grid') catalogGrid.style.display = 'grid';
          else catalogIndexWrap.style.display = 'block';
        }}
      }}
    }}

    tabButtons.forEach(function(btn){{
      btn.addEventListener('click', function(){{
        tabButtons.forEach(function(b){{ b.classList.remove('active'); }});
        this.classList.add('active');
        activeFilter = this.getAttribute('data-filter');
        applyCatalogFilters();
      }});
    }});

    if (searchInput) {{
      searchInput.addEventListener('input', function(){{
        activeSearch = this.value;
        if (searchClear) searchClear.style.display = (activeSearch.length > 0) ? 'block' : 'none';
        applyCatalogFilters();
      }});
    }}
    if (searchClear) {{
      searchClear.addEventListener('click', function(){{
        if (searchInput) {{
          searchInput.value = '';
          searchInput.focus();
        }}
        activeSearch = '';
        this.style.display = 'none';
        applyCatalogFilters();
      }});
    }}

    function resetFilters() {{
      activeFilter = 'all';
      activeSearch = '';
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.style.display = 'none';
      tabButtons.forEach(function(b){{
        b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
      }});
      applyCatalogFilters();
    }}

    viewButtons.forEach(function(btn){{
      btn.addEventListener('click', function(){{
        viewButtons.forEach(function(b){{ b.classList.remove('active'); }});
        this.classList.add('active');
        activeView = this.getAttribute('data-view');
        if (activeView === 'grid') {{
          catalogGrid.style.display = 'grid';
          catalogIndexWrap.style.display = 'none';
        }} else {{
          catalogGrid.style.display = 'none';
          catalogIndexWrap.style.display = 'block';
        }}
        applyCatalogFilters();
      }});
    }});

    function switchView(viewName) {{
      var targetBtn = document.querySelector('.view-btn[data-view="' + viewName + '"]');
      if (targetBtn) targetBtn.click();
      var sec = document.getElementById('proyectos');
      if (sec) sec.scrollIntoView({{ behavior: 'smooth' }});
    }}

    // MODAL
    var modal = document.getElementById('catalogModal');
    var modalPreview = document.getElementById('modalPreview');
    var modalBadge = document.getElementById('modalBadge');
    var modalCat = document.getElementById('modalCat');
    var modalProjTitle = document.getElementById('modalProjTitle');
    var modalDesc = document.getElementById('modalDesc');
    var modalMetric = document.getElementById('modalMetric');
    var modalStack = document.getElementById('modalStack');
    var modalDemoBtn = document.getElementById('modalDemoBtn');
    var modalShowcaseBtn = document.getElementById('modalShowcaseBtn');

    function openProjectModal(slug) {{
      var data = MODAL_DATA[slug];
      if (!data) return;

      var origCard = document.querySelector('.card[data-slug="' + slug + '"] .preview');
      if (origCard && modalPreview) {{
        modalPreview.innerHTML = origCard.innerHTML;
      }}
      if (modalBadge) {{
        modalBadge.textContent = data.badge;
        modalBadge.className = 'live ' + (data.is_live ? 'badge-demo' : 'badge-showcase');
      }}
      if (modalCat) modalCat.textContent = data.cat;
      if (modalProjTitle) modalProjTitle.textContent = data.title;
      if (modalDesc) modalDesc.textContent = data.description;
      if (modalMetric) modalMetric.textContent = data.metric;
      if (modalStack) {{
        modalStack.innerHTML = data.stack.map(function(s){{ return '<span class="chip">' + s + '</span>'; }}).join('');
      }}
      if (modalShowcaseBtn) {{
        modalShowcaseBtn.href = data.showcase_url;
      }}
      if (modalDemoBtn) {{
        if (data.is_live) {{
          modalDemoBtn.style.display = 'inline-flex';
          modalDemoBtn.href = data.demo_url;
          modalDemoBtn.textContent = data.is_game ? '{i18n['modal_btn_play']}' : '{i18n['modal_btn_demo']}';
          if (data.is_game) modalDemoBtn.target = '_blank';
        }} else {{
          modalDemoBtn.style.display = 'none';
        }}
      }}

      if (modal) {{
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }}
    }}

    function closeProjectModal() {{
      if (modal) {{
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }}
    }}

    document.addEventListener('keydown', function(e){{
      if (e.key === 'Escape') closeProjectModal();
    }});

    window.addEventListener('scroll', function(){{
      if (dockTopBtn) {{
        if (window.scrollY > 350) {{
          dockTopBtn.classList.add('visible');
        }} else {{
          dockTopBtn.classList.remove('visible');
        }}
      }}
    }});
  </script>
</body>
</html>
'''
    return page_html

html_es = build_page("es")
with open("index.html", "w", encoding="utf-8") as f:
    f.write(html_es)
print(f"Generated index.html: {len(html_es)} bytes")

html_en = build_page("en")
with open("en/index.html", "w", encoding="utf-8") as f:
    f.write(html_en)
print(f"Generated en/index.html: {len(html_en)} bytes")
