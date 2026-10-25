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

/** Mode potes : variantes tirées selon le numéro de la demande (stable en cas de renvoi). */
export const FUN_TEMPLATES = {
  first: [
    '🎉 {membre} débarque en **{rang}** en **{playlist}**. Bienvenue dans l’arène !',
    '👀 {membre} annonce **{rang}** en **{playlist}**. On attend les replays.',
    '🚗 {membre} entre sur le terrain en **{rang}** ({playlist}). Échauffement terminé ?',
  ],
  promotion: [
    '🚀 {membre} passe de **{ancien_rang}** à **{rang}** en **{playlist}** ! Respect.',
    '🏆 GG {membre} ! **{ancien_rang}** → **{rang}** en **{playlist}**. Le smurf est démasqué ?',
    '🔥 {membre} monte en **{rang}** ({playlist}). Les coéquipiers peuvent dire merci.',
    '📈 {membre} a enfin trouvé le bouton boost : **{rang}** en **{playlist}** !',
  ],
  demotion: [
    '📉 Aïe… {membre} redescend de **{ancien_rang}** à **{rang}** en **{playlist}**. C’était le lag, évidemment.',
    '🤡 {membre} passe de **{ancien_rang}** à **{rang}** en **{playlist}**. Les coéquipiers étaient nuls, c’est sûr.',
    '🪦 RIP le rang **{ancien_rang}** de {membre}. Retour en **{rang}** ({playlist}). On organise une collecte ?',
    '🧱 {membre} a percuté le mur : **{rang}** en **{playlist}**. Remonte vite, on te chambre en attendant.',
    '😬 {membre} en **{rang}** ({playlist}) après **{ancien_rang}**. Le ballon est rond, mais pas pour tout le monde.',
  ],
};

/**
 * Remplace uniquement les variables connues. Aucune évaluation de code :
 * un modèle saisi par un administrateur ne peut rien exécuter.
 */
export function renderTemplate(template, vars) {
  return template.replace(/\{(membre|rang|ancien_rang|playlist|type)\}/g, (_, k) => vars[k] ?? '');
}

/**
 * `variant` (numéro de demande) choisit une phrase du mode potes ; sans lui, messages classiques.
 * Un modèle personnalisé ne s'applique pas aux rétrogradations, qui gardent leur chambrage.
 */
export function buildMessage({ template, changeType, userId, rank, previousRank, playlist, variant = null }) {
  const pool = variant == null ? null : FUN_TEMPLATES[changeType];
  const custom = changeType === 'demotion' ? null : template;
  const base = custom || (pool ? pool[variant % pool.length] : null) || DEFAULT_TEMPLATES[changeType] || DEFAULT_TEMPLATES.first;
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
