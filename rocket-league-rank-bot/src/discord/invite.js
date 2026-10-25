import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const BASE = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions, // réactions sous les annonces (mode potes)
];

/**
 * Lien d'invitation avec les DEUX scopes nécessaires. « Gérer les rôles » uniquement si demandé.
 * Avec `guildId`, le serveur est présélectionné (installation « serveur », pas « utilisateur »).
 */
export function buildInviteUrl(clientId, { roles = false, guildId = null } = {}) {
  const permissions = new PermissionsBitField([...BASE, ...(roles ? [PermissionFlagsBits.ManageRoles] : [])]);
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'bot applications.commands');
  url.searchParams.set('permissions', permissions.bitfield.toString());
  url.searchParams.set('integration_type', '0');
  if (guildId) {
    url.searchParams.set('guild_id', guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
}
