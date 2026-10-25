/**
 * Calcule les rôles à ajouter/retirer pour qu'un membre porte uniquement le
 * rôle associé à son meilleur rang validé (toutes playlists confondues).
 * @param {Record<string,string|null>} roleByRank  rang -> id de rôle (ou null)
 * @param {string|null} highest                    meilleur rang validé
 * @param {string[]} currentRoleIds                rôles actuels du membre
 */
export function computeRoleChanges(roleByRank, highest, currentRoleIds) {
  const target = highest ? (roleByRank[highest] ?? null) : null;
  const managed = Object.values(roleByRank).filter(Boolean);
  const add = target && !currentRoleIds.includes(target) ? [target] : [];
  const remove = managed.filter((r) => r !== target && currentRoleIds.includes(r));
  return { add, remove };
}
