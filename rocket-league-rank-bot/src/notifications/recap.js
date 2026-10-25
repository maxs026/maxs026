import { EmbedBuilder } from 'discord.js';
import { RECAP_DAYS, recapSlot, summarizeWeek } from '../domain/recap.js';

const DAY_MS = 24 * 3600 * 1000;

/** Embed du récap, ou null s'il ne s'est rien passé (pas de message vide). */
export function buildRecap(summary) {
  const { climber, clown, hot, totals } = summary;
  if (!totals.changes) return null;
  const lines = [
    climber ? `🚀 **Grimpeur de la semaine** : <@${climber.user_id}> (${climber.promotions} montée${climber.promotions > 1 ? 's' : ''}, ${climber.points > 0 ? '+' : ''}${climber.points} pts)` : '🚀 **Grimpeur de la semaine** : personne… ça manque d’ambition.',
    clown ? `🤡 **Clown de la semaine** : <@${clown.user_id}> (${clown.demotions} chute${clown.demotions > 1 ? 's' : ''}). Courage, ça remonte un jour.` : '🤡 **Clown de la semaine** : aucune chute, bravo (ou vous cachez vos rangs ?).',
  ];
  if (hot) lines.push(`🔥 **Plus longue série en cours** : <@${hot.user_id}>, ${hot.streak} montées d’affilée.`);
  lines.push(`\n📊 ${totals.promotions} montée${totals.promotions > 1 ? 's' : ''} · ${totals.demotions} chute${totals.demotions > 1 ? 's' : ''} cette semaine. Classement complet : \`/rang classement\``);
  return new EmbedBuilder().setTitle('🗓️ Récap Rocket League de la semaine').setColor(0x9b59b6).setDescription(lines.join('\n'));
}

export function weekSummary(repo, guildId, now) {
  return summarizeWeek(repo.listChangesSince(guildId, now - RECAP_DAYS * DAY_MS), repo.listMemberStats(guildId));
}

/**
 * Envoie le récap du dimanche soir dans le salon d'annonces des serveurs en mode potes.
 * Au plus un récap par semaine et par serveur, même après redémarrage (clé en base, réservée avant l'envoi).
 */
export class WeeklyRecap {
  constructor({ repo, transport, logger, now = () => Date.now() }) {
    this.repo = repo;
    this.transport = transport;
    this.log = logger;
    this.now = now;
  }

  /** @returns {Promise<string[]>} serveurs pour lesquels un récap a été envoyé */
  async tick() {
    const key = recapSlot(this.now());
    if (!key) return [];
    const sent = [];
    for (const settings of this.repo.listFunGuilds()) {
      if (!settings.announce_channel_id || settings.last_recap_key === key) continue;
      // Réservé avant l'envoi : en cas de doute, un récap manquant plutôt qu'un doublon.
      if (!this.repo.claimRecap(settings.guild_id, key)) continue;
      const embed = buildRecap(weekSummary(this.repo, settings.guild_id, this.now()));
      if (!embed) continue; // semaine calme : rien à dire, la clé reste prise
      try {
        await this.transport.send(settings.announce_channel_id, { embeds: [embed], allowedMentions: { parse: [] } });
        sent.push(settings.guild_id);
      } catch (err) {
        this.log.error({ err, guildId: settings.guild_id }, 'Envoi du récap hebdomadaire impossible');
        this.repo.setGuildSetting(settings.guild_id, 'last_recap_key', settings.last_recap_key ?? null); // nouvel essai au prochain passage
      }
    }
    return sent;
  }
}
