"""Technical transform Apple Log -> Rec.709.

RULE: this module never invents an Apple Log -> Rec.709 function.

Official path (the only one that produces ``AppleLog_to_Rec709.cube``)
----------------------------------------------------------------------
Apple distributes an official Apple Log -> Rec.709 LUT on
https://developer.apple.com/download/all/?q=Apple%20log (Apple ID required).
Place the .cube you downloaded in ``00_TECHNICAL/source/``. It is copied
byte for byte (never modified, never re-sampled) and its SHA-256 recorded.

If no source file is present, generation of the technical LUT STOPS with an
explicit message. No approximation is produced under that name.

Optional, explicitly *non-Apple* reference (opt-in: ``--aces-reference``)
-------------------------------------------------------------------------
Built with OpenColorIO's built-in ACES studio config:
  Apple Log (decoding published by Apple, Apple Log Profile White Paper 2023,
  implemented as the OCIO built-in ``APPLE_LOG_to_ACES2065-1``)
  -> ACES 2.0 Output Transform "SDR 100 nits (Rec.709)" (AMPAS)
  -> display "Rec.1886 Rec.709".
This is a documented standard rendering, NOT Apple's own Rec.709 rendering.
It is written to ``00_TECHNICAL/alternatives/`` with a name that says so.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from .cube import Cube, identity_table, read_cube, write_cube

OFFICIAL_BASENAME = "AppleLog_to_Rec709"

MISSING_MESSAGE = """
======================================================================
 LUT TECHNIQUE NON GÉNÉRÉE : transformation officielle Apple manquante
======================================================================
 Aucune LUT officielle Apple Log -> Rec.709 n'a été trouvée dans :
     {source_dir}

 La courbe Apple Log (log -> linéaire) est publiée par Apple, mais le
 rendu Apple Log -> Rec.709 (tone mapping + gamut BT.2020 -> BT.709)
 ne l'est que sous forme de LUT officielle. Elle n'est PAS inventée ici.

 Pour la fournir :
   1. Télécharger "Apple Log LUT" / "Apple Log Profile" sur
      https://developer.apple.com/download/all/?q=Apple%20log
      (compte Apple ID gratuit requis)
   2. Copier le fichier .cube (ex. AppleLogToRec709-v1.0.cube) dans
      {source_dir}
   3. Relancer : python scripts/generate_luts.py

 Alternative documentée NON Apple (ACES 2.0 via OpenColorIO) :
      python scripts/generate_luts.py --aces-reference
======================================================================
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

    The source file is never modified or re-sampled: ``AppleLog_to_Rec709.cube``
    is a byte-for-byte copy (verified by SHA-256), whatever its grid size.
    Provenance (file name, size, SHA-256) is written next to it.
    """
    src = find_official_source(source_dir)
    if src is None:
        print(MISSING_MESSAGE.format(source_dir=source_dir))
        return []

    cube = read_cube(src)                      # validation only, never re-written
    if not np.all(np.isfinite(cube.table)):
        raise RuntimeError(f"{src}: contient des NaN/Inf, refusé")
    digest = sha256(src)
    dst = out_dir / f"{OFFICIAL_BASENAME}.cube"
    dst.write_bytes(src.read_bytes())
    if sha256(dst) != digest:
        raise RuntimeError(f"copie de {src} altérée (SHA-256 différent)")
    dst.with_suffix(".provenance.txt").write_text(
        f"source={src.name}\n"
        f"sha256={digest}\n"
        f"lut_3d_size={cube.size}\n"
        f"domain_min={cube.domain_min.tolist()}\n"
        f"domain_max={cube.domain_max.tolist()}\n"
        "method=copie octet par octet, aucune modification, aucun re-echantillonnage\n"
        "origine_declaree=LUT officielle Apple (developer.apple.com, Apple ID)\n",
        encoding="utf-8")
    print(f"  [technique] {dst.name}  (copie exacte de {src.name}, {cube.size}^3, sha256={digest[:16]}...)")
    return [dst]


def official_lut_path(out_dir: Path) -> Path | None:
    p = out_dir / f"{OFFICIAL_BASENAME}.cube"
    return p if p.exists() else None


def aces_path(out_dir: Path, n: int, master: int = 65) -> Path:
    if n == master:
        return out_dir / "alternatives" / f"{ACES_NAME}.cube"
    return out_dir / "alternatives" / f"{n}_compat" / f"{ACES_NAME}_{n}.cube"


ACES_NAME = "AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE"


def build_aces_reference(out_dir: Path, sizes: list[int]) -> list[Path]:
    try:
        import PyOpenColorIO as ocio
    except ImportError as exc:
        raise RuntimeError("--aces-reference nécessite opencolorio (pip install opencolorio)") from exc

    config = ocio.Config.CreateFromFile("ocio://studio-config-latest")
    dvt = ocio.DisplayViewTransform(src="Apple Log", display="Rec.1886 Rec.709 - Display",
                                    view="ACES 2.0 - SDR 100 nits (Rec.709)")
    proc = config.getProcessor(dvt).getDefaultCPUProcessor()
    written = []
    for n in sizes:
        grid = identity_table(n).astype(np.float32)
        flat = np.ascontiguousarray(grid.reshape(-1, 3))
        proc.applyRGB(flat)
        table = flat.reshape(n, n, n, 3).astype(np.float64)
        n_out = int(np.sum((table < 0) | (table > 1)))
        table = np.clip(table, 0.0, 1.0)
        dst = aces_path(out_dir, n)
        write_cube(dst, Cube(table=table, title=f"{ACES_NAME} {n}", comments=[
            "MAXS LUT LIBRARY v1 - 00_TECHNICAL/alternatives",
            "!!! NON OFFICIEL APPLE - reference documentee, pas le rendu Apple !!!",
            f"OpenColorIO {ocio.__version__} / config {config.getName()}",
            "Apple Log (decodage publie par Apple, OCIO builtin APPLE_LOG_to_ACES2065-1)",
            "-> ACES 2.0 Output Transform SDR 100 nits (Rec.709) -> Rec.1886 Rec.709",
            f"Valeurs hors [0,1] ramenees dans [0,1] : {n_out} composantes sur {table.size}",
        ]))
        written.append(dst)
        print(f"  [technique alt.] {dst.relative_to(out_dir.parent)}  (clamp {n_out} composantes)")
    return written
