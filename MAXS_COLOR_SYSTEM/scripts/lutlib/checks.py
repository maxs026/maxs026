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
    raw = Path(path).read_bytes()
    head = raw[:4096]
    rep.add("compatibilité lecteurs : sans BOM, fins de ligne LF",
            not raw.startswith(b"\xef\xbb\xbf") and b"\r" not in head, "")
    try:
        text_head = [l for l in head.decode("ascii").splitlines() if l and not l[0].isdigit() and l[0] not in "-."]
        ascii_ok = True
    except UnicodeDecodeError:
        text_head, ascii_ok = [], False
    rep.add("en-têtes ASCII", ascii_ok, "")
    kws = {l.split()[0] for l in text_head if not l.startswith("#")}
    rep.add("mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX)",
            kws <= {"TITLE", "LUT_3D_SIZE", "DOMAIN_MIN", "DOMAIN_MAX"}, " ".join(sorted(kws)))
    rep.add("taille MASTER 65 ou compat 33 (info)", True, str(cube.size))
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


GAMUT_TARGETS = {
    "rouge": [1, 0, 0], "vert": [0, 1, 0], "bleu": [0, 0, 1],
    "cyan": [0, 1, 1], "magenta": [1, 0, 1], "jaune": [1, 1, 0],
    "neon_rose": [1, 0.1, 0.6], "neon_cyan": [0.1, 1, 0.95], "neon_vert": [0.4, 1, 0.1],
    "neon_orange": [1, 0.45, 0.0], "neon_violet": [0.55, 0.0, 1.0],
}


def local_gain(v_in: np.ndarray, v_out: np.ndarray, floor: float = 1e-4) -> float:
    """Largest ratio between consecutive OkLab steps of the output and of the
    input along an ordered ramp. ~1 = the LUT follows the input smoothly; a
    discontinuity or fold gives a large value. (A plain step/median ratio is
    misleading near black, where OkLab's cube root makes the first step large
    for the input as well.)"""
    li = cs.linear_rgb_to_oklab(cs.display_to_linear(np.clip(v_in, 0, 1)))
    lo = cs.linear_rgb_to_oklab(cs.display_to_linear(np.clip(v_out, 0, 1)))
    di = np.linalg.norm(np.diff(li, axis=0), axis=1)
    do = np.linalg.norm(np.diff(lo, axis=0), axis=1)
    keep = di > floor
    return float((do[keep] / di[keep]).max())


def dense_chromatic_samples(n=300000, seed=11):
    """Random in-gamut colours, all hues, OkLab L 0.1-0.97, C 0.02-0.32 (display-encoded)."""
    rng = np.random.default_rng(seed)
    lch = np.stack([rng.uniform(0.1, 0.97, n), rng.uniform(0.02, 0.32, n), rng.uniform(0, 360, n)], -1)
    lin = cs.oklab_to_linear_rgb(cs.lch_to_lab(lch))
    ok = np.all((lin >= 0) & (lin <= 1), axis=1)
    x = cs.linear_to_display(lin[ok])
    return x, _oklch(x)


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

    # --- skin tones: measured patches, then derived carnation envelope ---
    from .testimages import skin_envelope, skin_references
    for label, skin in (("peau mesurée (ColorChecker)", skin_references()),
                        ("carnations (enveloppe dérivée)", skin_envelope())):
        s_in, s_out = _oklch(skin), _oklch(f(skin))
        dh = np.abs(cs.hue_diff(s_in[:, 2], s_out[:, 2]))
        cr = s_out[:, 1] / s_in[:, 1]
        dL = np.abs(s_out[:, 0] - s_in[:, 0])
        worst = s_in[np.argmin(cr)]
        rep.add(f"{label} : décalage de teinte", dh.max() <= th["skin_max_hue_shift"], f"max {dh.max():.2f}°")
        lo, hi_ = th["skin_chroma_ratio"]
        rep.add(f"{label} : ratio de chroma", lo <= cr.min() and cr.max() <= hi_,
                f"{cr.min():.3f}..{cr.max():.3f}",
                detail=f"min à L={worst[0]:.2f} C={worst[1]:.3f} h={worst[2]:.0f}°")
        rep.add(f"{label} : variation de luminosité", dL.max() <= th["skin_max_dL"], f"max dL={dL.max():.3f}")
    # protection boundary must not create artefacts: sweeps through the skin region
    sweeps = [np.stack([np.full(721, 0.62), np.full(721, 0.07), np.linspace(-20, 120, 721)], -1),
              np.stack([np.full(721, 0.62), np.linspace(0.0, 0.25, 721), np.full(721, 40.0)], -1),
              np.stack([np.linspace(0.2, 0.95, 721), np.full(721, 0.06), np.full(721, 40.0)], -1)]
    jump = 0.0
    for sw in sweeps:
        lin = cs.oklab_to_linear_rgb(cs.lch_to_lab(sw))
        lin = lin[np.all((lin >= 0) & (lin <= 1), axis=1)]
        v = cs.linear_to_display(lin)
        jump = max(jump, local_gain(v, f(v)))
    rep.add("peau : continuité autour de la zone protégée", jump < th["sweep_max_local_gain"],
            f"gain local max = {jump:.2f} (seuil {th['sweep_max_local_gain']})")

    # --- hue: engine limit checked on the FILE (dense sampling) ---
    x, a = dense_chromatic_samples()
    b = _oklch(f(x))
    dh = np.abs(cs.hue_diff(a[:, 2], b[:, 2]))
    tol = th.get(f"hue_interp_tolerance_{cube.size}", th["hue_interp_tolerance_33"])
    lim = th["max_hue_shift_deg"] + tol
    cmin = th["hue_file_min_chroma"]
    m = a[:, 1] >= cmin
    rep.add(f"teinte : rotation max (fichier, C ≥ {cmin})", dh[m].max() <= lim,
            f"max {dh[m].max():.2f}° (≤ {lim:g}°), moyen {dh[m].mean():.2f}°",
            detail=f"{int(m.sum())} couleurs")
    dH = 2 * np.sqrt(a[:, 1] * b[:, 1]) * np.sin(np.radians(dh) / 2)
    low = (a[:, 1] >= 0.02) & ~m
    rep.add("teinte : écart perceptuel ΔH (0.02 ≤ C < seuil)", dH[low].max() <= th["max_delta_H"],
            f"max ΔH={dH[low].max():.4f} (≤ {th['max_delta_H']}), angle max {dh[low].max():.1f}°",
            detail="angle peu significatif à faible chroma")

    # --- gamut: pure primaries / secondaries / neons ---
    worst_jump, worst_dc, worst_h, worst_end = 0.0, 0.0, 0.0, 1.0
    for c in GAMUT_TARGETS.values():
        s_ = np.linspace(0, 1, 513)[:, None]
        for start in (0.5, 0.15, 0.0):                 # from mid grey, near black, black
            ramp = start * (1 - s_) + np.asarray(c, float) * s_
            o = f(ramp)
            lab = cs.linear_rgb_to_oklab(cs.display_to_linear(o))
            d = np.linalg.norm(np.diff(lab, axis=0), axis=1)
            worst_jump = max(worst_jump, local_gain(ramp, o))
            ch = np.hypot(lab[:, 1], lab[:, 2])
            worst_dc = max(worst_dc, float((ch.max() - ch[-1]) / max(ch.max(), 1e-9)))
            worst_end = min(worst_end, float(d[-40:].mean() / max(np.median(d), 1e-9)))
            ai, bo = _oklch(ramp), _oklch(o)
            mm = ai[:, 1] >= cmin
            worst_h = max(worst_h, float(np.abs(cs.hue_diff(ai[mm, 2], bo[mm, 2])).max()))
    rep.add("gamut : continuité rampes primaires/néons", worst_jump < th["sweep_max_local_gain"],
            f"gain local max = {worst_jump:.2f} (seuil {th['sweep_max_local_gain']})")
    rep.add("gamut : retournement de chroma en fin de rampe", worst_dc <= th["gamut_max_chroma_reversal"],
            f"{worst_dc * 100:.1f} % (≤ {th['gamut_max_chroma_reversal'] * 100:.0f} %)",
            detail="roll-off des hautes lumières sur les primaires lumineuses")
    rep.add("gamut : pas de plateau en fin de rampe (compression douce)", worst_end > 0.1,
            f"pas final / médian = {worst_end:.2f}")
    rep.add("gamut : teinte des primaires/néons", worst_h <= lim, f"max {worst_h:.2f}° (≤ {lim:g}°)")

    # --- saturation ---
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
