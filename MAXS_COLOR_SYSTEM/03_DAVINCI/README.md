# 03_DAVINCI — MAXS COLOR SYSTEM dans DaVinci Resolve

> Ce qui suit décrit l'interface de Resolve telle que documentée par Blackmagic Design.
> Resolve n'a **pas** pu être lancé dans l'environnement où ce système a été construit : les
> LUTs sont vérifiées avec deux lecteurs `.cube` standards (OpenColorIO et colour-science),
> pas dans Resolve lui-même. Premier import : vérifier que les rendus correspondent à
> `02_TESTS/reports/` (voir « Contrôle après import »).

## 1. Réglages du projet (indispensables)

`File > Project Settings > Color Management` :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Color science | **DaVinci YRGB** (non « Color Managed », non ACES) | le Node 01 doit recevoir le signal Apple Log **brut** ; en projet géré, Resolve convertirait déjà l'Apple Log et la LUT technique serait appliquée deux fois |
| Timeline color space | **Rec.709 Gamma 2.4** | les looks MAXS sont conçus en Rec.709 BT.1886 (gamma 2.4) |
| Output color space | **Rec.709 Gamma 2.4** | idem |

Clip Attributes (clic droit sur le clip) → **Data Levels : Auto**. Les ProRes iPhone sont en plage
vidéo ; c'est ce que les tests de ce projet ont mesuré (voir `02_TESTS/reports/real_footage_report.html`).

## 2. Installer les LUTs

**Automatique (recommandé)** — copie versionnée, n'écrase jamais une version déjà installée :

```bash
python 03_DAVINCI/install_luts.py --dry-run          # vérifier
python 03_DAVINCI/install_luts.py                    # version courante
python 03_DAVINCI/install_luts.py --with-archives    # + versions archivées, pour comparer v1.0 / v1.1
```

**Manuel** — dans Resolve : `Project Settings > Color Management > Lookup Tables > Open LUT Folder`,
copier les fichiers, puis **Update Lists**. Dossiers par défaut documentés par Blackmagic :

| Système | Dossier LUT |
|---|---|
| macOS | `/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT` |
| Windows | `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\LUT` |
| Linux | `/opt/resolve/LUT` |

En cas de doute, le bouton **Open LUT Folder** fait foi.

Arborescence créée (visible dans le navigateur de LUTs de la page Color) :

```
LUT/MAXS_COLOR_SYSTEM/v1.1/
├── 1_TECHNICAL/   AppleLog_to_Rec709_APPLE_OFFICIAL.cube   (si la LUT Apple a été fournie)
│                  AppleLog_to_Rec709_ACES2-SDR100_NON-APPLE_65.cube / _33.cube
├── 2_LOOKS_65/    MAXS_Natural_65.cube … MAXS_Night_65.cube   ← MASTER
└── 3_LOOKS_33/    MAXS_Natural_33.cube … MAXS_Night_33.cube   ← compatibilité
```

## 3. Node tree recommandé (page Color)

```
[Node 01 TECHNICAL] → [Node 02 MAXS LOOK] → [Node 03 PRIMARY] → [Node 04 SECONDARY] → [Node 05 FINISHING]
```

| Node | Contenu | LUT |
|---|---|---|
| **01 TECHNICAL** | Apple Log → Rec.709, rien d'autre | `1_TECHNICAL/…APPLE_OFFICIAL.cube` si disponible, sinon `…ACES2-SDR100_NON-APPLE_65.cube` |
| **02 MAXS LOOK** | le look, rien d'autre | `2_LOOKS_65/MAXS_<Look>_65.cube` |
| **03 PRIMARY** | exposition, balance, contraste du plan | — |
| **04 SECONDARY** | qualifiers, fenêtres, peau | — |
| **05 FINISHING** | grain, vignettage, netteté | — |

Créer la chaîne : `Alt+S` (Option+S sur Mac) ajoute un node en série. Nommer un node :
clic droit → *Node Label*. Une fois la chaîne construite, l'enregistrer comme still dans la
Gallery pour la réappliquer à d'autres plans.

**Règle** : une LUT MAXS est **toujours Rec.709 → Rec.709**. Ne jamais la poser sur un clip Apple Log
non converti, et ne jamais cumuler deux LUTs techniques.

Remarque : de fortes corrections d'exposition se font mieux **avant** la conversion (sur le signal
log, dans un node inséré avant le Node 01), les petites retouches dans le Node 03.

## 4. Appliquer, désactiver, comparer

| Action | Comment |
|---|---|
| Appliquer une LUT | page Color → sélectionner le node → clic droit → **LUT** → `MAXS_COLOR_SYSTEM/v1.1/…` ; ou panneau **LUTs** (en haut à gauche), glisser la LUT sur le node |
| Désactiver un node (et sa LUT) | sélectionner le node → `Ctrl+D` / `Cmd+D` |
| Tout désactiver (avant/après) | `Shift+D` |
| Comparer plusieurs looks | clic droit sur la vignette du clip → **Local Versions → Create New Version** ; une version par look (Node 02 différent), puis passer de l'une à l'autre ; ou Gallery stills + wipe |
| Comparer deux versions MAXS (v1.0 / v1.1) | installer avec `--with-archives`, puis mettre `v1.0/2_LOOKS_65/MAXS_Paris_65.cube` dans une version locale et `v1.1/…` dans une autre |

## 5. 65³ ou 33³ ?

| | 65³ **MASTER** | 33³ compatibilité |
|---|---|---|
| Usage | par défaut dans Resolve | logiciels / lecteurs limités, preview léger |
| Précision | référence | écart moyen ≈ 0,0003 ; jusqu'à ≈ 0,08 sur les couleurs **extrêmes** (primaires pures, néons) |
| Taille | ≈ 7,4 Mo | ≈ 1 Mo |

Ne pas mélanger les deux dans une comparaison : comparer des 65³ entre elles.

## 6. Couche technique : trois options, par ordre de priorité

1. **LUT officielle Apple** (`…APPLE_OFFICIAL.cube`) — copie exacte du fichier Apple, SHA-256 dans
   `00_TECHNICAL/APPLE_OFFICIAL/*.provenance.txt`. **Absente tant que tu ne l'as pas fournie.**
2. **ACES 2.0 NON-APPLE** (`…ACES2-SDR100_NON-APPLE_65.cube`) — décodage Apple Log publié par Apple +
   rendu ACES 2.0 SDR Rec.709. Référence documentée, **pas** le rendu Apple : tons moyens plus bas et
   blancs moins lumineux mesurés sur rushes réels.
3. **Color Space Transform de Resolve** (référence dans l'application, non générée ici) : effet
   *Color Space Transform* sur le Node 01, Input Color Space **Rec.2020**, Input Gamma **Apple Log**
   (présent dans les versions récentes de Resolve — à vérifier dans ta version), Output **Rec.709** /
   **Gamma 2.4**, Tone Mapping **DaVinci**. Non testé dans ce projet.

Les looks MAXS ont été calibrés sur des images Rec.709 génériques ; leur rendu final dépend de la
couche technique choisie. Comparer les options 1 à 3 sur un même plan avant de figer un workflow.

## 7. Contrôle après import (5 minutes)

1. Importer `02_TESTS/images/07_gris_neutre.png` (Rec.709) dans une timeline.
2. Node unique avec `MAXS_Natural_65.cube`.
3. Comparer avec `02_TESTS/reports/MAXS_Natural_before_after.jpg` et la waveform
   `02_TESTS/reports/scopes/MAXS_Natural_waveform.png` : la rampe doit avoir la même forme.
4. Si ce n'est pas le cas : vérifier le Color science (DaVinci YRGB), Data Levels et le gamma de timeline.

## 8. Cycle de modification

```
config/looks.toml → python scripts/generate_luts.py → validate_luts.py → test_luts.py → render_comparison.py
→ install_luts.py (nouveau dossier v1.x) → Resolve : comparer v1.x et v1.(x-1) sur les mêmes plans
```

Changer un paramètre sans incrémenter `global.version` est **refusé** par le générateur : une version
installée dans Resolve ne change jamais de contenu.
