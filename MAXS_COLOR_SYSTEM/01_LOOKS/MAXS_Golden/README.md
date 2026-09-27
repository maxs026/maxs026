# MAXS_Golden — v1.1

Golden hour : chaleur subtile dans les tons moyens, oranges/jaunes saturés légèrement enrichis, peau naturelle, blancs préservés.

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `MAXS_Golden_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `MAXS_Golden_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.MAXS_Golden]`)

| Paramètre | Valeur |
|---|---|
| `tone.contrast` | 1.05 |
| `tone.black_lift` | 0.005 |
| `tone.white_out` | 0.985 |
| `saturation.global` | 1.01 |
| `saturation.shadows` | 0.95 |
| `saturation.highlights` | 0.9 |
| `split_tone.shadows` | {"hue": 60.0, "strength": 0.003} |
| `split_tone.midtones` | {"hue": 75.0, "strength": 0.008} |
| `split_tone.highlights` | {"hue": 80.0, "strength": 0.005} |
| `hue_bands[0]` | {"name": "oranges", "center": 62.0, "width": 32.0, "chroma": 1.12, "min_chroma": [0.08, 0.13]} |
| `hue_bands[1]` | {"name": "yellows", "center": 95.0, "width": 28.0, "chroma": 1.1, "hue_shift": -2.0, "min_chroma": [0.06, 0.11]} |
| `hue_bands[2]` | {"name": "blues", "center": 258.0, "width": 40.0, "chroma": 0.92} |
| `skin_protect.amount` | 0.85 |

Limites communes du moteur : rotation de teinte finale ±6.0° (garde de teinte),
compression de gamut douce (genou 0.85), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section MAXS_Golden).

## Historique

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-09-27 | Premiere version MAXS COLOR SYSTEM (parametres identiques a MAXS LUT LIBRARY v1) |
| v1.1 | 2026-09-27 | Moteur : compression de gamut en RGB lineaire (continue) + garde de teinte apres gamut. Parametres des looks inchanges. |
