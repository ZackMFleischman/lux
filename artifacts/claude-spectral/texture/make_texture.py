import numpy as np
from PIL import Image
W, H = 2048, 1024
rng = np.random.default_rng(7)

def hash3(ix, iy, iz, seed=0):
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263
         + iz.astype(np.int64) * 2147483647 + seed * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = (h ^ (h >> 16)) & 0xFFFFFFFF
    return h.astype(np.float32) / 4294967295.0

def vnoise(x, y, z, seed=0):
    xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - xi, y - yi, z - zi
    u = fx*fx*fx*(fx*(fx*6-15)+10); v = fy*fy*fy*(fy*(fy*6-15)+10); w = fz*fz*fz*(fz*(fz*6-15)+10)
    def c(a, b, d): return hash3(xi+a, yi+b, zi+d, seed)
    x00 = c(0,0,0)*(1-u)+c(1,0,0)*u; x10 = c(0,1,0)*(1-u)+c(1,1,0)*u
    x01 = c(0,0,1)*(1-u)+c(1,0,1)*u; x11 = c(0,1,1)*(1-u)+c(1,1,1)*u
    return (x00*(1-v)+x10*v)*(1-w) + (x01*(1-v)+x11*v)*w   # 0..1

def fbm(x, y, z, oct=5, seed=0, lac=2.03, gain=0.5):
    s = 0; a = 0.5; tot = 0
    for o in range(oct):
        s = s + a * vnoise(x, y, z, seed + o*17)
        tot += a; x, y, z = x*lac+3.1, y*lac-1.7, z*lac+5.3; a *= gain
    return s / tot

def voronoi(x, y, z, seed=0):
    xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
    f1 = np.full(x.shape, 9., np.float32); f2 = f1.copy(); cid = np.zeros(x.shape, np.float32)
    for a in (-1,0,1):
        for b in (-1,0,1):
            for d in (-1,0,1):
                cx, cy, cz = xi+a, yi+b, zi+d
                px = cx + hash3(cx,cy,cz,seed+1)*0.9+0.05
                py = cy + hash3(cx,cy,cz,seed+2)*0.9+0.05
                pz = cz + hash3(cx,cy,cz,seed+3)*0.9+0.05
                dist = np.sqrt((px-x)**2+(py-y)**2+(pz-z)**2)
                closer = dist < f1
                f2 = np.where(closer, f1, np.minimum(f2, dist))
                cid = np.where(closer, hash3(cx,cy,cz,seed+9), cid)
                f1 = np.where(closer, dist, f1)
    return f1, f2, cid

lon = (np.arange(W, dtype=np.float32)+0.5)/W*2*np.pi
lat = (0.5 - (np.arange(H, dtype=np.float32)+0.5)/H)*np.pi
LON, LAT = np.meshgrid(lon, lat)
X = np.cos(LAT)*np.cos(LON); Y = np.sin(LAT); Z = np.cos(LAT)*np.sin(LON)

def smooth(a, b, t):
    t = np.clip((t-a)/(b-a), 0, 1); return t*t*(3-2*t)

# domain warp
wx = fbm(X*1.3+10, Y*1.3, Z*1.3, 4, 100) - .5
wy = fbm(X*1.3, Y*1.3+20, Z*1.3, 4, 200) - .5
wz = fbm(X*1.3, Y*1.3, Z*1.3+30, 4, 300) - .5
wk = 0.85
qx, qy, qz = X*1.15+wk*wx, Y*1.15+wk*wy, Z*1.15+wk*wz
# second finer warp
w2 = fbm(qx*3, qy*3, qz*3, 3, 400) - .5
# layered growth coordinate: broad fbm + latitude-ish layering, all warped
g = fbm(qx, qy, qz, 5, 1)*1.0 + 0.35*(qy + 0.25*w2)
varf = 0.7 + 0.9*fbm(qx*2.2, qy*2.2, qz*2.2, 3, 500)   # varied spacing
phase = g * 15.0 * varf + w2*2.0
fr = phase - np.floor(phase)
# fine, irregular growth lines (thin dark grooves + soft broad band)
line = smooth(0.0, 0.07, fr) * (1 - smooth(0.93, 1.0, fr))   # 0 at line
groove = 1 - line
line2 = 0.5 + 0.5*np.cos(2*np.pi*phase*0.5 + 3*w2)
# micro lines
mphase = g*60.0*(0.8+0.4*varf) + w2*6
micro = 0.5 + 0.5*np.cos(2*np.pi*mphase)

# platelets
S = 36.0
f1, f2, cid = voronoi(X*S+0.5, Y*S+0.3, Z*S+0.7, 1000)
edge = smooth(0.0, 0.16, f2 - f1)           # 0 on edges
cellh = cid
cellh2 = f1  # dome within cell

# interference colour: thin-film cosine palette driven by growth phase + per-tile jitter
t = g*2.4 + w2*1.2 + (cellh-0.5)*0.22 + 0.15*micro
pal = np.stack([0.5+0.5*np.cos(2*np.pi*(t+d)) for d in (0.0, 0.33, 0.67)], -1)
# bias palette towards target hue bands: teal, violet, gold, rose
hueband = fbm(qx*0.9+5, qy*0.9, qz*0.9, 3, 700)
def col(r,g_,b): return np.array([r,g_,b], np.float32)/255.
ivory, pink, lav = col(246,236,228), col(240,206,222), col(214,203,238)
teal, violet, gold, rose = col(120,214,206), col(158,126,222), col(238,205,128), col(238,138,172)
base = ivory[None,None]*(1-smooth(.25,.5,hueband))[...,None] + pink[None,None]*smooth(.25,.5,hueband)[...,None]
base = base*(1-smooth(.55,.8,hueband))[...,None] + lav[None,None]*smooth(.55,.8,hueband)[...,None]
# four-band spectral picker over t
tb = (t*1.0) % 1.0
bands = [teal, violet, gold, rose]
sp = np.zeros((H,W,3), np.float32)
for i, bc in enumerate(bands):
    centre = (i+0.5)/4
    d = np.abs(((tb-centre+0.5) % 1.0) - 0.5)
    wgt = np.exp(-(d/0.13)**2)
    sp += wgt[...,None]*bc[None,None]
spn = sp / np.maximum(sp.sum(-1,keepdims=True)*0+1, 1)
# strength of iridescence: stronger near growth line edges and on band crests
irid = (0.35 + 0.45*smooth(0.1,0.9,line2) + 0.25*groove) * (0.7+0.3*micro)
irid = np.clip(irid, 0, 0.85)[...,None]
rgb = base*(1-irid) + (0.55*sp + 0.45*(0.65+0.35*pal))*irid
# deeper translucent swirls
sw = fbm(qx*0.7+40, qy*0.7, qz*0.7, 3, 800)
swirl = smooth(0.0, 0.5, 0.5 - np.abs(np.sin(sw*14 + w2*6)*0.5-0.0) ) 
swirl = np.exp(-((np.sin(sw*11+w2*5))/0.28)**2)
deep = np.stack([ (violet+teal*0.6)/1.6 ]*1,0)[0]
rgb = rgb*(1-0.28*swirl[...,None]) + (0.28*swirl[...,None])*(0.55*deep+0.45*rose)[None,None]*0.92
# platelet shading: per-tile lightness + subtle edge darkening + dome highlight
tile = 1.0 + (cellh-0.5)*0.05 - 0.05*cellh2*0 
rgb = rgb*tile[...,None]
rgb = rgb*(0.90+0.10*edge)[...,None] + 0.05*(1-edge)[...,None]*0  # edges darker
rgb = rgb*(1 - 0.10*groove)[...,None]
rgb = rgb + 0.05*(1-cellh2*1.6).clip(0,1)[...,None]*edge[...,None]*np.array([1,.97,1.0],np.float32)
# soft sheen variance for mid-tone lift, keep pastel
rgb = np.clip(rgb, 0, 1)
lum = rgb.mean(-1, keepdims=True)
rgb = lum + (rgb-lum)*1.08
rgb = np.clip(rgb*0.96+0.045, 0, 1)

# height / detail map
dome = np.clip(1 - f1*1.5, 0, 1)
h = 0.40*edge + 0.20*dome + 0.22*line + 0.10*micro + 0.10*(cellh-0.5)+0.05
h = 0.5 + 0.9*(h - h.mean())
alpha = np.clip(h*255 + (128 - np.clip(h*255,0,255).mean()), 40, 255)

out = np.dstack([(rgb*255+0.5).astype(np.uint8), (alpha+0.5).astype(np.uint8)])
img = Image.fromarray(out, 'RGBA')
img.save('nacre.png', optimize=True, pnginfo=None, icc_profile=None)
img.convert('RGB').resize((1024,512), Image.LANCZOS).save('preview.png')
a = out[...,3]; print('alpha', a.min(), a.max(), a.mean())
print('rgb mean', out[...,:3].reshape(-1,3).mean(0))
