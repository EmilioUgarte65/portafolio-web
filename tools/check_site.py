"""Comprueba referencias locales, exclusiones y el sitemap del portafolio."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re

ROOT=Path(__file__).resolve().parents[1]
class References(HTMLParser):
    def __init__(self):
        super().__init__();self.refs=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        self.refs.extend(attrs[k] for k in ('src','href') if k in attrs)

broken=[]
for page in ROOT.rglob('*.html'):
    if '.git' in page.parts:continue
    parser=References();parser.feed(page.read_text(encoding='utf-8'))
    for ref in parser.refs:
        url=urlsplit(ref)
        if url.scheme or url.netloc or not url.path:continue
        target=(ROOT/url.path.lstrip('/') if url.path.startswith('/') else page.parent/unquote(url.path)).resolve()
        if target.is_dir():target=target/'index.html'
        if not target.exists():broken.append({'page':str(page.relative_to(ROOT)),'reference':ref})

excluded=[]
for path in ROOT.rglob('*'):
    if '.git' in path.parts or not path.is_file():continue
    if path.suffix not in ('.html','.js','.css','.json','.svg'):continue
    if re.search(r'JukeRun',path.read_text(encoding='utf-8',errors='replace'),re.I):excluded.append(str(path.relative_to(ROOT)))

routes=['','en/','cv/','cv/en/']
routes += [str(p.parent.relative_to(ROOT)).replace('\\','/')+'/' for folder in ('proyectos','en/projects') for p in (ROOT/folder).glob('*/index.html')]
urls=''.join('<url><loc>https://emiliougarte65.github.io/portafolio-web/'+route+'</loc></url>\n' for route in routes)
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'</urlset>\n',encoding='utf-8')
result={'missing_local_references':broken,'excluded_project_references':excluded,'sitemap_pages':len(routes)}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(bool(broken or excluded))
