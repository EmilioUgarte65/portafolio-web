import os
import re
import json
from generate_catalog_html import SLUG_ORDER, PROJECT_META, lookup_es, lookup_en

BASE_URL = "https://emiliougarte65.github.io/portafolio-web"

DEMO_SLUGS = [
    "distrito", "lumen", "marquesina", "mundial", "myaccountant",
    "nexo", "nucleo", "ourway", "pulso", "radar",
    "ruta-clara", "totem", "vertice", "vitrina", "web-studio"
]

def strip_previous_injection(html_text):
    return re.sub(
        r"\s*<!-- SEO-GEO-AEO-START -->.*?<!-- SEO-GEO-AEO-END -->\s*",
        "\n",
        html_text,
        flags=re.DOTALL
    )

def inject_before_head_close(html_text, block):
    cleaned = strip_previous_injection(html_text)
    wrapped = f"\n  <!-- SEO-GEO-AEO-START -->\n{block}\n  <!-- SEO-GEO-AEO-END -->\n</head>"
    if "</head>" in cleaned:
        return cleaned.replace("</head>", wrapped, 1)
    elif "</HEAD>" in cleaned:
        return cleaned.replace("</HEAD>", wrapped, 1)
    return cleaned

def build_showcase_seo_block(slug, lang, card, meta):
    is_es = (lang == "es")
    es_url = f"{BASE_URL}/proyectos/{slug}/"
    en_url = f"{BASE_URL}/en/projects/{slug}/"
    canonical_url = es_url if is_es else en_url
    title_clean = card["title"]
    desc_clean = card["description"]
    cat_name = meta["cat_name_es"] if is_es else meta["cat_name_en"]
    stack_str = ", ".join(meta["stack"])
    preview_img = f"{BASE_URL}/assets/previews/{slug}.jpg"
    if not os.path.exists(os.path.join("assets", "previews", f"{slug}.jpg")):
        preview_img = f"{BASE_URL}/og-cover.png"

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Emilio Fonseca · Portafolio" if is_es else "Emilio Fonseca · Portfolio",
                        "item": f"{BASE_URL}/" if is_es else f"{BASE_URL}/en/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": title_clean,
                        "item": canonical_url
                    }
                ]
            },
            {
                "@type": "SoftwareApplication",
                "@id": f"{canonical_url}#software",
                "name": title_clean,
                "description": desc_clean,
                "url": canonical_url,
                "image": preview_img,
                "applicationCategory": cat_name,
                "operatingSystem": "Web Browser, WebGL, PWA, Cross-platform",
                "inLanguage": "es-MX" if is_es else "en-US",
                "keywords": f"{stack_str}, Emilio Fonseca, Tampico, Tamaulipas, México",
                "author": {
                    "@type": "Person",
                    "@id": f"{BASE_URL}/#person",
                    "name": "Emilio Fonseca",
                    "jobTitle": "Full-Stack Developer & AI Engineer",
                    "url": f"{BASE_URL}/",
                    "telephone": "+528336817886",
                    "email": "emilio656565@outlook.com",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Tampico",
                        "addressRegion": "Tamaulipas",
                        "addressCountry": "MX"
                    }
                }
            }
        ]
    }
    json_ld = json.dumps(graph, ensure_ascii=False, indent=2)

    return f'''  <meta name="author" content="Emilio Fonseca" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{canonical_url}" />
  <link rel="alternate" hreflang="es" href="{es_url}" />
  <link rel="alternate" hreflang="en" href="{en_url}" />
  <link rel="alternate" hreflang="x-default" href="{es_url}" />
  <link rel="author" type="text/plain" href="{BASE_URL}/humans.txt" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms.txt" title="LLM-readable summary" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms-full.txt" title="LLM-readable full knowledge base" />
  <meta name="ai-agent-instructions" content="Project built by Emilio Fonseca (Full-Stack &amp; AI Engineer in Tampico, Tamaulipas, Mexico). Consult {BASE_URL}/llms-full.txt for complete architecture, benchmarks, and direct contact (+52 833 681 7886 / emilio656565@outlook.com)." />
  <meta name="geo.region" content="MX-TAM" />
  <meta name="geo.placename" content="Tampico, Tamaulipas" />
  <meta name="geo.position" content="22.2558;-97.8686" />
  <meta name="ICBM" content="22.2558, -97.8686" />
  <meta name="keywords" content="{title_clean}, {stack_str}, Emilio Fonseca, Tampico, Tamaulipas, Monterrey, México, Desarrollador Full-Stack, IA" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Emilio Fonseca — Portfolio" />
  <meta property="og:title" content="{title_clean} · Emilio Fonseca" />
  <meta property="og:description" content="{desc_clean}" />
  <meta property="og:url" content="{canonical_url}" />
  <meta property="og:image" content="{preview_img}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title_clean} · Emilio Fonseca" />
  <meta name="twitter:description" content="{desc_clean}" />
  <meta name="twitter:image" content="{preview_img}" />
  <script type="application/ld+json">
{json_ld}
  </script>'''

def build_demo_seo_block(slug, card, meta):
    demo_url = f"{BASE_URL}/demos/{slug}/"
    showcase_es_url = f"{BASE_URL}/proyectos/{slug}/"
    title_clean = card["title"]
    desc_clean = card["description"]
    cat_name = meta["cat_name_es"]
    stack_str = ", ".join(meta["stack"])
    preview_img = f"{BASE_URL}/assets/previews/{slug}.jpg"
    if not os.path.exists(os.path.join("assets", "previews", f"{slug}.jpg")):
        preview_img = f"{BASE_URL}/og-cover.png"

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Emilio Fonseca · Portafolio",
                        "item": f"{BASE_URL}/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": title_clean,
                        "item": showcase_es_url
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": f"{title_clean} (Demo Interactiva)",
                        "item": demo_url
                    }
                ]
            },
            {
                "@type": "WebApplication",
                "@id": f"{demo_url}#webapp",
                "name": f"{title_clean} — Demo en Vivo · Emilio Fonseca",
                "description": desc_clean,
                "url": demo_url,
                "image": preview_img,
                "applicationCategory": cat_name,
                "operatingSystem": "Web Browser, PWA",
                "inLanguage": ["es-MX", "en-US"],
                "keywords": f"{stack_str}, Emilio Fonseca, Demo en vivo, Tampico, Tamaulipas, México",
                "author": {
                    "@type": "Person",
                    "@id": f"{BASE_URL}/#person",
                    "name": "Emilio Fonseca",
                    "url": f"{BASE_URL}/",
                    "telephone": "+528336817886",
                    "email": "emilio656565@outlook.com"
                }
            }
        ]
    }
    json_ld = json.dumps(graph, ensure_ascii=False, indent=2)

    return f'''  <meta name="description" content="{desc_clean} — Demo interactiva desarrollada por Emilio Fonseca (Ingeniero Full-Stack e IA en Tampico, Tamaulipas, México)." />
  <meta name="author" content="Emilio Fonseca" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="{demo_url}" />
  <link rel="author" type="text/plain" href="{BASE_URL}/humans.txt" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms.txt" title="LLM-readable summary" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms-full.txt" title="LLM-readable full knowledge base" />
  <meta name="ai-agent-instructions" content="Interactive web application demo built by Emilio Fonseca. Consult {BASE_URL}/llms-full.txt for full technical specifications and hiring details (+52 833 681 7886)." />
  <meta name="geo.region" content="MX-TAM" />
  <meta name="geo.placename" content="Tampico, Tamaulipas" />
  <meta name="geo.position" content="22.2558;-97.8686" />
  <meta name="ICBM" content="22.2558, -97.8686" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{title_clean} (Demo en vivo) · Emilio Fonseca" />
  <meta property="og:description" content="{desc_clean}" />
  <meta property="og:url" content="{demo_url}" />
  <meta property="og:image" content="{preview_img}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title_clean} (Demo en vivo) · Emilio Fonseca" />
  <meta name="twitter:description" content="{desc_clean}" />
  <meta name="twitter:image" content="{preview_img}" />
  <script type="application/ld+json">
{json_ld}
  </script>'''

def update_cv_pages():
    # Update cv/index.html and cv/en/index.html
    for lang, rel_path in [("es", os.path.join("cv", "index.html")), ("en", os.path.join("cv", "en", "index.html"))]:
        is_es = (lang == "es")
        with open(rel_path, "r", encoding="utf-8") as f:
            html = f.read()

        # Fix phone number
        html = html.replace("+52 833 127 3591", "+52 833 681 7886")
        html = html.replace(
            "Tamaulipas, México · +52 833 681 7886",
            "Tampico, Tamaulipas, México · <a href=\"https://wa.me/528336817886\" target=\"_blank\" rel=\"noopener\">+52 833 681 7886 (WhatsApp)</a>"
        )

        # Expand projects list in CV if only 4 projects
        if is_es:
            old_proj_sec = '<section><h2>Proyectos</h2><h3><a href="../proyectos/web-studio/">Web Studio →</a></h3><p>Un editor de video que convierte instrucciones en planes de edición y una línea de tiempo editable.</p><h3><a href="../proyectos/nexo/">Nexo →</a></h3><p>Asistentes y una bandeja compartida que conectan conversación, herramientas y gestión de clientes.</p><h3><a href="../proyectos/vertice/">Vértice →</a></h3><p>Gestión de proyectos, presupuestos y solicitudes de pago en una aplicación full-stack.</p><h3><a href="../proyectos/dexter/">Dexter →</a></h3><p>Un ecosistema extensible de herramientas, memoria y enrutamiento para agentes de IA.</p></section>'
            new_proj_sec = (
                '<section><h2>Proyectos Destacados (22 en Producción)</h2>'
                '<h3><a href="../proyectos/juego-construccion/">Obra Maestra MN (Unity WebGL &amp; Físicas) →</a></h3><p>Videojuego 2D con motor de físicas personalizado compilado a WebAssembly para ejecución instantánea en el navegador.</p>'
                '<h3><a href="../proyectos/inferencia/">Inferencia LLM en 4 GB VRAM (CUDA / INT4 GPTQ) →</a></h3><p>Ejecución de modelos de 7B parámetros a 23.4 tokens/seg en GPUs de consumo mediante cuantización INT4 GPTQ y adaptadores low-rank.</p>'
                '<h3><a href="../proyectos/cora/">CORA (IA Conversacional &amp; RAG Vectorial) →</a></h3><p>Asistente omnicanal para atención al cliente e integración con WhatsApp Business API, voz e imagen.</p>'
                '<h3><a href="../proyectos/web-studio/">Web Studio (Suite Multimedia WebGL) →</a></h3><p>Editor de video multipista en el navegador acelerado por Canvas WebGL con flujos asistidos por IA generativa.</p>'
                '<h3><a href="../proyectos/myaccountant/">MyAccountant (Finanzas PWA Offline-First) →</a></h3><p>Sistema contable 100% privado sin nube con almacenamiento local cifrado en IndexedDB y balances automatizados.</p>'
                '<h3><a href="../proyectos/dexter/">Dexter (Ecosistema Multi-Agente IA) →</a></h3><p>Arquitectura extensible de memoria, enrutamiento y más de 44 habilidades para agentes autónomos.</p>'
                '<h3><a href="../proyectos/mundial/">Predictor Mundial 2026 (XGBoost &amp; Monte Carlo) →</a></h3><p>Motor probabilístico con más de 50,000 partidos históricos, ratings Elo y simulaciones estocásticas.</p>'
                '<h3><a href="../proyectos/nucleo/">Núcleo ERP / Vértice / Nexo →</a></h3><p>Plataformas empresariales full-stack para inventarios, presupuestos de obra en campo y atención multicanal.</p>'
                '</section>'
            )
            html = html.replace(old_proj_sec, new_proj_sec)
        else:
            old_proj_sec_en = '<section><h2>Projects</h2><h3><a href="../../en/projects/web-studio/">Web Studio →</a></h3><p>A video editor that turns instructions into structured editing plans and an editable timeline.</p><h3><a href="../../en/projects/nexo/">Nexo →</a></h3><p>Assistants and a shared inbox connecting conversations, tools and customer management.</p><h3><a href="../../en/projects/vertice/">Vértice →</a></h3><p>Projects, budgets and payment requests in a full-stack application.</p><h3><a href="../../en/projects/dexter/">Dexter →</a></h3><p>An extensible ecosystem of tools, memory and routing for AI agents.</p></section>'
            new_proj_sec_en = (
                '<section><h2>Selected Flagship Projects (22 in Production)</h2>'
                '<h3><a href="../../en/projects/juego-construccion/">Obra Maestra MN (Unity WebGL &amp; Physics) →</a></h3><p>2D physics game compiled to WebAssembly for instant in-browser execution with custom material simulation.</p>'
                '<h3><a href="../../en/projects/inferencia/">LLM Inference on 4 GB VRAM (CUDA / INT4 GPTQ) →</a></h3><p>Running 7B parameter LLMs at 23.4 tokens/sec on consumer GPUs via INT4 GPTQ quantization and low-rank adapters.</p>'
                '<h3><a href="../../en/projects/cora/">CORA (Conversational AI &amp; Vector RAG) →</a></h3><p>Omnichannel customer support assistant with official WhatsApp Business API, audio transcription, and vision.</p>'
                '<h3><a href="../../en/projects/web-studio/">Web Studio (WebGL Multimedia Suite) →</a></h3><p>In-browser multitrack video editor and compositor accelerated by Canvas WebGL with generative AI workflows.</p>'
                '<h3><a href="../../en/projects/myaccountant/">MyAccountant (Offline-First Financial PWA) →</a></h3><p>Zero-cloud private accounting system with encrypted local storage in IndexedDB and automated monthly balance sheets.</p>'
                '<h3><a href="../../en/projects/dexter/">Dexter (Multi-Agent AI Ecosystem) →</a></h3><p>Extensible memory, routing, and 44+ skill orchestration platform for autonomous AI agents.</p>'
                '<h3><a href="../../en/projects/mundial/">World Cup 2026 Predictor (XGBoost &amp; Monte Carlo) →</a></h3><p>Probabilistic forecasting engine backed by 50,000+ historical matches, Elo ratings, and Monte Carlo simulations.</p>'
                '<h3><a href="../../en/projects/nucleo/">Núcleo ERP / Vértice / Nexo →</a></h3><p>Production full-stack enterprise platforms for inventory control, field construction budgets, and shared inboxes.</p>'
                '</section>'
            )
            html = html.replace(old_proj_sec_en, new_proj_sec_en)

        cv_es_url = f"{BASE_URL}/cv/"
        cv_en_url = f"{BASE_URL}/cv/en/"
        canonical_url = cv_es_url if is_es else cv_en_url

        cv_graph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "ProfilePage",
                    "@id": f"{canonical_url}#cvpage",
                    "url": canonical_url,
                    "name": "Currículum Vitae (CV) · Emilio Fonseca" if is_es else "Interactive Resume (CV) · Emilio Fonseca",
                    "mainEntity": {
                        "@type": "Person",
                        "@id": f"{BASE_URL}/#person",
                        "name": "Emilio Fonseca",
                        "jobTitle": "Ingeniero de IA y Desarrollador Full-Stack" if is_es else "AI & Full-Stack Software Engineer",
                        "url": f"{BASE_URL}/",
                        "telephone": "+528336817886",
                        "email": "emilio656565@outlook.com",
                        "address": {
                            "@type": "PostalAddress",
                            "addressLocality": "Tampico",
                            "addressRegion": "Tamaulipas",
                            "addressCountry": "MX"
                        },
                        "alumniOf": {
                            "@type": "CollegeOrUniversity",
                            "name": "Universidad Autónoma de Tamaulipas"
                        },
                        "sameAs": [
                            "https://github.com/EmilioUgarte65",
                            "https://www.linkedin.com/in/emilio-fonseca65"
                        ]
                    }
                }
            ]
        }
        cv_json_ld = json.dumps(cv_graph, ensure_ascii=False, indent=2)

        cv_seo_block = f'''  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="alternate" hreflang="es" href="{cv_es_url}" />
  <link rel="alternate" hreflang="en" href="{cv_en_url}" />
  <link rel="alternate" hreflang="x-default" href="{cv_es_url}" />
  <link rel="author" type="text/plain" href="{BASE_URL}/humans.txt" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms.txt" title="LLM-readable summary" />
  <link rel="alternate" type="text/markdown" href="{BASE_URL}/llms-full.txt" title="LLM-readable full knowledge base" />
  <meta name="ai-agent-instructions" content="Official Resume (CV) of Emilio Fonseca, Full-Stack &amp; AI Engineer based in Tampico, Tamaulipas, Mexico. Contact: +52 833 681 7886, emilio656565@outlook.com. Full dossier: {BASE_URL}/llms-full.txt" />
  <meta name="geo.region" content="MX-TAM" />
  <meta name="geo.placename" content="Tampico, Tamaulipas" />
  <meta name="geo.position" content="22.2558;-97.8686" />
  <meta name="ICBM" content="22.2558, -97.8686" />
  <script type="application/ld+json">
{cv_json_ld}
  </script>'''

        html = inject_before_head_close(html, cv_seo_block)
        with open(rel_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Updated CV page: {rel_path}")

def main():
    # 1. Update CV pages
    update_cv_pages()

    # 2. Update all 22 ES and 22 EN showcase pages
    showcase_count = 0
    for slug in SLUG_ORDER:
        meta = PROJECT_META[slug]
        # ES showcase
        es_path = os.path.join("proyectos", slug, "index.html")
        if os.path.exists(es_path):
            with open(es_path, "r", encoding="utf-8") as f:
                html = f.read()
            block = build_showcase_seo_block(slug, "es", lookup_es[slug], meta)
            html = inject_before_head_close(html, block)
            with open(es_path, "w", encoding="utf-8") as f:
                f.write(html)
            showcase_count += 1

        # EN showcase
        en_path = os.path.join("en", "projects", slug, "index.html")
        if os.path.exists(en_path):
            with open(en_path, "r", encoding="utf-8") as f:
                html = f.read()
            block = build_showcase_seo_block(slug, "en", lookup_en[slug], meta)
            html = inject_before_head_close(html, block)
            with open(en_path, "w", encoding="utf-8") as f:
                f.write(html)
            showcase_count += 1

    print(f"Updated {showcase_count} showcase pages (ES & EN).")

    # 3. Update all 15 live demo pages
    demo_count = 0
    for slug in DEMO_SLUGS:
        demo_path = os.path.join("demos", slug, "index.html")
        if os.path.exists(demo_path):
            with open(demo_path, "r", encoding="utf-8") as f:
                html = f.read()
            block = build_demo_seo_block(slug, lookup_es[slug], PROJECT_META[slug])
            html = inject_before_head_close(html, block)
            with open(demo_path, "w", encoding="utf-8") as f:
                f.write(html)
            demo_count += 1

    print(f"Updated {demo_count} interactive demo pages.")

    # 4. Regenerate complete sitemap.xml with all 66 public URLs
    urls = [
        f"{BASE_URL}/",
        f"{BASE_URL}/en/",
        f"{BASE_URL}/llms.txt",
        f"{BASE_URL}/llms-full.txt",
        f"{BASE_URL}/humans.txt",
        f"{BASE_URL}/cv/",
        f"{BASE_URL}/cv/en/",
    ]
    for slug in sorted(SLUG_ORDER):
        urls.append(f"{BASE_URL}/proyectos/{slug}/")
    for slug in sorted(SLUG_ORDER):
        urls.append(f"{BASE_URL}/en/projects/{slug}/")
    for slug in sorted(DEMO_SLUGS):
        urls.append(f"{BASE_URL}/demos/{slug}/")

    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for u in urls:
        sitemap_lines.append(f'<url><loc>{u}</loc></url>')
    sitemap_lines.append('</urlset>\n')

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(sitemap_lines))
    print(f"Updated sitemap.xml with {len(urls)} total URLs.")

if __name__ == "__main__":
    main()
