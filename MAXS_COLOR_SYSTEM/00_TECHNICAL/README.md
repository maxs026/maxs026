# 00_TECHNICAL — couche TECHNIQUE Apple Log → Rec.709

Cette couche convertit le signal Apple Log (BT.2020) en Rec.709 BT.1886. Elle ne contient **aucun look**
et aucun look ne contient de conversion Apple Log.

## Ordre de priorité

| # | Transformation | Statut | Dossier |
|---|---|---|---|
| 1 | **LUT officielle Apple** Apple Log → Rec.709 | ❌ **non fournie** (téléchargement Apple ID requis, inaccessible depuis l'environnement de construction) | `APPLE_OFFICIAL/` |
| 2 | **IDT Apple Log / ACES + ACES 2.0 SDR Rec.709** | ✅ générée, marquée **NON-APPLE** | `ACES2_NON-APPLE/` |
| 3 | **DaVinci Color Space Transform** (Rec.2020 / Apple Log → Rec.709 / Gamma 2.4) | référence dans Resolve, non générable ici | voir `03_DAVINCI/README.md` §6 |

Aucune approximation « maison » : aucune de ces transformations n'est écrite à la main.

## 1. APPLE_OFFICIAL/ — la LUT Apple, telle quelle

1. Se connecter sur https://developer.apple.com/download/all/?q=Apple%20log
2. Télécharger le paquet Apple Log (LUT Apple Log → Rec.709).
3. Copier **un seul** `.cube` dans `APPLE_OFFICIAL/source/` (ce fichier n'est jamais modifié).
4. `python scripts/generate_luts.py`

Le générateur :
* valide le fichier (NaN/Inf refusés) sans le réécrire ;
* le copie **octet par octet** en `AppleLog_to_Rec709_APPLE_OFFICIAL.cube`, vérifie le SHA-256 de la copie
  **et** de la source ;
* écrit `AppleLog_to_Rec709_APPLE_OFFICIAL.provenance.txt` (nom, SHA-256, taille de grille, domaine) ;
* ne la ré-échantillonne jamais (même si elle n'est pas en 65³).

Le nom « APPLE_OFFICIAL » n'est donné qu'à ce fichier-là.

## 2. ACES2_NON-APPLE/ — référence documentée (utilisée tant que la LUT Apple manque)

`AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_65.cube` (MASTER) et `_33.cube`, construits avec
OpenColorIO (config intégrée *studio-config*, version dans `provenance.txt`) :

| Étape | Source |
|---|---|
| Apple Log → linéaire scène BT.2020 → ACES2065-1 | courbe publiée par Apple (*Apple Log Profile White Paper*, 2023), built-in OCIO `APPLE_LOG_to_ACES2065-1` = IDT fournie par Apple à l'AMPAS (`IDT.Apple.AppleLog_BT2020.ctl`) |
| ACES → affichage | ACES 2.0 Output Transform « SDR 100 nits (Rec.709) » (AMPAS) |
| Encodage | Rec.1886 Rec.709 (gamma 2.4) |

Vérifications (tests) : la courbe Apple Log d'OCIO est comparée à celle de colour-science
(`tests/test_core.py`) ; les gris Apple Log de −8 à +6 IL ressortent neutres et monotones.

**Ce n'est pas le rendu Apple.** Mesuré sur rushes réels : tons moyens bas (L médian ≈ 0,41 OkLab)
et blancs peu lumineux (coque blanche ≈ 0,8). Les valeurs hors [0,1] de la sortie ACES sont ramenées
dans [0,1] (compte indiqué dans l'en-tête du fichier).

## Identification des rushes

`scripts/real_footage.py extract` documente pour chaque rush : codec, fabricant, primaires, transfert,
niveau de noir mesuré, et en déduit la plage du signal quand c'est possible. Voir
`02_TESTS/reports/real_footage_report.html`.
