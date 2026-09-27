"""Real footage helpers: probe / decode an Apple Log ProRes file, pick frames, measure.

Decoding
--------
ffmpeg (the static binary shipped by ``imageio-ffmpeg``, or ``ffmpeg`` on PATH)
decodes ProRes to 16-bit RGB. The Y'CbCr -> R'G'B' conversion uses the matrix
and range *read from the file* (``color_space`` / ``color_range`` tags). If the
file does not declare them, decoding stops unless the user passes them
explicitly (``--assume-matrix`` / ``--assume-range``): nothing is guessed.

Only ProRes is accepted: H.264 / HEVC transcodes are refused.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from . import colorspace as cs


def ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as exc:
        raise RuntimeError("ffmpeg introuvable : installer ffmpeg ou `pip install imageio-ffmpeg`") from exc


@dataclass
class Probe:
    path: str
    codec: str
    profile: str
    pix_fmt: str
    width: int
    height: int
    fps: float
    duration: float
    color_range: str | None
    color_space: str | None
    color_primaries: str | None
    color_trc: str | None
    rotation_deg: float
    raw_stream_line: str


_STREAM = re.compile(r"Stream #\d+:\d+.*?: Video: (?P<codec>\w+)(?: \((?P<profile>[^)]*)\))?.*?, "
                     r"(?P<pix>[a-z0-9_]+)(?:\((?P<tags>[^)]*)\))?, (?P<w>\d+)x(?P<h>\d+)")


def probe(path: Path) -> Probe:
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)],
                         capture_output=True, text=True).stderr
    line = next((l for l in out.splitlines() if "Video:" in l), None)
    if line is None:
        raise RuntimeError(f"{path}: aucun flux vidéo trouvé\n{out}")
    m = _STREAM.search(line)
    if not m:
        raise RuntimeError(f"{path}: flux vidéo non reconnu : {line}")
    tags = [t.strip() for t in (m.group("tags") or "").split(",") if t.strip()]
    rng = next((t for t in tags if t in ("tv", "pc")), None)
    cols = [t for t in tags if t not in ("tv", "pc", "progressive", "top first", "bottom first")]
    space = prim = trc = None
    if cols:
        parts = cols[0].split("/")
        space = parts[0]
        prim = parts[1] if len(parts) > 1 else parts[0]
        trc = parts[2] if len(parts) > 2 else parts[0]
    fps = re.search(r"([\d.]+) fps", line)
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    rot = re.search(r"rotation of (-?[\d.]+) degrees", out)
    return Probe(
        path=str(path), codec=m.group("codec"), profile=m.group("profile") or "",
        pix_fmt=m.group("pix"), width=int(m.group("w")), height=int(m.group("h")),
        fps=float(fps.group(1)) if fps else 0.0,
        duration=(int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3))) if dur else 0.0,
        color_range=rng, color_space=space, color_primaries=prim, color_trc=trc,
        rotation_deg=float(rot.group(1)) if rot else 0.0,
        raw_stream_line=line.strip())


def check_source(p: Probe) -> list[str]:
    """Hard requirements. Returns a list of blocking problems (empty = OK)."""
    problems = []
    if p.codec != "prores":
        problems.append(f"codec {p.codec!r} refusé : fournir le fichier ProRes Apple Log original "
                        "(pas une version H.264/HEVC transcodée)")
    return problems


def sha256_file(path: Path, chunk=1 << 22) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while b := fh.read(chunk):
            h.update(b)
    return h.hexdigest()


MATRICES = {"bt2020nc": "bt2020", "bt2020c": "bt2020", "bt709": "bt709", "smpte170m": "smpte170m"}


def decode_frame(path: Path, t: float, matrix: str, rng: str, width: int | None = None) -> np.ndarray:
    """Decode the frame at time ``t`` (s) to float RGB in [0,1] (still Apple Log encoded).

    ffmpeg applies the file's display rotation (iPhone portrait clips carry a
    -90 deg display matrix), exactly like a player or an NLE: pixel values are
    not changed, only their orientation. Output size is read from the 16-bit
    PPM header, so rotated frames get their true dimensions.
    """
    if matrix not in MATRICES:
        raise ValueError(f"matrice {matrix!r} non gérée")
    in_range = {"tv": "tv", "pc": "pc"}[rng]
    scale = (f"scale={width}:-2:" if width else "scale=iw:ih:") + \
        (f"in_color_matrix={MATRICES[matrix]}:in_range={in_range}:out_range=pc:"
         "flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp")
    cmd = [ffmpeg_exe(), "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
           "-vf", f"{scale},format=rgb48be", "-f", "image2pipe", "-vcodec", "ppm", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    if not raw:
        raise RuntimeError(f"aucune image décodée à t={t:.3f}s")
    # P6 header: "P6\n<w> <h>\n65535\n"
    parts = raw.split(b"\n", 3)
    if parts[0] != b"P6" or parts[2] != b"65535":
        raise RuntimeError("sortie ffmpeg inattendue (PPM 16 bits attendu)")
    w, h = map(int, parts[1].split())
    arr = np.frombuffer(parts[3], dtype=">u2", count=w * h * 3)
    return arr.reshape(h, w, 3).astype(np.float64) / 65535.0


# ----------------------------------------------------------------------------
# scene descriptors (computed on the reference Rec.709 rendering)
# ----------------------------------------------------------------------------
def masks(rec709: np.ndarray) -> dict:
    lch = cs.display_to_oklch(rec709.reshape(-1, 3)).reshape(rec709.shape)
    L, C, h = lch[..., 0], lch[..., 1], lch[..., 2]
    H = rec709.shape[0]
    top = np.zeros_like(L, dtype=bool)
    top[: int(H * 0.45)] = True
    from .look import SkinProtect, skin_weight
    skin = skin_weight(lch.reshape(-1, 3), SkinProtect()).reshape(L.shape) > 0.6
    return {
        "ciel": top & (L > 0.55) & (((h > 200) & (h < 285) & (C > 0.02)) | (C < 0.02)) & (L < 0.99),
        "vegetation": (h > 95) & (h < 165) & (C > 0.035) & (L > 0.15),
        "blancs": rec709.max(-1) > 0.9,
        "peau": skin & (L > 0.3) & (L < 0.9),
        "sombres": L < 0.25,
        "architecture": (C < 0.05) & (L > 0.25) & (L < 0.9) & ~top,
    }


def descriptors(rec709: np.ndarray) -> dict:
    return {k: float(v.mean()) for k, v in masks(rec709).items()}


def box_blur(x: np.ndarray, r: int = 2) -> np.ndarray:
    k = 2 * r + 1
    p = np.pad(x, ((r, r), (r, r)), mode="edge")
    c = np.cumsum(np.cumsum(p, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def measure(img: np.ndarray, ref: np.ndarray, m: dict) -> dict:
    """Objective numbers for one rendering ``img`` against the reference ``ref`` (Rec.709)."""
    lch = cs.display_to_oklch(img.reshape(-1, 3)).reshape(img.shape)
    rl = cs.display_to_oklch(ref.reshape(-1, 3)).reshape(ref.shape)
    L, C = lch[..., 0], lch[..., 1]
    Y = cs.luminance(cs.display_to_linear(img))
    out = {
        "L_median": float(np.median(L)),
        "contraste_L_p95_p5": float(np.percentile(L, 95) - np.percentile(L, 5)),
        "chroma_moyen": float(C.mean()),
        "clip_hautes_pct": float(np.mean(img.max(-1) >= 0.995) * 100),
        "noirs_ecrases_pct": float(np.mean(img.max(-1) <= 0.005) * 100),
        "noir_p1_L": float(np.percentile(L, 1)),
    }
    dark = m["sombres"]
    if dark.mean() > 0.01:
        hp = L - box_blur(L)
        hpr = rl[..., 0] - box_blur(rl[..., 0])
        cn = C - box_blur(C)
        cnr = rl[..., 1] - box_blur(rl[..., 1])
        out["bruit_ombres_L_ratio"] = float(hp[dark].std() / max(hpr[dark].std(), 1e-9))
        out["bruit_ombres_chroma_ratio"] = float(cn[dark].std() / max(cnr[dark].std(), 1e-9))
    for zone in ("peau", "ciel", "vegetation"):
        z = m[zone]
        if z.mean() > 0.005:
            dh = cs.hue_diff(rl[..., 2][z], lch[..., 2][z])
            ok = rl[..., 1][z] > 0.02
            out[f"{zone}_L_moyen"] = float(L[z].mean())
            out[f"{zone}_chroma_ratio"] = float(C[z].mean() / max(rl[..., 1][z].mean(), 1e-9))
            out[f"{zone}_teinte_decalage_moyen"] = float(np.abs(dh[ok]).mean()) if ok.any() else 0.0
    if m["blancs"].mean() > 0.002:
        out["blancs_chroma_moyen"] = float(C[m["blancs"]].mean())
    out["Y_moyen"] = float(Y.mean())
    return out


def select_frames(descs: list[tuple[float, dict]], n_repr: int = 5) -> list[tuple[str, float]]:
    """Pick the best frame per category (coverage >= 1 %), then add the most
    diverse remaining frames until ``n_repr`` distinct frames exist.
    A frame that wins several categories is kept once, labels joined by '+'."""
    labels: dict[float, list[str]] = {}
    for cat in ("ciel", "vegetation", "architecture", "blancs", "peau", "sombres"):
        best = max(descs, key=lambda d: d[1][cat])
        if best[1][cat] >= 0.01:
            labels.setdefault(best[0], []).append(cat)
    keys = list(descs[0][1].keys())
    feats = {t: np.array([d[k] for k in keys]) for t, d in descs}
    while len(labels) < min(n_repr, len(descs)):
        cand = max((t for t, _ in descs if t not in labels),
                   key=lambda t: min((np.linalg.norm(feats[t] - feats[u]) for u in labels), default=1.0))
        labels[cand] = ["representative"]
    return sorted(("+".join(v), t) for t, v in labels.items())


def save_manifest(path: Path, data: dict):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=lambda o: asdict(o)),
                    encoding="utf-8")
