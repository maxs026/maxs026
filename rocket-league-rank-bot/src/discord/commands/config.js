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
import { missingPermissions, resolveBotMember, resolveGuild, resolveGuildChannel } from '../guildContext.js';
import { UserFacingError } from '../userError.js';
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
  .addSubcommand((s) =>
    s
      .setName('mode-potes')
      .setDescription('Entre potes : rangs enregistrés sans validation, tous annoncés, chutes chambrées')
      .addBooleanOption((o) => o.setName('actif').setDescription('Activer ?').setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('gif-chute')
      .setDescription('GIF affiché quand un membre perd un rang (mode potes)')
      .addStringOption((o) => o.setName('url').setDescription('Lien https du GIF (vide = GIF par défaut)').setMaxLength(500)),
  )
  .addSubcommand((s) => s.setName('afficher').setDescription('Afficher la configuration actuelle'));

/** État lisible d'un salon configuré, pour /config afficher. Ne lève jamais. */
async function channelStatus(guild, me, channelId, kind) {
  if (!channelId) return 'Non défini';
  try {
    const channel = await resolveGuildChannel(guild, channelId);
    if (!channel) return `<#${channelId}> — ⚠️ salon supprimé ou introuvable`;
    const missing = missingPermissions(channel, me, kind);
    return missing.length ? `<#${channelId}> — ⚠️ permissions manquantes : ${missing.join(', ')}` : `<#${channelId}> — ✅ accessible`;
  } catch {
    return `<#${channelId}> — diagnostic indisponible`;
  }
}

export async function execute(interaction, ctx) {
  if (!isAdmin(memberInfo(interaction))) {
    return interaction.reply({ content: 'Commande réservée aux administrateurs.', flags: MessageFlags.Ephemeral });
  }
  // Les vérifications qui suivent peuvent appeler l'API Discord : on répond tout de suite pour
  // ne jamais dépasser le délai de 3 secondes, puis on édite la réponse.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const say = (content) => interaction.editReply({ content, allowedMentions: NO_MENTIONS });

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();
  const rank = ['rang-notification', 'rang-gif', 'rang-message', 'rang-role'].includes(sub)
    ? interaction.options.getString('rang', true)
    : null;

  switch (sub) {
    case 'canal-annonces':
    case 'canal-validation': {
      const kind = sub === 'canal-annonces' ? 'announce' : 'review';
      const picked = interaction.options.getChannel('canal', true);
      const guild = await resolveGuild(interaction);
      const me = await resolveBotMember(guild);
      const channel = await resolveGuildChannel(guild, picked.id);
      if (!channel) throw new UserFacingError(`Le salon <#${picked.id}> n’existe pas ou n’appartient pas à ce serveur.`);
      if (!channel.isTextBased()) throw new UserFacingError(`<#${channel.id}> n’est pas un salon textuel.`);
      const missing = missingPermissions(channel, me, kind);
      if (missing.length) {
        return say(
          `❌ Le bot n’a pas les permissions nécessaires dans <#${channel.id}> : ${missing.join(', ')}.\n` +
            'Pour un salon privé, ajoutez le bot (ou son rôle) dans les permissions du salon, puis relancez la commande.',
        );
      }
      ctx.repo.setGuildSetting(guildId, kind === 'announce' ? 'announce_channel_id' : 'review_channel_id', channel.id);
      return say(`✅ ${kind === 'announce' ? 'Salon d’annonces' : 'Salon de validation'} enregistré : <#${channel.id}>.`);
    }
    case 'role-moderateur': {
      const role = interaction.options.getRole('role');
      ctx.repo.setGuildSetting(guildId, 'moderator_role_id', role?.id ?? null);
      return say(role ? `✅ Rôle modérateur : <@&${role.id}>.` : '✅ Rôle modérateur retiré (administrateurs seuls).');
    }
    case 'rang-notification': {
      const actif = interaction.options.getBoolean('actif', true);
      ctx.repo.setRankSetting(guildId, rank, 'notify', actif ? 1 : 0);
      return say(`✅ Annonces pour **${rankLabel(rank)}** : ${actif ? 'activées' : 'désactivées'}.`);
    }
    case 'rang-gif': {
      const url = interaction.options.getString('url');
      if (url && !isValidGifUrl(url)) return say('❌ Le lien doit être une URL https valide (ex. https://media.example.com/gold.gif).');
      ctx.repo.setRankSetting(guildId, rank, 'gif_url', url ?? null);
      return say(url ? `✅ GIF défini pour **${rankLabel(rank)}**.` : `✅ GIF retiré pour **${rankLabel(rank)}**.`);
    }
    case 'rang-message': {
      const message = interaction.options.getString('message');
      ctx.repo.setRankSetting(guildId, rank, 'message_template', message?.trim() || null);
      return say(message ? `✅ Message défini pour **${rankLabel(rank)}**.` : `✅ Message par défaut rétabli pour **${rankLabel(rank)}**.`);
    }
    case 'rang-role': {
      const role = interaction.options.getRole('role');
      if (role && (role.managed || role.id === guildId)) {
        return say('❌ Ce rôle ne peut pas être attribué par le bot (rôle géré par une intégration ou @everyone).');
      }
      ctx.repo.setRankSetting(guildId, rank, 'role_id', role?.id ?? null);
      return say(role ? `✅ Rôle de **${rankLabel(rank)}** : <@&${role.id}>.` : `✅ Rôle retiré pour **${rankLabel(rank)}**.`);
    }
    case 'roles-actifs': {
      const actif = interaction.options.getBoolean('actif', true);
      ctx.repo.setGuildSetting(guildId, 'roles_enabled', actif ? 1 : 0);
      return say(`✅ Attribution automatique des rôles : ${actif ? 'activée' : 'désactivée'}. Le rôle du bot doit être placé au-dessus des rôles de rang.`);
    }
    case 'mode-potes': {
      const actif = interaction.options.getBoolean('actif', true);
      ctx.repo.setGuildSetting(guildId, 'fun_mode', actif ? 1 : 0);
      return say(
        actif
          ? '✅ Mode potes activé : `/rang declarer` enregistre le rang tout de suite, tous les rangs sont annoncés et les chutes sont chambrées. Points : `/rang classement`.'
          : '✅ Mode potes désactivé : retour à la validation par un modérateur, sans annonce des chutes.',
      );
    }
    case 'gif-chute': {
      const url = interaction.options.getString('url');
      if (url && !isValidGifUrl(url)) return say('❌ Le lien doit être une URL https valide.');
      ctx.repo.setGuildSetting(guildId, 'demotion_gif_url', url ?? null);
      return say(url ? '✅ GIF des chutes défini.' : '✅ GIF des chutes : GIF par défaut.');
    }
    case 'afficher': {
      const s = ctx.repo.getGuildSettings(guildId);
      let announce = s.announce_channel_id ? `<#${s.announce_channel_id}>` : 'Non défini';
      let review = s.review_channel_id ? `<#${s.review_channel_id}>` : 'Non défini';
      try {
        const guild = await resolveGuild(interaction);
        const me = await resolveBotMember(guild);
        announce = await channelStatus(guild, me, s.announce_channel_id, 'announce');
        review = await channelStatus(guild, me, s.review_channel_id, 'review');
      } catch {
        announce += s.announce_channel_id ? ' — ⚠️ le bot n’est pas membre du serveur (voir `npm run invite-url`)' : '';
      }
      const lines = RANKS.map((r) => {
        const c = ctx.repo.getRankSettings(guildId, r.id);
        const notify = s.fun_mode && !c.notify_configured ? true : c.notify;
        return `**${r.label}** — annonce : ${notify ? 'oui' : 'non'} · GIF : ${c.gif_url ? 'oui' : 'non'} · message : ${c.message_template ? 'perso' : 'défaut'} · rôle : ${c.role_id ? `<@&${c.role_id}>` : '—'}`;
      });
      const embed = new EmbedBuilder()
        .setTitle('Configuration')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Salon d’annonces', value: announce },
          { name: 'Salon de validation', value: review },
          { name: 'Rôle modérateur', value: s.moderator_role_id ? `<@&${s.moderator_role_id}>` : 'Aucun', inline: true },
          { name: 'Rôles automatiques', value: s.roles_enabled ? 'Activés' : 'Désactivés', inline: true },
          {
            name: 'Mode potes',
            value: s.fun_mode ? `Activé · GIF des chutes : ${s.demotion_gif_url ? 'perso' : 'par défaut'}` : 'Désactivé (validation par un modérateur)',
            inline: true,
          },
          { name: 'Rangs', value: lines.join('\n') },
        );
      return interaction.editReply({ embeds: [embed], allowedMentions: NO_MENTIONS });
    }
    default:
      return say('Sous-commande inconnue.');
  }
}
