import { EmbedBuilder } from 'discord.js';
import { CHANGE_LABELS, buildMessage } from '../domain/messages.js';
import { playlistLabel, rankLabel } from '../domain/ranks.js';
import { rewardLine } from '../domain/rewards.js';

/** GIF par défaut des rétrogradations (Giphy, lien direct vérifié) : une voiture qui regarde l'adversaire marquer. */
export const DEFAULT_DEMOTION_GIF = 'https://media.giphy.com/media/xT0xeksCiseQVcSQtW/giphy.gif';

const TITLES = {
  first: '🚀 Nouveau rang Rocket League',
  promotion: '🏆 Promotion Rocket League',
  demotion: '📉 Chute libre Rocket League',
};

const COLORS = {
  bronze: 0xcd7f32,
  silver: 0xc0c0c0,
  gold: 0xffd700,
  platinum: 0x7fdbff,
  diamond: 0x4a90e2,
  champion: 0x9b59b6,
  'grand-champion': 0xe74c3c,
  'supersonic-legend': 0xffffff,
};

export const footerMarker = (requestId) => `Demande #${requestId}`;

/**
 * Construit le message d'annonce (charge utile Discord brute).
 * @param {object} request  ligne rank_requests approuvée
 * @param {{gif_url:string|null, message_template:string|null}} rankSettings
 * @param {{fun_mode?:number, demotion_gif_url?:string|null}} [guildSettings]
 */
export function buildAnnouncement(request, rankSettings, guildSettings = {}) {
  const demotion = request.change_type === 'demotion';
  const description = buildMessage({
    template: rankSettings.message_template,
    changeType: request.change_type,
    userId: request.user_id,
    rank: request.rank,
    previousRank: request.previous_rank,
    playlist: request.playlist,
    variant: guildSettings.fun_mode ? request.id : null,
  });

  const embed = new EmbedBuilder()
    .setColor(demotion ? 0x992d22 : (COLORS[request.rank] ?? 0x5865f2))
    .setTitle(TITLES[request.change_type] ?? TITLES.first)
    .setDescription(description)
    .addFields(
      { name: 'Playlist', value: playlistLabel(request.playlist), inline: true },
      { name: 'Rang', value: rankLabel(request.rank), inline: true },
      { name: 'Type', value: CHANGE_LABELS[request.change_type], inline: true },
    )
    .setFooter({ text: footerMarker(request.id) })
    .setTimestamp(request.reviewed_at ?? Date.now());

  if (request.previous_rank) {
    embed.addFields({ name: 'Ancien rang', value: rankLabel(request.previous_rank), inline: true });
  }
  const reward = rewardLine(request);
  if (reward) embed.addFields({ name: demotion ? 'Sanction' : 'Récompense', value: reward });
  // Le GIF du rang célèbre une montée : une chute a son propre GIF.
  const gif = demotion ? (guildSettings.demotion_gif_url ?? DEFAULT_DEMOTION_GIF) : rankSettings.gif_url;
  if (gif) embed.setImage(gif);

  return {
    content: `<@${request.user_id}>`,
    embeds: [embed],
    // Seul le membre concerné peut être notifié, même si un modèle contient @everyone.
    allowedMentions: { parse: [], users: [request.user_id] },
  };
}
