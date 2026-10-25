# Rocket League Rank-Up Bot

Bot Discord (Node.js, discord.js v14, SQLite) qui annonce dans un salon quand un membre atteint un rang Rocket League (Silver et Gold par défaut, tous les rangs configurables).

> **Source des rangs : déclaration + validation par un modérateur.**
> Aucune source automatique fiable et légitime n'a été trouvée (voir [Source de données](#source-de-données)). Le bot ne lit donc pas les rangs tout seul : un membre déclare son rang, un modérateur le valide, et c'est cette validation qui déclenche l'annonce.

## Fonctionnement

1. Le membre lance `/rang declarer playlist rang [capture]`.
2. La demande arrive dans le **salon de validation** avec les boutons **Valider** / **Refuser**.
3. À la validation, le bot compare avec le dernier rang validé **du même membre pour la même playlist** :
   - `première déclaration` : aucun rang validé avant ;
   - `promotion` : nouveau rang plus élevé ;
   - `rétrogradation` : nouveau rang plus bas (enregistrée, **jamais annoncée**) ;
   - `aucun changement` : rien n'est fait.
4. Si c'est une première déclaration ou une promotion **vers un rang dont les annonces sont activées**, un embed est posté dans le salon d'annonces (mention du membre, rang, playlist, GIF du rang, message personnalisable).
5. Si activé, les rôles Discord du membre sont alignés sur son **meilleur rang validé, toutes playlists confondues**.

## Commandes

| Commande | Qui | Rôle |
|---|---|---|
| `/lier plateforme pseudo` | tous | Associe un compte Rocket League au membre (indicatif, non vérifié) |
| `/rang declarer playlist rang [capture]` | tous | Demande de validation d'un rang |
| `/rang voir [membre]` | tous | Rangs validés d'un membre, par playlist |
| `/rang-definir membre playlist rang` | modérateurs | Enregistre un rang sans passer par une demande (même détection et même annonce) |
| `/config canal-annonces` · `canal-validation` | admins | Salons (le bot vérifie ses permissions dans le salon) |
| `/config role-moderateur` | admins | Rôle autorisé à valider, en plus des admins |
| `/config rang-notification rang actif` | admins | Active/désactive l'annonce d'un rang |
| `/config rang-gif rang [url]` | admins | GIF (https) de l'annonce d'un rang ; sans `url` = retirer |
| `/config rang-message rang [message]` | admins | Message personnalisé. Variables : `{membre}` `{rang}` `{ancien_rang}` `{playlist}` ; sans `message` = défaut |
| `/config rang-role rang [role]` | admins | Rôle Discord associé au rang |
| `/config roles-actifs actif` | admins | Active l'attribution automatique des rôles |
| `/config afficher` | admins | Affiche la configuration |

Aucun GIF n'est fourni par défaut : l'annonce est envoyée sans image tant qu'aucun lien n'est configuré.

### Permissions des modérateurs et administrateurs

- **Valider/refuser** : administrateur, titulaire de « Gérer le serveur », ou rôle défini par `/config role-moderateur`. Vérifié **à chaque clic** (les boutons sont visibles de tous ceux qui voient le salon).
- Un modérateur **ne peut pas valider sa propre demande** (ni se définir un rang avec `/rang-definir`) ; un administrateur le peut.
- **`/config`** : administrateurs / « Gérer le serveur » uniquement. Le rôle modérateur n'y donne pas accès.
- `/config` et `/rang-definir` sont masquées par défaut aux membres sans « Gérer le serveur » (`default_member_permissions`), **et** revérifiées à l'exécution, car un serveur peut modifier ces droits dans *Paramètres > Intégrations*. Pour que votre rôle modérateur voie `/rang-definir`, autorisez-le à cet endroit.

## Source de données

| Source | Constat | Décision |
|---|---|---|
| API officielle Psyonix/Epic | Bêta fermée : accès uniquement sur demande à Psyonix (`RLPublicAPI@psyonix.com`, d'après la bibliothèque `rlapi`), sans garantie de réponse | Non utilisable sans identifiants Psyonix |
| Tracker Network | Pas d'API publique Rocket League ; son API interne répond `403` à un appel non authentifié (vérifié le 25/10/2026) | Écartée |
| Scraping de sites de stats | Fragile, probablement contraire aux conditions d'usage | Écartée |
| API tierces payantes | Fiabilité et conditions non vérifiées | Hors périmètre (aucun connecteur) |

Ces conclusions viennent de recherches web et d'un appel HTTP non authentifié ; aucune API de rang n'a pu être testée faute d'accès. **Ce qui manque pour la détection automatique** : des identifiants API Psyonix (ou une autre source officielle), puis un connecteur qui appelle `recordTrusted`.

**Pour brancher une source automatique plus tard** : elle n'a qu'à appeler `RankService.recordTrusted({ guildId, userId, playlist, rank, reviewerId, origin })`. La détection de changement, l'anti-doublon, l'annonce et les rôles sont ensuite identiques et ne sont pas modifiés. Les annonces sont gérées par `src/notifications/`, qui ignore d'où vient le rang.

## Limites de vérification des captures d'écran

**Le bot ne vérifie pas les captures.** Il ne fait ni OCR ni analyse d'image. La capture sert uniquement d'aide à la décision du modérateur.

- Une capture peut être retouchée, ancienne, ou appartenir à un autre joueur.
- Le bot ne peut pas relier le pseudo en jeu au compte Discord : `/lier` est une simple déclaration.
- Les liens de pièces jointes Discord expirent ; le bot **ré-héberge** la capture dans le salon de validation, mais si ce message est supprimé, la preuve disparaît. Rien n'est conservé en base hormis l'URL d'origine.
- Seule la validation humaine protège contre la fraude. Bonnes pratiques : exiger une capture de l'écran de classement complet avec le pseudo visible, et refuser en cas de doute.

## Garanties anti-doublon

- Le passage `en attente → validée` est une écriture SQL conditionnelle : un double clic ou deux modérateurs simultanés ne produisent qu'**une** validation.
- L'envoi de l'annonce est réservé atomiquement (`pending → sending → sent`) : une seule annonce par demande.
- Au redémarrage, les annonces restées « en attente » sont envoyées ; celles interrompues en plein envoi sont d'abord **recherchées dans le salon** (marqueur `Demande #N` dans le pied de l'embed, 50 derniers messages) avant tout renvoi.
- **Limite résiduelle** : si le bot plantait entre l'envoi Discord et l'écriture en base, ET que plus de 50 messages étaient postés dans le salon avant le redémarrage, un doublon est théoriquement possible. Si la recherche elle-même échoue, le bot préfère ne pas renvoyer (annonce manquante plutôt que doublon).
- Les annonces en échec sont retentées toutes les minutes, 5 fois maximum, puis abandonnées (journalisées).

## Autres limites

- Les rôles et l'annonce sont des effets de bord **après** l'enregistrement du rang. Si le bot s'arrête entre les deux, les rôles ne sont pas rejoués au redémarrage (l'annonce, si). Réexécuter `/rang-definir` avec le même rang resynchronise les rôles du membre.
- Les rangs sont par grand rang uniquement (pas de division I/II/III). Les listes de rangs et de playlists sont dans `src/domain/ranks.js`.
- Le bot est limité aux serveurs (pas de MP).

## Configuration Discord (à faire par vous)

1. [Portail développeur](https://discord.com/developers/applications) > **New Application**. Notez l'**Application ID** (`DISCORD_CLIENT_ID`).
2. Onglet **Bot** > **Reset Token**, copiez le jeton (`DISCORD_TOKEN`). Ne le partagez jamais.
3. **Aucun intent privilégié** n'est nécessaire (le bot n'utilise que `Guilds`) : laissez Presence, Server Members et Message Content désactivés.
4. Onglet **Installation** (ou OAuth2 > URL Generator), scopes **`bot`** et **`applications.commands`**. Permissions du bot :
   - Voir les salons, Envoyer des messages, Intégrer des liens, Joindre des fichiers, Lire l'historique des messages ;
   - **Gérer les rôles** seulement si vous activez les rôles automatiques.
5. Invitez le bot avec le lien généré par `npm run invite-url` (ajoutez `-- --roles` pour « Gérer les rôles »). **Les deux scopes `bot` ET `applications.commands` sont indispensables** : avec le seul scope `applications.commands`, les commandes apparaissent et répondent, mais le bot n'est *pas membre* du serveur (voir Dépannage).
6. **Rôles automatiques (optionnel)** : *Paramètres du serveur > Rôles*, glissez le rôle du bot **au-dessus** de tous les rôles de rang. Un bot ne peut pas attribuer un rôle placé au-dessus du sien ni un rôle « géré » par une intégration.
7. Enregistrez les commandes : `npm run deploy-commands` (voir ci-dessous). Avec `DISCORD_GUILD_ID` elles sont disponibles immédiatement ; en global, Discord peut mettre un peu de temps à les propager.
8. Dans Discord, en tant qu'administrateur :
   ```
   /config canal-validation canal:#validation-rangs
   /config canal-annonces   canal:#annonces-rangs
   /config role-moderateur  role:@Modérateurs        (optionnel)
   /config rang-gif rang:Gold url:https://…/gold.gif (optionnel)
   ```
   Les salons de validation doivent être **privés** (réservés aux modérateurs).

## Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| Log de démarrage `guilds: 0` + avertissement ; `/config canal-*` répond « le bot n'est pas membre de ce serveur » | Bot invité sans le scope `bot` : il reçoit les commandes mais n'est dans aucun serveur | Réinvitez-le avec `npm run invite-url` (retirer d'abord l'ancienne intégration n'est pas nécessaire) |
| « Une erreur inattendue est survenue (réf. xxxxxx) » | Erreur non prévue | Cherchez `xxxxxx` dans le terminal : la ligne JSON contient la stack trace (`err.stack`) |
| `/config canal-…` liste des permissions manquantes | Le bot n'a pas accès au salon | Salon privé : ajoutez le bot (ou son rôle) dans *Modifier le salon > Permissions* avec Voir le salon, Envoyer des messages, Intégrer des liens, Lire l'historique (+ Joindre des fichiers pour le salon de validation) |
| `/config canal-annonces` : « Envoyer des messages » manquant alors que le rôle du bot l'a | Le salon refuse « Envoyer des messages » à `@everyone` (salon d'annonces en lecture seule) : ce refus s'applique aussi au bot | *Modifier le salon > Permissions > Permissions avancées* : ajoutez le rôle du bot et autorisez Envoyer des messages et Intégrer des liens |
| Le bot a été « ajouté » au salon privé mais `/config canal-validation` refuse toujours « Voir le salon » | L'ajout n'a pas été enregistré | Vérifiez que le rôle du bot apparaît bien sous *Qui a accès à ce salon ?* |
| Configuration « perdue » après un redémarrage | Mauvaise base lue | Le chemin `DATABASE_PATH` relatif est résolu depuis la racine du projet ; le chemin absolu utilisé est affiché au démarrage (`database`) |

`npm run doctor` se connecte en lecture seule et vérifie : serveurs du bot, salons configurés et leurs permissions, hiérarchie des rôles de rang. `/config afficher` montre aussi l'état (✅/⚠️) de chaque salon configuré.

## Lancement local

Prérequis : Node.js ≥ 20 (testé avec Node 22).

```bash
cd rocket-league-rank-bot
npm install
cp .env.example .env        # puis remplissez DISCORD_TOKEN et DISCORD_CLIENT_ID
npm run invite-url          # lien d'invitation correct (bot + applications.commands)
npm run deploy-commands     # enregistre les commandes slash
npm run doctor              # (optionnel) vérifie connexion, salons, permissions
npm start
```

## Tests

```bash
npm test          # Vitest
npm run check     # vérification de syntaxe de tous les fichiers
```

Les tests couvrent la logique métier, la base SQLite (en mémoire et sur fichier, avec redémarrage simulé), les embeds, et — avec de **vrais objets discord.js construits hors ligne** (interactions, cache de guilde, salons privés avec overwrites, hiérarchie des rôles) — les commandes `/config`, `/rang`, `/lier`, `/rang-definir` et les boutons (double clic, permissions). **Ils ne se connectent pas à Discord** : la connexion réelle, l'enregistrement des commandes et les permissions effectives d'un vrai serveur doivent être vérifiés à la main (checklist ci-dessous).

### Checklist de test manuel (après le premier lancement)

1. Le log affiche « Bot connecté à Discord ».
2. `/config afficher` fonctionne ; `/config canal-annonces` sur un salon sans permissions est refusé avec la liste des manques.
3. Un membre fait `/rang declarer` Silver 3v3 avec capture → la demande apparaît avec ses boutons.
4. Cliquer deux fois vite sur **Valider** → une seule annonce.
5. Un membre sans droits qui clique sur **Valider** reçoit un refus.
6. Déclarer puis valider Gold sur la même playlist → annonce « promotion » ; Silver en 2v2 → « première déclaration ».
7. Redémarrer le bot : aucune annonce n'est renvoyée.
8. Avec les rôles activés : le rôle du meilleur rang est attribué, l'ancien retiré.

## Déploiement permanent

Il faut un processus qui tourne en continu et un **stockage persistant** pour le fichier SQLite (sinon les rangs sont perdus à chaque déploiement). Le bot ne reçoit aucune requête entrante : pas de port à ouvrir.

### Docker (VPS, Fly.io, Railway…)

```bash
cp .env.example .env     # à remplir sur le serveur
docker compose up -d --build
docker compose logs -f
```

Le volume `bot-data` contient la base (`/data/bot.sqlite`). Enregistrez les commandes une fois depuis n'importe quelle machine disposant du `.env` (`npm run deploy-commands`), et à chaque modification des commandes.

Sur une plateforme (Fly.io, Railway…) : définissez `DISCORD_TOKEN` et `DISCORD_CLIENT_ID` comme variables secrètes de la plateforme (pas dans l'image), montez un volume sur `/data`, et ne lancez qu'**une seule instance** (SQLite n'est pas fait pour plusieurs instances).

### Sur un Mac (tant qu'il est allumé)

Un LaunchAgent relance le bot à l'ouverture de session et après un plantage. Créez `~/Library/LaunchAgents/com.rocket-league-rank-bot.plist` avec `ProgramArguments` = `[chemin de node, src/index.js]`, `WorkingDirectory` = le dossier du bot, `RunAtLoad` et `KeepAlive` à `true`, puis `launchctl load ~/Library/LaunchAgents/com.rocket-league-rank-bot.plist`. Arrêtez d'abord tout `npm start` manuel : **une seule instance** doit tourner. Le bot s'arrête quand le Mac est éteint ou en veille.

### VPS gratuit (Debian/Ubuntu) avec `deploy/migrate-to-vps.sh`

VPS « toujours gratuits » adaptés (inscription avec carte bancaire de vérification, non débitée si l'on reste dans les limites ; vérifiez les conditions du jour) :

- **Oracle Cloud Always Free** : instance `VM.Standard.E2.1.Micro` (1 Go, x86) ou Ampere A1 (ARM, souvent en rupture de capacité). Choisissez bien la région d'origine : l'offre gratuite y est liée.
- **Google Cloud** : une `e2-micro` dans `us-west1`, `us-central1` ou `us-east1`, disque standard ≤ 30 Go. Une seule VM gratuite par compte de facturation.

Créez une VM Ubuntu 24.04 avec une clé SSH (aucun port entrant n'est nécessaire hormis SSH), puis depuis ce dossier :

```bash
deploy/migrate-to-vps.sh ubuntu@IP_DU_VPS ~/.ssh/ma_cle
```

Le script copie le code, installe Node 22 et les dépendances, **arrête le bot du Mac**, sauvegarde et vérifie la base, copie `.env` (chmod 600) et la base dans `/var/lib/rocket-league-rank-bot`, puis démarre le service systemd `rocket-league-rank-bot` (redémarrage automatique). En cas d'échec après l'arrêt local, il relance le bot du Mac. Journaux : `journalctl -u rocket-league-rank-bot -f`.

### Sans Docker

`npm ci --omit=dev` puis un gestionnaire de processus (systemd, pm2) avec redémarrage automatique. Sauvegardez régulièrement `DATABASE_PATH`.

> Le Dockerfile et le docker-compose n'ont **pas été testés** par l'auteur (pas de démon Docker disponible dans l'environnement de développement).

## Structure

```
src/
  index.js, deploy-commands.js, config.js, logger.js
  domain/          rangs, playlists, messages, permissions, rôles (logique pure)
  services/        RankService : détection de changement, validation idempotente
  storage/         SQLite (schéma + repository)
  notifications/   embeds d'annonce + Notifier (indépendant de la source des rangs)
  discord/         commandes slash, boutons, routage, synchronisation des rôles
test/              Vitest
```
