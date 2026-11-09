"""Draws the PulseCast logo and the installer artwork.

Run:  python branding/make_branding.py
Writes icon.png, icon.ico, installerSidebar.bmp, uninstallerSidebar.bmp, installerHeader.bmp
next to this script. Everything is drawn in code, so the artwork can be tweaked and rebuilt.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent
BG = (8, 10, 13)
PANEL = (17, 21, 27)
LIME = (216, 255, 62)
WHITE = (240, 244, 248)
DIM = (120, 132, 146)
FONTS = Path("C:/Windows/Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def pulse_points(x0, x1, cy, amp):
    """A heartbeat-style line: flat, a small bump, a tall spike, a dip, flat."""
    w = x1 - x0
    spec = [(0.0, 0), (0.30, 0), (0.38, -0.25), (0.45, 0), (0.52, 0.0), (0.58, -1.0), (0.66, 0.85), (0.72, 0), (1.0, 0)]
    return [(x0 + w * t, cy + amp * v) for t, v in spec]


def glow(img: Image.Image, mask_draw, radius: float, color, strength: float = 1.0) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mask_draw(ImageDraw.Draw(layer), color + (255,))
    blurred = layer.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        alpha = blurred.getchannel("A").point(lambda v: min(255, int(v * strength)))
        blurred.putalpha(alpha)
    return Image.alpha_composite(img, blurred)


def draw_mark(size: int, with_tile: bool = True) -> Image.Image:
    """The logo: a lime pulse line leaving a broadcast ring on a dark tile."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if with_tile:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG + (255,))
        # soft inner panel so the tile reads on dark and light backgrounds
        d.rounded_rectangle([s * 0.03, s * 0.03, s * 0.97, s * 0.97], radius=int(s * 0.19), outline=(34, 42, 52, 255), width=max(1, int(s * 0.012)))
    # broadcast arcs behind the pulse
    cx, cy = s * 0.5, s * 0.5
    for i, r in enumerate((0.36, 0.28)):
        box = [cx - s * r, cy - s * r, cx + s * r, cy + s * r]
        col = LIME + (int(255 * (0.30 if i == 0 else 0.55)),)
        d.arc(box, start=-50, end=50, fill=col, width=max(2, int(s * 0.03)))
        d.arc(box, start=130, end=230, fill=col, width=max(2, int(s * 0.03)))

    pts = pulse_points(s * 0.16, s * 0.84, s * 0.52, s * 0.27)
    width = max(3, int(s * 0.055))

    def stroke(dr, color):
        dr.line(pts, fill=color, width=width, joint="curve")
        for p in (pts[0], pts[-1]):
            dr.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=color)

    img = glow(img, stroke, s * 0.035, LIME, 1.4)
    d = ImageDraw.Draw(img)
    stroke(d, LIME + (255,))
    # live dot, top right
    r = s * 0.055
    dx, dy = s * 0.80, s * 0.20
    img = glow(img, lambda dr, c: dr.ellipse([dx - r, dy - r, dx + r, dy + r], fill=c), s * 0.03, (255, 90, 79), 1.6)
    ImageDraw.Draw(img).ellipse([dx - r, dy - r, dx + r, dy + r], fill=(255, 90, 79, 255))
    return img


def save_icon() -> None:
    big = draw_mark(1024)
    big.save(OUT / "icon.png")
    sizes = [16, 24, 32, 48, 64, 128, 256]
    big.save(OUT / "icon.ico", sizes=[(n, n) for n in sizes])


def gradient(w: int, h: int, top, bottom) -> Image.Image:
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = row
    return img


def sidebar() -> Image.Image:
    k = 3  # draw at 3x, then shrink for clean edges
    w, h = 164 * k, 314 * k
    img = gradient(w, h, (12, 16, 21), (6, 8, 10)).convert("RGBA")

    # faint pulse lines running down the panel
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for j, (cy, a) in enumerate(((0.93, 0.07), (0.97, 0.04))):
        ld.line(pulse_points(-w * 0.1, w * 1.1, h * cy, h * 0.05), fill=LIME + (int(255 * a * 4),), width=2 * k)
    img = Image.alpha_composite(img, layer)

    mark = draw_mark(int(112 * k))
    img.alpha_composite(mark, (int((w - mark.width) / 2), int(34 * k)))

    d = ImageDraw.Draw(img)
    big = font("bahnschrift.ttf", 22 * k)
    small = font("consolab.ttf", 9 * k)
    mid = font("segoeui.ttf", 10 * k)

    def centered(text, y, fnt, fill, spacing=0):
        # manual letter spacing
        widths = [d.textlength(c, font=fnt) for c in text]
        total = sum(widths) + spacing * (len(text) - 1)
        x = (w - total) / 2
        for c, cw in zip(text, widths):
            d.text((x, y), c, font=fnt, fill=fill)
            x += cw + spacing

    centered("PULSECAST", 172 * k, big, WHITE, 1 * k)
    centered("S T U D I O", 204 * k, small, LIME)
    d.line([(w * 0.34, 226 * k), (w * 0.66, 226 * k)], fill=(40, 50, 60), width=k)
    centered("PS5 to Twitch + Facebook", 238 * k, mid, DIM)
    centered("no capture card", 254 * k, mid, DIM)
    centered("LIVE", 268 * k, small, (255, 90, 79), 2 * k)
    return img.convert("RGB").resize((164, 314), Image.LANCZOS)


def header() -> Image.Image:
    k = 4
    w, h = 150 * k, 57 * k
    img = gradient(w, h, (12, 16, 21), (6, 8, 10)).convert("RGBA")
    mark = draw_mark(int(44 * k))
    img.alpha_composite(mark, (int(10 * k), int((h - mark.height) / 2)))
    d = ImageDraw.Draw(img)
    d.text((int(62 * k), int(14 * k)), "PULSECAST", font=font("bahnschrift.ttf", 14 * k), fill=WHITE)
    d.text((int(63 * k), int(35 * k)), "S T U D I O", font=font("consolab.ttf", 8 * k), fill=LIME)
    return img.convert("RGB").resize((150, 57), Image.LANCZOS)


if __name__ == "__main__":
    save_icon()
    side = sidebar()
    side.save(OUT / "installerSidebar.bmp")
    side.save(OUT / "uninstallerSidebar.bmp")
    header().save(OUT / "installerHeader.bmp")
    print("wrote", sorted(p.name for p in OUT.iterdir() if p.suffix in {".png", ".ico", ".bmp"}))
