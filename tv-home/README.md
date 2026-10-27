# Accueil TV (appli Tizen)

Page d'accueil légère pour Samsung Crystal UHD : heure, météo, grille de raccourcis.
Le même dossier fonctionne dans un navigateur (`index.html`) et comme appli Tizen (`config.xml`).

## Réglages
En haut de `index.html`, l'objet `CONFIG` : ville et coordonnées météo, liste des raccourcis,
`visible` = nombre d'applis visibles de chaque côté de la sélection.
`id` = identifiant de l'appli Samsung (ouvre l'appli native, sinon repli sur l'adresse web).
Les `id` fournis (YouTube, Netflix, Prime, Disney+) sont à vérifier sur ta TV : touche **bleue**
de la télécommande dans l'appli = liste des applis installées avec leurs vrais `id`.

## Installation
1. **TV** : écran Apps, taper `12345`, activer *Developer mode*, saisir l'IP du PC, redémarrer la TV.
2. **PC** : installer Tizen Studio (+ extension *TV*). Device Manager > connecter la TV (IP, port 26101).
3. **Certificat** : Certificate Manager > *Samsung* certificate (compte Samsung requis) pour la TV.
4. **Installer** : dans Tizen Studio, importer ce dossier (*Import > Tizen > Tizen Project*),
   clic droit > *Run As > Tizen Web Application*. Ou en ligne de commande :
   ```
   tizen package -t wgt -s <profil_certificat> -- tv-home
   tizen install -n TvHome.wgt -t <nom_de_la_tv>
   tizen run -p TvHomeApp0.Accueil -t <nom_de_la_tv>
   ```
5. **Démarrage auto** : ouvrir l'appli une fois, puis Paramètres > Général > Fonctions Smart >
   *Lancer automatiquement la dernière appli* (libellé variable selon le modèle).

## Télécommande
Haut / Bas : défiler la liste (en boucle, sans fin). OK : ouvrir. Retour : quitter. Bleu : liste des applis et de leurs `id`.
Vert : affiche ou masque les stats CPU / RAM. Jaune : change le niveau de qualité (**Normal → Éco → Ultra**). Rouge : Ultra on/off.
Éco : sans lueurs d'ambiance, transitions plus courtes. Ultra : aucune animation, 3 éléments seulement
rendus, stats ralenties. Pendant la navigation l'appli mesure le temps par image et baisse d'un niveau
toute seule si la TV rame ; le niveau est mémorisé.

## Limites
- Appli de développeur : le certificat expire (~1 an), à réinstaller ensuite.
- Une mise à jour du firmware peut désactiver le mode développeur.
- Smart Hub n'est pas remplaçable sur Tizen.

## Fluidité
Seuls `transform` et `opacity` sont animés (GPU) : échelle verticale infinie (la sélection reste au centre et la liste défile
autour, avec rebouclage), lueurs d'ambiance qui dérivent. Aucun flou, aucune ombre animée.
La répétition des flèches est limitée pour éviter les saccades quand on maintient la touche.

## HDMI 1 / HDMI 2
Les tuiles HDMI utilisent l'API `tizen.tvwindow` (privilège `tv.window`) : la TV affiche la source derrière
l'appli, Retour revient à l'accueil. Les stats utilisent `tizen.systeminfo` (privilège `system`).
Si l'installation est refusée pour une histoire de privilège, retire la ligne `tv.window` ou `system`
de `config.xml` (les tuiles HDMI ou les stats CPU/RAM ne marcheront alors plus).

## Optimisations
Appuis regroupés par image, défilement accéléré quand on maintient la touche, calques `contain`,
animations gelées après 45 s d'inactivité ou page cachée, stats et météo suspendues en veille.
