# 00_TECHNICAL — Apple Log → Rec.709

## Règle

`AppleLog_to_Rec709.cube` n'est produite **qu'à partir de la LUT officielle Apple**.
Aucune fonction Apple Log → Linear ou Apple Log → Rec.709 n'est inventée ici.

## Ce qui est disponible, et d'où

| Élément | Statut | Source |
|---|---|---|
| Primaires Apple Log | BT.2020, D65 | Apple Log Profile White Paper (2023) |
| Courbe Apple Log ↔ linéaire | ✅ disponible localement | White paper Apple ; implémentée dans `colour-science` (`log_encoding_AppleLogProfile`) et OpenColorIO (`CURVE - APPLE_LOG_to_LINEAR`), IDT ACES fournie par Apple (`IDT.Apple.AppleLog_BT2020.ctl`). Les deux implémentations sont comparées dans `tests/test_core.py`. |
| **Rendu Apple Log → Rec.709 d'Apple** | ❌ **absent** | LUT officielle sur https://developer.apple.com/download/all/?q=Apple%20log — connexion Apple ID requise, non accessible depuis l'environnement de génération. |

La courbe seule ne suffit pas : passer d'un signal scène (log, BT.2020) à un affichage Rec.709
exige un tone mapping et une conversion de gamut, qu'Apple ne publie que sous forme de LUT.

## Fournir la LUT officielle

1. Se connecter sur https://developer.apple.com/download/all/?q=Apple%20log
2. Télécharger le paquet *Apple Log* (LUT Apple Log → Rec.709, ex. `AppleLogToRec709-v1.0.cube`).
3. Copier **un seul** fichier `.cube` dans `00_TECHNICAL/source/`.
4. `python scripts/generate_luts.py && python scripts/validate_luts.py --source && python scripts/test_luts.py`

Le script :
* copie le fichier **à l'identique** (octet par octet) si sa taille correspond (33 ou 65) ;
* sinon le ré-échantillonne en interpolation tétraédrique (aucune information ajoutée, noté dans l'en-tête) ;
* écrit un fichier `*.provenance.txt` avec le SHA-256 de la source.

Sans source : message explicite, pas de LUT technique ; `--strict` renvoie un code d'erreur.

## Alternative documentée, NON Apple (`--aces-reference`)

`python scripts/generate_luts.py --aces-reference` écrit
`alternatives/AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_{33,65}.cube` :

Apple Log (décodage Apple, built-in OCIO) → ACES2065-1 → **ACES 2.0 Output Transform SDR 100 nits
(Rec.709)** → affichage Rec.1886, via la *studio config* intégrée à OpenColorIO ≥ 2.4.
C'est un rendu standard (AMPAS), **pas** le rendu Apple : contraste et saturation différents.
Les valeurs hors [0,1] en sortie sont ramenées dans [0,1] (compte noté dans l'en-tête).
Elle n'est pas générée par défaut.
