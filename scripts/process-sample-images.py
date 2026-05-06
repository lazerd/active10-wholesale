"""Clean up sample-packet photos: remove background, square-crop on white, optimize."""
from pathlib import Path
from PIL import Image, ImageOps
from rembg import remove, new_session

CANVAS = 800
PADDING = 60
BG = (255, 255, 255, 255)

INPUTS = [
    (Path(r"C:\Users\darri\Downloads\tempFileForShare_20260505-212007.jpg"),
     Path(r"C:\Users\darri\active10-wholesale\public\products\sample-original.png")),
    (Path(r"C:\Users\darri\Downloads\tempFileForShare_20260505-212045.jpg"),
     Path(r"C:\Users\darri\active10-wholesale\public\products\sample-plus.png")),
]

session = new_session("isnet-general-use")

for src, dst in INPUTS:
    print(f"Processing {src.name} -> {dst.name}")
    raw = Image.open(src).convert("RGBA")
    raw = ImageOps.exif_transpose(raw)
    cut = remove(raw, session=session, alpha_matting=True,
                 alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=20,
                 alpha_matting_erode_size=10)

    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)

    # Scale to fit canvas with padding
    target = CANVAS - 2 * PADDING
    cut.thumbnail((target, target), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), BG)
    x = (CANVAS - cut.width) // 2
    y = (CANVAS - cut.height) // 2
    canvas.paste(cut, (x, y), cut)

    flat = Image.new("RGB", canvas.size, (255, 255, 255))
    flat.paste(canvas, mask=canvas.split()[3])
    flat.save(dst, "PNG", optimize=True)
    print(f"  saved: {dst} ({dst.stat().st_size // 1024} KB)")

print("Done.")
