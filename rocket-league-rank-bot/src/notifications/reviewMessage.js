import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { CHANGE_LABELS } from '../domain/messages.js';
import { classifyChange, playlistLabel, rankLabel } from '../domain/ranks.js';

export const APPROVE_PREFIX = 'rank:approve:';
export const REJECT_PREFIX = 'rank:reject:';

const STATUS_TEXT = {
  approved: (r) => `✅ Validée par <@${r.reviewer_id}>`,
  rejected: (r) => `❌ Refusée par <@${r.reviewer_id}>`,
};

/**
 * Message affiché dans le salon de validation.
 * @param {object} request
 * @param {{previousRank?:string|null, account?:object|null, screenshot?:{name?:string,url?:string}|null, note?:string}} ctx
 */
export function buildReviewMessage(request, { previousRank = null, account = null, screenshot = null, note } = {}) {
  const preview = classifyChange(previousRank, request.rank);
  const embed = new EmbedBuilder()
    .setColor(request.status === 'pending' ? 0xfaa61a : request.status === 'approved' ? 0x57f287 : 0xed4245)
    .setTitle(`Demande de rang #${request.id}`)
    .setDescription(`<@${request.user_id}> déclare un rang. Vérifiez la capture avant de valider.`)
    .addFields(
      { name: 'Playlist', value: playlistLabel(request.playlist), inline: true },
      { name: 'Rang déclaré', value: rankLabel(request.rank), inline: true },
      { name: 'Rang validé actuel', value: previousRank ? rankLabel(previousRank) : 'Aucun', inline: true },
      { name: 'Nature', value: CHANGE_LABELS[preview], inline: true },
      {
        name: 'Compte lié',
        value: account ? `${account.platform} — ${account.handle} (non vérifié)` : 'Aucun compte lié',
        inline: true,
      },
    )
    .setTimestamp(request.created_at);
  if (screenshot?.name) embed.setImage(`attachment://${screenshot.name}`);
  else if (screenshot?.url) embed.setImage(screenshot.url);
  else embed.addFields({ name: 'Capture', value: 'Aucune capture fournie.' });

  if (request.status !== 'pending') {
    embed.addFields({ name: 'Décision', value: STATUS_TEXT[request.status](request) });
  }
  if (note) embed.addFields({ name: 'Remarque', value: note });

  const components =
    request.status === 'pending'
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`${APPROVE_PREFIX}${request.id}`).setLabel('Valider').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`${REJECT_PREFIX}${request.id}`).setLabel('Refuser').setStyle(ButtonStyle.Danger),
          ),
        ]
      : [];
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}
