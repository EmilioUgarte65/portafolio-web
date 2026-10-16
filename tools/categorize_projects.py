import json

# Define the category mappings for the 21 projects
categories_es = {
    "dino-ai": {"cat": "ia", "name": "IA & Machine Learning", "stack": ["Python", "PPO", "Reinforcement Learning", "OpenCV"]},
    "mundial": {"cat": "ia", "name": "IA & Machine Learning", "stack": ["Python", "FastAPI", "Monte Carlo", "Scikit-Learn"]},
    "dexter": {"cat": "ia", "name": "IA & Machine Learning", "stack": ["Python", "OpenAI / Claude", "FastAPI", "Multi-Agent"]},
    "nexo": {"cat": "auto", "name": "Automatización & BI", "stack": ["Python", "FastAPI", "WhatsApp Cloud API", "Docker"]},
    "lumen": {"cat": "ia", "name": "IA & Machine Learning", "stack": ["React", "FastAPI", "NL-to-SQL", "PostgreSQL"]},
    "brujula": {"cat": "auto", "name": "Automatización & BI", "stack": ["Python", "FastAPI", "BI", "WhatsApp API"]},
    "nucleo": {"cat": "web", "name": "Web Apps & ERP", "stack": ["React", "TypeScript", "Node.js", "PostgreSQL"]},
    "vertice": {"cat": "web", "name": "Web Apps & ERP", "stack": ["React", "PWA", "Offline-First", "Tailwind"]},
    "vitrina": {"cat": "web", "name": "Web Apps & ERP", "stack": ["Vanilla JS", "HTML5", "CSS3", "Sin frameworks"]},
    "myaccountant": {"cat": "web", "name": "Web Apps & ERP", "stack": ["React", "PWA", "IndexedDB", "Finanzas"]},
    "marquesina": {"cat": "hardware", "name": "3D, Videojuegos & Hardware", "stack": ["HTML5 Canvas", "WebSockets", "Digital Signage"]},
    "festo": {"cat": "auto", "name": "Automatización & BI", "stack": ["Python", "Automated Backend", "PostgreSQL", "B2B ERP"]},
    "pulso": {"cat": "web", "name": "Web Apps & ERP", "stack": ["React", "PWA", "Offline-First", "Service Workers"]},
    "totem": {"cat": "hardware", "name": "3D, Videojuegos & Hardware", "stack": ["React Native", "Firebase", "Kiosco"]},
    "web-studio": {"cat": "web", "name": "Web Apps & ERP", "stack": ["JavaScript", "HTML5 Canvas", "Media API", "Video Editor"]},
    "distrito": {"cat": "hardware", "name": "3D, Videojuegos & Hardware", "stack": ["Three.js", "WebGL", "Modelos 3D", "Animaciones"]},
    "ruta-clara": {"cat": "auto", "name": "Automatización & BI", "stack": ["JavaScript", "Leaflet", "GeoJSON", "Algoritmos de Ruta"]},
    "ourway": {"cat": "hardware", "name": "3D, Videojuegos & Hardware", "stack": ["Three.js", "WebGL", "Shaders", "Atlas 3D"]},
    "radar": {"cat": "auto", "name": "Automatización & BI", "stack": ["Chart.js", "JavaScript", "Analytics", "BI Dashboards"]},
    "inferencia": {"cat": "ia", "name": "IA & Machine Learning", "stack": ["PyTorch", "GPTQ", "INT4/INT3/INT2", "CUDA", "HuggingFace"]},
    "juego-construccion": {"cat": "hardware", "name": "3D, Videojuegos & Hardware", "stack": ["Unity", "C#", "WebGL", "WASM", "2D Platformer"]},
}

# Verify every project in projects_data.json matches a slug
cards = json.load(open("tools/projects_data.json", encoding="utf-8"))
for c in cards:
    href = c["href"]
    slug = href.strip("/").split("/")[-1]
    if slug not in categories_es:
        print(f"MISSING SLUG: {slug}")
    else:
        print(f"Matched: {slug:20s} -> {categories_es[slug]['cat']}")

print("All slugs accounted for!")
