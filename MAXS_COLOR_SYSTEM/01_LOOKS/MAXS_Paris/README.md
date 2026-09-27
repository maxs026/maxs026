# MAXS_Paris — v1.0

Paris contemporain : ombres légèrement froides, tons moyens légèrement chauds, verts désaturés, bleus contrôlés, blancs propres.

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `MAXS_Paris_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `MAXS_Paris_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.MAXS_Paris]`)

| Paramètre | Valeur |
|---|---|
| `tone.contrast` | 1.08 |
| `tone.black_lift` | 0.012 |
| `tone.white_out` | 0.975 |
| `saturation.global` | 0.96 |
| `saturation.shadows` | 0.9 |
| `saturation.highlights` | 0.85 |
| `split_tone.shadows` | {"hue": 250.0, "strength": 0.01} |
| `split_tone.midtones` | {"hue": 70.0, "strength": 0.006} |
| `split_tone.highlights` | {"hue": 0.0, "strength": 0.0} |
| `hue_bands[0]` | {"name": "greens", "center": 135.0, "width": 45.0, "chroma": 0.8} |
| `hue_bands[1]` | {"name": "blues", "center": 258.0, "width": 40.0, "chroma": 0.88} |
| `hue_bands[2]` | {"name": "cyans", "center": 205.0, "width": 30.0, "chroma": 0.9} |

Limites communes du moteur : rotation de teinte finale ±6.0° (garde de teinte),
compression de gamut douce (genou 0.85), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section MAXS_Paris).

## Historique

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-09-27 | Premiere version MAXS COLOR SYSTEM (parametres identiques a MAXS LUT LIBRARY v1) |
