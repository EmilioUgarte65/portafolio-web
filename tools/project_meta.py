import json
import re

# Load extracted projects
cards_es = json.load(open("tools/projects_data.json", encoding="utf-8"))
cards_en = json.load(open("tools/projects_data_en.json", encoding="utf-8"))

# Metadata mapping for each project
PROJECT_META = {
    "dino-ai": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "showcase",
        "stack": ["Python", "DQN", "Stable-Baselines3", "Gymnasium", "OpenCV"],
        "metric_es": "800,000 pasos de entrenamiento DQN, solo con CPU",
        "metric_en": "800,000 DQN training steps, CPU only"
    },
    "mundial": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Python", "XGBoost", "Elo", "Monte Carlo", "scikit-learn"],
        "metric_es": "60.8% de ganadores acertados en 97 partidos del Mundial 2026",
        "metric_en": "60.8% of winners called across 97 matches of the 2026 World Cup"
    },
    "dexter": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Python", "MCP", "SQLite", "Node.js", "Go"],
        "metric_es": "46+ skills · 6 agentes compatibles · memoria local",
        "metric_en": "46+ skills · 6 supported agents · local memory"
    },
    "nexo": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Node.js", "React", "Socket.IO", "SQL Server", "WhatsApp Cloud API"],
        "metric_es": "Bandeja multiagente · IA por chat · ERP en vivo",
        "metric_en": "Multi-agent inbox · AI per chat · live ERP"
    },
    "lumen": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Node.js", "Express", "NL-to-SQL", "SQL Server", "Chart.js"],
        "metric_es": "Dos pasadas de IA: SQL validado de solo lectura y narración con datos reales",
        "metric_en": "Two AI passes: validated read-only SQL and narration over real data"
    },
    "brujula": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Python", "pandas", "SQL Server", "WhatsApp Cloud API"],
        "metric_es": "Reportes programados desde el ERP · sin capturas",
        "metric_en": "Scheduled ERP reports · no manual data entry"
    },
    "nucleo": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "Vite", "Firebase", "Firestore", "Cloud Functions", "Express", "Google Calendar API", "OAuth 2.0"],
        "metric_es": "Calendario en 2 sentidos",
        "metric_en": "Two-way calendar sync"
    },
    "vertice": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "TypeScript", "Dexie (IndexedDB)", "FastAPI", "PostgreSQL", "Alembic", "JWT", "Docker"],
        "metric_es": "Captura sin señal",
        "metric_en": "Offline capture"
    },
    "vitrina": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "Vite", "Express", "SQL Server", "JWT", "Mercado Pago", "PWA"],
        "metric_es": "Catálogo sincronizado",
        "metric_en": "Synced catalog"
    },
    "myaccountant": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "Vite", "Firebase", "Firestore", "Cloud Functions", "PWA", "Capacitor", "Three.js"],
        "metric_es": "Web, Android y offline",
        "metric_en": "Web, Android and offline"
    },
    "marquesina": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["HTML", "CSS", "JavaScript", "FFmpeg", "GitHub Pages"],
        "metric_es": "Sin frameworks · videos optimizados con FFmpeg en dos calidades por pieza",
        "metric_en": "No frameworks · FFmpeg-optimized videos in two qualities per piece"
    },
    "festo": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "showcase",
        "stack": ["Node.js", "Docker", "Baileys", "React"],
        "metric_es": "Desatendido · reintento automático sin duplicados",
        "metric_en": "Unattended · automatic retry, no duplicates"
    },
    "pulso": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "TypeScript", "Dexie (IndexedDB)", "PWA", "Express", "Prisma", "SQL Server", "Socket.io"],
        "metric_es": "Sin señal, sin pérdidas",
        "metric_en": "Offline, no lost answers"
    },
    "totem": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "showcase",
        "stack": ["Electron", "React", "React Native", "Firebase", "OpenWeatherMap"],
        "metric_es": "Cambios en tiempo real con Firebase · descarga de videos con doble barrera",
        "metric_en": "Real-time updates via Firebase · two-barrier video downloads"
    },
    "web-studio": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Python", "FastAPI", "FFmpeg", "Claude · Codex", "JavaScript"],
        "metric_es": "Planes de edición JSON validados y crítico interno que revisa cada render",
        "metric_en": "Validated JSON editing plans and a built-in critic that reviews every render"
    },
    "distrito": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "showcase",
        "stack": ["Three.js", "Python", "PWA Offline", "SQLite", "RFM", "Machine Learning", "Blender", "Docker", "Playwright"],
        "metric_es": "Mascota 3D, misiones y ligas; clientes priorizados con RFM y un modelo predictivo",
        "metric_en": "3D pet, missions and leagues; customers ranked with RFM and a predictive model"
    },
    "ruta-clara": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Node.js", "React", "MapLibre", "OpenStreetMap", "Grafos / Graphs"],
        "metric_es": "Dijkstra por aristas + optimizador de flota",
        "metric_en": "Edge-based Dijkstra + fleet optimizer"
    },
    "ourway": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["React", "Three.js", "MapLibre GL", "Firebase", "Vite"],
        "metric_es": "Recupera el GPS leyendo solo metadatos, sin subir fotos · película al ritmo de la música",
        "metric_en": "Recovers GPS by reading metadata only, no photo uploads · films cut to the beat"
    },
    "radar": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Python", "SQLite FTS5", "SQL Server", "JavaScript"],
        "metric_es": "Prioridad explicable · búsqueda local en milisegundos",
        "metric_en": "Explainable priority · millisecond local search"
    },
    "inferencia": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "showcase",
        "stack": ["Python", "PyTorch", "CUDA", "GPTQ", "Ollama"],
        "metric_es": "INT2 de 2,588× a 12.45× de pérdida en GPT-2 · INT4 a 1.01×",
        "metric_en": "INT2 from 2,588× to 12.45× loss on GPT-2 · INT4 at 1.01×"
    },
    "juego-construccion": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["Unity 6", "C#", "WebGL", "WebAssembly", "Supabase", "PWA"],
        "metric_es": "Niveles procedurales validados · 700+ pruebas · arranque móvil < 20 MiB",
        "metric_en": "Validated procedural levels · 700+ tests · < 20 MiB mobile start-up"
    },
    "cora": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Node.js", "LLMs (OpenAI / Claude)", "SQL Server", "WhatsApp API"],
        "metric_es": "Agentes especializados · cotiza con precios del ERP",
        "metric_en": "Specialized agents · quotes with live ERP prices"
    }
}

print(f"Configured metadata for {len(PROJECT_META)} projects.")
