import base64

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\public\checkmark.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\checkIcon.js', 'w', encoding='utf-8') as f:
    f.write('export const checkIconBase64 = "data:image/png;base64,' + b64 + '";\n')

print("checkIcon.js updated cleanly with exact URL asset")
