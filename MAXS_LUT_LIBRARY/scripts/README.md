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
python scripts/generate_luts.py --sizes 33            # uniquement 33³
python scripts/generate_luts.py --sizes 33 65         # les deux (défaut : global.sizes)
python scripts/generate_luts.py --looks MAXS_Paris    # un seul look
python scripts/generate_luts.py --aces-reference      # + référence technique ACES 2.0 NON Apple
python scripts/generate_luts.py --strict              # erreur si LUT technique officielle absente
python scripts/generate_luts.py --config autre.toml   # autre jeu de paramètres

python scripts/validate_luts.py                       # toute la bibliothèque
python scripts/validate_luts.py 01_LOOKS/MAXS_Film.cube
python scripts/validate_luts.py --source              # + la LUT Apple déposée dans source/

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
3. Relancer l'enchaînement ci-dessus. Si un test échoue, c'est que le look sort des garde-fous
   (peau, gris, noirs, écrêtage…) : corriger le paramètre plutôt que le seuil.

## lutlib/

| Module | Contenu |
|---|---|
| `cube.py` | lecture stricte / écriture `.cube` (rouge le plus rapide, spec Adobe 1.0) |
| `colorspace.py` | BT.1886, luminance BT.709, OkLab / OkLCh |
| `pchip.py` | spline cubique monotone (courbes de ton) |
| `look.py` | moteur de look (voir tableau du README principal) |
| `interp.py` | interpolation tétraédrique, ré-échantillonnage |
| `technical.py` | import de la LUT officielle Apple, arrêt explicite, référence ACES optionnelle |
| `testimages.py` | images de test procédurales (seed fixe) + mire Apple Log |
| `checks.py` | validation et tests de comportement |
| `config.py` | chemins et chargement du TOML |
