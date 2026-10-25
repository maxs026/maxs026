import { syncMemberRoles } from './roleSync.js';

/**
 * Effets de bord d'une validation : annonce publique puis rôles.
 * Ne lève jamais ; la validation est déjà enregistrée en base.
 * @returns {Promise<string[]>} avertissements à montrer au modérateur
 */
export async function afterApproval(guild, result, ctx) {
  const warnings = [];
  const { request, shouldNotify } = result;
  if (shouldNotify) {
    const outcome = await ctx.notifier.deliver(request.id);
    if (outcome === 'retry') warnings.push('L’annonce n’a pas pu être envoyée ; nouvel essai automatique dans une minute.');
    if (outcome === 'failed') warnings.push('L’annonce n’a pas pu être envoyée (vérifiez le salon et les permissions).');
  }
  // Idempotent : rejouer la synchro (même sans changement de rang) répare un écart éventuel.
  warnings.push(...(await syncMemberRoles(guild, request.user_id, ctx)));
  return warnings;
}
