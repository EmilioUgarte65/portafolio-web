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

# Put image-heavy and key standout projects first
SLUG_ORDER = [
    "juego-construccion", "ruta-clara", "web-studio", "ourway", "radar", "distrito",
    "inferencia", "dino-ai", "mundial", "dexter", "nucleo",
    "lumen", "vertice", "vitrina", "myaccountant", "nexo", "brujula",
    "festo", "pulso", "totem", "marquesina"
]

def build_page(lang="es"):
    is_es = (lang == "es")
    lookup = lookup_es if is_es else lookup_en
    root_prefix = "" if is_es else "../"
    
    i18n = {
        "title": "Emilio Fonseca — Desarrollo de software, sistemas e IA aplicada" if is_es else "Emilio Fonseca — Full-Stack Developer, Systems & Applied AI",
        "description": "Emilio Fonseca — Desarrollador Full-Stack. Catálogo interactivo de 21 proyectos en producción: aplicaciones web (ERP, e-commerce, PWAs), análisis de datos y BI, e IA aplicada con demos en vivo." if is_es else "Emilio Fonseca — Full-Stack Developer. Interactive catalog of 21 production projects: web apps (ERP, e-commerce, PWAs), data & BI, and applied AI with live demos.",
        "hero_status": "Disponible para nuevos proyectos & contratos" if is_es else "Available for new projects & contracts",
        "hero_h1": "Software e IA aplicada." if is_es else "Software and applied AI.",
        "hero_lead": "Desarrollador full-stack especializado en sistemas de producción de punta a punta: plataformas ERP, analítica comercial, inferencia de IA en GPUs de consumo y videojuegos en WebGL. Explora el catálogo con demos interactivas en vivo." if is_es else "Full-stack developer building end-to-end production systems: ERP platforms, commercial analytics, consumer-GPU AI inference, and WebGL games. Explore the interactive catalog with live demos.",
        "stat_projects": "21 Sistemas" if is_es else "21 Systems",
        "stat_projects_desc": "Proyectos en producción" if is_es else "Production delivered systems",
        "stat_demos": "17 Demos" if is_es else "17 Live Demos",
        "stat_demos_desc": "Interactivos en el navegador" if is_es else "Interactive in browser",
        "stat_ia": "4 GB VRAM" if is_es else "4 GB VRAM",
        "stat_ia_desc": "Inferencia de LLMs optimizada" if is_es else "Optimized LLM inference",
        "stat_code": "100% Funcional" if is_es else "100% Functional",
        "stat_code_desc": "Probado en campo real" if is_es else "Field-verified code",
        "quick_highlights": "Proyectos destacados:" if is_es else "Key highlights:",
        "btn_explore_catalog": "Explorar catálogo interactivo (21)" if is_es else "Explore interactive catalog (21)",
        "btn_contact": "Contacto y CV" if is_es else "Contact and resume",
        "catalog_title": "Catálogo de proyectos y demos" if is_es else "Project and demo catalog",
        "catalog_desc": "Filtra por área de especialidad, busca por tecnología o cambia al índice compacto para escanear todo el portafolio en una sola pantalla sin scroll infinito." if is_es else "Filter by category, search by technology, or switch to compact index view to scan the entire portfolio without endless scrolling.",
        "search_placeholder": "Buscar por tecnología, nombre o caso de uso (ej. Python, React, Unity, ERP, Docker)..." if is_es else "Search by technology, name, or use case (e.g. Python, React, Unity, ERP, Docker)...",
        "view_grid": "Cuadrícula" if is_es else "Grid",
        "view_index": "Índice rápido" if is_es else "Quick index",
        "tab_all": "Todos" if is_es else "All",
        "tab_demos": "Demos en vivo" if is_es else "Live demos",
        "showing_text": "Mostrando" if is_es else "Showing",
        "of_text": "de 21 proyectos" if is_es else "of 21 projects",
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
        "jump_bottom": "Contacto y CV" if is_es else "Contact & CV",
        "jump_top": "Subir al inicio" if is_es else "Back to top",
        "nav_projects": "Proyectos" if is_es else "Projects",
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
            preview_inner = f'<img src="{img_src}" alt="{title_escaped}" loading="eager" width="320" height="200" />'
        elif slug == "dino-ai" and "dino" in previews_extracted:
            preview_inner = previews_extracted["dino"]
        elif slug == "inferencia":
            preview_inner = '<svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="320" height="168" fill="#0d1320"/><rect x="20" y="20" width="280" height="128" rx="10" fill="#151d2f" stroke="#2e3a52"/><text x="36" y="46" font-size="11" fill="#38bdf8" font-family="monospace" font-weight="700">CUDA / VRAM OPTIMIZER</text><text x="36" y="68" font-size="20" fill="#f8fafc" font-family="monospace" font-weight="800">2.4 GB / 4.0 GB</text><rect x="36" y="82" width="248" height="10" rx="5" fill="#1b2540"/><rect x="36" y="82" width="148" height="10" rx="5" fill="#38bdf8"/><text x="36" y="112" font-size="9" fill="#94a3b8" font-family="monospace">INT4 GPTQ + Low-Rank Quantization</text><text x="36" y="128" font-size="9" fill="#34d399" font-family="monospace">23.4 tokens/sec · Mistral-7B</text></svg>'
        elif slug in previews_extracted:
            preview_inner = previews_extracted[slug]
        else:
            preview_inner = f'<svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="320" height="168" fill="#0d1320"/><rect x="20" y="20" width="280" height="128" rx="8" fill="#151d2f"/><text x="160" y="90" font-size="14" fill="#94a3b8" text-anchor="middle" font-family="monospace">{slug}</text></svg>'
        
        showcase_url = card["href"]
        is_live_demo = (meta["demo_type"] == "demo")
        
        demo_url = showcase_url
        if slug == "juego-construccion":
            demo_url = "https://mnlaobramaestra.netlify.app/"
        elif slug in ["mundial", "nexo", "lumen", "nucleo", "vertice", "vitrina", "myaccountant", "marquesina", "pulso", "totem", "web-studio", "distrito", "ruta-clara", "ourway", "radar"]:
            demo_url = f"{root_prefix}demos/{slug}/"
            
        badge_label = f"Demo en vivo" if is_live_demo else "Showcase"
        if not is_es:
            badge_label = "Live demo" if is_live_demo else "Showcase"
        if slug == "juego-construccion":
            badge_label = "Demo jugable" if is_es else "Playable demo"
            
        cat_key = meta["cat"]
        cat_name = meta["cat_name_es"] if is_es else meta["cat_name_en"]
        metric = meta["metric_es"] if is_es else meta["metric_en"]
        stack_chips = "".join([f'<span class="chip">{s}</span>' for s in meta["stack"]])
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
        
        card_html = f'''
        <div class="card catalog-item" data-slug="{slug}" data-category="{cat_key}" data-live="{str(is_live_demo).lower()}" data-search="{search_terms}">
          <span class="live {badge_class}">{badge_label}</span>
          <div class="preview">
            {preview_inner}
          </div>
          <div class="card-body">
            <div class="card-header-row">
              <span class="tag">{card['tag']}</span>
              <span class="cat-label">{cat_name}</span>
            </div>
            <h3>{card['title']}</h3>
            <p>{card['description']}</p>
            <div class="card-metric-pill">
              <span class="metric-dot"></span>
              <span>{metric}</span>
            </div>
            <div class="stack">{stack_chips}</div>
            <div class="card-actions">
              <button type="button" class="btn-micro btn-inspect" onclick="openProjectModal('{slug}')" aria-label="Abrir ficha de {title_escaped}">
                {i18n['card_btn_preview']}
              </button>
              <a class="btn-micro btn-action" href="{showcase_url}">
                {i18n['card_btn_showcase']}
              </a>
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
    /* STRICT 5-STEP TYPE SYSTEM & TONE SCALE (taste-skill + impeccable) */
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
      
      --step-display: clamp(2.6rem, 7vw, 4.4rem);
      --step-h2: clamp(1.8rem, 3.8vw, 2.4rem);
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
    
    /* ATMOSPHERIC AMBIENT GLOW MESH */
    body::before {{
      content: ""; position: fixed; top: -140px; left: 50%; transform: translateX(-50%);
      width: 1000px; height: 550px;
      background: radial-gradient(50% 50% at 50% 40%, rgba(56, 189, 248, 0.08) 0%, rgba(99, 102, 241, 0.04) 65%, transparent 100%);
      pointer-events: none; z-index: -1;
    }}
    
    a {{ color: inherit; text-decoration: none; }}
    button {{ font-family: inherit; }}
    .container {{ width: 100%; max-width: 1140px; margin: 0 auto; padding: 0 24px; }}
    
    /* NAV */
    nav {{
      position: sticky; top: 0; z-index: 80;
      background: rgba(7, 11, 18, 0.92);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      transition: background .2s;
    }}
    [data-theme="light"] nav {{
      background: rgba(248, 250, 252, 0.94);
    }}
    nav .container {{ display: flex; align-items: center; justify-content: space-between; height: 66px; }}
    
    /* SLEEK DEVELOPER WORDMARK (NO LOGO) */
    .brand {{
      display: inline-flex; align-items: center; gap: 11px;
      font-size: var(--step-body); font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
      transition: transform .15s var(--ease-out), opacity .15s;
    }}
    .brand:hover {{ opacity: 0.92; transform: translateY(-1px); }}
    .brand:active {{ transform: scale(0.97); }}
    .brand-terminal {{
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 8px;
      background: var(--surface-2);
      color: var(--accent); font-family: monospace; font-size: var(--step-sm); font-weight: 800;
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
    
    /* HERO */
    .hero {{
      padding: 64px 0 72px; position: relative; overflow: hidden;
    }}
    .hero::before {{
      content: ""; position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%);
      pointer-events: none; opacity: 0.85;
    }}
    
    .hero h1 {{
      font-size: var(--step-display); font-weight: 800;
      letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 20px;
      color: var(--ink); max-width: 960px;
    }}
    .hero p.lead {{
      font-size: var(--step-body); color: var(--ink-muted); max-width: 760px;
      margin-bottom: 34px; line-height: 1.65;
    }}
    
    /* HERO TELEMETRY CARDS */
    .hero-stats-bar {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px; margin: 34px 0 36px;
    }}
    .hero-stat-card {{
      position: relative; background: var(--surface-1); border-radius: var(--radius);
      border: 1px solid transparent;
      padding: 22px 24px; overflow: hidden;
      transition: transform .25s var(--ease-out), background .25s var(--ease-out), border-color .25s var(--ease-out);
    }}
    .hero-stat-card:hover {{
      transform: translateY(-4px); background: var(--surface-2); border-color: rgba(56, 189, 248, 0.3);
    }}
    .hero-stat-card strong {{
      display: block; font-size: var(--step-h2); font-weight: 800; color: var(--ink);
      font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; line-height: 1.15;
    }}
    .hero-stat-card strong span {{ color: var(--accent); }}
    .hero-stat-card p {{ font-size: var(--step-sm); color: var(--ink-muted); margin-top: 6px; }}
    
    .hero-highlights {{
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 34px;
      font-size: var(--step-sm); color: var(--ink-muted);
    }}
    .highlight-pill {{
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 15px; background: var(--surface-1); border-radius: 999px;
      border: 1px solid transparent;
      color: var(--ink); font-weight: 500; font-size: var(--step-sm);
      transition: background .15s, transform .15s var(--ease-out), color .15s, border-color .15s;
    }}
    .highlight-pill:hover {{
      background: var(--surface-2); color: var(--accent); transform: translateY(-2px); border-color: rgba(56, 189, 248, 0.25);
    }}
    .highlight-pill:active {{ transform: scale(0.97); }}
    
    .cta-row {{ display: flex; gap: 14px; flex-wrap: wrap; }}
    .btn {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 13px 26px; border-radius: var(--radius-sm); font-weight: 600;
      font-size: var(--step-body); cursor: pointer; text-decoration: none; border: none;
      transition: transform .18s var(--ease-out), background .18s;
    }}
    .btn-primary {{
      background: var(--accent); color: var(--accent-ink); font-weight: 700;
    }}
    .btn-primary:hover {{ background: #7dd3fc; transform: translateY(-2px); }}
    .btn-primary:active {{ transform: scale(0.97); }}
    .btn-ghost {{
      background: var(--surface-1); color: var(--ink);
    }}
    .btn-ghost:hover {{ background: var(--surface-2); transform: translateY(-2px); }}
    .btn-ghost:active {{ transform: scale(0.97); }}
    
    /* CATALOG SECTION */
    #proyectos {{ padding: 68px 0 92px; position: relative; }}
    .section-head {{ margin-bottom: 34px; }}
    .section-head h2 {{
      font-size: var(--step-h2); font-weight: 800; letter-spacing: -0.03em; color: var(--ink);
    }}
    .section-head p {{ color: var(--ink-muted); margin-top: 8px; max-width: 720px; }}
    
    /* CATALOG CONTROLS BAR */
    .catalog-bar {{
      background: var(--surface-1); border-radius: var(--radius);
      border: 1px solid transparent;
      padding: 18px 22px; margin-bottom: 38px;
      display: flex; flex-direction: column; gap: 16px;
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
      width: 100%; height: 46px; background: var(--surface-2); border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: var(--radius-sm); padding: 0 38px 0 44px; color: var(--ink);
      font-size: var(--step-body); font-family: inherit; outline: none;
      transition: background .15s, border-color .15s, box-shadow .15s;
    }}
    .catalog-search-input:focus {{
      background: var(--surface-3); border-color: rgba(56, 189, 248, 0.4);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
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
      background: var(--surface-2); border: 1px solid transparent; color: var(--ink-muted);
      font-size: var(--step-sm); font-weight: 600; cursor: pointer;
      transition: all .18s var(--ease-out);
    }}
    .view-btn:hover {{ color: var(--ink); background: var(--surface-3); border-color: rgba(255, 255, 255, 0.1); }}
    .view-btn.active {{
      background: var(--accent); color: var(--accent-ink); border-color: transparent;
    }}
    .view-btn:active {{ transform: scale(0.97); }}
    
    .catalog-filter-bar {{
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    }}
    .catalog-tabs {{ display: flex; gap: 8px; flex-wrap: wrap; }}
    .cat-pill {{
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 16px; border-radius: 999px;
      background: var(--surface-2); border: 1px solid transparent; color: var(--ink-muted);
      font-size: var(--step-sm); font-weight: 500; cursor: pointer;
      transition: all .18s var(--ease-out);
    }}
    .cat-pill:hover {{ color: var(--ink); background: var(--surface-3); transform: translateY(-1px); border-color: rgba(255, 255, 255, 0.1); }}
    .cat-pill.active {{
      background: var(--accent); color: var(--accent-ink); border-color: transparent;
      font-weight: 700;
    }}
    .cat-pill:active {{ transform: scale(0.97); }}
    .pill-count {{
      font-size: var(--step-sm); opacity: 0.85; padding: 1px 6px; border-radius: 6px;
      background: rgba(0, 0, 0, 0.2); font-weight: 700;
    }}
    .cat-pill.active .pill-count {{ background: rgba(0, 0, 0, 0.28); color: #fff; }}
    .catalog-status-text {{ font-size: var(--step-sm); color: var(--ink-muted); font-weight: 500; }}
    
    /* GRID CARDS (WITH INTERACTIVE MOUSE SPOTLIGHT) */
    .catalog-grid {{
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 26px;
    }}
    .card {{
      position: relative; background: var(--surface-1); border-radius: var(--radius);
      border: 1px solid transparent;
      overflow: hidden; display: flex; flex-direction: column;
      transition: transform .25s var(--ease-out), border-color .25s var(--ease-out), box-shadow .25s var(--ease-out);
    }}
    /* Emil Kowalski spotlight flashlight layer */
    .card::before {{
      content: ""; position: absolute; inset: 0;
      background: radial-gradient(380px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), rgba(56, 189, 248, 0.14), transparent 45%);
      pointer-events: none; opacity: 0; transition: opacity .25s var(--ease-out);
      z-index: 2;
    }}
    .card:hover::before {{ opacity: 1; }}
    .card:hover {{
      transform: translateY(-6px);
      border-color: rgba(56, 189, 248, 0.4);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 25px -8px rgba(56, 189, 248, 0.22);
    }}
    
    .card .preview {{
      height: 188px; position: relative; overflow: hidden; background: #000;
    }}
    .card .preview svg, .card .preview img {{
      width: 100%; height: 100%; display: block; object-fit: cover;
      transition: transform .5s var(--ease-out), filter .3s var(--ease-out);
    }}
    .card:hover .preview svg, .card:hover .preview img {{
      transform: scale(1.05);
      filter: brightness(1.06);
    }}
    
    .card .live {{
      position: absolute; top: 12px; right: 12px; z-index: 3;
      font-size: var(--step-sm); font-weight: 700; padding: 4px 11px; border-radius: 999px;
    }}
    .badge-demo {{ background: var(--accent-green); color: #042f1a; }}
    .badge-showcase {{ background: var(--accent-purple); color: #ffffff; }}
    
    .card-body {{ padding: 22px; display: flex; flex-direction: column; flex: 1; position: relative; z-index: 3; }}
    .card-header-row {{
      display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;
    }}
    .card .tag {{
      font-size: var(--step-sm); color: var(--accent); font-weight: 600;
    }}
    .cat-label {{
      font-size: var(--step-sm); color: var(--ink-muted);
    }}
    .card h3 {{
      font-size: var(--step-h3); font-weight: 700; margin: 6px 0 8px;
      letter-spacing: -0.02em; line-height: 1.3; color: var(--ink);
    }}
    .card p {{ color: var(--ink-muted); font-size: var(--step-body); line-height: 1.6; flex: 1; }}
    
    .card-metric-pill {{
      margin-top: 14px; padding: 8px 12px; border-radius: var(--radius-sm);
      background: var(--surface-2); font-size: var(--step-sm); color: var(--ink);
      font-weight: 500; display: flex; align-items: center; gap: 8px;
    }}
    .card-metric-pill .metric-dot {{
      width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green); flex: none;
    }}
    
    .stack {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }}
    .chip {{
      font-size: var(--step-sm); background: var(--surface-2); color: var(--ink-muted);
      padding: 4px 10px; border-radius: 6px; font-weight: 500;
      transition: background .15s, color .15s;
    }}
    .card:hover .chip {{ color: var(--ink); }}
    
    .card-actions {{
      display: flex; gap: 10px; margin-top: 20px;
    }}
    .btn-micro {{
      flex: 1; display: inline-flex; align-items: center; justify-content: center;
      padding: 9px 12px; border-radius: var(--radius-sm); font-size: var(--step-sm); font-weight: 600;
      transition: all .18s var(--ease-out); cursor: pointer; text-align: center; border: none;
    }}
    .btn-inspect {{
      background: var(--surface-2); color: var(--ink);
      border: 1px solid transparent;
    }}
    .btn-inspect:hover {{ background: var(--surface-3); border-color: rgba(255, 255, 255, 0.15); }}
    .btn-inspect:active {{ transform: scale(0.97); }}
    .btn-action {{
      background: var(--accent); color: var(--accent-ink); font-weight: 700;
      border: 1px solid transparent;
    }}
    .btn-action:hover {{ background: #7dd3fc; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.4); }}
    .btn-action:active {{ transform: scale(0.97); }}
    
    /* INDEX VIEW (COMPACT TABLE) */
    .catalog-index-wrap {{
      display: none; width: 100%; border-radius: var(--radius);
      overflow-x: auto; background: var(--surface-1); border: 1px solid transparent;
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
    
    /* NO RESULTS */
    .catalog-empty-msg {{
      display: none; padding: 64px 24px; text-align: center;
      background: var(--surface-1); border-radius: var(--radius);
      border: 1px solid transparent;
    }}
    .catalog-empty-msg p {{ color: var(--ink-muted); font-size: var(--step-body); margin-bottom: 20px; }}
    
    /* MODAL (FICHA TÉCNICA QUICK PREVIEW) */
    .catalog-modal {{
      position: fixed; inset: 0; z-index: 100;
      display: none; align-items: center; justify-content: center; padding: 20px;
    }}
    .catalog-modal.open {{ display: flex; }}
    .modal-backdrop {{
      position: absolute; inset: 0; background: rgba(7, 11, 18, 0.82);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    }}
    .modal-panel {{
      position: relative; z-index: 2; width: 100%; max-width: 740px;
      background: var(--surface-1); border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 22px; overflow: hidden;
      transform: scale(0.95); opacity: 0;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px -10px rgba(56, 189, 248, 0.2);
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
      padding: 12px 16px; border-radius: var(--radius-sm); background: var(--surface-2);
      border: 1px solid transparent;
      color: var(--accent); font-weight: 600; font-size: var(--step-sm); margin-bottom: 20px;
    }}
    .modal-stack-label {{ font-size: var(--step-sm); color: var(--ink-muted); font-weight: 600; margin-bottom: 8px; }}
    .modal-foot-actions {{
      display: flex; gap: 12px; margin-top: 26px; flex-wrap: wrap;
    }}
    .modal-foot-actions a, .modal-foot-actions button {{
      padding: 13px 22px; border-radius: var(--radius-sm); font-size: var(--step-body); font-weight: 600;
      display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: none;
    }}
    
    /* FLOATING QUICK JUMP DOCK */
    .quick-jump-dock {{
      position: fixed; bottom: 26px; right: 26px; z-index: 70;
      display: flex; flex-direction: column; gap: 10px; align-items: flex-end;
    }}
    .dock-pill {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 18px; border-radius: 999px; font-size: var(--step-sm); font-weight: 600;
      background: var(--surface-2);
      color: var(--ink); border: 1px solid transparent;
      cursor: pointer; transition: transform .18s var(--ease-out), background .18s, border-color .18s, box-shadow .18s;
    }}
    .dock-pill:hover {{
      background: var(--accent); color: var(--accent-ink);
      border-color: transparent; transform: translateY(-2px);
      box-shadow: 0 12px 28px -5px rgba(56, 189, 248, 0.4);
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
      background: var(--bg); border: 1px solid transparent; border-radius: var(--radius);
      padding: 24px; transition: transform .2s var(--ease-out), border-color .2s;
    }}
    .skill-card:nth-child(1), .skill-card:nth-child(2) {{ grid-column: span 2; }}
    .skill-card:hover {{ transform: translateY(-3px); border-color: rgba(56, 189, 248, 0.3); }}
    .skill-card h3 {{ font-size: var(--step-h3); font-weight: 700; margin-bottom: 8px; color: var(--ink); }}
    .skill-card p {{ color: var(--ink-muted); font-size: var(--step-body); line-height: 1.55; margin-bottom: 14px; }}
    
    /* CONTACT */
    #contacto {{ padding: 88px 0 96px; }}
    .contact-box {{
      background: var(--surface-1); border: 1px solid transparent;
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
    
    /* ANIMATIONS & CHOREOGRAPHY (Emil Kowalski Philosophy) */
    @keyframes heroEntrance {{
      from {{ opacity: 0; transform: translateY(16px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    @keyframes cardPop {{
      from {{ opacity: 0; transform: translateY(14px) scale(0.97); }}
      to {{ opacity: 1; transform: translateY(0) scale(1); }}
    }}
    
    .hero-box {{ animation: heroEntrance 0.5s var(--ease-out) both; }}
    .hero-stat-card:nth-child(1) {{ animation: heroEntrance 0.5s var(--ease-out) 0.05s both; }}
    .hero-stat-card:nth-child(2) {{ animation: heroEntrance 0.5s var(--ease-out) 0.10s both; }}
    .hero-stat-card:nth-child(3) {{ animation: heroEntrance 0.5s var(--ease-out) 0.15s both; }}
    .hero-stat-card:nth-child(4) {{ animation: heroEntrance 0.5s var(--ease-out) 0.20s both; }}
    .catalog-bar {{ animation: heroEntrance 0.5s var(--ease-out) 0.25s both; }}
    .cat-pill:nth-child(1) {{ animation: heroEntrance 0.4s var(--ease-out) 0.30s both; }}
    .cat-pill:nth-child(2) {{ animation: heroEntrance 0.4s var(--ease-out) 0.34s both; }}
    .cat-pill:nth-child(3) {{ animation: heroEntrance 0.4s var(--ease-out) 0.38s both; }}
    .cat-pill:nth-child(4) {{ animation: heroEntrance 0.4s var(--ease-out) 0.42s both; }}
    .cat-pill:nth-child(5) {{ animation: heroEntrance 0.4s var(--ease-out) 0.46s both; }}
    .cat-pill:nth-child(6) {{ animation: heroEntrance 0.4s var(--ease-out) 0.50s both; }}
    .catalog-grid .card:nth-child(1) {{ animation: heroEntrance 0.45s var(--ease-out) 0.08s both; }}
    .catalog-grid .card:nth-child(2) {{ animation: heroEntrance 0.45s var(--ease-out) 0.14s both; }}
    .catalog-grid .card:nth-child(3) {{ animation: heroEntrance 0.45s var(--ease-out) 0.20s both; }}
    .catalog-grid .card:nth-child(4) {{ animation: heroEntrance 0.45s var(--ease-out) 0.26s both; }}
    .catalog-grid .card:nth-child(5) {{ animation: heroEntrance 0.45s var(--ease-out) 0.32s both; }}
    .catalog-grid .card:nth-child(6) {{ animation: heroEntrance 0.45s var(--ease-out) 0.38s both; }}
    .catalog-grid .card:nth-child(7) {{ animation: heroEntrance 0.45s var(--ease-out) 0.44s both; }}
    .catalog-grid .card:nth-child(8) {{ animation: heroEntrance 0.45s var(--ease-out) 0.50s both; }}

    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }}
    }}

    /* RESPONSIVE */
    @media (max-width: 768px) {{
      nav .nav-links {{ gap: 12px; font-size: var(--step-sm); white-space: nowrap; }}
      nav .nav-links a {{ white-space: nowrap; }}
      nav .nav-links a[href="#skills"], nav .nav-links a[href="#contacto"] {{ display: none; }}
      .brand {{ gap: 7px; }}
      .brand-last {{ display: none; }}
      .hero {{ padding: 42px 0 48px; }}
      .hero-stats-bar {{ grid-template-columns: 1fr 1fr; }}
      .catalog-bar {{ padding: 14px 16px; }}
      .catalog-top-row {{ flex-direction: column; align-items: stretch; }}
      .catalog-views {{ justify-content: flex-end; }}
      .quick-jump-dock {{ bottom: 16px; right: 16px; }}
      .dock-pill {{ padding: 9px 15px; font-size: var(--step-sm); }}
      .contact-box {{ padding: 42px 20px; }}
      .skill-card:nth-child(1), .skill-card:nth-child(2) {{ grid-column: span 1; }}
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
    <div class="container hero-box">
      <h1>{i18n['hero_h1']}</h1>
      <p class="lead">{i18n['hero_lead']}</p>
      
      <!-- STATS TELEMETRY BAR -->
      <div class="hero-stats-bar">
        <div class="hero-stat-card">
          <strong>21 <span>+</span></strong>
          <p>{i18n['stat_projects_desc']}</p>
        </div>
        <div class="hero-stat-card">
          <strong>17 <span>●</span></strong>
          <p>{i18n['stat_demos_desc']}</p>
        </div>
        <div class="hero-stat-card">
          <strong>4 GB <span>VRAM</span></strong>
          <p>{i18n['stat_ia_desc']}</p>
        </div>
        <div class="hero-stat-card">
          <strong>100% <span>OK</span></strong>
          <p>{i18n['stat_code_desc']}</p>
        </div>
      </div>

      <!-- QUICK ACCESS HIGHLIGHTS -->
      <div class="hero-highlights">
        <span>{i18n['quick_highlights']}</span>
        <a class="highlight-pill" href="#proyectos" onclick="filterBySlug('juego-construccion')">Obra Maestra MN</a>
        <a class="highlight-pill" href="#proyectos" onclick="filterBySlug('web-studio')">Web Studio (IA)</a>
        <a class="highlight-pill" href="#proyectos" onclick="filterBySlug('ruta-clara')">Ruta Clara</a>
        <a class="highlight-pill" href="#proyectos" onclick="filterBySlug('inferencia')">Inferencia 4GB</a>
      </div>

      <div class="cta-row">
        <a class="btn btn-primary" href="#proyectos">{i18n['btn_explore_catalog']}</a>
        <a class="btn btn-ghost" href="#contacto">{i18n['btn_contact']}</a>
      </div>
    </div>
  </header>

  <!-- CATALOG SHOWROOM -->
  <section id="proyectos">
    <div class="container">
      <div class="section-head">
        <h2>{i18n['catalog_title']}</h2>
        <p>{i18n['catalog_desc']}</p>
      </div>

      <!-- CONTROLS: SEARCH + CATEGORIES + VIEW TOGGLE -->
      <div class="catalog-bar">
        <div class="catalog-top-row">
          <div class="catalog-search-wrap">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="catalogSearch" class="catalog-search-input" placeholder="{i18n['search_placeholder']}" aria-label="Buscar en el catálogo" />
            <button type="button" id="catalogSearchClear" class="catalog-search-clear" aria-label="Limpiar búsqueda">✕</button>
          </div>

          <div class="catalog-views" role="radiogroup" aria-label="Modo de visualización">
            <button type="button" class="view-btn active" data-view="grid" aria-checked="true" role="radio" title="Ver como tarjetas visuales">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              <span>{i18n['view_grid']}</span>
            </button>
            <button type="button" class="view-btn" data-view="index" aria-checked="false" role="radio" title="Ver índice compacto sin scroll">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              <span>{i18n['view_index']}</span>
            </button>
          </div>
        </div>

        <div class="catalog-filter-bar">
          <div class="catalog-tabs" role="tablist">
            <button type="button" class="cat-pill active" data-filter="all">
              <span>{i18n['tab_all']}</span>
              <span class="pill-count" id="count-all">21</span>
            </button>
            <button type="button" class="cat-pill" data-filter="demos">
              <span>{i18n['tab_demos']}</span>
              <span class="pill-count" id="count-demos">17</span>
            </button>
            <button type="button" class="cat-pill" data-filter="ia">
              <span>IA &amp; ML</span>
              <span class="pill-count" id="count-ia">6</span>
            </button>
            <button type="button" class="cat-pill" data-filter="web">
              <span>Web &amp; ERP</span>
              <span class="pill-count" id="count-web">5</span>
            </button>
            <button type="button" class="cat-pill" data-filter="hardware">
              <span>3D &amp; Juegos</span>
              <span class="pill-count" id="count-hardware">5</span>
            </button>
            <button type="button" class="cat-pill" data-filter="auto">
              <span>Automatización &amp; BI</span>
              <span class="pill-count" id="count-auto">5</span>
            </button>
          </div>

          <div class="catalog-status-text" id="catalogCountText" aria-live="polite">
            {i18n['showing_text']} <strong id="catalogVisibleCount">21</strong> {i18n['of_text']}
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
        <h2>Lo que uso para construir</h2>
        <p>Herramientas y tecnologías que domino para llevar productos desde la concepción hasta el despliegue en producción.</p>
      </div>
      <div class="skills-grid">
        <div class="skill-card">
          <h3>Frontend y PWAs</h3>
          <p>React, TypeScript, JavaScript moderno, Tailwind CSS, Service Workers, aplicaciones offline-first, Three.js y WebGL.</p>
          <div class="stack"><span class="chip">React</span><span class="chip">TypeScript</span><span class="chip">PWA</span><span class="chip">WebGL</span></div>
        </div>
        <div class="skill-card">
          <h3>Backend y APIs</h3>
          <p>Python, FastAPI, Node.js, Express, diseño de APIs RESTful, webhooks en tiempo real y microservicios orientados a eventos.</p>
          <div class="stack"><span class="chip">FastAPI</span><span class="chip">Node.js</span><span class="chip">Python</span><span class="chip">REST</span></div>
        </div>
        <div class="skill-card">
          <h3>Bases de Datos &amp; Cache</h3>
          <p>PostgreSQL, Firebase Firestore, SQL Server, Redis, consultas optimizadas, ORMs y migraciones automáticas.</p>
          <div class="stack"><span class="chip">PostgreSQL</span><span class="chip">Firebase</span><span class="chip">Redis</span></div>
        </div>
        <div class="skill-card">
          <h3>Inteligencia Artificial y ML</h3>
          <p>Integración de LLMs (OpenAI, Claude), agentes autónomos, frameworks de inferencia local en GPU (vLLM, Ollama), INT4/GPTQ y computer vision con OpenCV.</p>
          <div class="stack"><span class="chip">PyTorch</span><span class="chip">OpenCV</span><span class="chip">HuggingFace</span><span class="chip">INT4 GPTQ</span></div>
        </div>
        <div class="skill-card">
          <h3>Automatización y BI</h3>
          <p>WhatsApp Business API oficial, dashboards interactivos, pipelines de extracción de datos, sincronización con ERPs (Dynamics 365) y bots 24/7.</p>
          <div class="stack"><span class="chip">WhatsApp API</span><span class="chip">BI</span><span class="chip">Dynamics 365</span></div>
        </div>
        <div class="skill-card">
          <h3>3D, Videojuegos y WebGL</h3>
          <p>Desarrollo con Unity en C#, compilación a WebAssembly/WebGL, shaders GLSL, Three.js para entornos inmersivos y modelado interactivo.</p>
          <div class="stack"><span class="chip">Unity</span><span class="chip">C#</span><span class="chip">Three.js</span><span class="chip">GLSL</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTACT SECTION -->
  <section id="contacto">
    <div class="container">
      <div class="contact-box">
        <h2>¿Tienes una idea en mente?</h2>
        <p>Hablemos sobre cómo construir o escalar tu próximo sistema, plataforma web o solución de IA.</p>
        <div class="contact-links-grid">
          <a class="btn btn-primary" href="https://wa.me/528336817886?text=Hola%20Emilio%2C%20vi%20tu%20cat%C3%A1logo%20y%20me%20gustar%C3%ADa%20platicar%20sobre%20un%20proyecto." target="_blank" rel="noopener">Escríbeme por WhatsApp</a>
          <a class="btn btn-ghost" href="{root_prefix}cv/">CV Interactivo</a>
          <a class="btn btn-ghost" href="{root_prefix}cv/Emilio-Fonseca-CV-ES.pdf" download>Descargar CV (PDF)</a>
          <a class="btn btn-ghost" href="https://www.linkedin.com/in/emilio-fonseca65" target="_blank" rel="noopener">LinkedIn</a>
          <a class="btn btn-ghost" href="https://github.com/EmilioUgarte65" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="contact-meta-row">
          <a href="mailto:emilio656565@outlook.com">emilio656565@outlook.com</a>
          <span>·</span>
          <span>Tampico, Tamps., México</span>
          <span>·</span>
          <span>Disponible para trabajo remoto</span>
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

    // EMIL KOWALSKI SPOTLIGHT EFFECT (Flashlight hover following mouse on cards)
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
          void card.offsetWidth; /* trigger reflow */
          card.style.animation = 'cardPop 0.35s var(--ease-out) ' + delay + 's both';
          delay = Math.min(delay + 0.03, 0.25);
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

    function filterBySlug(slug) {{
      if (searchInput) {{
        searchInput.value = slug;
        activeSearch = slug;
        if (searchClear) searchClear.style.display = 'block';
      }}
      applyCatalogFilters();
      var target = document.querySelector('.card[data-slug="' + slug + '"]');
      if (target) {{
        target.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
      }}
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
