import { DiscordAPIError, PermissionFlagsBits } from 'discord.js';
import { UserFacingError } from './userError.js';

export const NOT_IN_GUILD_MESSAGE =
  'Le bot n’est pas membre de ce serveur : il a probablement été invité avec le seul scope « applications.commands ». ' +
  'Réinvitez-le avec les scopes « bot » et « applications.commands » (lien : `npm run invite-url`).';

const isAccessError = (err) => err instanceof DiscordAPIError && [403, 404].includes(err.status);

/**
 * `interaction.guild` vaut null quand la guilde n'est pas dans le cache du bot
 * (bot absent du serveur, ou événement GUILD_CREATE pas encore reçu) : on tente de la récupérer.
 */
export async function resolveGuild(interaction) {
  if (interaction.guild) return interaction.guild;
  try {
    return await interaction.client.guilds.fetch(interaction.guildId);
  } catch (err) {
    if (isAccessError(err)) throw new UserFacingError(NOT_IN_GUILD_MESSAGE);
    throw err;
  }
}

/** `guild.members.me` peut être null si le membre du bot n'est pas en cache. */
export async function resolveBotMember(guild) {
  if (guild.members.me) return guild.members.me;
  try {
    return await guild.members.fetchMe();
  } catch (err) {
    if (isAccessError(err)) throw new UserFacingError(NOT_IN_GUILD_MESSAGE);
    throw err;
  }
}

/**
 * Salon de CE serveur, ou null s'il n'existe pas / appartient à un autre serveur.
 * On liste les salons de la guilde (accessible même pour un salon privé que le bot ne peut pas voir),
 * afin de pouvoir ensuite calculer précisément les permissions manquantes.
 */
export async function resolveGuildChannel(guild, channelId) {
  const channels = await guild.channels.fetch();
  return channels.get(channelId) ?? null;
}

const REQUIRED = {
  view: ['ViewChannel', 'Voir le salon', PermissionFlagsBits.ViewChannel],
  send: ['SendMessages', 'Envoyer des messages', PermissionFlagsBits.SendMessages],
  embed: ['EmbedLinks', 'Intégrer des liens', PermissionFlagsBits.EmbedLinks],
  history: ['ReadMessageHistory', 'Lire l’historique des messages', PermissionFlagsBits.ReadMessageHistory],
  attach: ['AttachFiles', 'Joindre des fichiers', PermissionFlagsBits.AttachFiles],
};

/** Annonces : pas de fichier joint. Validation : le bot ré-héberge les captures. */
export const CHANNEL_REQUIREMENTS = {
  announce: [REQUIRED.view, REQUIRED.send, REQUIRED.embed, REQUIRED.history],
  review: [REQUIRED.view, REQUIRED.send, REQUIRED.embed, REQUIRED.history, REQUIRED.attach],
};

/** Libellés (français) des permissions manquantes au bot dans ce salon. */
export function missingPermissions(channel, me, kind) {
  const perms = channel.permissionsFor(me);
  return CHANNEL_REQUIREMENTS[kind].filter(([, , bit]) => !perms?.has(bit)).map(([, label]) => label);
}
