import { AttachmentBuilder, EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { PLAYLISTS, RANKS, playlistLabel, rankLabel } from '../../domain/ranks.js';
import { RankError } from '../../services/rankService.js';
import { buildReviewMessage } from '../../notifications/reviewMessage.js';
import { NO_MENTIONS } from '../member.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const playlistChoices = PLAYLISTS.map((p) => ({ name: p.label, value: p.id }));
export const rankChoices = RANKS.map((r) => ({ name: r.label, value: r.id }));

export const data = new SlashCommandBuilder()
  .setName('rang')
  .setDescription('Déclarer ou consulter un rang Rocket League')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) =>
    s
      .setName('declarer')
      .setDescription('Déclarer votre rang, à faire valider par un modérateur')
      .addStringOption((o) => o.setName('playlist').setDescription('Playlist').setRequired(true).addChoices(...playlistChoices))
      .addStringOption((o) => o.setName('rang').setDescription('Votre rang actuel').setRequired(true).addChoices(...rankChoices))
      .addAttachmentOption((o) => o.setName('capture').setDescription('Capture d’écran de votre rang (recommandée)')),
  )
  .addSubcommand((s) =>
    s
      .setName('voir')
      .setDescription('Voir le rang validé d’un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre (vous par défaut)')),
  );

const reply = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });

const ERROR_TEXT = {
  already_validated: 'Ce rang est déjà validé pour cette playlist.',
  already_pending: 'Une demande est déjà en attente pour cette playlist. Patientez le temps qu’un modérateur la traite.',
};

export async function execute(interaction, ctx) {
  return interaction.options.getSubcommand() === 'voir' ? voir(interaction, ctx) : declarer(interaction, ctx);
}

async function declarer(interaction, ctx) {
  const settings = ctx.repo.getGuildSettings(interaction.guildId);
  if (!settings.review_channel_id) {
    return reply(interaction, 'Le serveur n’est pas encore configuré : un administrateur doit définir le salon de validation (`/config canal-validation`).');
  }
  const attachment = interaction.options.getAttachment('capture');
  if (attachment) {
    if (!ALLOWED_TYPES.includes(attachment.contentType?.split(';')[0] ?? '')) {
      return reply(interaction, 'La capture doit être une image PNG, JPEG ou WebP.');
    }
    if (attachment.size > MAX_BYTES) return reply(interaction, 'La capture dépasse 8 Mo.');
  }

  let request;
  try {
    request = ctx.rankService.submitDeclaration({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      playlist: interaction.options.getString('playlist', true),
      rank: interaction.options.getString('rang', true),
      screenshotUrl: attachment?.url ?? null,
    });
  } catch (err) {
    if (err instanceof RankError && ERROR_TEXT[err.code]) return reply(interaction, ERROR_TEXT[err.code]);
    throw err;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const previous = ctx.repo.getValidatedRank(request.guild_id, request.user_id, request.playlist)?.rank ?? null;
  const account = ctx.repo.getAccount(request.guild_id, request.user_id) ?? null;
  try {
    let messageId;
    if (attachment) {
      // On ré-héberge la capture dans le salon de validation : les liens CDN Discord expirent.
      const name = `capture-${request.id}.${EXT[attachment.contentType.split(';')[0]]}`;
      const files = [new AttachmentBuilder(attachment.url, { name })];
      try {
        messageId = await ctx.transport.send(settings.review_channel_id, {
          ...buildReviewMessage(request, { previousRank: previous, account, screenshot: { name } }),
          files,
        });
      } catch (err) {
        ctx.logger.warn({ err, requestId: request.id }, 'Ré-hébergement de la capture impossible, repli sur le lien');
        messageId = await ctx.transport.send(
          settings.review_channel_id,
          buildReviewMessage(request, { previousRank: previous, account, screenshot: { url: attachment.url } }),
        );
      }
    } else {
      messageId = await ctx.transport.send(
        settings.review_channel_id,
        buildReviewMessage(request, { previousRank: previous, account }),
      );
    }
    ctx.repo.setReviewMessage(request.id, messageId);
  } catch (err) {
    ctx.logger.error({ err, requestId: request.id }, 'Envoi au salon de validation impossible');
    ctx.repo.deleteRequest(request.id);
    return interaction.editReply('Impossible de transmettre votre demande aux modérateurs (salon introuvable ou permissions manquantes). Prévenez un administrateur.');
  }
  await interaction.editReply(
    `Demande n°${request.id} envoyée : **${rankLabel(request.rank)}** en **${playlistLabel(request.playlist)}**. Un modérateur doit la valider.`,
  );
}

async function voir(interaction, ctx) {
  const user = interaction.options.getUser('membre') ?? interaction.user;
  const rows = ctx.rankService.getValidatedRanks(interaction.guildId, user.id);
  const account = ctx.repo.getAccount(interaction.guildId, user.id);
  const embed = new EmbedBuilder()
    .setTitle(`Rangs validés — ${user.displayName ?? user.username}`)
    .setColor(0x5865f2)
    .setDescription(
      rows.length
        ? rows
            .map((r) => `**${playlistLabel(r.playlist)}** : ${rankLabel(r.rank)} — <t:${Math.floor(r.updated_at / 1000)}:R>`)
            .join('\n')
        : 'Aucun rang validé pour ce membre.',
    );
  if (account) embed.setFooter({ text: `Compte déclaré : ${account.handle} (${account.platform}), non vérifié` });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
}
