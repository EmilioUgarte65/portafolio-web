import re
import json

with open("tools/original_index.html", "r", encoding="utf-8") as f:
    content = f.read()

# match cards and their previews
cards = re.findall(r'<a[^>]*class=["\']card["\'][^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', content, re.DOTALL)
previews = {}
for href, inner in cards:
    slug = href.strip("/").split("/")[-1]
    m_prev = re.search(r'<div class=["\']preview["\']>(.*?)</div>', inner, re.DOTALL)
    if m_prev:
        previews[slug] = m_prev.group(1).strip()

print(f"Extracted {len(previews)} previews from original_index.html")
with open("tools/previews_extracted.json", "w", encoding="utf-8") as f:
    json.dump(previews, f, ensure_ascii=False, indent=2)
