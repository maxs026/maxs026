import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { isModerator } from '../../domain/permissions.js';
import { playlistLabel, rankLabel } from '../../domain/ranks.js';
import { memberInfo, NO_MENTIONS } from '../member.js';
import { afterApproval } from '../postApproval.js';
import { playlistChoices, rankChoices } from './rang.js';

export const data = new SlashCommandBuilder()
  .setName('rang-definir')
  .setDescription('Modération : enregistrer directement le rang d’un membre')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('membre').setDescription('Membre concerné').setRequired(true))
  .addStringOption((o) => o.setName('playlist').setDescription('Playlist').setRequired(true).addChoices(...playlistChoices))
  .addStringOption((o) => o.setName('rang').setDescription('Rang').setRequired(true).addChoices(...rankChoices));

export async function execute(interaction, ctx) {
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  // default_member_permissions peut être modifié par les réglages du serveur : on revérifie.
  if (!isModerator(memberInfo(interaction), ctx.repo.getGuildSettings(interaction.guildId))) {
    return reply('Commande réservée aux modérateurs.');
  }
  const user = interaction.options.getUser('membre', true);
  if (user.bot) return reply('Un bot n’a pas de rang.');
  const me = memberInfo(interaction);
  if (user.id === me.userId && !me.isAdministrator) {
    return reply('Vous ne pouvez pas valider votre propre rang : passez par `/rang declarer`.');
  }

  const result = ctx.rankService.recordTrusted({
    guildId: interaction.guildId,
    userId: user.id,
    playlist: interaction.options.getString('playlist', true),
    rank: interaction.options.getString('rang', true),
    reviewerId: interaction.user.id,
  });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const warnings = await afterApproval(interaction.guild, result, ctx);
  const labels = { first: 'première déclaration', promotion: 'promotion', demotion: 'rétrogradation', same: 'aucun changement' };
  await interaction.editReply({
    content:
      `Rang de <@${user.id}> : **${rankLabel(result.request.rank)}** en **${playlistLabel(result.request.playlist)}** (${labels[result.changeType]}).` +
      (warnings.length ? `\n⚠️ ${warnings.join('\n⚠️ ')}` : ''),
    allowedMentions: NO_MENTIONS,
  });
}
