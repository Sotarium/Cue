with open(r'c:\Users\olivi\Downloads\Rollbux\api\index.js', 'r', encoding='utf-8') as f:
    text = f.read().encode('ascii', 'replace').decode('ascii')

target = "pathname === '/api/mines/start'"
pos = text.find(target)
print("MINES START:")
print(text[pos:pos+2500])
