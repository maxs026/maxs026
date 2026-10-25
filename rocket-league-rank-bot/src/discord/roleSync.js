import { PermissionFlagsBits } from 'discord.js';
import { computeRoleChanges } from '../domain/roles.js';
import { RANK_IDS } from '../domain/ranks.js';

/**
 * Aligne les rôles Discord du membre sur son meilleur rang validé.
 * Ne lève jamais : renvoie une liste d'avertissements lisibles.
 * @returns {Promise<string[]>}
 */
export async function syncMemberRoles(guild, userId, { repo, rankService, logger }) {
  const settings = repo.getGuildSettings(guild.id);
  if (!settings.roles_enabled) return [];

  const roleByRank = Object.fromEntries(RANK_IDS.map((r) => [r, repo.getRankSettings(guild.id, r).role_id]));
  if (!Object.values(roleByRank).some(Boolean)) return [];

  try {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return ['Le bot n’a pas la permission « Gérer les rôles » : rôles non mis à jour.'];
    }
    const member = await guild.members.fetch(userId);
    const highest = rankService.getHighestRank(guild.id, userId);
    const { add, remove } = computeRoleChanges(roleByRank, highest, [...member.roles.cache.keys()]);

    const warnings = [];
    for (const [action, ids] of [['add', add], ['remove', remove]]) {
      for (const roleId of ids) {
        const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
        if (!role) {
          warnings.push(`Rôle <@&${roleId}> introuvable.`);
        } else if (role.managed || role.position >= me.roles.highest.position) {
          warnings.push(`Le rôle du bot doit être placé au-dessus de <@&${roleId}> dans la hiérarchie.`);
        } else {
          await (action === 'add' ? member.roles.add(role) : member.roles.remove(role));
        }
      }
    }
    return warnings;
  } catch (err) {
    logger.error({ err, userId, guildId: guild.id }, 'Synchronisation des rôles impossible');
    return ['Synchronisation des rôles impossible (membre absent du serveur ou erreur Discord).'];
  }
}
