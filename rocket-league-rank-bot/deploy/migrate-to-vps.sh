#!/usr/bin/env bash
# Déplace le bot de ce Mac vers un VPS Debian/Ubuntu, sans jamais faire tourner deux instances.
#
#   deploy/migrate-to-vps.sh utilisateur@adresse [chemin/de/la/clé-ssh]
#
# Étapes : copie du code -> installation de Node 22 et des dépendances -> arrêt du bot local
# -> sauvegarde vérifiée de la base -> copie du .env (chmod 600) et de la base -> démarrage systemd.
# Le .env n'est ni affiché ni versionné ; il ne transite que par SSH.
set -euo pipefail

TARGET=${1:?Usage : deploy/migrate-to-vps.sh utilisateur@adresse [clé-ssh]}
KEY=${2:-}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LABEL=com.maxs026.rocket-league-rank-bot
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
ssh_() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

[[ -f "$ROOT/.env" ]] || { echo "Fichier .env introuvable dans $ROOT" >&2; exit 1; }

echo "1/6 Connexion au VPS"
ssh_ 'uname -m; . /etc/os-release && echo "$PRETTY_NAME"'

echo "2/6 Copie du code (sans .env, base, node_modules)"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude node_modules --exclude data --exclude .env --exclude .git \
  "$ROOT/" "$TARGET:rocket-league-rank-bot/"

echo "3/6 Installation de Node 22 et des dépendances"
ssh_ 'set -e
  if ! command -v node >/dev/null || [ "$(node -p "process.versions.node.split(\".\")[0]")" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  cd ~/rocket-league-rank-bot && npm ci --omit=dev --no-audit --no-fund
  sudo install -d -o "$USER" -m 700 /var/lib/rocket-league-rank-bot
  sed -e "s#__USER__#$USER#" -e "s#__HOME__#$HOME#" deploy/rocket-league-rank-bot.service \
    | sudo tee /etc/systemd/system/rocket-league-rank-bot.service >/dev/null
  sudo systemctl daemon-reload'

echo "4/6 Arrêt du bot sur ce Mac (une seule instance)"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if pgrep -f "node src/index.js" >/dev/null; then
  echo "Un bot tourne encore sur ce Mac : arrêtez-le avant de continuer." >&2; exit 1
fi
# En cas d'échec à partir d'ici, le VPS n'a pas démarré : on relance le bot du Mac.
restore_local() {
  echo "Échec : le bot est relancé sur ce Mac." >&2
  ssh_ 'sudo systemctl disable --now rocket-league-rank-bot' 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$LABEL.plist" || true
}
trap restore_local ERR

echo "5/6 Sauvegarde vérifiée et copie de la base et du .env"
BACKUP="$HOME/maxs026-backups/bot-avant-vps-$(date +%Y%m%d-%H%M%S).sqlite"
mkdir -p "$HOME/maxs026-backups"
(cd "$ROOT" && node -e '
  const D = require("better-sqlite3");
  const src = new D(process.argv[1], { readonly: true });
  src.backup(process.argv[2]).then(() => {
    const ok = new D(process.argv[2], { readonly: true }).pragma("integrity_check", { simple: true });
    if (ok !== "ok") { console.error("Sauvegarde corrompue"); process.exit(1); }
    console.log("Sauvegarde OK :", process.argv[2]);
  });' "$ROOT/data/bot.sqlite" "$BACKUP")
chmod 600 "$BACKUP"
scp "${SSH_OPTS[@]}" -q "$BACKUP" "$TARGET:/var/lib/rocket-league-rank-bot/bot.sqlite"
scp "${SSH_OPTS[@]}" -q -p "$ROOT/.env" "$TARGET:rocket-league-rank-bot/.env"
ssh_ 'chmod 600 ~/rocket-league-rank-bot/.env /var/lib/rocket-league-rank-bot/bot.sqlite'

echo "6/6 Démarrage du service"
ssh_ 'sudo systemctl enable --now rocket-league-rank-bot && sleep 8 &&
  systemctl is-active rocket-league-rank-bot &&
  journalctl -u rocket-league-rank-bot -n 20 --no-pager -o cat | grep -m1 "Bot connecté" | cut -c1-300'
trap - ERR

cat <<EOF

Bot déployé sur $TARGET. Le LaunchAgent de ce Mac est arrêté (le fichier plist reste en place :
ne le rechargez pas tant que le VPS tourne). Journaux : ssh $TARGET journalctl -u rocket-league-rank-bot -f
EOF
