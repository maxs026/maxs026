#!/usr/bin/env python3
"""Structural / mathematical validation of every .cube of the library.

    python scripts/validate_luts.py               # whole library
    python scripts/validate_luts.py path/a.cube   # specific files
    python scripts/validate_luts.py --source      # also the official Apple source

Checks: .cube syntax, LUT_3D_SIZE >= 33, number of data lines, NaN / Inf,
min/max within [0,1], input domain, monotonic luminance along the grey axis,
continuity between neighbouring nodes. Exit code 1 if any check FAILS.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lutlib.checks import validate_cube  # noqa: E402
from lutlib.config import ROOT, TECH_SOURCE_DIR, all_cube_files  # noqa: E402


def print_report(rep):
    rel = Path(rep.path)
    try:
        rel = rel.relative_to(ROOT)
    except ValueError:
        pass
    print(f"\n{rel}")
    for r in rep.results:
        detail = f" — {r.detail}" if r.detail else ""
        print(f"  [{r.status}] {r.name}: {r.value}{detail}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", type=Path)
    ap.add_argument("--source", action="store_true", help="also validate 00_TECHNICAL/source/*.cube")
    args = ap.parse_args(argv)

    files = args.files or all_cube_files()
    if args.source:
        files += sorted(TECH_SOURCE_DIR.glob("*.cube"))
    if not files:
        print("Aucun fichier .cube trouvé. Lancer d'abord scripts/generate_luts.py")
        return 1

    n_fail = 0
    for f in files:
        rep, _ = validate_cube(f)
        print_report(rep)
        n_fail += bool(rep.failed)
    print(f"\n{len(files)} fichier(s), {n_fail} en échec")
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
