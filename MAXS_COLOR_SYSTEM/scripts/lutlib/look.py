"""Parametric creative look engine.

A look is a pure function  Rec.709 display RGB -> Rec.709 display RGB.
It knows nothing about Apple Log: it is meant to be placed *after* the
technical transform (00_TECHNICAL/AppleLog_to_Rec709.cube).

Processing chain (float64 everywhere, all steps documented in README.md)
------------------------------------------------------------------------
1. decode     V -> display light, BT.1886 (V ** 2.4)
2. OkLab      display light (Rec.709 primaries) -> OkLab -> OkLCh
3. tone       monotone PCHIP curve on OkLab L (lightness only, hue untouched)
              chroma follows lightness: C *= (L'/L) ** chroma_follow
4. saturation C *= global * zone(L)       (shadows / highlights multipliers)
5. hue bands  selective chroma gain + small hue shift, raised-cosine weights,
              only on sufficiently chromatic pixels (neutrals untouched),
              attenuated on skin (skin_protect)
6. split tone small (a, b) offsets in shadows / mids / highlights; the weights
              fall to 0 at L=0 and L=1 so pure black and pure white stay neutral
7. gamut      soft compression along the straight linear-RGB line toward the
              grey of equal lightness (knee + tanh): convex cube -> continuous
8. hue guard  final hue of chromatic inputs kept within +/- max_hue_shift_deg
              of the input hue (bands, split toning AND gamut drift)
9. encode     display light -> V ** (1/2.4)
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import colorspace as cs
from .pchip import Pchip

ZONES = {
    # (fade-in start, fade-in end, fade-out start, fade-out end) on OkLab L.
    # Shadows fade in from L=0 so that pure black stays neutral ("noirs propres").
    # Highlights fade out before L=1 so that pure white stays neutral.
    "shadows": (0.00, 0.12, 0.20, 0.55),
    "midtones": (0.25, 0.50, 0.62, 0.85),
    "highlights": (0.60, 0.82, 0.92, 1.00),
}


@dataclass
class ToneParams:
    pivot: float = 0.57          # OkLab L of display mid-grey (V=0.5 -> L~0.574)
    contrast: float = 1.0        # slope at the pivot (1 = unchanged)
    shadow_x: float = 0.20       # position of the shadow control point
    highlight_x: float = 0.82    # position of the highlight control point
    black_lift: float = 0.0      # OkLab L added at input black, fades out upwards
    white_out: float = 1.0       # OkLab L reached by input white (<= 1: soft roll-off)
    chroma_follow: float = 1.0   # how chroma follows lightness changes
    points: list | None = None   # optional explicit [[x, y], ...] override

    def control_points(self):
        if self.points:
            pts = np.asarray(self.points, dtype=np.float64)
            return pts[:, 0], pts[:, 1]
        p, c = self.pivot, self.contrast
        xs, xh = self.shadow_x, self.highlight_x
        ys = p - (p - xs) * c
        yh = p + (xh - p) * c
        x = np.array([0.0, xs, p, xh, 1.0])
        y = np.array([0.0, ys, p, yh, self.white_out])
        return x, y

    def curve(self):
        x, y = self.control_points()
        base = Pchip(x, y)
        lift = self.black_lift

        def f(L):
            yv = base(L)
            # additive lift decaying as (1-y)^4: d/dy = 1 - 4*lift*(1-y)^3 > 0
            # for lift < 0.25, so monotonicity is preserved.
            return yv + lift * (1.0 - yv) ** 4
        return f


@dataclass
class HueBand:
    name: str
    center: float                  # OkLCh hue (degrees)
    width: float                   # half-width of the raised cosine (degrees)
    chroma: float = 1.0            # chroma gain at band centre
    hue_shift: float = 0.0         # hue rotation at band centre (degrees)
    lightness: float = 0.0         # OkLab L offset at band centre (small!)
    min_chroma: tuple = (0.015, 0.035)   # ramp: neutrals are never affected
    skin_protect: bool = True


@dataclass
class SkinProtect:
    center: float = 40.0           # ColorChecker skins sit at h ~ 38-42 deg
    width: float = 28.0
    chroma_range: tuple = (0.02, 0.12)
    amount: float = 0.8            # 0 = no protection, 1 = full
    saturation: float = 0.5        # share of global/zone saturation change undone on skin


@dataclass
class LookParams:
    name: str
    description: str = ""
    tone: ToneParams = field(default_factory=ToneParams)
    saturation: float = 1.0
    sat_shadows: float = 1.0
    sat_highlights: float = 1.0
    split: dict = field(default_factory=dict)   # zone -> (hue_deg, strength)
    bands: list = field(default_factory=list)
    skin: SkinProtect = field(default_factory=SkinProtect)
    max_hue_shift: float = 6.0
    gamut_knee: float = 0.85
    hue_guard_chroma: tuple = (0.02, 0.04)   # OkLab C ramp of the hue guard


def _raised_cos(d, width):
    d = np.abs(d)
    return np.where(d < width, 0.5 * (1.0 + np.cos(np.pi * d / width)), 0.0)


def _zone_weight(L, zone):
    a, b, c, d = ZONES[zone]
    return cs.smoothstep(a, b, L) * (1.0 - cs.smoothstep(c, d, L))


def skin_weight(lch, skin: SkinProtect):
    L, C, h = lch[..., 0], lch[..., 1], lch[..., 2]
    lo, hi = skin.chroma_range
    wc = cs.smoothstep(lo * 0.5, lo, C) * (1.0 - cs.smoothstep(hi, hi * 1.4, C))
    return _raised_cos(cs.hue_diff(skin.center, h), skin.width) * wc


def apply_look(rgb: np.ndarray, p: LookParams) -> np.ndarray:
    shape = rgb.shape
    v = np.clip(np.asarray(rgb, dtype=np.float64).reshape(-1, 3), 0.0, 1.0)

    lin = cs.display_to_linear(v)
    lch = cs.lab_to_lch(cs.linear_rgb_to_oklab(lin))
    L0, C, h = lch[:, 0].copy(), lch[:, 1].copy(), lch[:, 2].copy()

    sk = skin_weight(lch, p.skin)          # 0..1, how "skin-like" a pixel is
    w_skin = sk * p.skin.amount

    # 3. tone
    L = p.tone.curve()(np.clip(L0, 0.0, 1.0))
    ratio = np.where(L0 > 1e-4, L / np.maximum(L0, 1e-4), 1.0)
    C = C * np.clip(ratio, 0.5, 2.0) ** p.tone.chroma_follow

    # 4. saturation by zone; skin keeps part of its chroma (skin.saturation)
    zone = np.interp(L, [0.0, p.tone.pivot, 1.0], [p.sat_shadows, 1.0, p.sat_highlights])
    gain = p.saturation * zone
    C = C * (gain + (1.0 - gain) * sk * p.skin.saturation)

    # 5. hue bands
    shift_total = np.zeros_like(h)
    for band in p.bands:
        lo, hi = band.min_chroma
        w = _raised_cos(cs.hue_diff(band.center, h), band.width) * cs.smoothstep(lo, hi, lch[:, 1])
        if band.skin_protect:
            w = w * (1.0 - w_skin)
        C = C * (1.0 + w * (band.chroma - 1.0))
        shift = np.clip(band.hue_shift, -p.max_hue_shift, p.max_hue_shift)
        shift_total += w * shift
        L = L + w * band.lightness
    h = h + np.clip(shift_total, -p.max_hue_shift, p.max_hue_shift)

    lab = cs.lch_to_lab(np.stack([L, C, h], axis=-1))

    # 6. split toning (luminance-neutral offsets in a/b). Zones are evaluated on
    #    the INPUT lightness L0, so input black / white stay neutral even when
    #    the tone curve lifts blacks or lowers white.
    for zone_name, (hue, strength) in p.split.items():
        w = _zone_weight(L0, zone_name) * (1.0 - w_skin) * strength
        lab[:, 1] += w * np.cos(np.radians(hue))
        lab[:, 2] += w * np.sin(np.radians(hue))

    # 7. soft gamut compression in LINEAR RGB (see gamut_soft), then
    # 8. hue guard on the FINAL colour: the hue of every chromatic input colour
    #    ends within +/- max_hue_shift of its input hue, whatever moved it
    #    (bands, split toning, gamut compression). Near-neutral inputs (hue
    #    undefined) are exempt: tinting them is the purpose of split toning.
    #    The allowance widens smoothly from max_hue_shift (C >= c1) to 180 deg
    #    (C <= c0). A colour rotated back is projected into the gamut if needed
    #    (projection only, continuous, no second compression).
    lab[:, 0] = np.clip(lab[:, 0], 0.0, 1.0)
    c0, c1 = p.hue_guard_chroma
    allowed = p.max_hue_shift + (180.0 - p.max_hue_shift) * (1.0 - cs.smoothstep(c0, c1, lch[:, 1]))
    lab = hue_guard(lab, lch[:, 2], allowed)
    out = gamut_soft(lab, knee=p.gamut_knee)
    for _ in range(4):
        lch_out = cs.lab_to_lch(cs.linear_rgb_to_oklab(out))
        dh = cs.hue_diff(lch[:, 2], lch_out[:, 2])
        bad = np.abs(dh) > allowed + 1e-4
        if not np.any(bad):
            break
        fixed = hue_guard(cs.lch_to_lab(lch_out[bad]), lch[bad, 2], allowed[bad])
        out[bad] = gamut_project(fixed)

    return cs.linear_to_display(out).reshape(shape)


def hue_guard(lab: np.ndarray, h_in: np.ndarray, allowed: np.ndarray) -> np.ndarray:
    """Clamp the hue of ``lab`` to h_in +/- allowed (constant L and C)."""
    lch = cs.lab_to_lch(lab)
    lch[:, 2] = h_in + np.clip(cs.hue_diff(h_in, lch[:, 2]), -allowed, allowed)
    return cs.lch_to_lab(lch)


def _ray_to_grey(lab: np.ndarray):
    """Linear RGB colour, its grey of equal OkLab lightness (Y = L^3) and the
    ratio r = |c - g| / |exit - g| along the straight segment grey -> colour
    (r = 1 on the cube surface, r < 1 inside). The Rec.709 cube is convex, so
    the exit point is unique and r is a continuous function of the colour."""
    rgb = cs.oklab_to_linear_rgb(lab)
    g = np.clip(lab[:, 0], 0.0, 1.0) ** 3
    d = rgb - g[:, None]
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(d < 0, g[:, None] / -d, np.where(d > 0, (1.0 - g)[:, None] / d, np.inf))
    t_exit = t.min(axis=1)
    r = np.where(t_exit > 0, 1.0 / np.where(t_exit > 0, t_exit, 1.0), np.inf)
    return rgb, g, d, r


def gamut_soft(lab: np.ndarray, knee: float = 0.85) -> np.ndarray:
    """Soft gamut compression toward the Rec.709 [0,1]^3 cube.

    Each colour moves on the straight line (in linear RGB) toward the grey of
    the same OkLab lightness. With r its relative distance to the cube surface
    along that line: r <= knee is untouched, above the knee
    r' = knee + (1 - knee) * tanh((r - knee) / (1 - knee)) (C1 at the knee,
    strictly increasing, < 1): no hard clip, no plateau, no discontinuity.

    Why linear RGB and not OkLCh: near the blue primary the constant-L,
    constant-hue chroma line leaves the cube and re-enters it, so "maximum
    chroma at (L, h)" is not continuous there (measured: in gamut for
    C in [0, 0.271] and [0.287, 0.302]). The linear-RGB line has a single exit.
    The slight hue drift it causes is bounded afterwards by the hue guard.
    """
    rgb, g, d, r = _ray_to_grey(lab)
    r2 = np.where(r > knee, knee + (1.0 - knee) * np.tanh((r - knee) / (1.0 - knee)), r)
    scale = np.where(np.isfinite(r) & (r > 0), r2 / np.where(r > 0, r, 1.0), 0.0)
    return np.clip(g[:, None] + d * scale[:, None], 0.0, 1.0)


def gamut_project(lab: np.ndarray) -> np.ndarray:
    """Project out-of-gamut colours onto the cube surface along the same
    grey line (identity inside the cube; continuous)."""
    rgb, g, d, r = _ray_to_grey(lab)
    scale = np.where(r > 1.0, 1.0 / np.where(np.isfinite(r), r, 1.0), 1.0)
    scale = np.where(np.isfinite(r), scale, 0.0)
    return np.clip(g[:, None] + d * scale[:, None], 0.0, 1.0)


def params_from_config(name: str, cfg: dict, global_cfg: dict) -> LookParams:
    tone = ToneParams(**cfg.get("tone", {}))
    sat = cfg.get("saturation", {})
    split = {z: (float(v["hue"]), float(v["strength"]))
             for z, v in cfg.get("split_tone", {}).items() if float(v.get("strength", 0)) != 0}
    for z in split:
        if z not in ZONES:
            raise ValueError(f"{name}: unknown split_tone zone {z!r}")
    bands = []
    for b in cfg.get("hue_bands", []):
        b = dict(b)
        if "min_chroma" in b:
            b["min_chroma"] = tuple(b["min_chroma"])
        bands.append(HueBand(**b))
    sk = dict(cfg.get("skin_protect", {}))
    if "chroma_range" in sk:
        sk["chroma_range"] = tuple(sk["chroma_range"])
    return LookParams(
        name=name,
        description=cfg.get("description", ""),
        tone=tone,
        saturation=float(sat.get("global", 1.0)),
        sat_shadows=float(sat.get("shadows", 1.0)),
        sat_highlights=float(sat.get("highlights", 1.0)),
        split=split,
        bands=bands,
        skin=SkinProtect(**sk),
        max_hue_shift=float(global_cfg.get("max_hue_shift_deg", 6.0)),
        gamut_knee=float(cfg.get("gamut_knee", global_cfg.get("gamut_knee", 0.85))),
        hue_guard_chroma=tuple(global_cfg.get("hue_guard_chroma", (0.02, 0.04))),
    )
