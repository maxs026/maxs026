import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const BASE = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
];

/** Lien d'invitation avec les DEUX scopes nécessaires. « Gérer les rôles » uniquement si demandé. */
export function buildInviteUrl(clientId, { roles = false } = {}) {
  const permissions = new PermissionsBitField([...BASE, ...(roles ? [PermissionFlagsBits.ManageRoles] : [])]);
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'bot applications.commands');
  url.searchParams.set('permissions', permissions.bitfield.toString());
  return url.toString();
}
