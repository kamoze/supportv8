"""Small WebP copies of the standard beaver portraits for chat (28/40px at 1x and 2x).

Usage: python3 scripts/resize-avatars.py
Writes public/avatars/beaver-<name>-<px>.webp next to each source JPEG.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "avatars"
NAMES = ["arthur", "barnaby", "cornelius", "default", "eleanor", "intern", "maxwell", "oliver", "penelope", "sophia", "vivian"]
SIZES = [28, 40, 56, 80]

for name in NAMES:
    with Image.open(ROOT / f"beaver-{name}.jpg") as source:
        image = source.convert("RGB")
        side = min(image.size)
        left, top = (image.width - side) // 2, (image.height - side) // 2
        square = image.crop((left, top, left + side, top + side))
        for px in SIZES:
            square.resize((px, px), Image.LANCZOS).save(ROOT / f"beaver-{name}-{px}.webp", "WEBP", quality=82, method=6)
print("ok")
