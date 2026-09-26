"""Validation (structure / maths) and behaviour tests for .cube files.

Every check reads the *written file* and evaluates it with tetrahedral
interpolation, so what is tested is exactly what an editing application
will load — not the in-memory engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import colorspace as cs
from .cube import CubeError, identity_table, read_cube
from .interp import apply_lut

MIN_REQUIRED_SIZE = 33


@dataclass
class Result:
    name: str
    status: str          # PASS / FAIL / WARN
    value: str = ""
    detail: str = ""


@dataclass
class Report:
    path: str
    results: list = field(default_factory=list)

    def add(self, name, ok, value="", detail="", warn_only=False):
        status = "PASS" if ok else ("WARN" if warn_only else "FAIL")
        self.results.append(Result(name, status, str(value), detail))

    @property
    def failed(self):
        return [r for r in self.results if r.status == "FAIL"]


# ----------------------------------------------------------------------------
# structural / mathematical validation
# ----------------------------------------------------------------------------
def validate_cube(path: Path, log_input: bool | None = None) -> tuple[Report, object]:
    """``log_input``: the LUT's input is a log signal (Apple Log technical LUT).
    Then code values below the log black point legitimately map to 0 (plateau)
    and the display-based continuity metric is reported as information only.
    Default: inferred from the file name ("AppleLog" in it)."""
    if log_input is None:
        log_input = "applelog" in Path(path).name.lower()
    rep = Report(str(path))
    try:
        cube = read_cube(path)
    except (CubeError, UnicodeDecodeError, OSError) as exc:
        rep.add("format .cube", False, detail=str(exc))
        return rep, None
    rep.add("format .cube", True, "LUT_3D_SIZE %d" % cube.size)
    t = cube.table
    rep.add("dimensions >= 33", cube.size >= MIN_REQUIRED_SIZE, f"{cube.size}^3")
    rep.add("nombre de points", t.shape == (cube.size,) * 3 + (3,), f"{cube.size ** 3}")

    finite = np.isfinite(t)
    rep.add("absence de NaN", not np.any(np.isnan(t)), f"{int(np.sum(np.isnan(t)))} NaN")
    rep.add("absence de Inf", bool(np.all(finite | np.isnan(t))),
            f"{int(np.sum(np.isinf(t)))} Inf")
    if not np.all(finite):
        return rep, cube

    lo, hi = float(t.min()), float(t.max())
    rep.add("valeurs min/max dans [0,1]", lo >= 0.0 and hi <= 1.0, f"min={lo:.6f} max={hi:.6f}")
    rep.add("domaine d'entrée", np.all(cube.domain_min == 0) and np.all(cube.domain_max == 1),
            f"{cube.domain_min.tolist()}..{cube.domain_max.tolist()}", warn_only=True)

    diag = t[np.arange(cube.size), np.arange(cube.size), np.arange(cube.size)]
    y = cs.luminance(cs.display_to_linear(diag))
    if log_input:
        rep.add("axe des gris : luminance non décroissante (entrée log)",
                bool(np.all(np.diff(y) >= 0)) and y[-1] > y[0], f"min dY={np.diff(y).min():.3e}")
    else:
        rep.add("axe des gris : luminance croissante", bool(np.all(np.diff(y) > 0)),
                f"min dY={np.diff(y).min():.3e}")
    spread = float(np.max(diag.max(1) - diag.min(1)))
    rep.add("axe des gris : écart RGB (info)", True, f"{spread:.4f}")

    # discontinuities: perceptual (OkLab) distance between neighbouring output
    # nodes relative to the distance between their inputs. A smooth LUT stays
    # close to 1; folds or clipping plateaus followed by jumps give large ratios.
    lab_out = cs.linear_rgb_to_oklab(cs.display_to_linear(np.clip(t, 0, 1)))
    lab_in = cs.linear_rgb_to_oklab(cs.display_to_linear(identity_table(cube.size)))
    worst = 0.0
    for a in range(3):
        d_out = np.linalg.norm(np.diff(lab_out, axis=a), axis=-1)
        d_in = np.linalg.norm(np.diff(lab_in, axis=a), axis=-1)
        worst = max(worst, float(np.max(d_out / np.maximum(d_in, 0.02))))
    if log_input:
        rep.add("continuité (info, entrée log)", True, f"gain local OkLab max {worst:.3f}")
    else:
        rep.add("continuité (gain local OkLab max entre noeuds)", worst < 4.0, f"{worst:.3f} (seuil 4)")
    return rep, cube


# ----------------------------------------------------------------------------
# behaviour tests for display-referred looks (Rec.709 -> Rec.709)
# ----------------------------------------------------------------------------
def _oklch(v):
    return cs.display_to_oklch(np.clip(v, 0, 1))


def mid_chroma_colours(n_h=24):
    """Colours spread around the hue circle at moderate chroma (C=0.06..0.10)."""
    out = []
    for L in (0.45, 0.6, 0.75):
        for C in (0.06, 0.10):
            for h in np.linspace(0, 360, n_h, endpoint=False):
                out.append([L, C, h])
    lch = np.array(out)
    lin = cs.oklab_to_linear_rgb(cs.lch_to_lab(lch))
    ok = np.all((lin >= 0) & (lin <= 1), axis=1)
    return cs.linear_to_display(lin[ok])


def colorchecker_display():
    import colour
    cc = colour.CCS_COLOURCHECKERS["ColorChecker24 - After November 2014"]
    xyY = np.array(list(cc.data.values()))
    rgb = colour.XYZ_to_RGB(colour.xyY_to_XYZ(xyY), "ITU-R BT.709",
                            illuminant=cc.illuminant, chromatic_adaptation_transform="Bradford")
    return cs.linear_to_display(np.clip(rgb, 0, 1))


def test_look(cube, th: dict, rep: Report, images: dict | None = None):
    f = lambda x: apply_lut(cube.table, np.asarray(x, dtype=np.float64))  # noqa: E731

    # --- greys ---
    g = np.linspace(0, 1, 1025)
    grey_in = np.stack([g, g, g], -1)
    grey_out = f(grey_in)
    lch = _oklch(grey_out)
    rep.add("gris : chroma max", lch[:, 1].max() <= th["gray_max_chroma"],
            f"{lch[:, 1].max():.4f} (≤ {th['gray_max_chroma']})")
    rep.add("blanc pur neutre", lch[-1, 1] <= th["white_max_chroma"], f"C={lch[-1, 1]:.4f}")
    rep.add("noir pur neutre", lch[0, 1] <= th["black_max_chroma"], f"C={lch[0, 1]:.4f}")
    rep.add("noir pas trop relevé", lch[0, 0] <= th["black_max_L"], f"L={lch[0, 0]:.4f}")
    rep.add("blanc pas terne", grey_out[-1].min() >= th["white_min_display"],
            f"V={grey_out[-1].round(4).tolist()}")

    # --- luminance monotonicity ---
    Y = cs.luminance(cs.display_to_linear(grey_out))
    dY = np.diff(Y)
    rep.add("monotonie luminance (gris)", dY.min() > -th["monotonic_tolerance"],
            f"min dY={dY.min():.2e}")
    worst = 0.0
    for base in np.vstack([colorchecker_display(), mid_chroma_colours(12)]):
        k = np.linspace(0, 1, 257)[:, None]
        ramp = cs.linear_to_display(cs.display_to_linear(base)[None, :] * k)
        yy = cs.luminance(cs.display_to_linear(f(ramp)))
        worst = min(worst, float(np.diff(yy).min()))
    rep.add("monotonie approx. luminance (couleurs)", worst > -1e-3, f"min dY={worst:.2e}")

    # --- highlight clipping ---
    hi = np.linspace(0.85, 1.0, 301)
    yhi = cs.luminance(cs.display_to_linear(f(np.stack([hi, hi, hi], -1))))
    rep.add("hautes lumières non clippées (gradient 0.85→1)", bool(np.all(np.diff(yhi) > 0)),
            f"min dY={np.diff(yhi).min():.2e}")
    tab = cube.table
    inner = tab[1:-1, 1:-1, 1:-1]
    frac = float(np.mean(np.any((inner >= 1.0 - 1e-6) | (inner <= 1e-6), axis=-1)))
    rep.add("clipping anormal (noeuds intérieurs à 0 ou 1)", frac < 0.01, f"{frac * 100:.2f} %")

    # --- shadow detail ---
    a, b = f([[0.02] * 3, [0.06] * 3])
    ratio = (b.mean() - a.mean()) / 0.04
    rep.add("détail des basses lumières (0.02 vs 0.06)", ratio >= th["shadow_detail_min_ratio"],
            f"ratio={ratio:.3f}")

    # --- skin tones ---
    from .testimages import skin_references
    skin = skin_references()
    s_in, s_out = _oklch(skin), _oklch(f(skin))
    dh = np.abs(cs.hue_diff(s_in[:, 2], s_out[:, 2]))
    cr = s_out[:, 1] / s_in[:, 1]
    dL = np.abs(s_out[:, 0] - s_in[:, 0])
    rep.add("peau : décalage de teinte", dh.max() <= th["skin_max_hue_shift"], f"max {dh.max():.2f}°")
    lo, hi_ = th["skin_chroma_ratio"]
    rep.add("peau : ratio de chroma", lo <= cr.min() and cr.max() <= hi_,
            f"{cr.min():.3f}..{cr.max():.3f}")
    rep.add("peau : variation de luminosité", dL.max() <= th["skin_max_dL"], f"max dL={dL.max():.3f}")

    # --- hue / saturation ---
    mc = mid_chroma_colours()
    m_in, m_out = _oklch(mc), _oklch(f(mc))
    dh = np.abs(cs.hue_diff(m_in[:, 2], m_out[:, 2]))
    rep.add("teinte : décalage max (couleurs moyennes)", dh.max() <= th["general_max_hue_shift"],
            f"max {dh.max():.2f}°, moyen {dh.mean():.2f}°")
    cc = colorchecker_display()
    c_in, c_out = _oklch(cc), _oklch(f(cc))
    chrom = c_in[:, 1] > 0.03
    r = float(np.mean(c_out[chrom, 1] / c_in[chrom, 1]))
    rep.add("saturation : ratio moyen ColorChecker", r <= th["mean_chroma_ratio_max"], f"{r:.3f}")

    # --- test images: clipping increase ---
    if images:
        worst_name, worst_inc = "", 0.0
        for name, img in images.items():
            before = np.mean(np.any(img >= 0.999, axis=-1))
            after = np.mean(np.any(f(img) >= 0.999, axis=-1))
            if after - before > worst_inc:
                worst_name, worst_inc = name, float(after - before)
        rep.add("images : augmentation de pixels clippés",
                worst_inc <= th["clip_fraction_increase_max"],
                f"{worst_inc * 100:.3f} % ({worst_name or '-'})")
    return rep


def test_technical(cube, rep: Report):
    """Behaviour of an Apple Log -> Rec.709 LUT: neutral greys, monotone."""
    import colour
    stops = np.linspace(-8, 6, 141)
    lin = 0.18 * 2.0 ** stops
    enc = colour.models.log_encoding_AppleLogProfile(lin)
    out = apply_lut(cube.table, np.stack([enc] * 3, -1))
    lch = _oklch(out)
    rep.add("gris Apple Log -> neutres", lch[:, 1].max() <= 0.01, f"C max={lch[:, 1].max():.4f}")
    Y = cs.luminance(cs.display_to_linear(out))
    rep.add("monotonie (-8 à +6 IL)", bool(np.all(np.diff(Y) >= -1e-6)), f"min dY={np.diff(Y).min():.2e}")
    mid = float(apply_lut(cube.table, np.array([[enc[80]] * 3]))[0].mean())
    rep.add("gris 18 % (info)", True, f"V={mid:.3f}")
    return rep
