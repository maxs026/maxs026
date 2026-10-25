import { describe, expect, it } from 'vitest';
import { buildMessage, isValidGifUrl, renderTemplate } from '../src/domain/messages.js';
import { canReview, isAdmin, isModerator } from '../src/domain/permissions.js';
import { PLAYLISTS, RANKS, classifyChange, highestRank, rankIndex } from '../src/domain/ranks.js';
import { computeRoleChanges } from '../src/domain/roles.js';

describe('rangs', () => {
  it('ordonne les rangs de Bronze à Supersonic Legend', () => {
    expect(rankIndex('bronze')).toBeLessThan(rankIndex('silver'));
    expect(rankIndex('silver')).toBeLessThan(rankIndex('gold'));
    expect(rankIndex('grand-champion')).toBeLessThan(rankIndex('supersonic-legend'));
  });
  it('rejette un rang inconnu', () => {
    expect(() => rankIndex('diamant')).toThrow();
  });
  it('distingue première déclaration, promotion, rétrogradation et identique', () => {
    expect(classifyChange(null, 'silver')).toBe('first');
    expect(classifyChange('silver', 'gold')).toBe('promotion');
    expect(classifyChange('gold', 'silver')).toBe('demotion');
    expect(classifyChange('gold', 'gold')).toBe('same');
  });
  it('trouve le meilleur rang', () => {
    expect(highestRank([])).toBeNull();
    expect(highestRank(['silver', 'platinum', 'gold'])).toBe('platinum');
  });
  it('expose au plus 25 choix pour les commandes slash', () => {
    expect(RANKS.length).toBeLessThanOrEqual(25);
    expect(PLAYLISTS.length).toBeLessThanOrEqual(25);
  });
});

describe('messages', () => {
  it('remplace uniquement les variables connues', () => {
    expect(renderTemplate('{membre} {rang} {inconnu} ${process.env.X}', { membre: '@a', rang: 'Gold' })).toBe(
      '@a Gold {inconnu} ${process.env.X}',
    );
  });
  it('utilise des modèles par défaut distincts pour première déclaration et promotion', () => {
    const base = { userId: '1', rank: 'gold', previousRank: 'silver', playlist: '3v3' };
    const first = buildMessage({ ...base, changeType: 'first', previousRank: null });
    const promo = buildMessage({ ...base, changeType: 'promotion' });
    expect(first).not.toBe(promo);
    expect(promo).toContain('<@1>');
    expect(promo).toContain('Silver');
    expect(promo).toContain('Gold');
  });
  it('applique le modèle personnalisé du rang', () => {
    const msg = buildMessage({ template: 'GG {membre} -> {rang} ({playlist})', changeType: 'promotion', userId: '9', rank: 'gold', previousRank: 'silver', playlist: '2v2' });
    expect(msg).toBe('GG <@9> -> Gold (Double 2v2)');
  });
  it('n’accepte que des GIF en https', () => {
    expect(isValidGifUrl('https://media.example.com/a.gif')).toBe(true);
    expect(isValidGifUrl('http://media.example.com/a.gif')).toBe(false);
    expect(isValidGifUrl('javascript:alert(1)')).toBe(false);
    expect(isValidGifUrl('pas une url')).toBe(false);
  });
});

describe('permissions', () => {
  const member = (o = {}) => ({ userId: 'u', isAdministrator: false, canManageGuild: false, roleIds: [], ...o });
  it('reconnaît administrateur, Gérer le serveur et rôle modérateur', () => {
    expect(isModerator(member({ isAdministrator: true }), {})).toBe(true);
    expect(isModerator(member({ canManageGuild: true }), {})).toBe(true);
    expect(isModerator(member({ roleIds: ['mod'] }), { moderator_role_id: 'mod' })).toBe(true);
  });
  it('refuse un membre ordinaire ou un rôle non configuré', () => {
    expect(isModerator(member(), { moderator_role_id: 'mod' })).toBe(false);
    expect(isModerator(member({ roleIds: ['mod'] }), {})).toBe(false);
  });
  it('réserve la configuration aux administrateurs / Gérer le serveur, pas au rôle modérateur', () => {
    expect(isAdmin(member({ roleIds: ['mod'] }))).toBe(false);
    expect(isAdmin(member({ canManageGuild: true }))).toBe(true);
  });
  it('interdit l’auto-validation sauf pour un administrateur', () => {
    const settings = { moderator_role_id: 'mod' };
    const own = { user_id: 'u' };
    expect(canReview(member({ roleIds: ['mod'] }), settings, own)).toEqual({ ok: false, reason: 'self_review' });
    expect(canReview(member({ isAdministrator: true }), settings, own)).toEqual({ ok: true });
    expect(canReview(member({ roleIds: ['mod'] }), settings, { user_id: 'autre' })).toEqual({ ok: true });
    expect(canReview(member(), settings, { user_id: 'autre' })).toEqual({ ok: false, reason: 'not_moderator' });
  });
});

describe('rôles', () => {
  const map = { silver: 'rS', gold: 'rG', platinum: null };
  it('ajoute le rôle du meilleur rang et retire les autres rôles de rang', () => {
    expect(computeRoleChanges(map, 'gold', ['rS', 'autre'])).toEqual({ add: ['rG'], remove: ['rS'] });
  });
  it('ne touche pas aux rôles étrangers et reste idempotent', () => {
    expect(computeRoleChanges(map, 'gold', ['rG', 'autre'])).toEqual({ add: [], remove: [] });
  });
  it('retire tout si aucun rôle n’est associé au rang courant', () => {
    expect(computeRoleChanges(map, 'platinum', ['rG'])).toEqual({ add: [], remove: ['rG'] });
    expect(computeRoleChanges(map, null, ['rS'])).toEqual({ add: [], remove: ['rS'] });
  });
});
