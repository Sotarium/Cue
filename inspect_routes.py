with open(r'c:\Users\olivi\Downloads\Rollbux\api\index.js', 'r', encoding='utf-8') as f:
    text = f.read().encode('ascii', 'replace').decode('ascii')

target = "pathname === '/api/upgrader/play'"
pos = text.find(target)
print("UPGRADER PLAY:")
print(text[pos:pos+2500])
