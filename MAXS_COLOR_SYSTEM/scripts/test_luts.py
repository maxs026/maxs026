#!/usr/bin/env python3
"""Automated tests of the generated LUT files (structure + behaviour).

    python scripts/test_luts.py            # all LUTs, writes 02_TESTS/reports/test_results.{json,md}
    python scripts/test_luts.py --quick    # skip the test-image clipping check

For every .cube:
  * validity of the .cube, dimensions, min/max, NaN/Inf, continuity
    (same checks as validate_luts.py)
For every look (01_LOOKS):
  * grey axis chroma, pure white / pure black neutrality, black level
  * luminance monotonicity (grey ramp + ramps of ColorChecker / mid-chroma colours)
  * highlight gradient 0.85 -> 1.0 strictly increasing (no clipping plateau)
  * interior nodes stuck at 0 or 1 (abnormal clipping)
  * shadow separation (0.02 vs 0.06)
  * skin tones: hue shift, chroma ratio, lightness change
  * hue shift on mid-chroma colours, mean ColorChecker chroma ratio
  * increase of clipped pixels on the synthetic test images
For the technical LUT (if present):
  * Apple Log greys -8..+6 EV map to neutral, monotonic output
Thresholds: [tests] section of config/looks.toml. Exit code 1 on any FAIL.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lutlib import testimages  # noqa: E402
from lutlib.checks import test_look, test_technical, validate_cube  # noqa: E402
from lutlib.config import LOOKS_DIR, REPORTS_DIR, ROOT, TECH_DIR, all_cube_files, load_config  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args(argv)

    cfg = load_config()
    th = dict(cfg["tests"])
    # the hue test enforces the same limit as the engine (global.max_hue_shift_deg)
    th["max_hue_shift_deg"] = float(cfg["global"]["max_hue_shift_deg"])
    files = all_cube_files()
    if not files:
        print("Aucune LUT. Lancer scripts/generate_luts.py")
        return 1

    images = None if args.quick else {k: fn() for k, fn in testimages.IMAGES.items()}
    reports = []
    for path in files:
        rep, cube = validate_cube(path)
        if cube is not None and not rep.failed:
            if LOOKS_DIR in path.parents:
                test_look(cube, th, rep, images)
            elif TECH_DIR in path.parents:
                test_technical(cube, rep)
        reports.append(rep)

    total_fail = 0
    md = [f"# MAXS COLOR SYSTEM v{cfg['global']['version']} — résultats des tests", "",
          "Généré par `scripts/test_luts.py`. Seuils : `config/looks.toml` [tests].", ""]
    tech_present = any("APPLE_OFFICIAL" in r.path for r in reports)
    if not tech_present:
        md += ["> **LUT officielle Apple absente** : couche technique testée = référence ACES 2.0 "
               "**NON-APPLE** (`00_TECHNICAL/ACES2_NON-APPLE/`).", ""]
    for rep in reports:
        rel = str(Path(rep.path).relative_to(ROOT))
        fails = len(rep.failed)
        total_fail += bool(fails)
        print(f"\n{rel}  ->  {'ÉCHEC' if fails else 'OK'}")
        md += [f"## `{rel}` — {'❌ ÉCHEC' if fails else '✅ OK'}", "",
               "| Test | Statut | Valeur |", "|---|---|---|"]
        for r in rep.results:
            print(f"  [{r.status}] {r.name}: {r.value} {r.detail}")
            md.append(f"| {r.name} | {r.status} | {r.value} {r.detail} |")
        md.append("")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "test_results.md").write_text("\n".join(md), encoding="utf-8")
    (REPORTS_DIR / "test_results.json").write_text(json.dumps(
        [{"path": str(Path(r.path).relative_to(ROOT)), "results": [asdict(x) for x in r.results]}
         for r in reports], indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(reports)} LUT(s) testée(s), {total_fail} en échec. "
          f"Rapport : {(REPORTS_DIR / 'test_results.md').relative_to(ROOT)}")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main())
