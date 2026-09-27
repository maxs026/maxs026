# scripts/

Tous les scripts se lancent depuis `MAXS_LUT_LIBRARY/` et lisent `config/looks.toml`.

| Script | Rôle | Code retour |
|---|---|---|
| `generate_luts.py` | Génère les looks (33³ / 65³) et la LUT technique si la source Apple est présente | 0 ; 1 avec `--strict` si technique absente |
| `validate_luts.py` | Validation structurelle et mathématique des `.cube` | 1 si un contrôle échoue |
| `test_luts.py` | Tests de comportement + rapport `02_TESTS/reports/test_results.{md,json}` | 1 si un test échoue |
| `render_comparison.py` | Images de test, planches avant/après, `metrics.json`, `index.html` | 0 |

## Options

```bash
python scripts/generate_luts.py --note "texte"        # note d'historique de la nouvelle version
python scripts/generate_luts.py --looks MAXS_Paris    # un seul look
python scripts/generate_luts.py --check               # compare sans rien écrire (détecte un changement non versionné)
python scripts/generate_luts.py --config autre.toml   # autre jeu de paramètres

python scripts/validate_luts.py                       # toutes les LUTs livrées
python scripts/validate_luts.py 01_LOOKS/MAXS_Film/MAXS_Film_65.cube
python scripts/validate_luts.py --source              # + la LUT Apple déposée dans APPLE_OFFICIAL/source/

python scripts/test_luts.py --quick                   # sans le test sur images
python scripts/render_comparison.py --full-renders    # + rendus pleine taille dans 02_TESTS/renders/
```

Enchaînement complet :

```bash
python scripts/generate_luts.py && python scripts/validate_luts.py && \
python scripts/test_luts.py && python scripts/render_comparison.py && python -m pytest tests/ -q
```

## Créer / modifier un look

1. Copier un bloc `[looks.MAXS_...]` dans `config/looks.toml` et le renommer.
2. Ajuster `tone`, `saturation`, `split_tone`, `hue_bands`, `skin_protect`
   (unités et repères de teinte en tête du fichier ; `tone.points = [[x,y],...]` remplace les
   réglages de contraste par une courbe explicite, qui doit rester croissante).
3. Incrémenter `global.version` si le résultat change (sinon le générateur refuse), relancer
   l'enchaînement. Si un test échoue, le look sort des garde-fous (peau, gris, noirs, gamut, teinte) :
   corriger le paramètre plutôt que le seuil.

## lutlib/

| Module | Contenu |
|---|---|
| `cube.py` | lecture stricte / écriture `.cube` (rouge le plus rapide, spec Adobe 1.0) |
| `colorspace.py` | BT.1886, luminance BT.709, OkLab / OkLCh |
| `pchip.py` | spline cubique monotone (courbes de ton) |
| `look.py` | moteur de look (voir tableau du README principal) |
| `interp.py` | interpolation tétraédrique, ré-échantillonnage |
| `technical.py` | LUT Apple copiée telle quelle (SHA-256), référence ACES 2.0 NON-APPLE |
| `scopes.py` | waveform Y' et histogramme RGB |
| `footage.py` | lecture ProRes, identification Apple Log, sélection de frames, mesures |
| `testimages.py` | images de test procédurales (seed fixe) + mire Apple Log |
| `checks.py` | validation et tests de comportement |
| `config.py` | chemins et chargement du TOML |

## Rush réel Apple Log (phase 2)

```bash
pip install imageio-ffmpeg                                   # si ffmpeg n'est pas installé
python scripts/real_footage.py extract IMG_7068.MOV IMG_7073.MOV   # ProRes original uniquement
python scripts/real_footage.py analyze                        # planches + 02_TESTS/reports/real_footage_report.html
python scripts/real_footage.py crops                          # recadrages 100 % (REAL_FOOTAGE/crops.toml)
python scripts/real_footage.py report                         # régénère le HTML (diagnostic.toml)
```

`extract` refuse tout fichier non ProRes, calcule le SHA-256, **identifie** le rush (codec,
fabricant, primaires, transfert, niveau de noir mesuré comparé au noir Apple Log), décode en 16 bits
avec la matrice déclarée et la plage déclarée ou **déduite des données** (sinon arrêt ;
`--assume-range tv --range-note "justification"` pour une hypothèse documentée ; une hypothèse
contredite par les données est refusée), choisit les frames (ciel, végétation, architecture, blancs, peau,
sombres + représentatives ; `--at peau=12.5` pour imposer un instant) et les enregistre sans
transformation dans `02_TESTS/REAL_FOOTAGE/<clip>/frames/*.npz` (Apple Log 16 bits).
Ces frames sont légères : on peut extraire sur son Mac, pousser le dossier, et analyser ailleurs.

`analyze` : A = LUT officielle Apple (si présente), B = ACES 2.0 (NON-APPLE), C–G = looks 65³
après la référence technique. Le diagnostic écrit et les notes viennent de
`02_TESTS/REAL_FOOTAGE/diagnostic.toml` (rédigé après examen visuel, jamais généré automatiquement).
