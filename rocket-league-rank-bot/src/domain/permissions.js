// Logique pure : travaille sur des données simples, testable sans Discord.

/**
 * Un modérateur est : administrateur, titulaire de « Gérer le serveur »,
 * ou titulaire du rôle modérateur configuré.
 * @param {{isAdministrator:boolean, canManageGuild:boolean, roleIds:string[]}} member
 * @param {{moderator_role_id?: string|null}} settings
 */
export function isModerator(member, settings) {
  if (member.isAdministrator || member.canManageGuild) return true;
  const roleId = settings?.moderator_role_id;
  return Boolean(roleId && member.roleIds.includes(roleId));
}

/** Seuls les administrateurs/« Gérer le serveur » modifient la configuration. */
export function isAdmin(member) {
  return Boolean(member.isAdministrator || member.canManageGuild);
}

/**
 * Peut-on valider cette demande ? Un modérateur ne valide pas sa propre
 * demande, sauf s'il est administrateur.
 */
export function canReview(member, settings, request) {
  if (!isModerator(member, settings)) return { ok: false, reason: 'not_moderator' };
  if (request.user_id === member.userId && !member.isAdministrator) {
    return { ok: false, reason: 'self_review' };
  }
  return { ok: true };
}
