import { playlistLabel, rankLabel } from './ranks.js';

export const CHANGE_LABELS = {
  first: 'Première déclaration',
  promotion: 'Promotion',
  demotion: 'Rétrogradation',
  same: 'Aucun changement',
};

export const DEFAULT_TEMPLATES = {
  first: '🎉 {membre} rejoint le classement avec le rang **{rang}** en **{playlist}** !',
  promotion: '🚀 Félicitations {membre} ! Passage de **{ancien_rang}** à **{rang}** en **{playlist}** !',
};

/**
 * Remplace uniquement les variables connues. Aucune évaluation de code :
 * un modèle saisi par un administrateur ne peut rien exécuter.
 */
export function renderTemplate(template, vars) {
  return template.replace(/\{(membre|rang|ancien_rang|playlist|type)\}/g, (_, k) => vars[k] ?? '');
}

export function buildMessage({ template, changeType, userId, rank, previousRank, playlist }) {
  const base = template || DEFAULT_TEMPLATES[changeType] || DEFAULT_TEMPLATES.first;
  return renderTemplate(base, {
    membre: `<@${userId}>`,
    rang: rankLabel(rank),
    ancien_rang: previousRank ? rankLabel(previousRank) : '—',
    playlist: playlistLabel(playlist),
    type: CHANGE_LABELS[changeType],
  });
}

/** Valide qu'une URL de GIF est exploitable (https uniquement). */
export function isValidGifUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && value.length <= 500;
  } catch {
    return false;
  }
}
