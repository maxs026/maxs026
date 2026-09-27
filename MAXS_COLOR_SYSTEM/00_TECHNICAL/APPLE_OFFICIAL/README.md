# APPLE_OFFICIAL

Déposer ici, dans `source/`, **la LUT officielle Apple Log → Rec.709** téléchargée sur
https://developer.apple.com/download/all/?q=Apple%20log (compte Apple ID).

État actuel : **vide** — aucune LUT Apple fournie. La couche technique utilisée est
`../ACES2_NON-APPLE/` (NON-APPLE).

Après `python scripts/generate_luts.py` :
* `source/<fichier Apple>.cube` — original, jamais modifié ;
* `AppleLog_to_Rec709_APPLE_OFFICIAL.cube` — copie octet par octet ;
* `AppleLog_to_Rec709_APPLE_OFFICIAL.provenance.txt` — SHA-256 et caractéristiques.
