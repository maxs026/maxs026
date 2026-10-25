// Récap hebdomadaire : logique pure (créneau horaire et agrégation), testable sans Discord.

export const RECAP_TIMEZONE = 'Europe/Paris';
export const RECAP_HOUR = 20; // dimanche 20 h, heure de Paris
export const RECAP_DAYS = 7;

const parts = (now, timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  return Object.fromEntries(f.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
};

/**
 * Clé du récap à envoyer maintenant, ou null hors créneau.
 * Créneau : du dimanche 20 h au lundi 23 h 59 (heure de Paris), pour rattraper un Mac en veille.
 * La clé est la date du dimanche concerné (AAAA-MM-JJ) : un seul récap par semaine.
 */
export function recapSlot(now, timeZone = RECAP_TIMEZONE) {
  const p = parts(now, timeZone);
  if (p.weekday === 'Sun' && Number(p.hour) >= RECAP_HOUR) return `${p.year}-${p.month}-${p.day}`;
  if (p.weekday === 'Mon') {
    const y = parts(now - 24 * 3600 * 1000, timeZone);
    return `${y.year}-${y.month}-${y.day}`;
  }
  return null;
}

/**
 * Résume les changements de la semaine.
 * @param {{user_id:string, change_type:string, points_delta:number|null}[]} changes
 * @param {{user_id:string, streak:number}[]} stats  statistiques actuelles des membres
 */
export function summarizeWeek(changes, stats) {
  const byUser = new Map();
  for (const c of changes) {
    const u = byUser.get(c.user_id) ?? { user_id: c.user_id, points: 0, promotions: 0, demotions: 0 };
    u.points += c.points_delta ?? 0;
    if (c.change_type === 'promotion') u.promotions += 1;
    if (c.change_type === 'demotion') u.demotions += 1;
    byUser.set(c.user_id, u);
  }
  const users = [...byUser.values()];
  const climber = users.filter((u) => u.promotions > 0).sort((a, b) => b.points - a.points || b.promotions - a.promotions)[0] ?? null;
  const clown = users.filter((u) => u.demotions > 0).sort((a, b) => b.demotions - a.demotions || a.points - b.points)[0] ?? null;
  const hot = [...stats].filter((s) => s.streak >= 2).sort((a, b) => b.streak - a.streak)[0] ?? null;
  return {
    climber,
    clown,
    hot,
    totals: {
      changes: changes.length,
      promotions: users.reduce((n, u) => n + u.promotions, 0),
      demotions: users.reduce((n, u) => n + u.demotions, 0),
    },
  };
}
