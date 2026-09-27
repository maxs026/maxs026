# MAXS_Film — v1.0

Inspiration pellicule : contraste organique, noirs légèrement relevés, saturation contrôlée, légère séparation des couleurs.

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `MAXS_Film_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `MAXS_Film_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.MAXS_Film]`)

| Paramètre | Valeur |
|---|---|
| `tone.contrast` | 1.12 |
| `tone.black_lift` | 0.06 |
| `tone.white_out` | 0.965 |
| `saturation.global` | 0.95 |
| `saturation.shadows` | 0.85 |
| `saturation.highlights` | 0.8 |
| `split_tone.shadows` | {"hue": 215.0, "strength": 0.006} |
| `split_tone.highlights` | {"hue": 80.0, "strength": 0.006} |
| `hue_bands[0]` | {"name": "greens", "center": 135.0, "width": 40.0, "chroma": 0.9, "hue_shift": 3.0} |
| `hue_bands[1]` | {"name": "blues", "center": 262.0, "width": 35.0, "chroma": 0.92, "hue_shift": -3.0} |
| `hue_bands[2]` | {"name": "reds", "center": 25.0, "width": 25.0, "chroma": 1.04} |

Limites communes du moteur : rotation de teinte finale ±6.0° (garde de teinte),
compression de gamut douce (genou 0.85), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section MAXS_Film).

## Historique

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-09-27 | Premiere version MAXS COLOR SYSTEM (parametres identiques a MAXS LUT LIBRARY v1) |
