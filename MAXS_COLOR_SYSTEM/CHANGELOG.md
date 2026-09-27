# CHANGELOG — MAXS COLOR SYSTEM

Chaque version publiée est archivée dans `01_LOOKS/MAXS_<Name>/versions/v<x.y>/` et n'est jamais
réécrite. `03_DAVINCI/install_luts.py --with-archives` installe toutes les versions côte à côte.

## v1.1 — 2026-09-27 — correction moteur (gamut + garde de teinte)

Paramètres des looks **inchangés**. Sorties modifiées uniquement près des limites du gamut :
ΔE OkLab moyen 0,0002–0,0009, max 0,008–0,047, 0 à 3,3 % des nœuds 65³ au-delà de 0,005.

* **Corrigé — discontinuité dans la compression de gamut** (tous les looks, y compris Natural).
  La v1.0 compressait le chroma relativement au « chroma max à L et teinte constants » (OkLCh). Près du
  bleu primaire cette ligne sort du cube Rec.709 et y rentre (mesuré : en gamut pour C ∈ [0 ; 0,271] et
  [0,287 ; 0,302]), la recherche par dichotomie changeait de borne ⇒ cassure (gain local 187 sur la rampe
  gris → bleu de Natural). La v1.1 compresse le long de la droite, en RGB linéaire, vers le gris de même
  luminosité : cube convexe ⇒ sortie unique, continue, calculée sans itération.
* **Corrigé — garde de teinte** appliquée après la compression de gamut (la dérive due à la compression
  est elle aussi bornée) : le moteur respecte ±6,00° exactement pour C ≥ 0,04.
* **Documentation corrigée** : la limite ±6° était annoncée comme tenue par les **fichiers** dès C ≥ 0,04.
  Mesure dense (300 000 couleurs) : faux près de C ≈ 0,04–0,06 à cause de l'interpolation (jusqu'à 12° en
  65³, 15° en 33³, écart perceptuel ΔH ≤ 0,015). Garanties réelles désormais documentées et testées.
* **Tests ajoutés** : primaires / secondaires / néons (continuité, retournement de chroma, teinte),
  enveloppe de carnations (très claires à très foncées), continuité autour de la protection peau,
  teinte dense, lecture OpenColorIO, en-têtes compatibles Resolve, versionnage.
* **Nouveaux constats (non corrigés, en attente d'accord)** : carnations foncées peu saturées
  désaturées de 19–24 % par Paris, Film, Night ; teinte > 4° sur l'enveloppe en 33³ pour Golden et Night.

## v1.0 — 2026-09-27 — MAXS COLOR SYSTEM

* Restructuration de MAXS LUT LIBRARY v1 : couches TECHNICAL / CREATIVE séparées, un dossier par look
  (`_65` MASTER, `_33` compatibilité, README, VERSION.json), 03_DAVINCI, versionnage.
* Référence technique ACES 2.0 NON-APPLE générée par défaut ; LUT Apple importée telle quelle si fournie.
* Données des LUTs **identiques** à MAXS LUT LIBRARY v1 (vérifié nœud par nœud, 65³ et 33³).

## Avant v1.0 — MAXS LUT LIBRARY v1

* Moteur OkLab, 5 looks, tests, garde de teinte après split toning (Golden 7,6° → 6°), 65³ MASTER.
* Phase 2 : validation sur rushes réels IMG_7068 / IMG_7073 (diagnostic `02_TESTS/REAL_FOOTAGE/diagnostic.toml`).
