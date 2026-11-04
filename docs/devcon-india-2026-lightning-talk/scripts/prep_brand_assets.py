"""Cut the DevCon logo, FOSSASIA/OTS logos, DevCon diamond artwork and speaker photo
out of the official title slide, so every slide uses the same artwork as the session banner.

The title slide sits on a soft lavender gradient. Each crop is converted to a
transparent PNG by removing that local background colour ("colour to alpha"),
which keeps the anti-aliased logo edges intact.

Usage: python3 scripts/prep_brand_assets.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "src" / "assets" / "brand"
TITLE = BRAND / "title-slide-light.png"

# (left, top, right, bottom) in the 1920x1080 title slide.
CROPS = {
    "devcon-viii-logo.png": (100, 82, 392, 214),
    "fossasia-ots-logos.png": (106, 974, 326, 1030),
}


def border_plane(arr: np.ndarray) -> np.ndarray:
    """Fit a linear colour plane to the crop border so a gradient bg is removed."""
    h, w, _ = arr.shape
    ys, xs = np.mgrid[0:h, 0:w]
    mask = np.zeros((h, w), bool)
    mask[:3, :] = mask[-3:, :] = mask[:, :3] = mask[:, -3:] = True
    A = np.stack([xs[mask], ys[mask], np.ones(mask.sum())], 1)
    plane = np.zeros_like(arr)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, arr[..., c][mask], rcond=None)
        plane[..., c] = coef[0] * xs + coef[1] * ys + coef[2]
    return plane


def colour_to_alpha(img: Image.Image, bg: np.ndarray | None = None) -> Image.Image:
    arr = np.asarray(img.convert("RGB")).astype(float)
    if bg is None:
        bg = border_plane(arr)
    diff = arr - bg
    # The title slide is dithered: ignore tiny brightening, it is noise, not ink.
    up = np.where(diff > 9, diff / np.maximum(255 - bg, 1), 0)
    down = np.where(arr < bg, (bg - arr) / np.maximum(bg, 1), 0)
    alpha = np.clip(np.maximum(up, down).max(2), 0, 1)
    alpha = np.where(alpha < 0.10, 0, alpha)  # drop gradient noise
    # Median filter removes isolated dither speckles.
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    alpha = np.asarray(alpha_img).astype(float) / 255
    a3 = np.maximum(alpha[..., None], 1e-6)
    rgb = np.clip((arr - bg * (1 - a3)) / a3, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def slide_plane(title: Image.Image, box: tuple[int, int, int, int]) -> np.ndarray:
    """Background gradient of the whole title slide, fitted on clean margin pixels."""
    arr = np.asarray(title).astype(float)
    pts = [(x, y) for x in range(10, 1100, 40) for y in (10, 30, 60, 250, 280)]
    pts += [(x, y) for x in (20, 40, 60) for y in range(0, 1080, 40)]
    A = np.array([[x, y, 1] for x, y in pts], float)
    l, t, r, b = box
    ys, xs = np.mgrid[t:b, l:r]
    plane = np.zeros((b - t, r - l, 3))
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, np.array([arr[y, x, c] for x, y in pts]), rcond=None)
        plane[..., c] = coef[0] * xs + coef[1] * ys + coef[2]
    return plane


def main() -> None:
    title = Image.open(TITLE).convert("RGB")

    # The DevCon diamond artwork and the "CLS lightning talk / OTS" badge, so the
    # title slide can be re-typeset without the faint watermark or old text.
    box = (1236, 216, 1920, 1080)
    hero = colour_to_alpha(title.crop(box), slide_plane(title, box))
    # Drop the faint watermark: keep only pixels that are clearly ink, then ramp the edge.
    a = np.asarray(hero.getchannel("A")).astype(float) / 255
    a = np.clip((a - 0.28) / 0.5, 0, 1)
    hero.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    hero.resize((hero.width * 2, hero.height * 2), Image.LANCZOS).save(BRAND / "devcon-hero-art.png")
    print("wrote", BRAND / "devcon-hero-art.png")
    for name, box in CROPS.items():
        crop = title.crop(box)
        keyed = colour_to_alpha(crop)
        keyed.resize((crop.width * 3, crop.height * 3), Image.LANCZOS).save(BRAND / name)
        print("wrote", BRAND / name)

    # Speaker photo: the circular crop from the title slide, used on slide 1.
    cx, cy, r = 172, 860, 54
    face = title.crop((cx - r, cy - r, cx + r, cy + r)).resize((432, 432), Image.LANCZOS)
    mask = Image.new("L", face.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 431, 431), fill=255)
    face.putalpha(mask)
    face.save(BRAND / "speaker-photo.png")
    print("wrote", BRAND / "speaker-photo.png")


if __name__ == "__main__":
    main()
