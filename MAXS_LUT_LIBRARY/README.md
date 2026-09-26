# MAXS LUT LIBRARY v1

Bibliothèque de LUTs 3D personnelle, **reproductible**, pour des vidéos iPhone 15 Pro Max
tournées en **Apple Log / ProRes**. Toutes les LUTs sont régénérées à partir de
`config/looks.toml` par des scripts Python : on modifie les paramètres, on relance, on reteste.

## Principe : technique ≠ look

```
Clip Apple Log (BT.2020)
   │
   ▼  00_TECHNICAL/AppleLog_to_Rec709.cube   ← transformation TECHNIQUE (officielle Apple uniquement)
Rec.709 (BT.1886)
   │
   ▼  01_LOOKS/MAXS_<Look>.cube              ← transformation CRÉATIVE (Rec.709 → Rec.709)
Rec.709 (BT.1886) final
```

* La LUT technique ne contient **aucun look**. Les looks ne contiennent **aucune conversion Apple Log**.
* Les looks attendent du Rec.709 en entrée : ils fonctionnent derrière la LUT officielle
  Apple, derrière la gestion couleur de Resolve / Final Cut, ou sur n'importe quel clip Rec.709.

## ⚠️ État de la LUT technique

**`00_TECHNICAL/AppleLog_to_Rec709.cube` n'est pas générée.** Voir [`00_TECHNICAL/README.md`](00_TECHNICAL/README.md).

* Apple publie la **courbe** Apple Log (white paper *Apple Log Profile*, 2023). Elle est disponible
  localement dans `colour-science` et `OpenColorIO` (built-in `APPLE_LOG_to_ACES2065-1`) ; les
  deux implémentations sont comparées dans `tests/test_core.py`.
* Mais le **rendu Apple Log → Rec.709** (tone mapping + gamut) officiel d'Apple n'existe que sous
  forme de LUT téléchargeable sur developer.apple.com, **derrière une connexion Apple ID**, donc
  inaccessible depuis cet environnement.
* Conformément à la règle du projet, aucune approximation n'est produite sous ce nom.
  → Déposer la LUT Apple dans `00_TECHNICAL/source/` puis relancer `generate_luts.py`.
* Option explicite, **non Apple** : `--aces-reference` construit une LUT Apple Log → ACES 2.0
  SDR Rec.709 via OpenColorIO, nommée `..._NON-APPLE_..` et rangée dans `00_TECHNICAL/alternatives/`.

## Architecture

```
MAXS_LUT_LIBRARY/
├── 00_TECHNICAL/
│   ├── README.md                    provenance, procédure d'import de la LUT Apple
│   ├── source/                      ← déposer ici la LUT officielle Apple (.cube)
│   ├── alternatives/                (optionnel) référence ACES 2.0 NON Apple
│   └── AppleLog_to_Rec709.cube      (généré seulement depuis la source officielle)
├── 01_LOOKS/
│   ├── MAXS_Natural.cube  MAXS_Paris.cube  MAXS_Film.cube  MAXS_Golden.cube  MAXS_Night.cube   (65³ MASTER)
│   └── 33_compat/MAXS_*_33.cube                                                                 (33³ compatibilité)
├── 02_TESTS/
│   ├── images/                      images de test synthétiques (aperçus PNG)
│   └── reports/                     avant/après, overview, metrics.json, test_results.md, index.html
├── config/looks.toml                ← TOUS les paramètres des looks + seuils des tests
├── scripts/
│   ├── generate_luts.py  validate_luts.py  test_luts.py  render_comparison.py
│   ├── README.md
│   └── lutlib/                      moteur (cube IO, OkLab, PCHIP, look, interpolation, tests)
├── tests/test_core.py               tests unitaires pytest du moteur
└── requirements.txt
```

## Installation

```bash
cd MAXS_LUT_LIBRARY
python3 -m venv .venv && source .venv/bin/activate      # Python ≥ 3.11 (tomllib)
pip install -r requirements.txt
```

## Utilisation

```bash
python scripts/generate_luts.py            # génère 65³ MASTER + 33³ compat (+ technique si source Apple présente)
python scripts/validate_luts.py            # validité mathématique de tous les .cube
python scripts/test_luts.py                # tests de comportement -> 02_TESTS/reports/test_results.md
python scripts/render_comparison.py        # avant/après -> 02_TESTS/reports/index.html
python -m pytest tests/ -q                 # tests unitaires du moteur
```

Modifier un look : éditer `config/looks.toml` puis relancer les quatre commandes.
Détails et options : [`scripts/README.md`](scripts/README.md).

### Dans un logiciel de montage

* **DaVinci Resolve** : nœud 1 = LUT technique (ou CST Apple Log → Rec.709), nœud 2 = look.
  Faire l'exposition / balance des blancs **avant** le look, sur le nœud 1 ou entre les deux.
* **Final Cut Pro** : Inspecteur → *Camera LUT* : conversion Apple Log (LUT Apple) ;
  puis effet *Custom LUT* avec le look (entrée/sortie Rec.709).
* Ne jamais appliquer un look directement sur un clip Apple Log non converti.

## Moteur de look (ce que fait chaque LUT)

Chaque look est une fonction pure Rec.709 → Rec.709, calculée en float64 sur une grille N³
(`scripts/lutlib/look.py`). Étapes, dans l'ordre :

| # | Étape | Détail | Paramètres |
|---|---|---|---|
| 1 | Décodage | V → lumière affichée, BT.1886 (V^2.4) | – |
| 2 | Espace de travail | Rec.709 linéaire → **OkLab / OkLCh** (Ottosson 2020) : luminosité, chroma et teinte séparés | – |
| 3 | Courbe de ton | Spline monotone **PCHIP** (Fritsch-Carlson) sur L uniquement → la teinte ne bouge pas ; points (0,0), (shadow_x, ·), (pivot, pivot), (highlight_x, ·), (1, white_out) ; relevé des noirs `lift·(1−y)^4` (monotone) ; le chroma suit la luminosité `C·(L'/L)^chroma_follow` | `tone.*` |
| 4 | Saturation | `C × global × zone(L)` (ombres / hautes lumières) ; la peau récupère une part du changement (`skin_protect.saturation`) | `saturation.*` |
| 5 | Bandes de teinte | Gain de chroma + rotation de teinte (bornée ensuite par l'étape 6b), poids cosinus surélevé, **inactif sur les neutres** (rampe `min_chroma`), atténué sur la peau | `hue_bands` |
| 6 | Split toning | Petits décalages a/b OkLab par zone, zones évaluées sur la luminosité **d'entrée** : noir et blanc purs restent neutres | `split_tone.*` |
| 6b | Garde de teinte | La teinte **finale** de toute couleur saturée (C ≥ 0,04) reste à ±`max_hue_shift_deg` (6°) de sa teinte d'entrée, quelle que soit l'étape (bandes ou split toning). Les quasi-neutres (C < 0,02) sont exemptés : les teinter est le rôle du split toning | `global.max_hue_shift_deg`, `global.hue_guard_chroma` |
| 7 | Gamut | Compression **douce** du chroma relative au chroma max Rec.709 à (L, h) constants (genou 0.85 + tanh) : aucune teinte déviée, aucun écrêtage dur | `global.gamut_knee` |
| 8 | Encodage | lumière → V^(1/2.4) | – |

### Les cinq looks (valeurs exactes dans `config/looks.toml`)

| Look | Ton | Couleur |
|---|---|---|
| **MAXS_Natural** | contraste 1.05, blanc 0.99, noirs propres | saturation 1.02, légère désaturation ombres/HL, aucune rotation de teinte |
| **MAXS_Paris** | contraste 1.08, noirs +0.012, roll-off HL (0.975) | ombres froides (h 250, bleu — pas teal), tons moyens chauds légers, HL neutres (ciel gris conservé), verts ×0.80, bleus ×0.88, cyans ×0.90 |
| **MAXS_Film** | contraste 1.12, noirs relevés (+0.06), HL douces (0.965) | saturation 0.95, ombres légèrement cyan / HL chaudes (0.006), verts +3° vers cyan, bleus −3°, rouges ×1.04 |
| **MAXS_Golden** | contraste 1.05 | chaleur surtout dans les tons moyens (0.008), s'annule au blanc pur ; oranges ×1.12 et jaunes ×1.10 **seulement s'ils sont déjà saturés** (la peau est exclue), bleus ×0.92 |
| **MAXS_Night** | contraste 1.04, noirs +0.02, pied adouci (détails conservés) | ombres froides (h 255, 0.011), HL neutres, saturation des ombres 0.80 (bruit chroma), bleus ×0.88 |

## Tests effectués (résultats réels dans `02_TESTS/reports/test_results.md`)

* **Validation** : syntaxe .cube, taille ≥ 33, nombre de lignes, NaN/Inf, min/max ∈ [0,1],
  axe des gris croissant, continuité (gain local OkLab entre nœuds voisins < 4).
* **Comportement** (sur le fichier écrit, interpolation tétraédrique) : chroma des gris, neutralité
  du blanc et du noir purs, niveau du noir, blanc non terne, monotonie de luminance (gris +
  rampes de couleurs), gradient 0.85→1 sans plateau, nœuds intérieurs écrêtés, séparation des
  basses lumières, peau (teinte / chroma / luminosité sur les patchs ColorChecker *dark/light skin*
  et interpolations), rotation de teinte, ratio de saturation, pixels écrêtés sur les images.
* **Unitaires** (`tests/test_core.py`) : courbe Apple Log colour-science vs OpenColorIO,
  aller-retour .cube, ordre des données vs `colour.read_LUT`, interpolation vs colour-science,
  OkLab vs colour-science, monotonie PCHIP, gamut, arrêt de la LUT technique sans source, copie
  bit-exacte de la source, étiquetage « NON-APPLE » de la référence ACES.

## Validation sur rush réel (phase 2)

`scripts/real_footage.py` : voir [`scripts/README.md`](scripts/README.md). Rapport :
`02_TESTS/reports/real_footage_report.html` (planches A–G, recadrages 100 %, mesures, diagnostic et
notes rédigés dans `02_TESTS/real_footage/diagnostic.toml`). Sans LUT officielle Apple, tous les
résultats passent par la référence ACES 2.0 et sont marqués **NON-APPLE**.

## Limites connues

* **LUT technique officielle absente** tant que la LUT Apple n'est pas déposée dans `00_TECHNICAL/source/`.
* Les **images de test sont synthétiques** (procédurales) : elles vérifient le comportement
  numérique par familles de couleurs, pas le rendu sur de vraies images. À valider sur vos rushes.
* Les looks supposent un Rec.709 **BT.1886 (gamma 2.4)**. Sur une timeline sRGB / gamma 2.2
  le rendu reste cohérent mais la linéarisation interne est légèrement différente.
* Une LUT 3D est bornée à [0,1] : les valeurs hors plage (super-blancs) sont écrêtées à l'entrée.
  Faire la récupération des hautes lumières **avant** le look.
* La compression de gamut désature légèrement (≤ ~5 %) les couleurs déjà à la limite du Rec.709.
* **65³ = version MASTER** (`01_LOOKS/MAXS_*.cube`) ; **33³ = compatibilité uniquement**
  (`01_LOOKS/33_compat/`). Écart 33³ vs 65³ (mesuré sur 200 000 couleurs aléatoires) : écart moyen 0.0001–0.0003, mais
  jusqu'à 0.04 (Natural) / 0.08 (Golden) en valeur affichée sur les couleurs **extrêmes au bord du
  gamut Rec.709** (un canal ≈ 0, les autres ≈ 1 : jaune ou bleu purs, néons), soit ~1–1.6 % du cube
  RGB. Préférer le 65³ pour ce type de contenu.
* Pas de gestion HDR (Rec.2100 PQ/HLG) dans cette v1.
