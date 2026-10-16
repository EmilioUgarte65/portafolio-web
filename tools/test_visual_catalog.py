import subprocess
import os

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

base_dir = r'C:\Users\carlo\Documents\portafolio-web\tools'

tests = [
    {
        'url': 'http://localhost:4173/#',
        'out': os.path.join(base_dir, 'shot_hero.png'),
        'size': '1280,800'
    },
    {
        'url': 'http://localhost:4173/#proyectos',
        'out': os.path.join(base_dir, 'shot_catalog.png'),
        'size': '1280,1000'
    }
]

for t in tests:
    cmd = [
        edge_path,
        '--headless',
        f"--screenshot={t['out']}",
        f"--window-size={t['size']}",
        t['url']
    ]
    res = subprocess.run(cmd, capture_output=True)
    exists = os.path.exists(t['out'])
    size = os.path.getsize(t['out']) if exists else 0
    print(f"Captured {t['out']}: exists={exists}, size={size} bytes")
