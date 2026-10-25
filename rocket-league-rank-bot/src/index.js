import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config.js';
import { DiscordTransport } from './discord/transport.js';
import { routeInteraction } from './discord/router.js';
import { createLogger } from './logger.js';
import { Notifier } from './notifications/notifier.js';
import { RankService } from './services/rankService.js';
import { openDatabase } from './storage/db.js';
import { Repository } from './storage/repository.js';

const RETRY_INTERVAL_MS = 60_000;

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const db = openDatabase(config.DATABASE_PATH);
const repo = new Repository(db);
const client = new Client({ intents: [GatewayIntentBits.Guilds] }); // aucun intent privilégié
const transport = new DiscordTransport(client);
const ctx = {
  repo,
  rankService: new RankService(repo),
  notifier: new Notifier({ repo, transport, logger }),
  transport,
  logger,
};

let retryTimer;

client.once(Events.ClientReady, async (c) => {
  logger.info({ user: c.user.tag, guilds: c.guilds.cache.size }, 'Bot connecté à Discord');
  try {
    // Reprise après redémarrage : annonces restées en attente ou interrompues.
    await ctx.notifier.recover();
  } catch (err) {
    logger.error({ err }, 'Reprise des annonces en échec');
  }
  retryTimer = setInterval(() => {
    ctx.notifier.dispatchPending().catch((err) => logger.error({ err }, 'Relance des annonces en échec'));
  }, RETRY_INTERVAL_MS);
});

client.on(Events.InteractionCreate, (interaction) => routeInteraction(interaction, ctx));
client.on(Events.Error, (err) => logger.error({ err }, 'Erreur du client Discord'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Promesse rejetée non gérée'));

async function shutdown(signal) {
  logger.info({ signal }, 'Arrêt en cours');
  clearInterval(retryTimer);
  await client.destroy();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await client.login(config.DISCORD_TOKEN);
} catch (err) {
  logger.fatal({ err }, 'Connexion à Discord impossible (token invalide ou réseau)');
  db.close();
  process.exit(1);
}
