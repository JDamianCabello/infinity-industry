#!/usr/bin/env python3
"""Empaqueta los sprites de assets/src en un único atlas (assets/atlas.png)
y genera js/atlas_data.js con las coordenadas de cada fotograma.

Uso:  python3 tools/build_atlas.py
Requiere Pillow (pip install pillow).
"""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'src')
PREFIX = {
    'scifi-rts/structure': ('st_', 'scifiStructure_'),
    'scifi-rts/tile': ('tile_', 'scifiTile_'),
    'scifi-rts/env': ('env_', 'scifiEnvironment_'),
    'td': ('td_', 'towerDefense_tile'),
    'racing/cars': ('', ''),
    'racing/objects': ('obj_', ''),
    'particles': ('fx_', ''),
}
MAX_W = 2048
PAD = 2

frames = []
for folder, (pre, strip) in PREFIX.items():
    d = os.path.join(SRC, folder)
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.png'):
            continue
        name = pre + fn[:-4].replace(strip, '', 1) if strip else pre + fn[:-4]
        im = Image.open(os.path.join(d, fn)).convert('RGBA')
        frames.append((name, im))

# Empaquetado por estantes, de mayor a menor altura
frames.sort(key=lambda f: -f[1].size[1])
x = y = shelf_h = 0
placed = {}
for name, im in frames:
    w, h = im.size
    if x + w + PAD > MAX_W:
        x = 0
        y += shelf_h + PAD
        shelf_h = 0
    placed[name] = (x, y, w, h)
    x += w + PAD
    shelf_h = max(shelf_h, h)
total_h = y + shelf_h
H = total_h
atlas = Image.new('RGBA', (MAX_W, H), (0, 0, 0, 0))
for name, im in frames:
    px, py, _, _ = placed[name]
    atlas.paste(im, (px, py))
atlas.save(os.path.join(ROOT, 'assets', 'atlas.png'), optimize=True)

with open(os.path.join(ROOT, 'js', 'atlas_data.js'), 'w') as f:
    f.write('// Generado por tools/build_atlas.py. No editar a mano.\n')
    f.write('window.IE = window.IE || {};\n')
    f.write('IE.ATLAS_FRAMES = ' + json.dumps({k: list(v) for k, v in sorted(placed.items())}, separators=(',', ':')) + ';\n')
print('atlas', MAX_W, 'x', H, 'frames', len(placed))
