# MAXS_Natural — v1.0

Rendu naturel, contraste modéré, peau naturelle, hautes lumières douces.

**Couche CREATIVE : Rec.709 → Rec.709.** Ce look ne contient **aucune** conversion Apple Log.
Il se place **après** la couche technique (Node 01 dans DaVinci Resolve, voir `03_DAVINCI/README.md`).

| Fichier | Rôle |
|---|---|
| `MAXS_Natural_65.cube` | **MASTER** 65³ — à utiliser par défaut |
| `MAXS_Natural_33.cube` | compatibilité 33³ (logiciels / workflows légers) |
| `VERSION.json` | version, SHA-256 des fichiers, paramètres exacts |
| `versions/` | versions précédentes archivées (jamais écrasées) |

## Paramètres (`config/looks.toml` → `[looks.MAXS_Natural]`)

| Paramètre | Valeur |
|---|---|
| `tone.contrast` | 1.05 |
| `tone.black_lift` | 0.0 |
| `tone.white_out` | 0.99 |
| `saturation.global` | 1.02 |
| `saturation.shadows` | 0.95 |
| `saturation.highlights` | 0.9 |

Limites communes du moteur : rotation de teinte finale ±6.0° (garde de teinte),
compression de gamut douce (genou 0.85), protection peau, noir et blanc purs neutres.
Tolérances vérifiées sur les fichiers : voir `02_TESTS/reports/test_results.md`.

## Diagnostic sur rushes réels

Voir `02_TESTS/reports/real_footage_report.html` (section MAXS_Natural).

## Historique

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-09-27 | Premiere version MAXS COLOR SYSTEM (parametres identiques a MAXS LUT LIBRARY v1) |
