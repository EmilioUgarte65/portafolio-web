import re

def analyze_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    sections = re.findall(r'<section[^>]*id=["\']([^"\']+)["\'][^>]*>', content)
    cards = re.findall(r'<a[^>]*class=["\']card[^"\']*["\'][^>]*href=["\']([^"\']+)["\'][^>]*>', content)
    headings = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', content, re.DOTALL)
    
    print(f"=== {filename} ===")
    print(f"Total lines: {len(content.splitlines())}")
    print(f"Section IDs: {sections}")
    print(f"Total project cards: {len(cards)}")
    print(f"Cards targets: {cards[:15]}")
    clean_h = [re.sub(r'<[^>]+>', '', h).strip() for h in headings[:10]]
    print(f"Top headings: {clean_h}")

analyze_file('index.html')
analyze_file('en/index.html')
