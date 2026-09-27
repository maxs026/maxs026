"""Minimal video scopes (PIL only): luma waveform and RGB histogram.

Conventions of video scopes: black background, recessive graticule at
0 / 25 / 50 / 75 / 100 %, channel colours R / G / B identify the channels and
are labelled in text. Values are Rec.709 display-encoded code values (0-1).
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REC709_LUMA_PRIME = np.array([0.2126, 0.7152, 0.0722])   # BT.709 Y' from R'G'B'
BG = (10, 10, 10)
GRID = (60, 60, 60)
INK = (170, 170, 170)


def _font(size=12):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _graticule(im: Image.Image, top: int, left: int, h: int, w: int, horizontal_levels: bool):
    d = ImageDraw.Draw(im)
    for pct in (0, 25, 50, 75, 100):
        if horizontal_levels:
            y = top + h - 1 - int(round(pct / 100 * (h - 1)))
            d.line([(left, y), (left + w, y)], fill=GRID)
            d.text((2, y - 6), f"{pct}", fill=INK, font=_font(10))
        else:
            x = left + int(round(pct / 100 * (w - 1)))
            d.line([(x, top), (x, top + h)], fill=GRID)
            d.text((x - 6, top + h + 2), f"{pct}", fill=INK, font=_font(10))


def waveform(img: np.ndarray, title: str, w: int = 480, h: int = 200) -> Image.Image:
    """Luma (Y') waveform: x = image column, y = level; brightness = pixel count (log)."""
    y = np.clip(img[..., :3] @ REC709_LUMA_PRIME, 0, 1)
    cols = np.linspace(0, y.shape[1] - 1, w).astype(int)
    ys = y[:, cols]
    bins = np.clip((ys * (h - 1)).round().astype(int), 0, h - 1)
    hist = np.zeros((h, w))
    np.add.at(hist, (h - 1 - bins, np.broadcast_to(np.arange(w), bins.shape)), 1)
    v = np.log1p(hist) / max(np.log1p(hist).max(), 1e-9)
    left, top = 26, 20
    im = Image.new("RGB", (w + left + 6, h + top + 6), BG)
    plot = (np.clip(v, 0, 1) ** 0.6 * 235).astype(np.uint8)
    im.paste(Image.fromarray(np.stack([plot] * 3, -1)), (left, top))
    _graticule(im, top, left, h, w, horizontal_levels=True)
    ImageDraw.Draw(im).text((left, 3), title, fill=INK, font=_font(12))
    return im


def histogram(img: np.ndarray, title: str, w: int = 480, h: int = 160) -> Image.Image:
    """RGB histogram: one 2 px line per channel, linear counts normalised to the
    99.5th percentile of all bins (so a few spikes do not flatten the rest)."""
    left, top = 8, 20
    x = np.clip(img.reshape(-1, 3), 0, 1)
    hists = [np.histogram(x[:, c], bins=w, range=(0, 1))[0].astype(float) for c in range(3)]
    ref = max(np.percentile(np.concatenate(hists), 99.5), 1.0)
    out = Image.new("RGB", (w + left + 6, h + top + 18), BG)
    _graticule(out, top, left, h, w, horizontal_levels=False)
    d = ImageDraw.Draw(out)
    colours = [(230, 70, 70), (70, 200, 90), (80, 130, 255)]      # channel identity R, G, B
    for hist, col in zip(hists, colours):
        v = np.clip(hist / ref, 0, 1)
        pts = [(left + i, top + h - 1 - int(round(vv * (h - 1)))) for i, vv in enumerate(v)]
        d.line(pts, fill=col, width=2)
    d.text((left, 3), f"{title}", fill=INK, font=_font(12))
    for i, (lab, col) in enumerate(zip("RGB", colours)):
        d.text((left + w - 60 + i * 18, 3), lab, fill=col, font=_font(12))
    return out


def side_by_side(a: Image.Image, b: Image.Image, gap: int = 8) -> Image.Image:
    out = Image.new("RGB", (a.width + b.width + gap, max(a.height, b.height)), BG)
    out.paste(a, (0, 0))
    out.paste(b, (a.width + gap, 0))
    return out
