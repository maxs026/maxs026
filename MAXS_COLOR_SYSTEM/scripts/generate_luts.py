#!/usr/bin/env python3
"""Generate MAXS COLOR SYSTEM from config/looks.toml.

    python scripts/generate_luts.py                     # technique + 5 looks, 65^3 MASTER + 33^3 compat
    python scripts/generate_luts.py --looks MAXS_Paris  # un seul look
    python scripts/generate_luts.py --check             # vérifie sans rien écrire

TECHNICAL (00_TECHNICAL/)  Apple Log -> Rec.709, never mixed with a look:
  * APPLE_OFFICIAL/  copy of Apple's LUT if the user dropped it in source/
  * ACES2_NON-APPLE/ documented ACES 2.0 reference, always generated
CREATIVE (01_LOOKS/MAXS_Name/)  Rec.709 -> Rec.709:
  * MAXS_Name_65.cube (MASTER), MAXS_Name_33.cube (compat), README.md, VERSION.json

Versioning (global.version in looks.toml, "1.0", "1.1", ...):
  * same version, same result      -> files kept as they are
  * same version, different result -> REFUSED: bump global.version
  * new version                    -> previous files moved to versions/v<old>/, new ones written
A published version is therefore never overwritten silently.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402

from lutlib import technical  # noqa: E402
from lutlib.config import (ACES_DIR, APPLE_DIR, COMPAT_SIZE, CONFIG_PATH, MASTER_SIZE, ROOT,  # noqa: E402
                           SYSTEM_NAME, TECH_SOURCE_DIR, load_config, load_looks, look_dir, look_path)
from lutlib.cube import Cube, identity_table, read_cube, write_cube  # noqa: E402
from lutlib.look import apply_look  # noqa: E402

SIZES = (MASTER_SIZE, COMPAT_SIZE)
SAME_TOL = 2e-6          # 6-decimal files: equal within rounding


def build_look(look, size: int) -> np.ndarray:
    grid = identity_table(size)
    return apply_look(grid.reshape(-1, 3), look).reshape(grid.shape)


def header(look, size: int, version: str) -> list[str]:
    t = look.tone
    lines = [
        f"{SYSTEM_NAME} v{version} - CREATIVE LOOK - {look.name}",
        look.description,
        "Entree : Rec.709 BT.1886 / Sortie : Rec.709 BT.1886 (aucune conversion Apple Log incluse)",
        "A placer APRES la couche TECHNICAL (Apple Log -> Rec.709)",
        f"Taille : {size}^3 ({'MASTER' if size == MASTER_SIZE else 'COMPATIBILITE - preferer le 65^3 MASTER'}), calcul float64",
        f"tone : contrast={t.contrast} pivot={t.pivot} black_lift={t.black_lift} "
        f"white_out={t.white_out} chroma_follow={t.chroma_follow}",
        f"saturation : global={look.saturation} shadows={look.sat_shadows} highlights={look.sat_highlights}",
    ]
    for z, (h, s) in look.split.items():
        lines.append(f"split_tone {z} : hue={h} strength={s}")
    for b in look.bands:
        lines.append(f"hue_band {b.name} : center={b.center} width={b.width} chroma={b.chroma} hue_shift={b.hue_shift}")
    lines += [f"skin_protect : center={look.skin.center} width={look.skin.width} amount={look.skin.amount} "
              f"saturation={look.skin.saturation}",
              f"garde de teinte : +/-{look.max_hue_shift} deg (moteur), gamut_knee={look.gamut_knee}"]
    return lines


def same_as_published(ldir: Path, name: str, tables: dict) -> tuple[bool, str]:
    worst = 0.0
    for n, t in tables.items():
        p = look_path(name, n)
        if not p.exists():
            return False, f"{p.name} manquant"
        worst = max(worst, float(np.abs(read_cube(p).table - t).max()))
    return worst <= SAME_TOL, f"écart max {worst:.2e}"


def archive(ldir: Path, name: str, old_version: str) -> Path:
    dst = ldir / "versions" / f"v{old_version}"
    if dst.exists():
        raise RuntimeError(f"{dst} existe déjà : archive de v{old_version} déjà faite, vérifier l'historique")
    dst.mkdir(parents=True)
    for f in [look_path(name, n) for n in SIZES] + [ldir / "VERSION.json", ldir / "README.md"]:
        if f.exists():
            shutil.move(str(f), dst / f.name)
    return dst


def write_readme(ldir: Path, look, raw: dict, version: str, history: list, tests_cfg: dict):
    def fmt(v):
        return json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else str(v)

    rows = []
    for section, body in raw.items():
        if isinstance(body, dict):
            for k, v in body.items():
                rows.append(f"| `{section}.{k}` | {fmt(v)} |")
        elif isinstance(body, list):
            for i, item in enumerate(body):
                rows.append(f"| `{section}[{i}]` | {fmt(item)} |")
        elif section != "description":
            rows.append(f"| `{section}` | {fmt(body)} |")
    hist = "\n".join(f"| v{h['version']} | {h['date']} | {h.get('note', '')} |" for h in history)
    text = f"""# {look.name} — v{version}

{look.description}

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `{look.name}_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `{look.name}_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.{look.name}]`)

| Paramètre | Valeur |
|---|---|
{chr(10).join(rows)}

Limites communes du moteur : rotation de teinte finale ±{look.max_hue_shift}° (garde de teinte),
compression de gamut douce (genou {look.gamut_knee}), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section {look.name}).

## Historique

| Version | Date | Note |
|---|---|---|
{hist}
"""
    (ldir / "README.md").write_text(text, encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, default=CONFIG_PATH)
    ap.add_argument("--looks", nargs="+", help="sous-ensemble de looks")
    ap.add_argument("--check", action="store_true", help="calcule et compare, n'écrit rien")
    ap.add_argument("--note", default="", help="note d'historique pour une nouvelle version")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    version = str(cfg["global"]["version"])
    if not re.fullmatch(r"\d+\.\d+", version):
        ap.error(f"global.version invalide : {version!r} (format attendu 1.0, 1.1, ...)")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"{SYSTEM_NAME} v{version}")

    if not args.check:
        print("\n[00_TECHNICAL]")
        APPLE_DIR.mkdir(parents=True, exist_ok=True)
        TECH_SOURCE_DIR.mkdir(parents=True, exist_ok=True)
        technical.build_official(TECH_SOURCE_DIR, APPLE_DIR)
        ACES_DIR.mkdir(parents=True, exist_ok=True)
        technical.build_aces_reference(ACES_DIR, list(SIZES))

    print("\n[01_LOOKS]")
    looks = load_looks(cfg)
    if args.looks:
        unknown = set(args.looks) - {l.name for l in looks}
        if unknown:
            ap.error(f"looks inconnus : {sorted(unknown)}")
        looks = [l for l in looks if l.name in args.looks]

    refused = []
    for look in looks:
        ldir = look_dir(look.name)
        tables = {n: build_look(look, n) for n in SIZES}
        vfile = ldir / "VERSION.json"
        prev = json.loads(vfile.read_text(encoding="utf-8")) if vfile.exists() else None
        history = prev.get("history", []) if prev else []

        if prev and prev["version"] == version:
            same, detail = same_as_published(ldir, look.name, tables)
            if same:
                print(f"  {look.name} v{version} : inchangé ({detail}), fichiers conservés")
                if not args.check:
                    write_readme(ldir, look, cfg["looks"][look.name], version, history, cfg.get("tests", {}))
                continue
            refused.append(f"{look.name} : v{version} déjà publiée, nouveau résultat différent ({detail})")
            continue
        if args.check:
            print(f"  {look.name} : v{prev['version'] if prev else '-'} -> v{version} (serait écrit)")
            continue
        if prev:
            dst = archive(ldir, look.name, prev["version"])
            print(f"  {look.name} : v{prev['version']} archivée dans {dst.relative_to(ROOT)}")
        ldir.mkdir(parents=True, exist_ok=True)
        files = {}
        for n, table in tables.items():
            p = look_path(look.name, n)
            write_cube(p, Cube(table=table, title=f"{look.name} v{version} {n}",
                               comments=header(look, n, version)))
            files[str(n)] = {"file": p.name, "sha256": technical.sha256(p),
                             "role": "MASTER" if n == MASTER_SIZE else "compat",
                             "min": round(float(table.min()), 6), "max": round(float(table.max()), 6)}
            print(f"  {p.relative_to(ROOT)}  [{files[str(n)]['role']}]  min={table.min():.4f} max={table.max():.4f}")
        history = history + [{"version": version, "date": today, "note": args.note}]
        vfile.write_text(json.dumps({
            "system": SYSTEM_NAME, "look": look.name, "version": version, "date": today,
            "layer": "CREATIVE Rec.709 -> Rec.709", "files": files,
            "params": cfg["looks"][look.name],
            "engine": {k: cfg["global"].get(k) for k in ("max_hue_shift_deg", "hue_guard_chroma", "gamut_knee")},
            "history": history}, indent=2, ensure_ascii=False), encoding="utf-8")
        write_readme(ldir, look, cfg["looks"][look.name], version, history, cfg.get("tests", {}))

    if refused:
        print("\nREFUS — une version publiée ne peut pas changer de contenu :")
        for r in refused:
            print(f"  {r}")
        print("Incrémenter global.version dans config/looks.toml (ex. 1.0 -> 1.1) puis relancer.")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
