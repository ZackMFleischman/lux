"""Independent JPEG fixtures: Pillow/libjpeg, not jpeg-js. Run manually."""
from pathlib import Path
from PIL import Image, ImageFile
import random

out = Path(__file__).parent / 'fixtures' / 'jpeg'
out.mkdir(parents=True, exist_ok=True)
ImageFile.MAXBLOCK = 2 * 1024 * 1024  # Pillow 9's progressive encoder buffer guess is too small for noise.
rgb = Image.new('RGB', (32, 24))
rgb.putdata([(230, 20, 40) if x < 16 else (20, 200, 70) for y in range(24) for x in range(32)])
rgb.save(out / 'baseline.jpg', quality=100, subsampling=0)
rgb.save(out / 'progressive.jpg', quality=100, subsampling=0, progressive=True)
gray = Image.new('L', (3, 2))
gray.putdata([10, 40, 70, 100, 130, 160])
gray.save(out / 'gray.jpg', quality=100)
large = Image.new('RGB', (512, 512))
large.putdata([((x+y)%256, (3*x+y)%256, (x+3*y)%256) for y in range(512) for x in range(512)])
large.save(out / 'maximum-progressive.jpg', quality=95, progressive=True)
for size in [362, 512]:
    noise = Image.new('RGB', (size, size))
    rng = random.Random(123)
    noise.frombytes(bytes(rng.randrange(256) for _ in range(size*size*3)))
    noise.save(out / f'noise-{size}.jpg', quality=90, subsampling=0, progressive=True)
