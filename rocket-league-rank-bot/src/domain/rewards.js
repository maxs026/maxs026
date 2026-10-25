// Points et séries : logique pure, testable sans Discord ni base.
import { rankIndex } from './ranks.js';

export const POINTS = {
  first: 5, // bienvenue
  perRankUp: 10, // par rang gagné
  perRankDown: -5, // par rang perdu
  streakBonus: 5, // à partir de 3 montées d'affilée
};

/**
 * Nouvelles statistiques d'un membre après un changement de rang validé.
 * `streak` > 0 : montées d'affilée ; < 0 : chutes d'affilée.
 * @param {'first'|'promotion'|'demotion'|'same'} changeType
 * @param {{points:number, promotions:number, demotions:number, streak:number}} stats
 */
export function applyReward(changeType, previousRank, rank, stats) {
  const next = { ...stats, delta: 0 };
  if (changeType === 'first') {
    next.delta = POINTS.first;
  } else if (changeType === 'promotion') {
    next.streak = Math.max(stats.streak, 0) + 1;
    next.promotions += 1;
    next.delta = POINTS.perRankUp * (rankIndex(rank) - rankIndex(previousRank)) + (next.streak >= 3 ? POINTS.streakBonus : 0);
  } else if (changeType === 'demotion') {
    next.streak = Math.min(stats.streak, 0) - 1;
    next.demotions += 1;
    next.delta = POINTS.perRankDown * (rankIndex(previousRank) - rankIndex(rank));
  }
  next.points += next.delta;
  return next;
}

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Ligne « Récompense » de l'annonce, ou null si la demande n'a pas de points enregistrés. */
export function rewardLine({ change_type: type, points_delta: delta, points_total: total, streak }) {
  if (delta == null) return null;
  if (type === 'first') return `${signed(delta)} pts de bienvenue (total ${total})`;
  let line = `${signed(delta)} pts (total ${total})`;
  if (type === 'promotion' && streak >= 2) line += ` · 🔥 ${streak} montées d’affilée${streak >= 3 ? ` (bonus +${POINTS.streakBonus})` : ''}`;
  if (type === 'demotion' && streak <= -2) line += ` · 🤡 ${-streak} chutes d’affilée`;
  return line;
}

/** Petit titre affiché dans le classement. */
export function titleFor({ streak }) {
  if (streak >= 3) return '🔥 En feu';
  if (streak <= -2) return '🤡 En chute libre';
  return '';
}
