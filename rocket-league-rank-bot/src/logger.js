import pino from 'pino';

export function createLogger(level = 'info') {
  return pino({
    level,
    // Ceinture et bretelles : le token ne doit jamais apparaître dans les logs.
    redact: ['token', 'DISCORD_TOKEN', '*.token', '*.DISCORD_TOKEN'],
  });
}
