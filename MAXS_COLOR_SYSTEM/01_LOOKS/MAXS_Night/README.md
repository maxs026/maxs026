# MAXS_Night — v1.0

Nuit : ombres légèrement froides, hautes lumières neutres, contraste contrôlé, détails des basses lumières conservés.

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `MAXS_Night_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `MAXS_Night_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.MAXS_Night]`)

| Paramètre | Valeur |
|---|---|
| `tone.contrast` | 1.04 |
| `tone.black_lift` | 0.02 |
| `tone.white_out` | 0.98 |
| `tone.shadow_x` | 0.22 |
| `saturation.global` | 0.94 |
| `saturation.shadows` | 0.8 |
| `saturation.highlights` | 0.9 |
| `split_tone.shadows` | {"hue": 255.0, "strength": 0.011} |
| `hue_bands[0]` | {"name": "blues", "center": 262.0, "width": 40.0, "chroma": 0.88} |

Limites communes du moteur : rotation de teinte finale ±6.0° (garde de teinte),
compression de gamut douce (genou 0.85), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section MAXS_Night).

## Historique

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-09-27 | Premiere version MAXS COLOR SYSTEM (parametres identiques a MAXS LUT LIBRARY v1) |
