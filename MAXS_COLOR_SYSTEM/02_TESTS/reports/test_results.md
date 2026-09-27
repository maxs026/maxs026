# MAXS COLOR SYSTEM v1.1 — résultats des tests

Généré par `scripts/test_luts.py`. Seuils : `config/looks.toml` [tests].

> **LUT officielle Apple absente** : couche technique testée = référence ACES 2.0 **NON-APPLE** (`00_TECHNICAL/ACES2_NON-APPLE/`).

## `00_TECHNICAL/ACES2_NON-APPLE/AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=1.000000  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance non décroissante (entrée log) | PASS | min dY=0.000e+00  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (info, entrée log) | PASS | gain local OkLab max 4.931  |
| gris Apple Log -> neutres | PASS | C max=0.0000  |
| monotonie (-8 à +6 IL) | PASS | min dY=9.30e-08  |
| gris 18 % (info) | PASS | V=0.383  |

## `00_TECHNICAL/ACES2_NON-APPLE/AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_65.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=1.000000  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance non décroissante (entrée log) | PASS | min dY=0.000e+00  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (info, entrée log) | PASS | gain local OkLab max 3.174  |
| gris Apple Log -> neutres | PASS | C max=0.0000  |
| monotonie (-8 à +6 IL) | PASS | min dY=1.70e-07  |
| gris 18 % (info) | PASS | V=0.383  |

## `01_LOOKS/MAXS_Film/MAXS_Film_33.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.003876 max=0.999520  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=6.135e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0239  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.544 (seuil 4)  |
| gris : chroma max | PASS | 0.0060 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0600  |
| blanc pas terne | PASS | V=[0.9564, 0.9564, 0.9564]  |
| monotonie luminance (gris) | PASS | min dY=1.23e-05  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=5.16e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.655  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.68°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.876..0.984 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.034  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 3.94°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.785..1.005 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.033  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.22 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.57° (≤ 7°), moyen 1.44° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0083 (≤ 0.015), angle max 22.7° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.29 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 3.9 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.45  |
| gamut : teinte des primaires/néons | PASS | max 6.18° (≤ 7°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.902  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Film/MAXS_Film_65.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.003821 max=0.999524  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=2.744e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0240  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.123 (seuil 4)  |
| gris : chroma max | PASS | 0.0060 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0600  |
| blanc pas terne | PASS | V=[0.9564, 0.9564, 0.9564]  |
| monotonie luminance (gris) | PASS | min dY=1.34e-05  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=5.03e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.636  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.65°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.883..0.984 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.034  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 3.54°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.788..1.004 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.033  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.22 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.27° (≤ 6.5°), moyen 1.44° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0081 (≤ 0.015), angle max 22.1° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.38 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 3.9 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.45  |
| gamut : teinte des primaires/néons | PASS | max 6.03° (≤ 6.5°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.903  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Golden/MAXS_Golden_33.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.001330 max=0.999884  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.986e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0315  |
| continuité (gain local OkLab max entre noeuds) | PASS | 2.220 (seuil 4)  |
| gris : chroma max | PASS | 0.0083 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0050  |
| blanc pas terne | PASS | V=[0.9813, 0.9813, 0.9813]  |
| monotonie luminance (gris) | PASS | min dY=2.86e-07  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.45e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.861  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 1.28°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.989..1.036 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.014  |
| carnations (enveloppe dérivée) : décalage de teinte | FAIL | max 4.09°  |
| carnations (enveloppe dérivée) : ratio de chroma | PASS | 0.926..1.145 min à L=0.35 C=0.100 h=45° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.014  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.30 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.10° (≤ 7°), moyen 2.37° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0083 (≤ 0.015), angle max 24.3° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.33 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 4.2 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.63  |
| gamut : teinte des primaires/néons | PASS | max 6.07° (≤ 7°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.979  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Golden/MAXS_Golden_65.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.001330 max=0.999884  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=4.434e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0315  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.771 (seuil 4)  |
| gris : chroma max | PASS | 0.0083 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0050  |
| blanc pas terne | PASS | V=[0.9813, 0.9813, 0.9813]  |
| monotonie luminance (gris) | PASS | min dY=2.97e-07  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.50e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.853  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.90°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.982..1.025 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.014  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 3.76°  |
| carnations (enveloppe dérivée) : ratio de chroma | PASS | 0.926..1.140 min à L=0.35 C=0.100 h=45° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.014  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.31 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.02° (≤ 6.5°), moyen 2.37° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0083 (≤ 0.015), angle max 24.4° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.64 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 4.2 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.63  |
| gamut : teinte des primaires/néons | PASS | max 6.01° (≤ 6.5°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.979  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Natural/MAXS_Natural_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=0.997880  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.614e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.076 (seuil 4)  |
| gris : chroma max | PASS | 0.0000 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0000  |
| blanc pas terne | PASS | V=[0.9875, 0.9875, 0.9875]  |
| monotonie luminance (gris) | PASS | min dY=3.94e-08  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.71e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.861  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.03°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.967..1.010 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.013  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 0.92°  |
| carnations (enveloppe dérivée) : ratio de chroma | PASS | 0.921..1.012 min à L=0.35 C=0.100 h=45° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.015  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.08 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 1.46° (≤ 7°), moyen 0.03° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0013 (≤ 0.015), angle max 2.5° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.08 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 3.9 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.59  |
| gamut : teinte des primaires/néons | PASS | max 1.56° (≤ 7°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.996  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Natural/MAXS_Natural_65.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=0.997891  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=2.995e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (gain local OkLab max entre noeuds) | PASS | 0.896 (seuil 4)  |
| gris : chroma max | PASS | 0.0000 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0000  |
| blanc pas terne | PASS | V=[0.9875, 0.9875, 0.9875]  |
| monotonie luminance (gris) | PASS | min dY=3.86e-08  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.77e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.863  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.00°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.967..1.010 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.013  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 0.87°  |
| carnations (enveloppe dérivée) : ratio de chroma | PASS | 0.920..1.012 min à L=0.35 C=0.100 h=45° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.015  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.08 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 1.40° (≤ 6.5°), moyen 0.03° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0008 (≤ 0.015), angle max 1.2° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.63 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 4.8 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.59  |
| gamut : teinte des primaires/néons | PASS | max 1.56° (≤ 6.5°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.996  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Night/MAXS_Night_33.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.004624 max=0.994910  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=3.742e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0312  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.149 (seuil 4)  |
| gris : chroma max | PASS | 0.0110 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0200  |
| blanc pas terne | PASS | V=[0.9751, 0.9751, 0.9751]  |
| monotonie luminance (gris) | PASS | min dY=2.60e-06  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.26e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.941  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.99°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.888..0.969 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.012  |
| carnations (enveloppe dérivée) : décalage de teinte | FAIL | max 5.16°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.756..0.968 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.012  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.08 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.37° (≤ 7°), moyen 0.57° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0124 (≤ 0.015), angle max 44.2° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.19 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 0.0 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.67  |
| gamut : teinte des primaires/néons | PASS | max 6.17° (≤ 7°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.904  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Night/MAXS_Night_65.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.003818 max=0.994961  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.167e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0312  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.098 (seuil 4)  |
| gris : chroma max | PASS | 0.0110 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0200  |
| blanc pas terne | PASS | V=[0.9751, 0.9751, 0.9751]  |
| monotonie luminance (gris) | PASS | min dY=2.81e-06  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.30e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.925  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.77°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.900..0.970 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.012  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 3.89°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.762..0.969 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.012  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.08 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.10° (≤ 6.5°), moyen 0.57° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0124 (≤ 0.015), angle max 43.0° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.32 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 0.1 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.67  |
| gamut : teinte des primaires/néons | PASS | max 6.07° (≤ 6.5°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.904  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Paris/MAXS_Paris_33.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.002310 max=0.998349  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=2.098e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0286  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.117 (seuil 4)  |
| gris : chroma max | PASS | 0.0100 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0120  |
| blanc pas terne | PASS | V=[0.9688, 0.9688, 0.9688]  |
| monotonie luminance (gris) | PASS | min dY=9.44e-07  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=7.02e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.817  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.92°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.904..1.002 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.022  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 3.16°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.803..1.074 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.022  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.15 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.29° (≤ 7°), moyen 1.50° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0126 (≤ 0.015), angle max 42.6° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.15 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 2.2 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.56  |
| gamut : teinte des primaires/néons | PASS | max 6.16° (≤ 7°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.885  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Paris/MAXS_Paris_65.cube` — ❌ ÉCHEC

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| compatibilité lecteurs : sans BOM, fins de ligne LF | PASS |   |
| en-têtes ASCII | PASS |   |
| mots-clés standard uniquement (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX) | PASS | DOMAIN_MAX DOMAIN_MIN LUT_3D_SIZE TITLE  |
| taille MASTER 65 ou compat 33 (info) | PASS | 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.002046 max=0.998361  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=5.730e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0286  |
| continuité (gain local OkLab max entre noeuds) | PASS | 0.939 (seuil 4)  |
| gris : chroma max | PASS | 0.0100 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0120  |
| blanc pas terne | PASS | V=[0.9688, 0.9688, 0.9688]  |
| monotonie luminance (gris) | PASS | min dY=9.98e-07  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=7.01e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.00 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.808  |
| peau mesurée (ColorChecker) : décalage de teinte | PASS | max 0.69°  |
| peau mesurée (ColorChecker) : ratio de chroma | PASS | 0.908..1.000 min à L=0.38 C=0.054 h=42° |
| peau mesurée (ColorChecker) : variation de luminosité | PASS | max dL=0.023  |
| carnations (enveloppe dérivée) : décalage de teinte | PASS | max 2.74°  |
| carnations (enveloppe dérivée) : ratio de chroma | FAIL | 0.808..1.070 min à L=0.35 C=0.035 h=55° |
| carnations (enveloppe dérivée) : variation de luminosité | PASS | max dL=0.022  |
| peau : continuité autour de la zone protégée | PASS | gain local max = 1.15 (seuil 4.0)  |
| teinte : rotation max (fichier, C ≥ 0.065) | PASS | max 6.06° (≤ 6.5°), moyen 1.50° 63074 couleurs |
| teinte : écart perceptuel ΔH (0.02 ≤ C < seuil) | PASS | max ΔH=0.0124 (≤ 0.015), angle max 41.4° angle peu significatif à faible chroma |
| gamut : continuité rampes primaires/néons | PASS | gain local max = 1.28 (seuil 4.0)  |
| gamut : retournement de chroma en fin de rampe | PASS | 2.5 % (≤ 8 %) roll-off des hautes lumières sur les primaires lumineuses |
| gamut : pas de plateau en fin de rampe (compression douce) | PASS | pas final / médian = 0.56  |
| gamut : teinte des primaires/néons | PASS | max 6.03° (≤ 6.5°)  |
| saturation : ratio moyen ColorChecker | PASS | 0.885  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |
