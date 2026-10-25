import { MessageFlags } from 'discord.js';
import { commandMap } from './commands/index.js';
import { handleReviewButton, isReviewButton } from './interactions/reviewButtons.js';

/** Route les interactions et garantit une réponse en cas d'erreur. */
export async function routeInteraction(interaction, ctx) {
  try {
    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: 'Ce bot fonctionne uniquement sur un serveur.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (command) await command.execute(interaction, ctx);
    } else if (interaction.isButton() && isReviewButton(interaction.customId)) {
      await handleReviewButton(interaction, ctx);
    }
  } catch (err) {
    ctx.logger.error({ err, command: interaction.commandName, customId: interaction.customId }, 'Erreur pendant le traitement d’une interaction');
    const content = 'Une erreur est survenue. Réessayez ou prévenez un administrateur.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch (replyErr) {
      ctx.logger.error({ err: replyErr }, 'Impossible de répondre à l’interaction');
    }
  }
}
