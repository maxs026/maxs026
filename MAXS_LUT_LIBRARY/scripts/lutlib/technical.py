"""Technical transform Apple Log -> Rec.709.

RULE: this module never invents an Apple Log -> Rec.709 function.

Official path (the only one that produces ``AppleLog_to_Rec709.cube``)
----------------------------------------------------------------------
Apple distributes an official Apple Log -> Rec.709 LUT on
https://developer.apple.com/download/all/?q=Apple%20log (Apple ID required).
Place the .cube you downloaded in ``00_TECHNICAL/source/``. It is copied
unmodified when its size matches, otherwise re-gridded with tetrahedral
interpolation (documented in the output header). Its SHA-256 is recorded.

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
from .interp import apply_lut

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


def build_official(source_dir: Path, out_dir: Path, sizes: list[int]) -> list[Path]:
    """Import the official Apple LUT. Returns written paths, or [] if missing."""
    src = find_official_source(source_dir)
    if src is None:
        print(MISSING_MESSAGE.format(source_dir=source_dir))
        return []

    cube = read_cube(src)
    if not np.all(np.isfinite(cube.table)):
        raise RuntimeError(f"{src}: contient des NaN/Inf, refusé")
    digest = sha256(src)
    written = []
    for n in sizes:
        dst = _technical_path(out_dir, n)
        if n == cube.size and np.allclose(cube.domain_min, 0) and np.allclose(cube.domain_max, 1):
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())   # bit-exact copy
            note = "copie exacte"
        else:
            # re-grid on the source's own domain (kept in the output header)
            grid = identity_table(n) * (cube.domain_max - cube.domain_min) + cube.domain_min
            table = apply_lut(cube.table, grid, cube.domain_min, cube.domain_max)
            write_cube(dst, Cube(
                table=table,
                title=f"{OFFICIAL_BASENAME} {n}",
                domain_min=cube.domain_min,
                domain_max=cube.domain_max,
                comments=[
                    "MAXS LUT LIBRARY v1 - 00_TECHNICAL",
                    f"Source officielle Apple : {src.name}",
                    f"SHA-256 source : {digest}",
                    f"Re-echantillonnage tetraedrique {cube.size} -> {n} points "
                    "(aucune information ajoutee)",
                    "Entree : Apple Log (BT.2020) / Sortie : Rec.709",
                ]))
            note = f"ré-échantillonnée {cube.size}->{n}"
        (dst.parent / (dst.stem + ".provenance.txt")).write_text(
            f"source={src.name}\nsha256={digest}\nsource_size={cube.size}\n"
            f"output_size={n}\nmethod={note}\n", encoding="utf-8")
        written.append(dst)
        print(f"  [technique] {dst.relative_to(out_dir.parent)}  ({note})")
    return written


def _technical_path(out_dir: Path, n: int) -> Path:
    if n == 33:
        return out_dir / f"{OFFICIAL_BASENAME}.cube"
    return out_dir / str(n) / f"{OFFICIAL_BASENAME}_{n}.cube"


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
        dst = out_dir / "alternatives" / f"{ACES_NAME}_{n}.cube"
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
