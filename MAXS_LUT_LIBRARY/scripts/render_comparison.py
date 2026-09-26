#!/usr/bin/env python3
"""Render the synthetic test images through every LUT and build before/after reports.

    python scripts/render_comparison.py
    python scripts/render_comparison.py --full-renders   # also save every full-size render

Outputs (02_TESTS/):
  images/<name>.png                  synthetic test images (8-bit preview)
  images/applelog_chart.png          Apple Log encoded chart (for the technical LUT)
  reports/<LUT>_avant_apres.jpg      before | after sheet for each LUT
  reports/overview.jpg               all looks side by side
  reports/technical_*.jpg            Apple Log chart through the technical LUT(s), if present
  reports/metrics.json               per-image numbers (lightness, chroma, clipping)
  reports/index.html                 report (sheets + metrics + test results)
  renders/<LUT>/<name>.png           full-size renders (only with --full-renders)

The images are procedurally generated (not photographs): they exercise
colour families and tonal ranges, they do not prove how a look feels on real
footage. Always confirm on your own Apple Log clips.
"""

from __future__ import annotations

import argparse
import html
import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from lutlib import colorspace as cs  # noqa: E402
from lutlib import technical, testimages  # noqa: E402
from lutlib.config import (IMAGES_DIR, LOOKS_DIR, RENDERS_DIR, REPORTS_DIR, ROOT, TECH_DIR,  # noqa: E402
                           MASTER_SIZE, load_looks, look_path)
from lutlib.cube import read_cube  # noqa: E402
from lutlib.interp import apply_lut  # noqa: E402

THUMB = (480, 270)


def to8(img: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8))


def font(size=18):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def ascii_text(text: str) -> str:
    """PIL's built-in font has no accented glyphs."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def label(im: Image.Image, text: str) -> Image.Image:
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width, 26], fill=(0, 0, 0))
    d.text((8, 4), ascii_text(text), fill=(235, 235, 235), font=font())
    return im


def sheet(rows, col_titles, title):
    """rows: list of (row_name, [np images]) -> PIL image."""
    w, h = THUMB
    ncol = len(col_titles)
    head = 70
    out = Image.new("RGB", (w * ncol, head + h * len(rows)), (18, 18, 18))
    d = ImageDraw.Draw(out)
    d.text((10, 8), ascii_text(title), fill=(255, 255, 255), font=font(24))
    for c, t in enumerate(col_titles):
        d.text((c * w + 10, 42), ascii_text(t), fill=(200, 200, 200), font=font(18))
    for r, (name, imgs) in enumerate(rows):
        for c, img in enumerate(imgs):
            tile = label(to8(img).resize(THUMB, Image.LANCZOS), name if c == 0 else "")
            out.paste(tile, (c * w, head + r * h))
    return out


def metrics(before: np.ndarray, after: np.ndarray) -> dict:
    b = cs.display_to_oklch(before.reshape(-1, 3).astype(np.float64))
    a = cs.display_to_oklch(after.reshape(-1, 3).astype(np.float64))
    chrom = b[:, 1] > 0.02
    return {
        "L_moyen_avant": round(float(b[:, 0].mean()), 4),
        "L_moyen_apres": round(float(a[:, 0].mean()), 4),
        "ratio_chroma_moyen": round(float(a[chrom, 1].mean() / b[chrom, 1].mean()), 4) if chrom.any() else None,
        "decalage_teinte_moyen_deg": round(float(np.abs(cs.hue_diff(b[chrom, 2], a[chrom, 2])).mean()), 3)
        if chrom.any() else None,
        "pixels_clippes_avant_pct": round(float(np.mean(np.any(before >= 0.999, -1)) * 100), 3),
        "pixels_clippes_apres_pct": round(float(np.mean(np.any(after >= 0.999, -1)) * 100), 3),
        "pixels_noirs_avant_pct": round(float(np.mean(np.all(before <= 0.001, -1)) * 100), 3),
        "pixels_noirs_apres_pct": round(float(np.mean(np.all(after <= 0.001, -1)) * 100), 3),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--full-renders", action="store_true")
    args = ap.parse_args(argv)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Images de test synthétiques...")
    images = {k: fn() for k, fn in testimages.IMAGES.items()}
    for k, img in images.items():
        to8(img).save(IMAGES_DIR / f"{k}.png")
    chart = testimages.applelog_chart()
    to8(chart).save(IMAGES_DIR / "applelog_chart.png")

    looks = [l.name for l in load_looks()]
    luts = {}
    for name in looks:
        p = look_path(name, MASTER_SIZE)
        if p.exists():
            luts[name] = read_cube(p)
        else:
            print(f"  (absent : {p.relative_to(ROOT)})")

    all_metrics: dict = {}
    renders: dict = {}
    for name, cube in luts.items():
        print(f"Rendu {name}...")
        renders[name] = {}
        all_metrics[name] = {}
        for k, img in images.items():
            out = apply_lut(cube.table, img.astype(np.float64)).astype(np.float32)
            renders[name][k] = out
            all_metrics[name][k] = metrics(img, out)
            if args.full_renders:
                (RENDERS_DIR / name).mkdir(parents=True, exist_ok=True)
                to8(out).save(RENDERS_DIR / name / f"{k}.png")
        rows = [(k, [images[k], renders[name][k]]) for k in images]
        sheet(rows, ["AVANT (Rec.709)", f"APRÈS {name}"],
              f"{name} - avant / après (images synthétiques)").save(
            REPORTS_DIR / f"{name}_avant_apres.jpg", quality=92, subsampling=0)

    if renders:
        rows = [(k, [images[k]] + [renders[n][k] for n in renders]) for k in images]
        sheet(rows, ["Original"] + list(renders), "MAXS LUT LIBRARY v1 - vue d'ensemble").save(
            REPORTS_DIR / "overview.jpg", quality=90, subsampling=0)

    # technical LUT(s): official and/or documented alternatives
    tech_files = [p for p in (technical.official_lut_path(TECH_DIR),
                              technical.aces_path(TECH_DIR, MASTER_SIZE)) if p and p.exists()]
    tech_rows = []
    for tp in tech_files:
        tc = read_cube(tp)
        rec709 = apply_lut(tc.table, chart.astype(np.float64)).astype(np.float32)
        imgs = [chart, rec709] + [apply_lut(luts[n].table, rec709.astype(np.float64)) for n in luts]
        tech_rows.append(tp.name)
        sheet([("applelog_chart", imgs)],
              ["Apple Log (brut)", "Technique -> Rec.709"] + list(luts),
              f"Chaîne complète : {tp.name} puis looks").save(
            REPORTS_DIR / f"technical_{tp.stem}.jpg", quality=92, subsampling=0)
        print(f"Chaîne technique : {tp.relative_to(ROOT)}")
    if not tech_files:
        print("Aucune LUT technique : rendu Apple Log non effectué (voir 00_TECHNICAL/README.md).")

    (REPORTS_DIR / "metrics.json").write_text(json.dumps(all_metrics, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    write_html(looks, all_metrics, tech_rows)
    print(f"Rapport : {(REPORTS_DIR / 'index.html').relative_to(ROOT)}")
    return 0


def write_html(looks, all_metrics, tech_rows):
    tests_path = REPORTS_DIR / "test_results.json"
    tests = json.loads(tests_path.read_text(encoding="utf-8")) if tests_path.exists() else []
    e = html.escape
    parts = ["<!doctype html><meta charset='utf-8'><title>MAXS LUT LIBRARY v1 — rapport</title>",
             "<style>body{font-family:system-ui,sans-serif;background:#111;color:#ddd;margin:24px;max-width:1200px}"
             "img{max-width:100%;border:1px solid #333}table{border-collapse:collapse;font-size:13px;margin:8px 0 24px}"
             "td,th{border:1px solid #333;padding:4px 8px;text-align:left}th{background:#222}"
             ".PASS{color:#7c7}.FAIL{color:#f66}.WARN{color:#fc6}code{color:#9cf}</style>",
             "<h1>MAXS LUT LIBRARY v1 — rapport avant / après</h1>",
             "<p>Images <b>synthétiques</b> générées par <code>scripts/lutlib/testimages.py</code> "
             "(pas des photographies). Looks : entrée et sortie Rec.709.</p>"]
    if not tech_rows:
        parts.append("<p class='FAIL'><b>LUT technique officielle absente</b> : la chaîne "
                     "Apple Log → Rec.709 n'a pas été rendue. Voir <code>00_TECHNICAL/README.md</code>.</p>")
    for t in tech_rows:
        stem = Path(t).stem
        parts.append(f"<h2>Chaîne technique : {e(t)}</h2><img src='technical_{e(stem)}.jpg'>")
    parts.append("<h2>Vue d'ensemble</h2><img src='overview.jpg'>")
    for name in looks:
        if name not in all_metrics:
            continue
        parts.append(f"<h2>{e(name)}</h2><img src='{e(name)}_avant_apres.jpg'>")
        keys = list(next(iter(all_metrics[name].values())).keys())
        parts.append("<table><tr><th>image</th>" + "".join(f"<th>{e(k)}</th>" for k in keys) + "</tr>")
        for img, m in all_metrics[name].items():
            parts.append(f"<tr><td>{e(img)}</td>" + "".join(f"<td>{m[k]}</td>" for k in keys) + "</tr>")
        parts.append("</table>")
    if tests:
        parts.append("<h2>Résultats de scripts/test_luts.py</h2>")
        for rep in tests:
            parts.append(f"<h3><code>{e(rep['path'])}</code></h3><table><tr><th>test</th><th>statut</th><th>valeur</th></tr>")
            for r in rep["results"]:
                parts.append(f"<tr><td>{e(r['name'])}</td><td class='{r['status']}'>{r['status']}</td>"
                             f"<td>{e(r['value'])} {e(r['detail'])}</td></tr>")
            parts.append("</table>")
    else:
        parts.append("<p>Lancer <code>scripts/test_luts.py</code> pour inclure les résultats des tests.</p>")
    (REPORTS_DIR / "index.html").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
