with open(r'c:\Users\olivi\Downloads\Rollbux\api\index.js', 'r', encoding='utf-8') as f:
    text = f.read().encode('ascii', 'replace').decode('ascii')

target = "pathname === '/api/battles/create'"
pos = text.find(target)
print("BATTLES CREATE:")
print(text[pos:pos+2500])
