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
        "stack": ["Python", "PPO", "Reinforcement Learning", "OpenCV"],
        "metric_es": "Reconocimiento visual en tiempo real · 0 entrenamiento previo",
        "metric_en": "Real-time computer vision · 0 prior training"
    },
    "mundial": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Python", "FastAPI", "Monte Carlo", "Scikit-Learn"],
        "metric_es": "+50,000 partidos históricos simulados",
        "metric_en": "50,000+ historical matches simulated"
    },
    "dexter": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["Python", "OpenAI / Claude", "FastAPI", "Multi-Agent"],
        "metric_es": "Arquitectura multi-agente con herramientas dinámicas",
        "metric_en": "Multi-agent architecture with dynamic tooling"
    },
    "nexo": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Python", "FastAPI", "WhatsApp Cloud API", "Docker"],
        "metric_es": "Atención 24/7 sin latencia de webhook",
        "metric_en": "24/7 customer care with zero webhook lag"
    },
    "lumen": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["React", "FastAPI", "NL-to-SQL", "PostgreSQL"],
        "metric_es": "Consultas en lenguaje natural traducidas a SQL seguro",
        "metric_en": "Natural language queries compiled to safe SQL"
    },
    "brujula": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Python", "FastAPI", "BI", "WhatsApp API"],
        "metric_es": "Reportes diarios y alertas automáticas a dirección",
        "metric_en": "Automated executive KPI summaries via WhatsApp"
    },
    "nucleo": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "TypeScript", "Node.js", "PostgreSQL"],
        "metric_es": "Control total de inventario, ventas y compras",
        "metric_en": "End-to-end inventory, sales & purchase control"
    },
    "vertice": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "PWA", "Offline-First", "Tailwind"],
        "metric_es": "Generación instantánea de cotizaciones en campo",
        "metric_en": "Instant field quotes generation without connectivity"
    },
    "vitrina": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["Vanilla JS", "HTML5", "CSS3", "Sin dependencias"],
        "metric_es": "Carga ultra rápida (<300ms) sin frameworks pesados",
        "metric_en": "Ultra-fast load (<300ms) with zero heavy frameworks"
    },
    "myaccountant": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "PWA", "IndexedDB", "Finanzas"],
        "metric_es": "Contabilidad personal 100% offline y privada",
        "metric_en": "100% offline and private personal accounting"
    },
    "marquesina": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["HTML5 Canvas", "WebSockets", "Digital Signage"],
        "metric_es": "Render de textos y animaciones a 60 FPS",
        "metric_en": "60 FPS hardware-accelerated text & graphics"
    },
    "festo": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "showcase",
        "stack": ["Python", "Automated Backend", "PostgreSQL", "B2B ERP"],
        "metric_es": "Cero intervención humana · Sincronización diaria",
        "metric_en": "Zero human intervention · Daily background sync"
    },
    "pulso": {
        "cat": "web",
        "cat_name_es": "Web Apps & ERP",
        "cat_name_en": "Web Apps & ERP",
        "demo_type": "demo",
        "stack": ["React", "PWA", "Offline-First", "Service Workers"],
        "metric_es": "Levantamiento de encuestas sin señal celular",
        "metric_en": "Reliable survey data collection in remote zones"
    },
    "totem": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "showcase",
        "stack": ["React Native", "Firebase", "Kiosco Interactivo"],
        "metric_es": "Actualización remota en tiempo real de pantallas",
        "metric_en": "Real-time remote control of digital billboards"
    },
    "web-studio": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "demo",
        "stack": ["JavaScript", "IA Multimedia", "Canvas WebGL", "Video Editor"],
        "metric_es": "Editor de video asistido por IA y multipista en el navegador",
        "metric_en": "AI-assisted multitrack video editor running in-browser"
    },
    "distrito": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["Three.js", "WebGL", "Modelos 3D", "Animaciones"],
        "metric_es": "Habitación 3D interactiva y controles de cámara",
        "metric_en": "Interactive 3D isometric room with smooth orbital cam"
    },
    "ruta-clara": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["JavaScript", "Leaflet", "GeoJSON", "Algoritmos de Ruta"],
        "metric_es": "Optimización logística y despacho de última milla",
        "metric_en": "Last-mile routing optimization & dispatch management"
    },
    "ourway": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["Three.js", "WebGL", "Shaders", "Atlas 3D"],
        "metric_es": "Planeta 3D orbital navegable con texturas personalizadas",
        "metric_en": "Navigable orbital 3D globe with procedural shaders"
    },
    "radar": {
        "cat": "auto",
        "cat_name_es": "Automatización & BI",
        "cat_name_en": "Automation & BI",
        "demo_type": "demo",
        "stack": ["Chart.js", "JavaScript", "Analytics", "BI Dashboards"],
        "metric_es": "Tablero comercial interactivo y series temporales",
        "metric_en": "Interactive commercial dashboards & sales time-series"
    },
    "inferencia": {
        "cat": "ia",
        "cat_name_es": "IA & Machine Learning",
        "cat_name_en": "AI & Machine Learning",
        "demo_type": "showcase",
        "stack": ["PyTorch", "GPTQ", "INT4/INT3/INT2", "CUDA", "HuggingFace"],
        "metric_es": "Modelos 7B corriendo en GPUs de 4 GB VRAM (2.4 GB footprint)",
        "metric_en": "7B LLMs running on 4 GB VRAM GPUs (2.4 GB footprint)"
    },
    "juego-construccion": {
        "cat": "hardware",
        "cat_name_es": "3D, Videojuegos & Hardware",
        "cat_name_en": "3D, Games & Hardware",
        "demo_type": "demo",
        "stack": ["Unity", "C#", "WebGL", "WASM", "2D Platformer"],
        "metric_es": "Motor de físicas y coladas de concreto compilado a WebGL",
        "metric_en": "Physics engine & material harvesting compiled to WASM"
    }
}

print(f"Configured metadata for {len(PROJECT_META)} projects.")
