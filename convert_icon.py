import base64

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\public\sotarium-brand-icon.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\brandIcon.js', 'w', encoding='utf-8') as f:
    f.write('export const brandIconBase64 = "data:image/png;base64,' + b64 + '";\n')

print("brandIcon.js written successfully")
