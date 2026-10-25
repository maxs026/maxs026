// Seul fichier à modifier si Psyonix change la liste des rangs ou des playlists.

/** Du plus bas au plus haut. L'ordre du tableau définit la comparaison. */
export const RANKS = [
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
  { id: 'platinum', label: 'Platinum' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'champion', label: 'Champion' },
  { id: 'grand-champion', label: 'Grand Champion' },
  { id: 'supersonic-legend', label: 'Supersonic Legend' },
];

export const PLAYLISTS = [
  { id: '1v1', label: 'Duel 1v1' },
  { id: '2v2', label: 'Double 2v2' },
  { id: '3v3', label: 'Standard 3v3' },
  { id: 'hoops', label: 'Hoops' },
  { id: 'rumble', label: 'Rumble' },
  { id: 'dropshot', label: 'Dropshot' },
  { id: 'snowday', label: 'Snow Day' },
];

/** Rangs annoncés par défaut tant qu'un serveur n'a rien configuré. */
export const DEFAULT_NOTIFY_RANKS = ['silver', 'gold'];

export const PLAYLIST_IDS = PLAYLISTS.map((p) => p.id);
export const RANK_IDS = RANKS.map((r) => r.id);

export const isRank = (id) => RANK_IDS.includes(id);
export const isPlaylist = (id) => PLAYLIST_IDS.includes(id);
export const rankLabel = (id) => RANKS.find((r) => r.id === id)?.label ?? id;
export const playlistLabel = (id) => PLAYLISTS.find((p) => p.id === id)?.label ?? id;

export function rankIndex(id) {
  const i = RANK_IDS.indexOf(id);
  if (i === -1) throw new Error(`Rang inconnu : ${id}`);
  return i;
}

/**
 * Compare le rang précédent (null si aucun) au nouveau rang pour un même
 * membre ET une même playlist.
 * @returns {'first'|'promotion'|'demotion'|'same'}
 */
export function classifyChange(previous, next) {
  if (previous == null) return 'first';
  const diff = rankIndex(next) - rankIndex(previous);
  if (diff > 0) return 'promotion';
  if (diff < 0) return 'demotion';
  return 'same';
}

/** Rang le plus élevé d'une liste (null si vide). */
export function highestRank(ranks) {
  if (!ranks.length) return null;
  return ranks.reduce((best, r) => (rankIndex(r) > rankIndex(best) ? r : best));
}
