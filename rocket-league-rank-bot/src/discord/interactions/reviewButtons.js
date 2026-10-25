import { MessageFlags } from 'discord.js';
import { canReview } from '../../domain/permissions.js';
import { buildReviewMessage, APPROVE_PREFIX, REJECT_PREFIX } from '../../notifications/reviewMessage.js';
import { memberInfo } from '../member.js';
import { afterApproval } from '../postApproval.js';

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

export const isReviewButton = (customId) =>
  customId.startsWith(APPROVE_PREFIX) || customId.startsWith(REJECT_PREFIX);

/**
 * Clic sur Valider / Refuser. Les permissions sont revérifiées ici : les
 * boutons sont visibles de tous ceux qui voient le salon.
 */
export async function handleReviewButton(interaction, ctx) {
  const approve = interaction.customId.startsWith(APPROVE_PREFIX);
  const id = Number(interaction.customId.slice((approve ? APPROVE_PREFIX : REJECT_PREFIX).length));
  const request = Number.isInteger(id) ? ctx.repo.getRequest(id) : undefined;
  if (!request || request.guild_id !== interaction.guildId) {
    return interaction.reply(ephemeral('Demande introuvable.'));
  }

  const settings = ctx.repo.getGuildSettings(request.guild_id);
  const verdict = canReview(memberInfo(interaction), settings, request);
  if (!verdict.ok) {
    return interaction.reply(
      ephemeral(
        verdict.reason === 'self_review'
          ? 'Vous ne pouvez pas valider votre propre demande.'
          : 'Seuls les modérateurs peuvent traiter cette demande.',
      ),
    );
  }

  const reviewer = interaction.user.id;
  if (!approve) {
    const res = ctx.rankService.reject(id, reviewer);
    if (res.alreadyProcessed) return interaction.reply(ephemeral('Cette demande a déjà été traitée.'));
    return interaction.update(buildReviewMessage(res.request, {}));
  }

  const result = ctx.rankService.approve(id, reviewer);
  if (result.alreadyProcessed) return interaction.reply(ephemeral('Cette demande a déjà été traitée.'));

  // On répond d'abord à Discord (délai de 3 s), puis on déclenche les effets de bord.
  const existingEmbed = interaction.message?.embeds?.[0]?.image?.url ?? null;
  await interaction.update(
    buildReviewMessage(result.request, {
      previousRank: result.previousRank,
      screenshot: existingEmbed ? { url: existingEmbed } : null,
    }),
  );
  const warnings = await afterApproval(interaction.guild, result, ctx);
  if (warnings.length) {
    await interaction.followUp(ephemeral(`⚠️ ${warnings.join('\n⚠️ ')}`));
  }
}
