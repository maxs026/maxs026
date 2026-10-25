import { PermissionFlagsBits } from 'discord.js';

/** Réduit une interaction à des données simples pour domain/permissions.js. */
export function memberInfo(interaction) {
  const perms = interaction.memberPermissions;
  const roles = interaction.member?.roles;
  const roleIds = Array.isArray(roles) ? roles : roles?.cache ? [...roles.cache.keys()] : [];
  return {
    userId: interaction.user.id,
    isAdministrator: Boolean(perms?.has(PermissionFlagsBits.Administrator)),
    canManageGuild: Boolean(perms?.has(PermissionFlagsBits.ManageGuild)),
    roleIds,
  };
}

/** Réponses sans aucune mention possible. */
export const NO_MENTIONS = { parse: [] };
