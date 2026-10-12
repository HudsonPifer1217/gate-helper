"""Draw the Gate Helper icon and write extension/icons/icon{16,32,48,128}.png.

Run from the project root:  python3 tools/make_icons.py
Design: lime lightning bolt (the panel's ⚡) on a dark rounded tile with a soft glow.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S = 1024  # draw large, then downscale for crisp edges
LIME_TOP, LIME_BOTTOM = (226, 255, 120), (150, 230, 0)
OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"

BOLT = [(565, 92), (285, 585), (488, 585), (418, 932), (748, 418), (548, 418), (690, 92)]


def vertical_gradient(size, top, bottom):
    g = Image.new("RGB", (1, size[1]))
    for y in range(size[1]):
        t = y / (size[1] - 1)
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g.resize(size)


def draw():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Dark tile with a faint top highlight.
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((24, 24, S - 24, S - 24), radius=220, fill=255)
    tile.paste(vertical_gradient((S, S), (40, 40, 44), (12, 12, 14)), (0, 0), mask)
    img = Image.alpha_composite(img, tile)

    # Lime glow behind the bolt.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(BOLT, fill=(198, 255, 61, 170))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    glow.putalpha(Image.composite(glow.getchannel("A"), Image.new("L", (S, S), 0), mask))
    img = Image.alpha_composite(img, glow)

    # Bolt: gradient fill with a thin dark edge so it reads at 16px.
    bolt_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bolt_mask).polygon(BOLT, fill=255)
    edge = bolt_mask.filter(ImageFilter.MaxFilter(17))
    img.paste((10, 10, 10, 255), (0, 0), edge)
    img.paste(vertical_gradient((S, S), LIME_TOP, LIME_BOTTOM), (0, 0), bolt_mask)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    big = draw()
    for px in (16, 32, 48, 128):
        big.resize((px, px), Image.LANCZOS).save(OUT / f"icon{px}.png")
    big.resize((512, 512), Image.LANCZOS).save(OUT / "icon512.png")
    print("wrote", sorted(p.name for p in OUT.glob("icon*.png")))


if __name__ == "__main__":
    main()
