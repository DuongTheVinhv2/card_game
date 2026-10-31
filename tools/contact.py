# Contact sheet: python tools/contact.py <out.png> <cols> <crop: x0,y0,x1,y1 as fractions> <images...>
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
cols = int(sys.argv[2])
crop = [float(v) for v in sys.argv[3].split(',')]
files = sys.argv[4:]
tiles = []
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    tiles.append((f, im))
tw = 520
th = int(tiles[0][1].size[1] * tw / tiles[0][1].size[0])
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (8, 8, 16))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(tiles):
    im = im.resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y))
    d.text((x + 6, y + 4), f.split('/')[-1].replace('.png', ''), fill=(255, 220, 140))
sheet.save(out)
print('saved', out, sheet.size)
