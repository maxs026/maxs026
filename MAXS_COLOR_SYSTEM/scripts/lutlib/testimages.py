"""Procedural, reproducible test images.

All images are SYNTHETIC (generated from code with a fixed seed), not real
photographs. They are authored in Rec.709 display light and returned
display-encoded (BT.1886, V = L ** (1/2.4)), i.e. what the technical LUT
would output and what a look LUT expects as input.

The Apple Log chart is the exception: it is built in scene-linear BT.2020
and encoded with the Apple Log curve published by Apple (via colour-science,
cross-checked against OpenColorIO in tests/). It is only used to exercise the
technical LUT.
"""

from __future__ import annotations

import numpy as np

from . import colorspace as cs

W, H = 960, 540
SEED = 20240915


def _rng(k: int) -> np.random.Generator:
    return np.random.default_rng(SEED + k)


def fbm(h, w, rng, octaves=5, base=4, persistence=0.55):
    """Fractal value noise in [0, 1] (bilinear up-sampled random grids)."""
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        g = rng.random((n + 1, int(n * w / h) + 2))
        ys = np.linspace(0, n, h)
        xs = np.linspace(0, g.shape[1] - 1.001, w)
        y0 = np.floor(ys).astype(int).clip(0, n - 1)
        x0 = np.floor(xs).astype(int)
        fy = (ys - y0)[:, None]
        fx = (xs - x0)[None, :]
        a = g[y0][:, x0]
        b = g[y0][:, x0 + 1]
        c = g[y0 + 1][:, x0]
        d = g[y0 + 1][:, x0 + 1]
        layer = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
        out += amp * layer
        total += amp
        amp *= persistence
    return out / total


def _col(*rgb_display):
    """Colour given as display-encoded Rec.709 -> display light."""
    return cs.display_to_linear(np.array(rgb_display, dtype=np.float64))


def _encode(lin):
    return cs.linear_to_display(np.clip(lin, 0.0, 1.0)).astype(np.float32)


def _lerp(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t


def img_ciel():
    rng = _rng(1)
    y = np.linspace(0, 1, H)[:, None]
    top, horizon = _col(0.33, 0.52, 0.80), _col(0.74, 0.82, 0.90)
    sky = _lerp(top, horizon, np.repeat(y ** 0.8, W, 1))
    clouds = cs.smoothstep(0.50, 0.75, fbm(H, W, rng, base=3))
    cloud_col = _lerp(_col(0.72, 0.73, 0.75), _col(0.97, 0.97, 0.97), fbm(H, W, rng, base=6))
    img = _lerp(sky, cloud_col, clouds * 0.9)
    # right third: overcast Paris sky (neutral greys)
    x = np.linspace(0, 1, W)[None, :]
    over = _lerp(_col(0.62, 0.63, 0.65), _col(0.86, 0.86, 0.87), fbm(H, W, rng, base=2))
    img = _lerp(img, over, np.repeat(cs.smoothstep(0.62, 0.70, x), H, 0))
    return _encode(img)


def skin_references():
    """Skin reflectances: ColorChecker 'dark skin' / 'light skin' (colour-science
    dataset 'ColorChecker24 - After November 2014', Bradford-adapted to D65)
    plus interpolations between them in OkLab. Display-encoded Rec.709."""
    import colour
    cc = colour.CCS_COLOURCHECKERS["ColorChecker24 - After November 2014"]
    xyY = np.array([cc.data["dark skin"], cc.data["light skin"]])
    rgb = colour.XYZ_to_RGB(colour.xyY_to_XYZ(xyY), "ITU-R BT.709",
                            illuminant=cc.illuminant, chromatic_adaptation_transform="Bradford")
    lab = cs.linear_rgb_to_oklab(np.clip(rgb, 0, 1))
    tones = []
    for t in np.linspace(0, 1, 6):
        base = lab[0] * (1 - t) + lab[1] * t
        for dL in (-0.08, 0.0, 0.08):
            tones.append(base + np.array([dL, 0, 0]))
    lin = np.clip(cs.oklab_to_linear_rgb(np.array(tones)), 0, 1)
    return cs.linear_to_display(lin)


def skin_envelope():
    """Carnation envelope DERIVED (not measured) from the two measured skin
    patches above (OkLCh h 38-42 deg, C 0.054-0.070): lightness 0.35-0.85
    (very dark to very light complexions), chroma 0.035-0.10, hue 30-55 deg
    (redder to more yellow complexions). Display-encoded Rec.709, in gamut only."""
    L, C, h = np.meshgrid(np.linspace(0.35, 0.85, 6), np.linspace(0.035, 0.10, 4),
                          np.linspace(30, 55, 6), indexing="ij")
    lch = np.stack([L.ravel(), C.ravel(), h.ravel()], -1)
    lin = cs.oklab_to_linear_rgb(cs.lch_to_lab(lch))
    ok = np.all((lin >= 0) & (lin <= 1), axis=1)
    return cs.linear_to_display(lin[ok])


def img_peau():
    tones = cs.display_to_linear(skin_references())[1::3]  # 6 base tones
    yy, xx = np.mgrid[0:H, 0:W]
    img = np.tile(_col(0.30, 0.30, 0.31), (H, W, 1))
    r = 85
    for i, tone in enumerate(tones):
        cx = 90 + i * 156
        for row, cy in enumerate((150, 390)):
            d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / r ** 2
            inside = d2 < 1
            z = np.sqrt(np.clip(1 - d2, 0, 1))
            nx, ny = (xx - cx) / r, (yy - cy) / r
            light = np.array([-0.5, -0.5, 0.7]) / np.linalg.norm([-0.5, -0.5, 0.7])
            shade = np.clip(nx * light[0] + ny * light[1] + z * light[2], 0, 1)
            key = 1.15 if row == 0 else 0.55   # top row brightly lit, bottom row dim
            val = tone * (0.12 + 0.88 * shade)[..., None] * key
            img[inside] = val[inside]
    return _encode(img)


def img_vegetation():
    rng = _rng(3)
    n1, n2, n3 = fbm(H, W, rng, base=8), fbm(H, W, rng, base=16), fbm(H, W, rng, base=4)
    dark, mid, light = _col(0.10, 0.20, 0.07), _col(0.28, 0.45, 0.18), _col(0.60, 0.70, 0.30)
    img = _lerp(_lerp(dark, mid, cs.smoothstep(0.3, 0.6, n1)), light, cs.smoothstep(0.6, 0.8, n2))
    olive = _col(0.42, 0.44, 0.22)
    img = _lerp(img, olive, cs.smoothstep(0.55, 0.75, n3) * 0.6)
    return _encode(img)


def img_architecture():
    rng = _rng(4)
    img = np.tile(_col(0.70, 0.71, 0.73), (H, W, 1))            # overcast sky
    stone = _col(0.78, 0.72, 0.62)                                # Paris limestone
    tex = fbm(H, W, rng, base=12)[..., None]
    for x0, x1, top, tone in ((0, 330, 90, 1.0), (330, 640, 60, 0.9), (640, 960, 110, 0.8)):
        block = stone * tone * (0.92 + 0.16 * tex[top:, x0:x1])
        img[top:, x0:x1] = block
        img[top - 30:top, x0:x1] = _col(0.42, 0.45, 0.50)          # zinc roof
        for wy in range(top + 40, H - 40, 95):
            for wx in range(x0 + 25, x1 - 50, 70):
                img[wy:wy + 60, wx:wx + 34] = _col(0.12, 0.14, 0.18)       # window
                img[wy:wy + 20, wx:wx + 34] = _col(0.45, 0.52, 0.62)       # sky reflection
                img[wy + 60:wy + 66, wx - 4:wx + 38] = _col(0.16, 0.16, 0.17)  # balcony
    img[:, 328:332] = _col(0.2, 0.2, 0.2)
    img[:, 638:642] = _col(0.2, 0.2, 0.2)
    return _encode(img)


def img_eau():
    rng = _rng(5)
    yy, xx = np.mgrid[0:H, 0:W] / H
    ripples = 0.5 + 0.5 * np.sin(40 * yy + 6 * fbm(H, W, rng, base=6) * 3)
    deep, surf = _col(0.18, 0.28, 0.30), _col(0.42, 0.52, 0.55)
    img = _lerp(deep, surf, ripples * 0.6 + 0.4 * yy)
    spec = cs.smoothstep(0.93, 0.99, ripples * fbm(H, W, rng, base=10) * 1.6)
    img = _lerp(img, np.ones(3), spec)
    return _encode(img)


def img_blanc():
    img = np.ones((H, W, 3))
    levels = np.linspace(0.80, 1.00, 11)
    for i, v in enumerate(levels):
        img[:H // 2, i * W // 11:(i + 1) * W // 11] = v
    img[H // 2:, : W // 3] = _col(1.00, 0.97, 0.92)   # warm paper
    img[H // 2:, W // 3: 2 * W // 3] = 1.0              # pure white
    img[H // 2:, 2 * W // 3:] = _col(0.93, 0.96, 1.00)  # cool paper
    # levels given as display values in top half:
    img[:H // 2] = cs.display_to_linear(img[:H // 2])
    return _encode(img)


def img_gris():
    img = np.zeros((H, W, 3))
    img[: H // 2] = np.linspace(0, 1, W)[None, :, None]           # smooth ramp
    steps = np.repeat(np.linspace(0, 1, 21), int(np.ceil(W / 21)))[:W]
    img[H // 2:] = steps[None, :, None]
    return img.astype(np.float32)   # values are display-encoded already


def img_faible_lumiere():
    rng = _rng(8)
    yy, xx = np.mgrid[0:H, 0:W]
    sky = _lerp(_col(0.04, 0.05, 0.10), _col(0.10, 0.10, 0.14), np.repeat(np.linspace(0, 1, H)[:, None], W, 1))
    img = sky.copy()
    ground = yy > H * 0.62
    img[ground] = (_col(0.06, 0.055, 0.05) * (0.7 + 0.6 * fbm(H, W, rng, base=10)[..., None]))[ground]
    for lx, col in ((250, _col(1.0, 0.72, 0.38)), (700, _col(0.95, 0.95, 1.0))):
        d = np.sqrt((xx - lx) ** 2 + (yy - 170) ** 2)
        glow = np.exp(-d / 45)[..., None]
        img = img + col * glow
        img[(d < 9)] = col * 1.0
    # near-black detail wedge (display values 0 .. 0.10)
    for i, v in enumerate(np.linspace(0.0, 0.10, 11)):
        img[H - 60:, 40 + i * 50:40 + (i + 1) * 50] = cs.display_to_linear(np.array([v, v, v]))
    return _encode(img)


def img_forte_lumiere():
    rng = _rng(9)
    yy, xx = np.mgrid[0:H, 0:W]
    img = _lerp(_col(0.80, 0.86, 0.94), _col(0.97, 0.97, 0.96), np.repeat(np.linspace(0, 1, H)[:, None], W, 1))
    d = np.sqrt((xx - 720) ** 2 + (yy - 120) ** 2)
    img = img + np.exp(-d / 60)[..., None] * 0.8
    sand = _col(0.90, 0.84, 0.72) * (0.92 + 0.12 * fbm(H, W, rng, base=14)[..., None])
    img[yy > H * 0.6] = sand[yy > H * 0.6]
    skin = cs.display_to_linear(skin_references()[14])
    face = ((xx - 250) ** 2 + (yy - 250) ** 2) < 90 ** 2
    img[face] = skin * 1.1
    return _encode(img)


def img_colorchecker():
    import colour
    cc = colour.CCS_COLOURCHECKERS["ColorChecker24 - After November 2014"]
    xyY = np.array(list(cc.data.values()))
    rgb = colour.XYZ_to_RGB(colour.xyY_to_XYZ(xyY), "ITU-R BT.709",
                            illuminant=cc.illuminant, chromatic_adaptation_transform="Bradford")
    img = np.tile(_col(0.2, 0.2, 0.2), (H, W, 1))
    pw, ph = W // 6, H // 4
    for i, c in enumerate(np.clip(rgb, 0, 1)):
        r, k = divmod(i, 6)
        img[r * ph + 8:(r + 1) * ph - 8, k * pw + 8:(k + 1) * pw - 8] = c
    return _encode(img)


def img_couleurs_saturees():
    """Top: gradients from mid grey to pure red, yellow, green, cyan, blue,
    magenta (Rec.709 primaries / secondaries at full saturation).
    Bottom: neon lights (pink, cyan, green, orange, violet) with saturated
    glows on a near-black background."""
    img = np.zeros((H, W, 3))
    t = np.linspace(0, 1, W)[:, None]
    targets = [(1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1), (1, 0, 1)]
    band = (H // 2) // len(targets)
    for i, c in enumerate(targets):
        row = 0.5 * (1 - t) + np.array(c, float) * t                 # display values
        img[i * band:(i + 1) * band] = cs.display_to_linear(row)[None, :, :]
    yy, xx = np.mgrid[0:H, 0:W]
    bottom = yy >= H // 2
    img[bottom] = _col(0.03, 0.03, 0.04)
    neons = [(1, 0.1, 0.6), (0.1, 1, 0.95), (0.4, 1, 0.1), (1, 0.45, 0.0), (0.55, 0.0, 1.0)]
    for i, c in enumerate(neons):
        cx, cy = 100 + i * 190, int(H * 0.75)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        col = cs.display_to_linear(np.array(c, float))
        glow = (np.exp(-d / 38.0) * bottom)[..., None]
        img = img + col * glow
        core = (np.abs(xx - cx) < 50) & (np.abs(yy - cy) < 6)
        img[core] = col
    return _encode(img)


def img_carnations():
    """Measured ColorChecker skins (first row) then the derived carnation
    envelope (see skin_envelope), as flat patches on mid grey."""
    patches = np.vstack([skin_references(), skin_envelope()])
    img = np.tile(_col(0.45, 0.45, 0.45), (H, W, 1))
    cols = 18
    pw, ph = W // cols, H // int(np.ceil(len(patches) / cols))
    for i, c in enumerate(patches):
        r, k = divmod(i, cols)
        img[r * ph + 2:(r + 1) * ph - 2, k * pw + 2:(k + 1) * pw - 2] = cs.display_to_linear(c)
    return _encode(img)


IMAGES = {
    "01_ciel": img_ciel,
    "02_peau": img_peau,
    "03_vegetation": img_vegetation,
    "04_architecture": img_architecture,
    "05_eau": img_eau,
    "06_blanc_neutre": img_blanc,
    "07_gris_neutre": img_gris,
    "08_faible_lumiere": img_faible_lumiere,
    "09_forte_lumiere": img_forte_lumiere,
    "10_colorchecker": img_colorchecker,
    "11_couleurs_saturees": img_couleurs_saturees,
    "12_carnations": img_carnations,
}


def applelog_chart():
    """Scene-linear BT.2020 chart encoded with the published Apple Log curve.

    Top: exposure wedge from -8 to +6 stops around 18 % grey.
    Bottom: ColorChecker 24 (D65, BT.2020) at 0 EV.
    """
    import colour
    img = np.zeros((H, W, 3))
    stops = np.linspace(-8, 6, 15)
    for i, s in enumerate(stops):
        img[: H // 3, i * W // 15:(i + 1) * W // 15] = 0.18 * 2.0 ** s
    img[H // 3: H // 3 + 20] = (0.18 * 2.0 ** np.linspace(-8, 6, W))[None, :, None]
    cc = colour.CCS_COLOURCHECKERS["ColorChecker24 - After November 2014"]
    xyY = np.array(list(cc.data.values()))
    rgb = colour.XYZ_to_RGB(colour.xyY_to_XYZ(xyY), "ITU-R BT.2020",
                            illuminant=cc.illuminant, chromatic_adaptation_transform="Bradford")
    y0 = H // 3 + 30
    pw, ph = W // 12, (H - y0) // 2
    for i, c in enumerate(rgb):
        r, k = divmod(i, 12)
        img[y0 + r * ph + 4:y0 + (r + 1) * ph - 4, k * pw + 4:(k + 1) * pw - 4] = c
    enc = colour.models.log_encoding_AppleLogProfile(img)
    return np.clip(enc, 0, 1).astype(np.float32)
