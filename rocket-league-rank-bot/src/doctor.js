// Diagnostic en lecture seule : se connecte, liste les serveurs du bot et vérifie la configuration
// enregistrée (salons, permissions, hiérarchie des rôles). N'envoie aucun message, n'affiche aucun secret.
import { existsSync } from 'node:fs';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { PROJECT_ROOT } from './env.js';
import { loadConfig } from './config.js';
import { buildInviteUrl } from './discord/invite.js';
import { missingPermissions, resolveBotMember, resolveGuildChannel } from './discord/guildContext.js';
import { RANK_IDS, rankLabel } from './domain/ranks.js';
import { openDatabase } from './storage/db.js';
import { Repository } from './storage/repository.js';

const config = loadConfig(process.env, { root: PROJECT_ROOT });
const say = (m = '') => console.log(m);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  let problems = 0;
  const flag = (msg) => (problems++, say(`  ⚠️  ${msg}`));
  try {
    say(`Connecté en tant que ${c.user.tag}`);
    say(`Base de données : ${config.DATABASE_PATH} (${existsSync(config.DATABASE_PATH) ? 'existe' : 'sera créée au premier lancement'})`);
    say(`Serveurs du bot : ${c.guilds.cache.size}`);
    if (c.guilds.cache.size === 0) {
      flag('Le bot n’est membre d’aucun serveur. Il a sans doute été invité sans le scope « bot ».');
      say(`     Lien correct : ${buildInviteUrl(config.DISCORD_CLIENT_ID)}`);
    }
    if (config.DISCORD_GUILD_ID && !c.guilds.cache.has(config.DISCORD_GUILD_ID)) {
      flag(`DISCORD_GUILD_ID (${config.DISCORD_GUILD_ID}) ne fait pas partie des serveurs du bot.`);
    }
    const repo = existsSync(config.DATABASE_PATH) ? new Repository(openDatabase(config.DATABASE_PATH)) : null;

    for (const guild of c.guilds.cache.values()) {
      say(`\n— ${guild.name} (${guild.id})`);
      const me = await resolveBotMember(guild);
      say(`  Rôle le plus haut du bot : ${me.roles.highest.name} (position ${me.roles.highest.position})`);
      const settings = repo?.getGuildSettings(guild.id);
      for (const [label, id, kind] of [['Salon d’annonces', settings?.announce_channel_id, 'announce'], ['Salon de validation', settings?.review_channel_id, 'review']]) {
        if (!id) { flag(`${label} : non configuré (/config ${kind === 'announce' ? 'canal-annonces' : 'canal-validation'}).`); continue; }
        const channel = await resolveGuildChannel(guild, id);
        if (!channel) { flag(`${label} : salon ${id} introuvable.`); continue; }
        const missing = missingPermissions(channel, me, kind);
        if (missing.length) flag(`${label} #${channel.name} : permissions manquantes : ${missing.join(', ')}`);
        else say(`  ✅ ${label} #${channel.name} : accessible`);
      }
      if (settings?.roles_enabled) {
        for (const rank of RANK_IDS) {
          const roleId = repo.getRankSettings(guild.id, rank).role_id;
          if (!roleId) continue;
          const role = guild.roles.cache.get(roleId);
          if (!role) flag(`Rôle de ${rankLabel(rank)} introuvable.`);
          else if (role.managed || role.position >= me.roles.highest.position) flag(`Rôle « ${role.name} » (${rankLabel(rank)}) au-dessus du rôle du bot : non attribuable.`);
        }
      }
    }
    say(problems ? `\n${problems} point(s) à corriger.` : '\nAucun problème détecté.');
  } catch (err) {
    console.error('Diagnostic interrompu :', err.message);
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
});

try {
  await client.login(config.DISCORD_TOKEN);
} catch (err) {
  console.error(`Connexion impossible : ${err.message}`);
  process.exit(1);
}
