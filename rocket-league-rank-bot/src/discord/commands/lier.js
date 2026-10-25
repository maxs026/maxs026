import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const PLATFORMS = [
  { name: 'Epic Games', value: 'epic' },
  { name: 'Steam', value: 'steam' },
  { name: 'PlayStation', value: 'psn' },
  { name: 'Xbox', value: 'xbox' },
  { name: 'Nintendo Switch', value: 'switch' },
];

export const data = new SlashCommandBuilder()
  .setName('lier')
  .setDescription('Associer votre compte Rocket League à votre profil Discord')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) =>
    o.setName('plateforme').setDescription('Votre plateforme').setRequired(true).addChoices(...PLATFORMS),
  )
  .addStringOption((o) =>
    o.setName('pseudo').setDescription('Votre pseudo en jeu').setRequired(true).setMinLength(2).setMaxLength(64),
  );

export async function execute(interaction, ctx) {
  const platform = interaction.options.getString('plateforme', true);
  const handle = interaction.options.getString('pseudo', true).trim();
  ctx.repo.linkAccount(interaction.guildId, interaction.user.id, platform, handle, Date.now());
  await interaction.reply({
    content: `Compte enregistré : **${handle}** (${platform}). Ce lien est indicatif : le bot ne peut pas le vérifier.`,
    flags: MessageFlags.Ephemeral,
  });
}
