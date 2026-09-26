# MAXS LUT LIBRARY v1 — résultats des tests

Généré par `scripts/test_luts.py`. Seuils : `config/looks.toml` [tests].

> **LUT technique officielle absente** : `00_TECHNICAL/AppleLog_to_Rec709.cube` n'a pas été générée (source Apple non fournie). Non testée.

## `00_TECHNICAL/alternatives/33_compat/AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
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

## `00_TECHNICAL/alternatives/AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
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

## `01_LOOKS/33_compat/MAXS_Film_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000758 max=0.999414  |
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
| peau : décalage de teinte | PASS | max 0.68°  |
| peau : ratio de chroma | PASS | 0.876..0.984  |
| peau : variation de luminosité | PASS | max dL=0.034  |
| teinte : décalage max (couleurs moyennes) | PASS | max 4.87° (≤ 6.5°), moyen 1.43°  |
| saturation : ratio moyen ColorChecker | PASS | 0.902  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/33_compat/MAXS_Golden_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.001330 max=0.999800  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.986e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0315  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.589 (seuil 4)  |
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
| peau : décalage de teinte | PASS | max 1.28°  |
| peau : ratio de chroma | PASS | 0.989..1.036  |
| peau : variation de luminosité | PASS | max dL=0.014  |
| teinte : décalage max (couleurs moyennes) | PASS | max 6.09° (≤ 6.5°), moyen 3.44°  |
| saturation : ratio moyen ColorChecker | PASS | 0.981  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/33_compat/MAXS_Natural_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=0.997719  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.614e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.759 (seuil 4)  |
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
| peau : décalage de teinte | PASS | max 0.03°  |
| peau : ratio de chroma | PASS | 0.967..1.010  |
| peau : variation de luminosité | PASS | max dL=0.013  |
| teinte : décalage max (couleurs moyennes) | PASS | max 0.03° (≤ 6.5°), moyen 0.00°  |
| saturation : ratio moyen ColorChecker | PASS | 0.997  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/33_compat/MAXS_Night_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.002480 max=0.994547  |
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
| peau : décalage de teinte | PASS | max 0.99°  |
| peau : ratio de chroma | PASS | 0.888..0.969  |
| peau : variation de luminosité | PASS | max dL=0.012  |
| teinte : décalage max (couleurs moyennes) | PASS | max 2.34° (≤ 6.5°), moyen 0.36°  |
| saturation : ratio moyen ColorChecker | PASS | 0.904  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/33_compat/MAXS_Paris_33.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 33  |
| dimensions >= 33 | PASS | 33^3  |
| nombre de points | PASS | 35937  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000642 max=0.998097  |
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
| peau : décalage de teinte | PASS | max 0.92°  |
| peau : ratio de chroma | PASS | 0.904..1.002  |
| peau : variation de luminosité | PASS | max dL=0.022  |
| teinte : décalage max (couleurs moyennes) | PASS | max 5.95° (≤ 6.5°), moyen 2.10°  |
| saturation : ratio moyen ColorChecker | PASS | 0.885  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Film.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000748 max=0.999420  |
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
| peau : décalage de teinte | PASS | max 0.65°  |
| peau : ratio de chroma | PASS | 0.883..0.984  |
| peau : variation de luminosité | PASS | max dL=0.034  |
| teinte : décalage max (couleurs moyennes) | PASS | max 4.88° (≤ 6.5°), moyen 1.44°  |
| saturation : ratio moyen ColorChecker | PASS | 0.903  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Golden.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000854 max=0.999800  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=4.434e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0315  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.153 (seuil 4)  |
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
| peau : décalage de teinte | PASS | max 0.90°  |
| peau : ratio de chroma | PASS | 0.982..1.025  |
| peau : variation de luminosité | PASS | max dL=0.014  |
| teinte : décalage max (couleurs moyennes) | PASS | max 6.02° (≤ 6.5°), moyen 3.44°  |
| saturation : ratio moyen ColorChecker | PASS | 0.981  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Natural.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=0.997741  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=2.995e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0000  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.605 (seuil 4)  |
| gris : chroma max | PASS | 0.0000 (≤ 0.02)  |
| blanc pur neutre | PASS | C=0.0000  |
| noir pur neutre | PASS | C=0.0000  |
| noir pas trop relevé | PASS | L=0.0000  |
| blanc pas terne | PASS | V=[0.9875, 0.9875, 0.9875]  |
| monotonie luminance (gris) | PASS | min dY=3.86e-08  |
| monotonie approx. luminance (couleurs) | PASS | min dY=0.00e+00  |
| hautes lumières non clippées (gradient 0.85→1) | PASS | min dY=8.77e-04  |
| clipping anormal (noeuds intérieurs à 0 ou 1) | PASS | 0.02 %  |
| détail des basses lumières (0.02 vs 0.06) | PASS | ratio=0.863  |
| peau : décalage de teinte | PASS | max 0.00°  |
| peau : ratio de chroma | PASS | 0.967..1.010  |
| peau : variation de luminosité | PASS | max dL=0.013  |
| teinte : décalage max (couleurs moyennes) | PASS | max 0.01° (≤ 6.5°), moyen 0.00°  |
| saturation : ratio moyen ColorChecker | PASS | 0.997  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Night.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.002480 max=0.994618  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=1.167e-04  |
| axe des gris : écart RGB (info) | PASS | 0.0312  |
| continuité (gain local OkLab max entre noeuds) | PASS | 1.101 (seuil 4)  |
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
| peau : décalage de teinte | PASS | max 0.77°  |
| peau : ratio de chroma | PASS | 0.900..0.970  |
| peau : variation de luminosité | PASS | max dL=0.012  |
| teinte : décalage max (couleurs moyennes) | PASS | max 2.34° (≤ 6.5°), moyen 0.35°  |
| saturation : ratio moyen ColorChecker | PASS | 0.905  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |

## `01_LOOKS/MAXS_Paris.cube` — ✅ OK

| Test | Statut | Valeur |
|---|---|---|
| format .cube | PASS | LUT_3D_SIZE 65  |
| dimensions >= 33 | PASS | 65^3  |
| nombre de points | PASS | 274625  |
| absence de NaN | PASS | 0 NaN  |
| absence de Inf | PASS | 0 Inf  |
| valeurs min/max dans [0,1] | PASS | min=0.000000 max=0.998134  |
| domaine d'entrée | PASS | [0.0, 0.0, 0.0]..[1.0, 1.0, 1.0]  |
| axe des gris : luminance croissante | PASS | min dY=5.730e-05  |
| axe des gris : écart RGB (info) | PASS | 0.0286  |
| continuité (gain local OkLab max entre noeuds) | PASS | 0.913 (seuil 4)  |
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
| peau : décalage de teinte | PASS | max 0.69°  |
| peau : ratio de chroma | PASS | 0.908..1.000  |
| peau : variation de luminosité | PASS | max dL=0.023  |
| teinte : décalage max (couleurs moyennes) | PASS | max 6.01° (≤ 6.5°), moyen 2.10°  |
| saturation : ratio moyen ColorChecker | PASS | 0.885  |
| images : augmentation de pixels clippés | PASS | 0.000 % (-)  |
