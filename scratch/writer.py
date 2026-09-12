import sys, os, base64

if len(sys.argv) < 3:
    print('Usage: writer.py <filepath> <base64_content>')
    sys.exit(1)

path = sys.argv[1]
b64 = sys.argv[2]
content = base64.b64decode(b64.encode('ascii')).decode('utf-8')

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Wrote {len(content)} chars to {path}')
