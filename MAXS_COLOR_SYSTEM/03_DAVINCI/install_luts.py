#!/usr/bin/env python3
"""Copy MAXS COLOR SYSTEM LUTs into DaVinci Resolve's LUT folder, one folder per version.

    python 03_DAVINCI/install_luts.py --dry-run            # show what would be copied
    python 03_DAVINCI/install_luts.py                      # current version
    python 03_DAVINCI/install_luts.py --with-archives      # + archived versions (compare v1.0 / v1.1 ...)
    python 03_DAVINCI/install_luts.py --dest "/chemin/LUT" # explicit LUT folder

Layout created inside the LUT folder (visible as sub-folders in Resolve's LUT browser):
    MAXS_COLOR_SYSTEM/v1.1/1_TECHNICAL/   Apple Log -> Rec.709 (Apple official if present, ACES2 NON-APPLE)
    MAXS_COLOR_SYSTEM/v1.1/2_LOOKS_65/    MASTER looks
    MAXS_COLOR_SYSTEM/v1.1/3_LOOKS_33/    compatibility looks

Default LUT folders (as documented by Blackmagic Design; if unsure, use Resolve's
Project Settings > Color Management > Lookup Tables > "Open LUT Folder" and pass it with --dest):
    macOS   /Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT
    Windows C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\LUT
    Linux   /opt/resolve/LUT
After copying, click "Update Lists" in the same settings panel (or restart Resolve).
Nothing is ever overwritten: an existing version folder is left untouched.
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = {
    "Darwin": Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT"),
    "Windows": Path(r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\LUT"),
    "Linux": Path("/opt/resolve/LUT"),
}


def plan(with_archives: bool) -> dict[str, list[tuple[Path, str]]]:
    """version -> [(source file, sub-folder)]"""
    out: dict[str, list[tuple[Path, str]]] = {}
    tech = sorted((ROOT / "00_TECHNICAL").glob("*/*.cube"))
    tech = [p for p in tech if "source" not in p.parts]
    for vfile in sorted((ROOT / "01_LOOKS").glob("*/VERSION.json")):
        v = json.loads(vfile.read_text(encoding="utf-8"))
        items = out.setdefault(v["version"], [(p, "1_TECHNICAL") for p in tech])
        for n, f in v["files"].items():
            items.append((vfile.parent / f["file"], "2_LOOKS_65" if n == "65" else "3_LOOKS_33"))
        if with_archives:
            for old in sorted((vfile.parent / "versions").glob("v*/VERSION.json")):
                ov = json.loads(old.read_text(encoding="utf-8"))
                items_o = out.setdefault(ov["version"], [(p, "1_TECHNICAL") for p in tech])
                for n, f in ov["files"].items():
                    items_o.append((old.parent / f["file"], "2_LOOKS_65" if n == "65" else "3_LOOKS_33"))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dest", type=Path, help="dossier LUT de DaVinci Resolve")
    ap.add_argument("--with-archives", action="store_true", help="installer aussi les versions archivées")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    dest = args.dest or DEFAULTS.get(platform.system())
    if dest is None:
        ap.error("système inconnu : préciser --dest")
    if not args.dry_run and not dest.exists():
        print(f"Dossier LUT introuvable : {dest}\n"
              "Dans Resolve : Project Settings > Color Management > Lookup Tables > Open LUT Folder,\n"
              "puis relancer avec --dest \"<ce dossier>\".")
        return 1
    base = dest / "MAXS_COLOR_SYSTEM"
    for version, items in sorted(plan(args.with_archives).items()):
        vdir = base / f"v{version}"
        if vdir.exists():
            print(f"v{version} : déjà installée dans {vdir} — laissée intacte")
            continue
        for src, sub in items:
            dst = vdir / sub / src.name
            print(f"{'[simulation] ' if args.dry_run else ''}{src.relative_to(ROOT)} -> {dst}")
            if not args.dry_run:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
    if not args.dry_run:
        print("\nDans Resolve : Project Settings > Color Management > Lookup Tables > Update Lists")
    return 0


if __name__ == "__main__":
    sys.exit(main())
