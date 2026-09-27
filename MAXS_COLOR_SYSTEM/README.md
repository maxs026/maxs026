# MAXS COLOR SYSTEM — v1.1

Système personnel, paramétrique et reproductible de colorimétrie pour rushes **Apple Log / ProRes**
d'iPhone 15 Pro Max, conçu pour **DaVinci Resolve**. On modifie `config/looks.toml`, on régénère,
on teste, on compare les versions.

## Principe : deux couches strictement séparées

```
Apple Log (BT.2020, ProRes)
   │  TECHNICAL   00_TECHNICAL/   Apple Log → Rec.709        (Node 01)
   ▼
Rec.709 BT.1886
   │  CREATIVE    01_LOOKS/       Rec.709 → Rec.709          (Node 02)
   ▼
Corrections (Node 03-04) → Finishing (Node 05) → Export
```

Aucune LUT créative ne contient la conversion Apple Log ; aucune LUT technique ne contient de look.

## ⚠️ État de la couche technique

| Priorité | Transformation | État |
|---|---|---|
| 1 | LUT officielle Apple | **non fournie** — à déposer dans `00_TECHNICAL/APPLE_OFFICIAL/source/` |
| 2 | Décodage Apple Log (Apple) + ACES 2.0 SDR Rec.709 | ✅ `00_TECHNICAL/ACES2_NON-APPLE/` — **NON-APPLE** |
| 3 | Color Space Transform de Resolve | documenté, non générable ici |

Détails et provenance : [`00_TECHNICAL/README.md`](00_TECHNICAL/README.md).

## Architecture

```
MAXS_COLOR_SYSTEM/
├── 00_TECHNICAL/
│   ├── APPLE_OFFICIAL/{source/, README.md}        LUT Apple (copie exacte + SHA-256) quand fournie
│   └── ACES2_NON-APPLE/                            AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_{65,33}.cube + provenance
├── 01_LOOKS/
│   └── MAXS_<Name>/                                Natural, Paris, Film, Golden, Night
│       ├── MAXS_<Name>_65.cube                     MASTER
│       ├── MAXS_<Name>_33.cube                     compatibilité
│       ├── README.md  VERSION.json                 paramètres, SHA-256, historique
│       └── versions/v1.0/                          versions précédentes (jamais écrasées)
├── 02_TESTS/
│   ├── images/                                     images synthétiques (12)
│   ├── REAL_FOOTAGE/<clip>/                        manifest (SHA-256, identification Apple Log), frames
│   └── reports/                                    index.html, real_footage_report.html, before/after, scopes, tests
├── 03_DAVINCI/{README.md, install_luts.py}         installation, node tree, comparaison des versions
├── config/looks.toml                               TOUS les paramètres + version + seuils de tests
├── scripts/                                        generate / validate / test / render_comparison / real_footage
├── tests/test_core.py                              tests unitaires (pytest)
├── CHANGELOG.md  README.md  requirements.txt
```

## Installation

```bash
cd MAXS_COLOR_SYSTEM
python3 -m venv .venv && source .venv/bin/activate      # Python ≥ 3.11
pip install -r requirements.txt
```

## Cycle de travail

```bash
# 1. modifier config/looks.toml (et incrémenter global.version si un résultat change)
python scripts/generate_luts.py --note "ce qui change"
python scripts/validate_luts.py            # fichiers .cube : format, dimensions, domaine, NaN/Inf, ASCII…
python scripts/test_luts.py                # comportement couleur → 02_TESTS/reports/test_results.md
python scripts/render_comparison.py        # avant/après + scopes → 02_TESTS/reports/index.html
python -m pytest tests/ -q                 # moteur
# 2. rushes réels
python scripts/real_footage.py extract IMG_xxxx.MOV && python scripts/real_footage.py analyze
# 3. Resolve
python 03_DAVINCI/install_luts.py --with-archives
```

**Versions** : `global.version` (1.0, 1.1, …). Régénérer une version publiée avec un résultat
différent est **refusé** ; une nouvelle version archive la précédente dans `versions/v<old>/`.

## Moteur de look (`scripts/lutlib/look.py`)

Rec.709 BT.1886 → **OkLab** (Ottosson 2020) → transformations → Rec.709 BT.1886, en float64 :

| # | Étape | Détail |
|---|---|---|
| 1 | Décodage | V → lumière affichée : V^2.4 (BT.1886, Lb = 0) |
| 2 | Espace de travail | Rec.709 linéaire → OkLab → OkLCh (L, C, h séparés) |
| 3 | Ton | spline **monotone PCHIP** sur L seul ; noirs relevés `lift·(1−y)^4` ; roll-off par `white_out` ; le chroma suit L |
| 4 | Saturation | global × zone (ombres / hautes lumières) ; la peau récupère une part du changement |
| 5 | Bandes de teinte | gain de chroma + petite rotation, poids cosinus, inactives sur les neutres, atténuées sur la peau |
| 6 | Split toning | petits décalages a/b par zone (évaluées sur la luminosité **d'entrée** : noir et blanc purs restent neutres) |
| 7 | Gamut | **compression douce en RGB linéaire** vers le gris de même luminosité (genou + tanh). Le cube est convexe ⇒ continu. *(v1.0 compressait dans OkLCh : discontinu près du bleu primaire, corrigé en v1.1)* |
| 8 | Garde de teinte | teinte **finale** de toute couleur saturée (C ≥ 0,04) à ±6,00° de son entrée, quelle que soit l'étape responsable ; quasi-neutres (C < 0,02) exemptés |
| 9 | Encodage | V = L^(1/2.4) |

### Limite de teinte ±6° : ce qui est réellement garanti

| Où | Garantie | Vérifié par |
|---|---|---|
| Moteur | ±6,00° pour C ≥ 0,04 | `tests/test_core.py::test_hue_guard_enforced` |
| Fichier 65³ | ±6,5° pour C ≥ 0,065 (tolérance d'interpolation 0,5°) | `test_luts.py`, 300 000 couleurs |
| Fichier 33³ | ±7,0° pour C ≥ 0,065 (tolérance 1,0°) | idem |
| Couleurs peu saturées (0,02 ≤ C < 0,065) | l'angle peut atteindre ~40° mais l'écart perceptuel ΔH ≤ 0,015 OkLab (~seuil de visibilité) | idem |

### Correspondance avec les noms de paramètres « type »

| Paramètre type | Dans `looks.toml` | Remarque |
|---|---|---|
| `contrast` | `tone.contrast` | pente au gris moyen (1 = neutre) |
| `saturation` | `saturation.global` | |
| `shadow_lift` | `tone.black_lift` | en L OkLab |
| `highlight_rolloff` | `tone.white_out` | roll-off ≈ 1 − white_out |
| `shadow_hue` / `midtone_hue` / `highlight_hue` | `split_tone.<zone>.hue` + `.strength` | teinte **ajoutée** (direction + force), pas une rotation |
| `green_saturation`, `blue_saturation` | `[[hue_bands]]` `chroma` | 0,92 = −8 % |
| `skin_protection` | `skin_protect.amount` | + `skin_protect.saturation` |
| `gamut_compression` | `gamut_knee` (global ou par look) | compression ≈ 1 − genou |

## Les cinq looks (v1.1, paramètres inchangés depuis v1.0)

| Look | Intention | Réglages principaux |
|---|---|---|
| **Natural** | référence quotidienne, fidèle | contraste 1,05, saturation 1,02, aucune teinte ajoutée |
| **Paris** | éditorial, architecture, Seine | contraste 1,08, noirs +0,012, ombres froides (h 250), tons moyens chauds légers, verts ×0,80, bleus ×0,88 |
| **Film** | pellicule moderne | contraste 1,12, noirs +0,06, HL 0,965, séparation légère (verts +3°, bleus −3°) |
| **Golden** | golden hour | chaleur des tons moyens, oranges/jaunes saturés enrichis (peau exclue) |
| **Night** | nuit / ville | ombres froides, HL neutres, saturation des ombres 0,80, bleus ×0,88 |

Chaque look : `01_LOOKS/MAXS_<Name>/README.md`.

## Tests

* **Fichiers** : syntaxe `.cube`, 33/65, `DOMAIN_MIN/MAX`, NaN/Inf, [0,1], ordre R-rapide (vérifié contre
  `colour.read_LUT`), lecture identique par **OpenColorIO**, en-têtes ASCII, sans BOM, LF, mots-clés standard.
* **Couleur** : gris, blanc, noir, monotonie, hautes lumières sans plateau, basses lumières, peau
  mesurée + **enveloppe de carnations** (très claires à très foncées), continuité autour de la protection
  peau, teinte (dense), primaires / secondaires / néons (continuité, retournement de chroma, teinte).
* **Rushes réels** : identification Apple Log, extraction, A–G, mesures, diagnostic écrit.

Résultats actuels : [`02_TESTS/reports/test_results.md`](02_TESTS/reports/test_results.md).

## Limites connues (v1.1)

* **LUT Apple absente** : toute la chaîne réelle passe par ACES 2.0 (NON-APPLE).
* **Carnations foncées peu saturées** : Paris, Film, Night les désaturent de 19 à 24 % (seuil 15 %) ;
  Golden et Night 33³ dépassent 4° de teinte sur l'enveloppe. **Tests en échec, correction proposée
  (v1.2), en attente d'accord.**
* **Night** : la nouvelle spécification demande « bleus légèrement renforcés », les paramètres actuels les
  réduisent (×0,88). À arbitrer (v1.2).
* **Paris / Golden sur ciel bleu** : chroma du ciel −31 à −53 % sur rush réel (diagnostic phase 2). Correction proposée.
* **Protection peau** : une LUT 3D ne voit qu'une couleur, pas un visage ; la protection est une zone
  colorimétrique (teinte + chroma), pas une détection de peau. Un mur de même couleur est traité pareil.
* **33³** : écart jusqu'à ≈ 0,08 sur les couleurs extrêmes. Préférer le 65³.
* **Images de test synthétiques** : elles vérifient des comportements, pas un rendu esthétique.
* **Resolve non testé directement** ici (voir `03_DAVINCI/README.md` §7 pour le contrôle à faire).
* Pas de HDR.
