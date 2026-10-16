import json
from html.parser import HTMLParser

class CardParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards = []
        self.in_card = False
        self.current_card = None
        self.current_tag = None
        self.text_buffer = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        classes = attrs_dict.get('class', '').split()
        
        if tag == 'a' and 'card' in classes:
            self.in_card = True
            self.current_card = {
                'href': attrs_dict.get('href', ''),
                'badge': '',
                'image': '',
                'alt': '',
                'tag': '',
                'title': '',
                'description': ''
            }
        
        if self.in_card:
            if tag == 'img':
                self.current_card['image'] = attrs_dict.get('src', '')
                self.current_card['alt'] = attrs_dict.get('alt', '')
            self.current_tag = (tag, classes)
            self.text_buffer = ""

    def handle_endtag(self, tag):
        if self.in_card:
            text = self.text_buffer.strip()
            if self.current_tag:
                t_name, classes = self.current_tag
                if 'live' in classes:
                    self.current_card['badge'] = text
                elif 'tag' in classes:
                    self.current_card['tag'] = text
                elif t_name == 'h3':
                    self.current_card['title'] = text
                elif t_name == 'p':
                    self.current_card['description'] = text
            
            if tag == 'a':
                self.in_card = False
                if self.current_card and self.current_card['title']:
                    self.cards.append(self.current_card)
                self.current_card = None
            self.current_tag = None
            self.text_buffer = ""

    def handle_data(self, data):
        if self.in_card:
            self.text_buffer += data

parser = CardParser()
with open('en/index.html', 'r', encoding='utf-8') as f:
    parser.feed(f.read())

with open('tools/projects_data_en.json', 'w', encoding='utf-8') as f:
    json.dump(parser.cards, f, ensure_ascii=False, indent=2)

print(f"Extracted and saved {len(parser.cards)} cards to tools/projects_data_en.json")
