import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { isAdmin } from '../../domain/permissions.js';
import { isValidGifUrl } from '../../domain/messages.js';
import { RANKS, rankLabel } from '../../domain/ranks.js';
import { memberInfo, NO_MENTIONS } from '../member.js';
import { rankChoices } from './rang.js';

const TEXT_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const rankOption = (o) => o.setName('rang').setDescription('Rang concerné').setRequired(true).addChoices(...rankChoices);
const channelOption = (o) =>
  o.setName('canal').setDescription('Salon textuel').setRequired(true).addChannelTypes(...TEXT_CHANNELS);

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configuration du bot Rocket League (administrateurs)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('canal-annonces').setDescription('Salon où les rangs sont annoncés').addChannelOption(channelOption))
  .addSubcommand((s) => s.setName('canal-validation').setDescription('Salon où les modérateurs valident les demandes').addChannelOption(channelOption))
  .addSubcommand((s) =>
    s
      .setName('role-moderateur')
      .setDescription('Rôle autorisé à valider les demandes (en plus des administrateurs)')
      .addRoleOption((o) => o.setName('role').setDescription('Rôle modérateur (vide = retirer)')),
  )
  .addSubcommand((s) =>
    s
      .setName('rang-notification')
      .setDescription('Activer ou désactiver l’annonce d’un rang')
      .addStringOption(rankOption)
      .addBooleanOption((o) => o.setName('actif').setDescription('Annoncer ce rang ?').setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('rang-gif')
      .setDescription('GIF affiché dans l’annonce d’un rang')
      .addStringOption(rankOption)
      .addStringOption((o) => o.setName('url').setDescription('Lien https du GIF (vide = retirer)').setMaxLength(500)),
  )
  .addSubcommand((s) =>
    s
      .setName('rang-message')
      .setDescription('Message personnalisé pour un rang')
      .addStringOption(rankOption)
      .addStringOption((o) =>
        o
          .setName('message')
          .setDescription('Variables : {membre} {rang} {ancien_rang} {playlist} (vide = message par défaut)')
          .setMaxLength(500),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('rang-role')
      .setDescription('Rôle Discord associé à un rang')
      .addStringOption(rankOption)
      .addRoleOption((o) => o.setName('role').setDescription('Rôle à attribuer (vide = retirer)')),
  )
  .addSubcommand((s) =>
    s
      .setName('roles-actifs')
      .setDescription('Activer l’attribution automatique des rôles de rang')
      .addBooleanOption((o) => o.setName('actif').setDescription('Activer ?').setRequired(true)),
  )
  .addSubcommand((s) => s.setName('afficher').setDescription('Afficher la configuration actuelle'));

const NEEDED_CHANNEL_PERMS = [
  ['ViewChannel', PermissionFlagsBits.ViewChannel],
  ['SendMessages', PermissionFlagsBits.SendMessages],
  ['EmbedLinks', PermissionFlagsBits.EmbedLinks],
  ['AttachFiles', PermissionFlagsBits.AttachFiles],
  ['ReadMessageHistory', PermissionFlagsBits.ReadMessageHistory],
];

/** Permissions manquantes du bot dans un salon (liste de noms). */
export function missingChannelPermissions(channel, me) {
  const perms = channel.permissionsFor(me);
  return NEEDED_CHANNEL_PERMS.filter(([, bit]) => !perms?.has(bit)).map(([name]) => name);
}

export async function execute(interaction, ctx) {
  const say = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  if (!isAdmin(memberInfo(interaction))) return say('Commande réservée aux administrateurs.');

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();
  const rank = ['rang-notification', 'rang-gif', 'rang-message', 'rang-role'].includes(sub)
    ? interaction.options.getString('rang', true)
    : null;

  switch (sub) {
    case 'canal-annonces':
    case 'canal-validation': {
      const channel = interaction.options.getChannel('canal', true);
      const missing = missingChannelPermissions(channel, interaction.guild.members.me);
      if (missing.length) {
        return say(`Le bot n’a pas les permissions nécessaires dans <#${channel.id}> : ${missing.join(', ')}. Corrigez-les puis relancez la commande.`);
      }
      ctx.repo.setGuildSetting(guildId, sub === 'canal-annonces' ? 'announce_channel_id' : 'review_channel_id', channel.id);
      return say(`${sub === 'canal-annonces' ? 'Salon d’annonces' : 'Salon de validation'} : <#${channel.id}>.`);
    }
    case 'role-moderateur': {
      const role = interaction.options.getRole('role');
      ctx.repo.setGuildSetting(guildId, 'moderator_role_id', role?.id ?? null);
      return say(role ? `Rôle modérateur : <@&${role.id}>.` : 'Rôle modérateur retiré (administrateurs seuls).');
    }
    case 'rang-notification': {
      const actif = interaction.options.getBoolean('actif', true);
      ctx.repo.setRankSetting(guildId, rank, 'notify', actif ? 1 : 0);
      return say(`Annonces pour **${rankLabel(rank)}** : ${actif ? 'activées' : 'désactivées'}.`);
    }
    case 'rang-gif': {
      const url = interaction.options.getString('url');
      if (url && !isValidGifUrl(url)) return say('Le lien doit être une URL https valide.');
      ctx.repo.setRankSetting(guildId, rank, 'gif_url', url ?? null);
      return say(url ? `GIF défini pour **${rankLabel(rank)}**.` : `GIF retiré pour **${rankLabel(rank)}**.`);
    }
    case 'rang-message': {
      const message = interaction.options.getString('message');
      ctx.repo.setRankSetting(guildId, rank, 'message_template', message?.trim() || null);
      return say(message ? `Message défini pour **${rankLabel(rank)}**.` : `Message par défaut rétabli pour **${rankLabel(rank)}**.`);
    }
    case 'rang-role': {
      const role = interaction.options.getRole('role');
      if (role && (role.managed || role.id === guildId)) {
        return say('Ce rôle ne peut pas être attribué par le bot (rôle géré par une intégration ou @everyone).');
      }
      ctx.repo.setRankSetting(guildId, rank, 'role_id', role?.id ?? null);
      return say(role ? `Rôle de **${rankLabel(rank)}** : <@&${role.id}>.` : `Rôle retiré pour **${rankLabel(rank)}**.`);
    }
    case 'roles-actifs': {
      const actif = interaction.options.getBoolean('actif', true);
      ctx.repo.setGuildSetting(guildId, 'roles_enabled', actif ? 1 : 0);
      return say(`Attribution automatique des rôles : ${actif ? 'activée' : 'désactivée'}. Le rôle du bot doit être placé au-dessus des rôles de rang.`);
    }
    case 'afficher': {
      const s = ctx.repo.getGuildSettings(guildId);
      const lines = RANKS.map((r) => {
        const c = ctx.repo.getRankSettings(guildId, r.id);
        return `**${r.label}** — annonce : ${c.notify ? 'oui' : 'non'} · GIF : ${c.gif_url ? 'oui' : 'non'} · message : ${c.message_template ? 'perso' : 'défaut'} · rôle : ${c.role_id ? `<@&${c.role_id}>` : '—'}`;
      });
      const embed = new EmbedBuilder()
        .setTitle('Configuration')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Salon d’annonces', value: s.announce_channel_id ? `<#${s.announce_channel_id}>` : 'Non défini', inline: true },
          { name: 'Salon de validation', value: s.review_channel_id ? `<#${s.review_channel_id}>` : 'Non défini', inline: true },
          { name: 'Rôle modérateur', value: s.moderator_role_id ? `<@&${s.moderator_role_id}>` : 'Aucun', inline: true },
          { name: 'Rôles automatiques', value: s.roles_enabled ? 'Activés' : 'Désactivés', inline: true },
          { name: 'Rangs', value: lines.join('\n') },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    }
    default:
      return say('Sous-commande inconnue.');
  }
}
