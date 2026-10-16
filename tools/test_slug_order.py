import json
import re
from project_meta import PROJECT_META

cards_es = json.load(open("tools/projects_data.json", encoding="utf-8"))
cards_en = json.load(open("tools/projects_data_en.json", encoding="utf-8"))

def get_slug(href):
    return href.strip("/").split("/")[-1]

lookup_es = {get_slug(c["href"]): c for c in cards_es}
lookup_en = {get_slug(c["href"]): c for c in cards_en}

# Read existing previews from index.html
with open("index.html", "r", encoding="utf-8") as f:
    orig_html_es = f.read()

with open("en/index.html", "r", encoding="utf-8") as f:
    orig_html_en = f.read()

def extract_previews_map(content):
    matches = re.findall(r'<a[^>]*class=["\']card["\'][^>]*href=["\']([^"\']+)["\'][^>]*>.*?<div class=["\']preview["\']>(.*?)</div>', content, re.DOTALL)
    res = {}
    for href, p_html in matches:
        slug = get_slug(href)
        res[slug] = p_html.strip()
    return res

previews_es = extract_previews_map(orig_html_es)
previews_en = extract_previews_map(orig_html_en)

# Order of projects for catalog
SLUG_ORDER = [
    "dino-ai", "juego-construccion", "inferencia", "ruta-clara", "mundial",
    "dexter", "nucleo", "web-studio", "lumen", "distrito", "ourway",
    "radar", "vertice", "vitrina", "myaccountant", "nexo", "brujula",
    "festo", "pulso", "totem", "marquesina"
]

print(f"Total slugs in order: {len(SLUG_ORDER)}")
for s in SLUG_ORDER:
    assert s in lookup_es, f"Missing {s} in ES"
    assert s in lookup_en, f"Missing {s} in EN"
    assert s in PROJECT_META, f"Missing {s} in META"
print("All slugs validated.")
