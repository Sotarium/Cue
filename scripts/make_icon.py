from pathlib import Path
from PIL import Image, ImageDraw

out = Path('/home/ubuntu/cueagent/build')
out.mkdir(parents=True, exist_ok=True)
size = 1024
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# Polished circular blue Sotarium mark.
d.ellipse((32, 32, size - 32, size - 32), fill=(79, 163, 239, 255), outline=(139, 211, 255, 255), width=10)
d.ellipse((88, 78, size - 88, size - 78), fill=(84, 169, 243, 255))
# Open eye.
d.ellipse((220, 290, 470, 540), fill=(255, 255, 255, 255))
d.ellipse((303, 366, 388, 451), fill=(30, 51, 78, 255))
# Wink.
d.line((610, 365, 705, 320), fill=(30, 51, 78, 255), width=34)
d.line((610, 365, 708, 411), fill=(30, 51, 78, 255), width=34)
# Small smile.
d.arc((486, 455, 645, 620), 8, 160, fill=(30, 51, 78, 255), width=20)
img.save(out / 'sotarium-icon.png')
img.save(out / 'sotarium-icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
