#!/usr/bin/env python3
"""Generate the whole MAXS LUT LIBRARY from config/looks.toml.

    python scripts/generate_luts.py                     # 65 (MASTER) + 33 (compatibilite)
    python scripts/generate_luts.py --sizes 65          # MASTER only
    python scripts/generate_luts.py --looks MAXS_Paris  # one look
    python scripts/generate_luts.py --aces-reference    # + non-Apple ACES reference
    python scripts/generate_luts.py --strict            # exit 1 if the technical LUT is missing

The technical LUT is only produced from an official Apple source placed in
00_TECHNICAL/source/ (see 00_TECHNICAL/README.md). Otherwise it is skipped
with an explicit message; the looks are generated regardless because they do
not depend on it (Rec.709 in -> Rec.709 out).
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402

from lutlib import technical  # noqa: E402
from lutlib.config import (CONFIG_PATH, LOOKS_DIR, MASTER_SIZE, TECH_DIR, TECH_SOURCE_DIR, load_config,  # noqa: E402
                           load_looks, look_path)
from lutlib.cube import Cube, identity_table, write_cube  # noqa: E402
from lutlib.look import apply_look  # noqa: E402

VERSION = "MAXS LUT LIBRARY v1"


def build_look(look, size: int) -> np.ndarray:
    grid = identity_table(size)
    return apply_look(grid.reshape(-1, 3), look).reshape(grid.shape)


def header(look, size: int) -> list[str]:
    t = look.tone
    lines = [
        f"{VERSION} - 01_LOOKS - {look.name}",
        look.description,
        "Entree : Rec.709 (BT.1886) / Sortie : Rec.709 (BT.1886)",
        "A placer APRES la LUT technique AppleLog_to_Rec709",
        f"Genere : {datetime.now(timezone.utc).strftime('%Y-%m-%d')} depuis config/looks.toml",
        f"Taille : {size}^3 ({'MASTER' if size == MASTER_SIZE else 'compatibilite, preferer la version 65^3 MASTER'}), calcul float64",
        f"tone : contrast={t.contrast} pivot={t.pivot} black_lift={t.black_lift} "
        f"white_out={t.white_out} chroma_follow={t.chroma_follow}",
        f"saturation : global={look.saturation} shadows={look.sat_shadows} "
        f"highlights={look.sat_highlights}",
    ]
    for z, (h, s) in look.split.items():
        lines.append(f"split_tone {z} : hue={h} strength={s}")
    for b in look.bands:
        lines.append(f"hue_band {b.name} : center={b.center} width={b.width} "
                     f"chroma={b.chroma} hue_shift={b.hue_shift}")
    lines.append(f"skin_protect : center={look.skin.center} width={look.skin.width} "
                 f"amount={look.skin.amount}")
    return lines


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, default=CONFIG_PATH)
    ap.add_argument("--sizes", type=int, nargs="+")
    ap.add_argument("--looks", nargs="+", help="subset of looks to build")
    ap.add_argument("--aces-reference", action="store_true",
                    help="also build the NON-Apple ACES 2.0 reference technical LUT")
    ap.add_argument("--strict", action="store_true",
                    help="exit with code 1 if the official technical LUT is missing")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    sizes = args.sizes or cfg.get("global", {}).get("sizes", [33])
    for n in sizes:
        if n < 33:
            ap.error(f"taille {n} refusée : minimum 33")

    print(f"{VERSION} — génération ({', '.join(map(str, sizes))})")

    print("\n[00_TECHNICAL]")
    tech = technical.build_official(TECH_SOURCE_DIR, TECH_DIR)
    if args.aces_reference:
        technical.build_aces_reference(TECH_DIR, sizes)

    print("\n[01_LOOKS]")
    looks = load_looks(cfg)
    if args.looks:
        unknown = set(args.looks) - {l.name for l in looks}
        if unknown:
            ap.error(f"looks inconnus : {sorted(unknown)}")
        looks = [l for l in looks if l.name in args.looks]
    for look in looks:
        for n in sizes:
            table = build_look(look, n)
            path = look_path(look.name, n)
            write_cube(path, Cube(table=table, title=f"{look.name} {n}", comments=header(look, n)))
            role = "MASTER" if n == MASTER_SIZE else "compat"
            print(f"  {path.relative_to(LOOKS_DIR.parent)}  [{role}]  min={table.min():.4f} max={table.max():.4f}")

    if not tech:
        print("\nATTENTION : LUT technique officielle absente (voir message ci-dessus).")
        return 1 if args.strict else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
