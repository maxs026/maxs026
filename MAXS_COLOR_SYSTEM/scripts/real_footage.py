#!/usr/bin/env python3
"""Validation on real Apple Log ProRes footage (iPhone 15 Pro Max).

    python scripts/real_footage.py extract IMG_7068.MOV [IMG_7073.MOV ...]
    python scripts/real_footage.py analyze
    python scripts/real_footage.py run IMG_7068.MOV       # extract + analyze

extract
  * refuses anything that is not ProRes (no H.264 / HEVC transcodes)
  * records SHA-256, codec, profile, colour tags of the original file
  * decodes with the file's own matrix / range (or --assume-matrix/--assume-range
    if the file has no tags; nothing is guessed silently)
  * samples the clip, renders the samples through the reference technical LUT and
    picks frames: sky, vegetation, architecture, whites, skin, darks + diverse
    representative frames (>= 5). --at label=seconds forces specific frames.
  * saves each frame UNCHANGED (Apple Log, 16-bit) in
    02_TESTS/REAL_FOOTAGE/<clip>/frames/*.npz + an 8-bit preview
analyze
  * A  Apple Log -> official Apple LUT -> Rec.709          (if 00_TECHNICAL/APPLE_OFFICIAL/ holds Apple's LUT)
  * B  Apple Log -> ACES 2.0 SDR (NON-APPLE) -> Rec.709
  * C-G reference technical -> MAXS Natural / Paris / Film / Golden / Night (65^3 MASTER)
    (reference = A if available, otherwise B, and then every result is marked NON-APPLE)
  * one comparison sheet per frame, objective measurements per rendering,
    02_TESTS/reports/real_footage_report.html
  * the written diagnosis (strengths, defects, scores) is read from
    02_TESTS/REAL_FOOTAGE/diagnostic.toml; it is NEVER generated automatically.
"""

from __future__ import annotations

import argparse
import html
import json
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from lutlib import footage, technical  # noqa: E402
from lutlib.config import (ACES_DIR, APPLE_DIR, MASTER_SIZE, REAL_FOOTAGE_DIR, REPORTS_DIR, ROOT, load_looks,  # noqa: E402
                           look_path, system_version)  # noqa: E402
from lutlib.cube import read_cube  # noqa: E402
from lutlib.interp import apply_lut  # noqa: E402

RF_DIR = REAL_FOOTAGE_DIR
DIAG_PATH = RF_DIR / "diagnostic.toml"


# ----------------------------------------------------------------------------
def technical_chain():
    """Return (reference_name, reference_cube, is_official, {name: cube} for A/B)."""
    chains = {}
    off = technical.official_lut_path(APPLE_DIR)
    if off:
        chains["A_Apple_Rec709"] = read_cube(off)
    aces = technical.aces_path(ACES_DIR, MASTER_SIZE)
    if not aces.exists():
        technical.build_aces_reference(ACES_DIR, [MASTER_SIZE])
    chains["B_ACES2_Rec709_NON-APPLE"] = read_cube(aces)
    if off:
        return "A_Apple_Rec709", chains["A_Apple_Rec709"], True, chains
    return "B_ACES2_Rec709_NON-APPLE", chains["B_ACES2_Rec709_NON-APPLE"], False, chains


def to8(img):
    return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8))


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


# ----------------------------------------------------------------------------
def cmd_extract(args) -> int:
    ref_name, ref, official, _ = technical_chain()
    for src in args.files:
        src = Path(src)
        p = footage.probe(src)
        problems = footage.check_source(p)
        if problems:
            print("\n".join(f"REFUS {src.name}: {x}" for x in problems))
            return 1
        stats = footage.raw_luma_stats(src, np.linspace(0.3, max(p.duration - 0.3, 0.4), 6))
        ident = footage.identify_apple_log(src, p, stats)
        print(f"  identification : {ident['verdict']}")
        for ev in ident["indices"]:
            print(f"    [{ {True: 'OK', False: 'NON', None: '??'}[ev['ok']] }] {ev['indice']} : {ev['valeur']}")
        print(f"  plage : {ident['plage']} ({ident['plage_justification']})")
        matrix = p.color_space or args.assume_matrix
        rng = args.assume_range or ident["plage"]
        if args.assume_range and not ident["plage"]:
            args.range_note = args.range_note or "imposée par --assume-range"
        elif args.assume_range and args.assume_range != ident["plage"]:
            print(f"ARRÊT {src.name}: --assume-range {args.assume_range} contredit les données ({ident['plage_justification']})")
            return 1
        else:
            args.range_note = ident["plage_justification"]
        if not matrix or not rng:
            print(f"ARRÊT {src.name}: matrice ({p.color_space}) ou plage ({p.color_range}) non déclarée "
                  "dans le fichier. Relancer avec --assume-matrix bt2020nc --assume-range tv|pc "
                  "si vous connaissez la valeur exacte.")
            return 1
        print(f"{src.name}: {p.raw_stream_line}")
        print("  SHA-256 en cours...")
        digest = footage.sha256_file(src)
        out = RF_DIR / src.stem
        (out / "frames").mkdir(parents=True, exist_ok=True)

        # sampling for automatic selection
        t0, t1 = 0.25, max(p.duration - 0.25, 0.3)
        times = np.linspace(t0, t1, args.samples)
        descs = []
        for t in times:
            small = footage.decode_frame(src, float(t), matrix, rng, width=480)
            descs.append((round(float(t), 3), footage.descriptors(apply_lut(ref.table, small))))
        picks = footage.select_frames(descs, n_repr=args.min_frames)
        for spec in args.at or []:
            label, t = spec.split("=")
            picks.append((label, float(t)))

        frames = []
        for i, (label, t) in enumerate(picks):
            img = footage.decode_frame(src, t, matrix, rng, width=args.width)
            name = f"{i:02d}_{label}_{t:07.3f}s"
            np.savez_compressed(out / "frames" / f"{name}.npz",
                                applelog=np.round(img * 65535).astype(np.uint16))
            prev = to8(img)
            prev.thumbnail((1080, 1080), Image.LANCZOS)
            prev.save(out / "frames" / f"{name}_applelog_preview.jpg", quality=90)
            d = dict(next((d for tt, d in descs if tt == t), {}))
            frames.append({"name": name, "label": label, "t": t, "descripteurs_echantillon": d})
            print(f"  frame {name}")
        footage.save_manifest(out / "manifest.json", {
            "source": src.name, "sha256": digest, "taille_octets": src.stat().st_size,
            "probe": p.__dict__, "identification": ident, "decodage": {"matrice": matrix, "plage": rng,
                                             "matrice_declaree": p.color_space, "plage_declaree": p.color_range,
                                             "justification_plage": args.range_note,
                                             "largeur": args.width, "profondeur": "16 bits (rgb48)"},
            "selection": {"reference_technique": ref_name, "echantillons": len(times)},
            "frames": frames,
            "descripteurs_tous_echantillons": [{"t": t, **d} for t, d in descs],
        })
    return 0


# ----------------------------------------------------------------------------
def sheet(title, tiles):
    """Grid of 4 columns; tiles keep the frame's aspect ratio (portrait clips stay portrait)."""
    ih, iw = tiles[0][1].shape[:2]
    w, h = (360, int(round(360 * ih / iw))) if ih > iw else (640, int(round(640 * ih / iw)))
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new("RGB", (w * cols, 50 + (h + 30) * rows), (16, 16, 16))
    d = ImageDraw.Draw(out)
    d.text((10, 12), footage_ascii(title), fill=(255, 255, 255), font=font(22))
    for i, (lab, img) in enumerate(tiles):
        r, c = divmod(i, cols)
        x, y = c * w, 50 + r * (h + 30)
        d.text((x + 6, y + 6), footage_ascii(lab), fill=(230, 230, 230), font=font(13 if ih > iw else 17))
        out.paste(to8(img).resize((w, h), Image.LANCZOS), (x, y + 30))
    return out


def footage_ascii(s):
    import unicodedata
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def cmd_analyze(args) -> int:
    ref_name, ref, official, chains = technical_chain()
    tag = "" if official else " [NON-APPLE]"
    looks = [(l.name, read_cube(look_path(l.name, MASTER_SIZE))) for l in load_looks()]
    clips = sorted(d for d in RF_DIR.iterdir() if (d / "manifest.json").exists()) if RF_DIR.exists() else []
    if not clips:
        print("Aucun clip extrait. Lancer d'abord : real_footage.py extract <fichier.MOV>")
        return 1
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for clip in clips:
        man = json.loads((clip / "manifest.json").read_text(encoding="utf-8"))
        for fr in man["frames"]:
            log = np.load(clip / "frames" / f"{fr['name']}.npz")["applelog"].astype(np.float64) / 65535.0
            base = apply_lut(ref.table, log)
            m = footage.masks(base)
            tiles = [("ORIGINAL APPLE LOG", log)]
            meas = {}
            if "A_Apple_Rec709" in chains:
                tiles.append(("A  APPLE -> REC709", base))
            else:
                tiles.append(("A  APPLE -> REC709 : LUT officielle absente", np.full_like(log, 0.1)))
            b = apply_lut(chains["B_ACES2_Rec709_NON-APPLE"].table, log)
            tiles.append(("B  ACES 2.0 -> REC709 (NON-APPLE)", b))
            meas["B_ACES2"] = footage.measure(b, base, m)
            if official:
                meas["A_Apple"] = footage.measure(base, base, m)
            ref_lab = "APPLE -> REC709" if official else "ACES2 (NON-APPLE) -> REC709"
            for letter, (name, cube) in zip("CDEFG", looks):
                out = apply_lut(cube.table, base)
                tiles.append((f"{letter}  {ref_lab} -> {name.replace('MAXS_', 'MAXS ').upper()}", out))
                meas[name] = footage.measure(out, base, m)
            fname = f"real_{clip.name}_{fr['name']}.jpg"
            sheet(f"{man['source']}  t={fr['t']:.2f}s  ({fr['label']}){tag}", tiles).save(
                REPORTS_DIR / fname, quality=90, subsampling=0)
            cover = {k: round(float(v.mean()) * 100, 1) for k, v in m.items()}
            results.append({"clip": man["source"], "frame": fr["name"], "label": fr["label"], "t": fr["t"],
                            "sheet": fname, "couverture_pct": cover, "mesures": meas})
            print(f"  {fname}")
    (REPORTS_DIR / "real_footage_metrics.json").write_text(
        json.dumps({"reference": ref_name, "officielle_apple": official, "frames": results},
                   indent=2, ensure_ascii=False), encoding="utf-8")
    write_report(results, clips, ref_name, official, [n for n, _ in looks])
    print(f"Rapport : {(REPORTS_DIR / 'real_footage_report.html').relative_to(ROOT)}")
    return 0


# ----------------------------------------------------------------------------
def write_report(results, clips, ref_name, official, look_names):
    e = html.escape
    diag = tomllib.loads(DIAG_PATH.read_text(encoding="utf-8")) if DIAG_PATH.exists() else {}
    P = ["<!doctype html><meta charset='utf-8'><title>MAXS COLOR SYSTEM — rush réel</title>",
         "<style>body{font-family:system-ui,sans-serif;background:#111;color:#ddd;margin:24px;max-width:1500px}"
         "img{max-width:100%;border:1px solid #333}table{border-collapse:collapse;font-size:12px;margin:8px 0 20px}"
         "td,th{border:1px solid #333;padding:3px 7px;text-align:right}th{background:#222}td:first-child{text-align:left}"
         ".warn{background:#4a1d1d;border:1px solid #a33;padding:10px 14px;margin:12px 0}"
         ".ok{background:#1d3a1d;border:1px solid #3a3;padding:10px 14px}code{color:#9cf}"
         ".score{font-size:28px;font-weight:bold}ul{margin:4px 0 10px}</style>",
         f"<h1>MAXS COLOR SYSTEM v{system_version()} — validation sur rush Apple Log réel</h1>"]
    if official:
        P.append("<div class='ok'>Conversion technique : <b>LUT officielle Apple</b> "
                 "(<code>00_TECHNICAL/APPLE_OFFICIAL/</code>, provenance et SHA-256 dans le fichier .provenance.txt).</div>")
    else:
        P.append("<div class='warn'><b>NON-APPLE</b> — la LUT officielle Apple Log → Rec.709 n'est pas fournie. "
                 "La colonne A est vide. Les looks C–G sont appliqués après la référence "
                 "<b>ACES 2.0 SDR 100 nits (Rec.709)</b> (décodage Apple Log publié par Apple, via OpenColorIO). "
                 "Ce n'est <b>pas</b> le rendu Apple : les looks ont été conçus pour se placer après la LUT Apple, "
                 "le diagnostic doit être confirmé avec elle.</div>")
    P.append("<h2>Sources</h2><table><tr><th>fichier</th><th>SHA-256</th><th>codec</th><th>format</th>"
             "<th>tags couleur (espace/primaires/transfert, plage)</th><th>durée</th></tr>")
    for c in clips:
        m = json.loads((c / "manifest.json").read_text(encoding="utf-8"))
        p = m["probe"]
        P.append(f"<tr><td>{e(m['source'])}</td><td><code>{m['sha256']}</code></td>"
                 f"<td>{e(p['codec'])} {e(p['profile'])}</td><td>{p['width']}x{p['height']} {e(p['pix_fmt'])} "
                 f"{p['fps']} fps</td><td>{e(str(p['color_space']))}/{e(str(p['color_primaries']))}/"
                 f"{e(str(p['color_trc']))}, {e(str(p['color_range']))}</td><td>{p['duration']:.1f}s</td></tr>")
    P.append("</table><h3>Identification Apple Log</h3>")
    for c in clips:
        m = json.loads((c / "manifest.json").read_text(encoding="utf-8"))
        idt = m.get("identification")
        if not idt:
            continue
        P.append(f"<p><b>{e(m['source'])}</b> : {e(idt['verdict'])}<br>Plage du signal : "
                 f"<b>{e(str(m['decodage']['plage']))}</b> — {e(str(m['decodage'].get('justification_plage') or idt['plage_justification']))}</p><table>"
                 "<tr><th>indice</th><th>résultat</th><th>valeur</th></tr>" +
                 "".join(f"<tr><td>{e(i['indice'])}</td><td>{ {True: 'OK', False: 'NON', None: 'non concluant'}[i['ok']] }</td>"
                         f"<td>{e(str(i['valeur']))}</td></tr>" for i in idt["indices"]) + "</table>")
    P.append("<p>Frames décodées en 16 bits avec la matrice et la plage déclarées par le fichier, "
             f"réduites à {e(str(json.loads((clips[0] / 'manifest.json').read_text())['decodage']['largeur']))} px "
             "de large pour l'analyse. Sélection automatique (ciel, végétation, architecture, blancs, peau, "
             "sombres, représentatives) : voir <code>manifest.json</code>.</p>")

    # diagnosis
    P.append("<h2>Diagnostic par look</h2>")
    if not diag:
        P.append("<div class='warn'>Diagnostic visuel non rédigé (<code>02_TESTS/REAL_FOOTAGE/diagnostic.toml</code> "
                 "absent). Aucune note n'est générée automatiquement.</div>")
    else:
        if diag.get("contexte"):
            P.append(f"<p>{e(diag['contexte'])}</p>")
        for name in look_names:
            d = diag.get("looks", {}).get(name)
            if not d:
                continue
            P.append(f"<h3>{e(name)} — <span class='score'>{d.get('note', '–')}/10</span></h3>")
            for key, title in (("forces", "Forces"), ("defauts", "Défauts"),
                               ("fonctionne", "Scènes où il fonctionne"),
                               ("fonctionne_moins", "Scènes où il fonctionne moins bien"),
                               ("recommandations", "Recommandations (non appliquées)")):
                if d.get(key):
                    P.append(f"<b>{title}</b><ul>" + "".join(f"<li>{e(x)}</li>" for x in d[key]) + "</ul>")
        if diag.get("recommandation_globale"):
            P.append(f"<h3>Recommandation</h3><p>{e(diag['recommandation_globale'])}</p>")
        if diag.get("corrections_proposees"):
            P.append("<h3>Corrections proposées (en attente d'accord, non appliquées)</h3><ol>" +
                     "".join(f"<li>{e(x)}</li>" for x in diag["corrections_proposees"]) + "</ol>")

    # objective measures, averaged per look
    P.append("<h2>Mesures objectives (moyenne sur les frames)</h2>"
             f"<p>Écarts calculés par rapport à la référence technique <code>{e(ref_name)}</code>. "
             "L, C = OkLab. Ratio de bruit = écart-type haute fréquence dans les zones sombres / référence.</p>")
    keys = ["L_median", "contraste_L_p95_p5", "chroma_moyen", "noir_p1_L", "clip_hautes_pct",
            "noirs_ecrases_pct", "bruit_ombres_L_ratio", "bruit_ombres_chroma_ratio", "peau_chroma_ratio",
            "peau_teinte_decalage_moyen", "ciel_chroma_ratio", "vegetation_chroma_ratio", "blancs_chroma_moyen"]
    names = ["B_ACES2"] + (["A_Apple"] if official else []) + look_names
    P.append("<table><tr><th>rendu</th>" + "".join(f"<th>{e(k)}</th>" for k in keys) + "</tr>")
    for n in names:
        row = []
        for k in keys:
            vals = [r["mesures"][n][k] for r in results if n in r["mesures"] and k in r["mesures"][n]]
            row.append(f"{np.mean(vals):.3f}" if vals else "–")
        P.append(f"<tr><td>{e(n)}</td>" + "".join(f"<td>{v}</td>" for v in row) + "</tr>")
    P.append("</table>")

    crops = sorted((REPORTS_DIR / "real_crops").glob("*.jpg")) if (REPORTS_DIR / "real_crops").exists() else []
    if crops:
        P.append("<h2>Recadrages à 100 % (référence technique + 5 looks, 65³ MASTER)</h2>")
        for c in crops:
            P.append(f"<h3>{e(c.stem)}</h3><img src='real_crops/{e(c.name)}'>")
    P.append("<h2>Planches comparatives</h2>")
    for r in results:
        P.append(f"<h3>{e(r['clip'])} — t={r['t']:.2f}s — {e(r['label'])}</h3>"
                 f"<p>Couverture détectée (%) : {e(json.dumps(r['couverture_pct'], ensure_ascii=False))}</p>"
                 f"<img src='{e(r['sheet'])}'>")
        P.append("<table><tr><th>rendu</th>" + "".join(f"<th>{e(k)}</th>" for k in keys) + "</tr>")
        for n, mm in r["mesures"].items():
            P.append(f"<tr><td>{e(n)}</td>" + "".join(
                f"<td>{mm[k]:.3f}</td>" if k in mm else "<td>–</td>" for k in keys) + "</tr>")
        P.append("</table>")
    (REPORTS_DIR / "real_footage_report.html").write_text("\n".join(P), encoding="utf-8")


def cmd_crops(args) -> int:
    """100 % crops defined in REAL_FOOTAGE/crops.toml, reference technical + 5 looks (MASTER)."""
    ref_name, ref, official, _ = technical_chain()
    tag = "" if official else " (NON-APPLE)"
    looks = [(l.name, read_cube(look_path(l.name, MASTER_SIZE))) for l in load_looks()]
    spec = tomllib.loads((RF_DIR / "crops.toml").read_text(encoding="utf-8"))["crop"]
    out_dir = REPORTS_DIR / "real_crops"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.jpg"):
        old.unlink()
    for c in spec:
        f = sorted((RF_DIR / c["clip"] / "frames").glob(f"{c['frame']}*.npz"))
        if not f:
            print(f"  (frame absente : {c['clip']}/{c['frame']} - extraire d'abord)")
            continue
        y0, y1, x0, x1 = c["box"]
        z = int(c.get("zoom", 1))
        log = np.load(f[0])["applelog"][y0:y1, x0:x1].astype(np.float64) / 65535.0
        base = apply_lut(ref.table, log)
        tiles = [(ref_name.replace("_Rec709", "").replace("B_", "").replace("A_", ""), base)] + [(n, apply_lut(t.table, base)) for n, t in looks]
        w, h = (x1 - x0) * z, (y1 - y0) * z
        im = Image.new("RGB", (w * 3, (h + 24) * 2), (16, 16, 16))
        d = ImageDraw.Draw(im)
        for i, (lab, t) in enumerate(tiles):
            r, k = divmod(i, 3)
            im.paste(to8(t).resize((w, h), Image.NEAREST), (k * w, r * (h + 24) + 24))
            d.text((k * w + 6, r * (h + 24) + 4), footage_ascii(lab), fill=(230, 230, 230), font=font(15))
        im.save(out_dir / f"{c['name']}.jpg", quality=92)
        print(f"  real_crops/{c['name']}.jpg")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("extract", "run"):
        s = sub.add_parser(name)
        s.add_argument("files", nargs="+")
        s.add_argument("--samples", type=int, default=40)
        s.add_argument("--min-frames", type=int, default=5)
        s.add_argument("--width", type=int, default=1920)
        s.add_argument("--at", action="append", help="label=secondes, ex. peau=12.5")
        s.add_argument("--assume-matrix", choices=sorted(footage.MATRICES))
        s.add_argument("--assume-range", choices=["tv", "pc"])
        s.add_argument("--range-note", default=None, help="justification de --assume-range (manifest)")
    sub.add_parser("analyze")
    sub.add_parser("crops", help="recadrages 100 %% définis dans REAL_FOOTAGE/crops.toml")
    sub.add_parser("report", help="régénère le HTML depuis real_footage_metrics.json et diagnostic.toml")
    args = ap.parse_args(argv)
    if args.cmd == "extract":
        return cmd_extract(args)
    if args.cmd == "analyze":
        return cmd_analyze(args)
    if args.cmd == "crops":
        return cmd_crops(args)
    if args.cmd == "report":
        data = json.loads((REPORTS_DIR / "real_footage_metrics.json").read_text(encoding="utf-8"))
        clips = sorted(d for d in RF_DIR.iterdir() if (d / "manifest.json").exists())
        write_report(data["frames"], clips, data["reference"], data["officielle_apple"],
                     [l.name for l in load_looks()])
        print(f"Rapport : {(REPORTS_DIR / 'real_footage_report.html').relative_to(ROOT)}")
        return 0
    return cmd_extract(args) or cmd_analyze(args)


if __name__ == "__main__":
    sys.exit(main())
