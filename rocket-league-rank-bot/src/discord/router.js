import { randomBytes } from 'node:crypto';
import { MessageFlags } from 'discord.js';
import { commandMap } from './commands/index.js';
import { handleReviewButton, isReviewButton } from './interactions/reviewButtons.js';
import { UserFacingError } from './userError.js';

/** Répond une seule fois, quel que soit l'état de l'interaction (non répondue, différée, déjà répondue). */
async function respond(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  if (interaction.replied) return interaction.followUp(payload);
  if (interaction.deferred) return interaction.editReply({ content, allowedMentions: payload.allowedMentions });
  return interaction.reply(payload);
}

/** Route les interactions et garantit une réponse en cas d'erreur. */
export async function routeInteraction(interaction, ctx) {
  const where = {
    command: interaction.commandName,
    subcommand: interaction.options?.getSubcommand?.(false) ?? undefined,
    customId: interaction.customId,
    guildId: interaction.guildId,
  };
  try {
    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) await respond(interaction, 'Ce bot fonctionne uniquement sur un serveur.');
      return;
    }
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (command) await command.execute(interaction, ctx);
    } else if (interaction.isButton() && isReviewButton(interaction.customId)) {
      await handleReviewButton(interaction, ctx);
    }
  } catch (err) {
    let content;
    if (err instanceof UserFacingError) {
      ctx.logger.warn({ ...where, reason: err.message }, 'Interaction refusée (erreur prévisible)');
      content = err.message;
    } else {
      // Référence courte : visible de l'utilisateur ET dans les logs, pour retrouver la stack trace.
      const ref = randomBytes(3).toString('hex');
      ctx.logger.error({ err, ref, ...where }, 'Erreur inattendue pendant le traitement d’une interaction');
      content = `Une erreur inattendue est survenue (réf. ${ref}). Prévenez un administrateur en lui donnant cette référence.`;
    }
    try {
      await respond(interaction, content);
    } catch (replyErr) {
      ctx.logger.error({ err: replyErr, ...where }, 'Impossible de répondre à l’interaction');
    }
  }
}
