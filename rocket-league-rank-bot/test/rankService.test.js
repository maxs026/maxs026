import { describe, expect, it } from 'vitest';
import { RankError } from '../src/services/rankService.js';
import { makeCtx } from './helpers.js';

const declare = (svc, over = {}) =>
  svc.submitDeclaration({ guildId: 'g1', userId: 'u1', playlist: '3v3', rank: 'silver', ...over });

describe('RankService', () => {
  it('première déclaration puis promotion sont distinguées', () => {
    const { rankService: svc } = makeCtx();
    const r1 = svc.approve(declare(svc).id, 'mod');
    expect(r1.changeType).toBe('first');
    expect(r1.previousRank).toBeNull();
    const r2 = svc.approve(declare(svc, { rank: 'gold' }).id, 'mod');
    expect(r2.changeType).toBe('promotion');
    expect(r2.previousRank).toBe('silver');
  });

  it('enregistre une rétrogradation sans l’annoncer', () => {
    const { rankService: svc, repo } = makeCtx();
    svc.approve(declare(svc, { rank: 'gold' }).id, 'mod');
    const res = svc.approve(declare(svc, { rank: 'silver' }).id, 'mod');
    expect(res.changeType).toBe('demotion');
    expect(res.shouldNotify).toBe(false);
    expect(repo.getValidatedRank('g1', 'u1', '3v3').rank).toBe('silver');
    expect(repo.getRequest(res.request.id).notify_state).toBe('none');
  });

  it('compare par membre ET par playlist', () => {
    const { rankService: svc } = makeCtx();
    svc.approve(declare(svc, { rank: 'gold', playlist: '3v3' }).id, 'mod');
    const other = svc.approve(declare(svc, { rank: 'silver', playlist: '2v2' }).id, 'mod');
    expect(other.changeType).toBe('first'); // pas une rétrogradation par rapport au 3v3
    const otherUser = svc.approve(declare(svc, { userId: 'u2', rank: 'silver' }).id, 'mod');
    expect(otherUser.changeType).toBe('first');
  });

  it('n’annonce par défaut que Silver et Gold', () => {
    const { rankService: svc } = makeCtx();
    const silver = svc.approve(declare(svc, { rank: 'silver' }).id, 'mod');
    const plat = svc.approve(declare(svc, { rank: 'platinum', playlist: '2v2' }).id, 'mod');
    expect(silver.shouldNotify).toBe(true);
    expect(plat.shouldNotify).toBe(false);
  });

  it('respecte la configuration des rangs annoncés', () => {
    const { rankService: svc, repo } = makeCtx();
    repo.setRankSetting('g1', 'platinum', 'notify', 1);
    repo.setRankSetting('g1', 'gold', 'notify', 0);
    expect(svc.approve(declare(svc, { rank: 'platinum' }).id, 'mod').shouldNotify).toBe(true);
    expect(svc.approve(declare(svc, { rank: 'gold', playlist: '2v2' }).id, 'mod').shouldNotify).toBe(false);
  });

  it('une seconde validation de la même demande est sans effet', () => {
    const { rankService: svc, repo } = makeCtx();
    const id = declare(svc).id;
    const first = svc.approve(id, 'mod1');
    const second = svc.approve(id, 'mod2');
    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);
    expect(repo.getRequest(id).reviewer_id).toBe('mod1');
    expect(repo.listNotifications('pending')).toHaveLength(1);
  });

  it('valider puis refuser (ou l’inverse) ne s’applique qu’une fois', () => {
    const { rankService: svc } = makeCtx();
    const id = declare(svc).id;
    expect(svc.reject(id, 'mod').alreadyProcessed).toBe(false);
    expect(svc.approve(id, 'mod').alreadyProcessed).toBe(true);
    expect(svc.getValidatedRanks('g1', 'u1')).toHaveLength(0);
  });

  it('refuse les doublons et rangs identiques', () => {
    const { rankService: svc } = makeCtx();
    declare(svc);
    expect(() => declare(svc, { rank: 'gold' })).toThrow(expect.objectContaining({ code: 'already_pending' }));
    const { rankService: svc2 } = makeCtx();
    svc2.approve(declare(svc2).id, 'mod');
    expect(() => declare(svc2)).toThrow(expect.objectContaining({ code: 'already_validated' }));
  });

  it('rejette playlist ou rang invalides', () => {
    const { rankService: svc } = makeCtx();
    expect(() => declare(svc, { rank: 'cuivre' })).toThrow(RankError);
    expect(() => declare(svc, { playlist: '5v5' })).toThrow(RankError);
  });

  it('une saisie de confiance remplace la demande en attente', () => {
    const { rankService: svc, repo } = makeCtx();
    const pending = declare(svc, { rank: 'gold' });
    const res = svc.recordTrusted({ guildId: 'g1', userId: 'u1', playlist: '3v3', rank: 'silver', reviewerId: 'admin' });
    expect(res.changeType).toBe('first');
    expect(repo.getRequest(pending.id).status).toBe('rejected');
    expect(repo.getValidatedRank('g1', 'u1', '3v3').rank).toBe('silver');
  });

  it('calcule le meilleur rang toutes playlists confondues', () => {
    const { rankService: svc } = makeCtx();
    svc.approve(declare(svc, { rank: 'silver', playlist: '1v1' }).id, 'mod');
    svc.approve(declare(svc, { rank: 'platinum', playlist: '2v2' }).id, 'mod');
    expect(svc.getHighestRank('g1', 'u1')).toBe('platinum');
  });
});
