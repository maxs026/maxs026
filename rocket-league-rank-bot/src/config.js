import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string('DISCORD_TOKEN manquant').min(1, 'DISCORD_TOKEN manquant'),
  DISCORD_CLIENT_ID: z.string('DISCORD_CLIENT_ID manquant').regex(/^\d{15,25}$/, 'DISCORD_CLIENT_ID doit être un identifiant numérique'),
  // Facultatif : si défini, les commandes sont enregistrées sur ce serveur (instantané, utile en test).
  DISCORD_GUILD_ID: z
    .string()
    .regex(/^\d{15,25}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  DATABASE_PATH: z.string().default('./data/bot.sqlite'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** Valide l'environnement. Lève une erreur lisible sans jamais afficher le token. */
export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `- ${i.path.join('.')} : ${i.message}`);
    throw new Error(`Configuration invalide :\n${lines.join('\n')}`);
  }
  return parsed.data;
}
