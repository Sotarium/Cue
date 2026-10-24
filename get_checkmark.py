import urllib.request
import base64

url = 'https://pngate.com/wp-content/uploads/2025/05/green-checkmark-round-icon-flat-ui-1.png'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        b64 = base64.b64encode(data).decode('ascii')
        with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\checkIcon.js', 'w', encoding='utf-8') as f:
            f.write('export const checkIconBase64 = "data:image/png;base64,' + b64 + '";\n')
        print("Success downloading checkmark icon")
except Exception as e:
    print("Download error:", e)
    # Generate high quality SVG/canvas checkmark fallback if blocked
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Green circle
    d.ellipse([10, 10, 246, 246], fill=(52, 199, 89, 255))
    # White checkmark
    d.line([(70, 130), (110, 175), (190, 85)], fill=(255, 255, 255, 255), width=24, joint='curve')
    d.ellipse([70-12, 130-12, 70+12, 130+12], fill=(255, 255, 255, 255))
    d.ellipse([190-12, 85-12, 190+12, 85+12], fill=(255, 255, 255, 255))
    import io
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\checkIcon.js', 'w', encoding='utf-8') as f:
        f.write('export const checkIconBase64 = "data:image/png;base64,' + b64 + '";\n')
    print("Fallback generated high quality checkmark")
