"""TECHNICAL layer: Apple Log -> Rec.709. Never mixed with a creative look.

RULE: this module never invents an Apple Log -> Rec.709 function, and never
labels a transform "Apple official" unless it is the file Apple distributes.

Priority (see 00_TECHNICAL/README.md)
-------------------------------------
1. APPLE OFFICIAL  - the Apple Log -> Rec.709 LUT distributed by Apple on
   https://developer.apple.com/download/all/?q=Apple%20log (Apple ID required).
   Dropped by the user in 00_TECHNICAL/APPLE_OFFICIAL/source/. Copied byte for
   byte (never modified, never re-sampled), SHA-256 recorded.
2. ACES2 NON-APPLE - always generated, so the project never blocks:
     Apple Log decoding published by Apple (Apple Log Profile White Paper 2023),
     as the OpenColorIO built-in ``APPLE_LOG_to_ACES2065-1`` (same maths as the
     Apple-supplied ACES IDT ``IDT.Apple.AppleLog_BT2020.ctl``)
     -> ACES 2.0 Output Transform "SDR 100 nits (Rec.709)" (AMPAS)
     -> display "Rec.1886 Rec.709" (OCIO built-in studio config).
   A documented standard rendering, NOT Apple's own Rec.709 rendering.
3. DaVinci Resolve Color Space Transform - documented in 03_DAVINCI/README.md
   as an in-application reference; it cannot be generated from here.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from .cube import Cube, identity_table, read_cube, write_cube

OFFICIAL_NAME = "AppleLog_to_Rec709_APPLE_OFFICIAL"
ACES_NAME = "AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE"

MISSING_MESSAGE = """
----------------------------------------------------------------------
 LUT officielle Apple Log -> Rec.709 : ABSENTE
----------------------------------------------------------------------
 Rien dans {source_dir}
 Référence technique utilisée : {aces_name} (NON-APPLE).
 Pour ajouter la LUT Apple (priorité 1) :
   1. https://developer.apple.com/download/all/?q=Apple%20log (Apple ID)
   2. copier le .cube Apple Log -> Rec.709 dans {source_dir}
   3. relancer : python scripts/generate_luts.py
----------------------------------------------------------------------
"""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def find_official_source(source_dir: Path) -> Path | None:
    cubes = sorted(p for p in source_dir.glob("*.cube") if p.is_file())
    if not cubes:
        return None
    if len(cubes) > 1:
        raise RuntimeError(
            f"Plusieurs .cube dans {source_dir} : {[c.name for c in cubes]}. "
            "N'en garder qu'un (la LUT officielle Apple).")
    return cubes[0]


def build_official(source_dir: Path, out_dir: Path) -> list[Path]:
    """Import the official Apple LUT, used AS IS. Returns [dst] or [] if missing.

    ``out_dir/AppleLog_to_Rec709_APPLE_OFFICIAL.cube`` is a byte-for-byte copy
    (verified by SHA-256) of the source, whatever its grid size. The source
    file itself is only read.
    """
    src = find_official_source(source_dir)
    if src is None:
        print(MISSING_MESSAGE.format(source_dir=source_dir, aces_name=ACES_NAME))
        return []

    cube = read_cube(src)                      # validation only, never re-written
    if not np.all(np.isfinite(cube.table)):
        raise RuntimeError(f"{src}: contient des NaN/Inf, refusé")
    digest = sha256(src)
    dst = out_dir / f"{OFFICIAL_NAME}.cube"
    dst.write_bytes(src.read_bytes())
    if sha256(dst) != digest or sha256(src) != digest:
        raise RuntimeError(f"copie de {src} altérée (SHA-256 différent)")
    dst.with_suffix(".provenance.txt").write_text(
        f"source={src.name}\n"
        f"sha256={digest}\n"
        f"lut_3d_size={cube.size}\n"
        f"domain_min={cube.domain_min.tolist()}\n"
        f"domain_max={cube.domain_max.tolist()}\n"
        "method=copie octet par octet, aucune modification, aucun re-echantillonnage\n"
        "origine_declaree=LUT officielle Apple (developer.apple.com, Apple ID), deposee par l'utilisateur\n",
        encoding="utf-8")
    print(f"  [APPLE OFFICIAL] {dst.name}  (copie exacte de {src.name}, {cube.size}^3, "
          f"sha256={digest[:16]}...)")
    return [dst]


def official_lut_path(apple_dir: Path) -> Path | None:
    p = apple_dir / f"{OFFICIAL_NAME}.cube"
    return p if p.exists() else None


def aces_path(aces_dir: Path, n: int) -> Path:
    return aces_dir / f"{ACES_NAME}_{n}.cube"


def build_aces_reference(aces_dir: Path, sizes: list[int]) -> list[Path]:
    try:
        import PyOpenColorIO as ocio
    except ImportError as exc:
        raise RuntimeError("la référence ACES nécessite opencolorio (pip install opencolorio)") from exc

    config = ocio.Config.CreateFromFile("ocio://studio-config-latest")
    view = "ACES 2.0 - SDR 100 nits (Rec.709)"
    display = "Rec.1886 Rec.709 - Display"
    dvt = ocio.DisplayViewTransform(src="Apple Log", display=display, view=view)
    proc = config.getProcessor(dvt).getDefaultCPUProcessor()
    written, prov = [], []
    for n in sizes:
        grid = identity_table(n).astype(np.float32)
        flat = np.ascontiguousarray(grid.reshape(-1, 3))
        proc.applyRGB(flat)
        table = flat.reshape(n, n, n, 3).astype(np.float64)
        n_out = int(np.sum((table < 0) | (table > 1)))
        table = np.clip(table, 0.0, 1.0)
        dst = aces_path(aces_dir, n)
        write_cube(dst, Cube(table=table, title=f"{ACES_NAME} {n}", comments=[
            "MAXS COLOR SYSTEM - 00_TECHNICAL - TECHNICAL LAYER (aucun look)",
            "!!! NON OFFICIEL APPLE - reference documentee, pas le rendu Apple !!!",
            f"OpenColorIO {ocio.__version__} / config {config.getName()}",
            "Apple Log (decodage publie par Apple, OCIO builtin APPLE_LOG_to_ACES2065-1)",
            f"-> ACES 2.0 Output Transform ({view}) -> {display}",
            f"Entree : Apple Log (BT.2020) / Sortie : Rec.709 BT.1886 - {'MASTER' if n == 65 else 'compatibilite'} {n}^3",
            f"Valeurs hors [0,1] ramenees dans [0,1] : {n_out} composantes sur {table.size}",
        ]))
        written.append(dst)
        prov.append(f"{dst.name}: sha256={sha256(dst)} clamp={n_out}/{table.size}")
        print(f"  [ACES2 NON-APPLE] {dst.name}  (clamp {n_out} composantes)")
    (aces_dir / "provenance.txt").write_text(
        "NON OFFICIEL APPLE\n"
        f"opencolorio={ocio.__version__}\nconfig={config.getName()}\n"
        f"transform=DisplayViewTransform(src='Apple Log', display='{display}', view='{view}')\n"
        "apple_log_decoding=OCIO builtin APPLE_LOG_to_ACES2065-1 "
        "(Apple Log Profile White Paper 2023 / IDT.Apple.AppleLog_BT2020.ctl)\n"
        + "\n".join(prov) + "\n", encoding="utf-8")
    return written
