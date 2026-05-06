"""Clean up sample-packet photos: remove background, add soft shadow, off-white canvas."""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageChops
from rembg import remove, new_session

CANVAS = 800
PADDING = 70
BG_COLOR = (248, 246, 242)  # warm off-white so the white packet pops
SHADOW_OFFSET = (0, 18)
SHADOW_BLUR = 22
SHADOW_OPACITY = 90  # 0-255

INPUTS = [
    (Path(r"C:\Users\darri\Downloads\tempFileForShare_20260505-212007.jpg"),
     Path(r"C:\Users\darri\active10-wholesale\public\products\sample-original.png")),
    (Path(r"C:\Users\darri\Downloads\tempFileForShare_20260505-212045.jpg"),
     Path(r"C:\Users\darri\active10-wholesale\public\products\sample-plus.png")),
]

session = new_session("birefnet-general")

for src, dst in INPUTS:
    print(f"Processing {src.name} -> {dst.name}")
    raw = ImageOps.exif_transpose(Image.open(src).convert("RGBA"))

    # Plain segmentation (no alpha matting — that's for hair/fur, destroys white objects)
    cut = remove(raw, session=session, post_process_mask=True)

    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)

    # Boost contrast/saturation a touch so the print stands out
    rgb = cut.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18)
    rgb = ImageEnhance.Color(rgb).enhance(1.10)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.30)
    cut = Image.merge("RGBA", (*rgb.split(), cut.split()[3]))

    # Scale to fit canvas
    target = CANVAS - 2 * PADDING
    cut.thumbnail((target, target), Image.LANCZOS)

    # Build canvas with warm off-white background
    canvas = Image.new("RGBA", (CANVAS, CANVAS), BG_COLOR + (255,))

    # Drop shadow: alpha → grey blob → blur → paste under packet
    alpha = cut.split()[3]
    shadow_layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_mask = Image.new("L", (CANVAS, CANVAS), 0)
    sx = (CANVAS - cut.width) // 2 + SHADOW_OFFSET[0]
    sy = (CANVAS - cut.height) // 2 + SHADOW_OFFSET[1]
    shadow_mask.paste(alpha, (sx, sy))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    shadow_mask = shadow_mask.point(lambda v: int(v * SHADOW_OPACITY / 255))
    shadow_layer.paste((30, 30, 30, 255), (0, 0), shadow_mask)
    canvas = Image.alpha_composite(canvas, shadow_layer)

    # Paste packet on top
    px = (CANVAS - cut.width) // 2
    py = (CANVAS - cut.height) // 2
    canvas.paste(cut, (px, py), cut)

    canvas.convert("RGB").save(dst, "PNG", optimize=True)
    print(f"  saved: {dst} ({dst.stat().st_size // 1024} KB)")

print("Done.")
