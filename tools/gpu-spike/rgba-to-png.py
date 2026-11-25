import pathlib,zlib,struct
p=pathlib.Path('evidence/tracer-0.1/tr02-standalone-03/final.rgba');raw=p.read_bytes();w,h=1920,1080
def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
rows=b''.join(b'\0'+raw[y*w*4:(y+1)*w*4] for y in range(h-1,-1,-1));p.with_suffix('.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b''))
