"""CV público sin identificación de empleadores ni datos de sus operaciones."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/cv-ia-fullstack-reportlab'))
from reportlab.platypus import SimpleDocTemplate,Paragraph,Table,TableStyle,Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
import fitz

ROOT=Path(__file__).resolve().parents[1]
for name,file in [('PublicGeorgia','georgia.ttf'),('PublicGeorgia-Bold','georgiab.ttf'),('PublicGeorgia-Italic','georgiai.ttf')]:pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('PublicGeorgia',normal='PublicGeorgia',bold='PublicGeorgia-Bold',italic='PublicGeorgia-Italic',boldItalic='PublicGeorgia-Bold')
style=ParagraphStyle('body',fontName='PublicGeorgia',fontSize=8.7,leading=11,spaceAfter=4,textColor=HexColor('#111'))
bold=ParagraphStyle('bold',parent=style,fontName='PublicGeorgia-Bold',spaceBefore=5,keepWithNext=True)
sub=ParagraphStyle('sub',parent=style,fontName='PublicGeorgia-Italic',fontSize=8,leading=10,keepWithNext=True)
class Heading(Flowable):
    def __init__(self,text):super().__init__();self.text=text;self.height=23;self.keepWithNext=True
    def wrap(self,w,h):self.width=w;return w,self.height
    def draw(self):
        self.canv.setFont('PublicGeorgia-Bold',9);self.canv.drawString(0,6,self.text);self.canv.setLineWidth(.45);self.canv.line(0,2,self.width,2)

for lang in [0,1]:
    es=lang==0
    title='Ingeniero de IA y Desarrollo Full-Stack' if es else 'AI & Full-Stack Engineer'
    parts=[Paragraph('EMILIO FONSECA',ParagraphStyle('name',parent=bold,fontSize=18,leading=22,alignment=1)),Paragraph(title,ParagraphStyle('role',parent=bold,alignment=1,fontSize=10,leading=14)),Paragraph('Tamaulipas, México | +52 833 127 3591 | <a href="mailto:emilio656565@outlook.com">emilio656565@outlook.com</a>',ParagraphStyle('contact',parent=style,alignment=1,fontSize=8,leading=12)),Paragraph('<a href="https://www.linkedin.com/in/emilio-fonseca65">linkedin.com/in/emilio-fonseca65</a> | <a href="https://github.com/EmilioUgarte65">github.com/EmilioUgarte65</a>',ParagraphStyle('links',parent=style,alignment=1,fontSize=8,leading=12))]
    def heading(a,b):parts.append(Heading(a if es else b))
    def p(a,b,sty=style):parts.append(Paragraph(a if es else b,sty))
    heading('PERFIL','PROFILE')
    p('Desarrollador especializado en <b>IA generativa, agentes y aplicaciones full-stack</b>. Construyo interfaces con React y servicios con Python y Node.js; integro APIs, herramientas y datos para automatizar procesos y crear productos útiles.','Developer focused on <b>generative AI, agents and full-stack applications</b>. I build React interfaces and Python/Node.js services, integrating APIs, tools and data to automate processes and create useful products.')
    heading('EXPERIENCIA','EXPERIENCE')
    p('Gestión del conocimiento, innovación digital e IA','Knowledge management, digital innovation and AI',bold)
    p('Organización privada | 2025 - Actualidad','Private organization | 2025 - Present',sub)
    p('• Desarrollé aplicaciones, servicios y automatizaciones para conectar procesos e información.','• Developed applications, services and automation to connect processes and information.')
    p('• Integré agentes de IA con herramientas, memoria conversacional y sistemas empresariales.','• Integrated AI agents with tools, conversational memory and business systems.')
    p('• Construí interfaces, APIs REST y reportes con control de acceso y documentación.','• Built interfaces, REST APIs and reports with access control and documentation.')
    p('Desarrollo independiente y académico | 2023 - 2025','Independent and academic development | 2023 - 2025',bold)
    p('Aplicaciones de gestión, finanzas, comercio electrónico y experimentos con IA, además de proyectos móviles e interactivos.','Management, finance and e-commerce applications, AI experiments and mobile/interactive projects.')
    heading('PROYECTOS RELEVANTES','SELECTED PROJECTS')
    projects=[('Web Studio','Python · FastAPI · OpenAI / Claude · FFmpeg','Editor web local que convierte instrucciones en planes de edición, con línea de tiempo, subtítulos y exportación de video.','Local web editor that turns instructions into editing plans, with a timeline, subtitles and video export.'),('Nexo','React · Node.js · LLMs · APIs REST · SQL','Asistentes y CRM con herramientas, memoria y flujos para coordinar atención y gestión de clientes.','Assistants and CRM with tools, memory and workflows to coordinate support and customer management.'),('Vértice','React · TypeScript · FastAPI · PostgreSQL · Docker','Aplicación para proyectos, presupuestos y solicitudes de pago, con autenticación, migraciones y trabajo offline.','An application for projects, budgets and payment requests, with authentication, migrations and offline work.'),('Dexter','Python · MCP · Multi-LLM · Ollama','Integración y extensión de un ecosistema open-source de agentes con habilidades, memoria persistente y enrutamiento de proveedores.','Integration and extension of an open-source agent ecosystem with skills, persistent memory and provider routing.')]
    for name,stack,a,b in projects:
        parts.extend([Paragraph(name,bold),Paragraph(stack,sub),Paragraph(a if es else b,style)])
    heading('HABILIDADES TÉCNICAS','TECHNICAL SKILLS')
    p('<b>Frontend:</b> React, TypeScript, JavaScript, HTML/CSS, PWA. <b>Backend:</b> Python, FastAPI, Node.js, Express, APIs REST. <b>Datos:</b> PostgreSQL, SQL Server, SQLite, Firebase. <b>IA y entrega:</b> OpenAI, Claude, tool calling, MCP, Docker, Git.','<b>Frontend:</b> React, TypeScript, JavaScript, HTML/CSS, PWA. <b>Backend:</b> Python, FastAPI, Node.js, Express, REST APIs. <b>Data:</b> PostgreSQL, SQL Server, SQLite, Firebase. <b>AI & delivery:</b> OpenAI, Claude, tool calling, MCP, Docker, Git.')
    heading('EDUCACIÓN E IDIOMAS','EDUCATION & LANGUAGES')
    p('<b>Ingeniería en Sistemas Computacionales</b> | Universidad Autónoma de Tamaulipas | 2020 - 2025','<b>Computer Systems Engineering</b> | Universidad Autónoma de Tamaulipas | 2020 - 2025')
    p('Español nativo · Inglés B2','Spanish native · English B2')
    p('Portafolio: <a href="https://emiliougarte65.github.io/portafolio-web/">emiliougarte65.github.io/portafolio-web</a>','Portfolio: <a href="https://emiliougarte65.github.io/portafolio-web/en/">emiliougarte65.github.io/portafolio-web/en/</a>')
    target=ROOT/'cv'/('Emilio-Fonseca-CV-ES.pdf' if es else 'Emilio-Fonseca-CV-EN.pdf')
    SimpleDocTemplate(str(target),pagesize=(612,792),leftMargin=43,rightMargin=43,topMargin=26,bottomMargin=32,title='Emilio Fonseca · '+title,author='Emilio Fonseca',subject='CV público / Public CV').build(parts)
    with fitz.open(target) as pdf:
        if len(pdf)!=1:raise RuntimeError('El CV público debe ocupar una página.')
        preview=ROOT.parent/'CV-IA-Full-Stack-2026-10-14/tmp/pdfs'/('cv-publico-es.png' if es else 'cv-publico-en.png')
        pdf[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(preview)
    (ROOT/'cv'/('Emilio-Fonseca-CV-ES-modern.pdf' if es else 'Emilio-Fonseca-CV-EN-modern.pdf')).write_bytes(target.read_bytes())
(ROOT/'cv/_new.pdf').write_bytes((ROOT/'cv/Emilio-Fonseca-CV-ES.pdf').read_bytes())
print('CV públicos generados: español, inglés y tres rutas compatibles.')
