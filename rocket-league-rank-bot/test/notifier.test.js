import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Notifier } from '../src/notifications/notifier.js';
import { RankService } from '../src/services/rankService.js';
import { footerMarker } from '../src/notifications/embed.js';
import { configureGuild, makeCtx, makeRepo, makeTransport, silentLogger } from './helpers.js';

function approvedRequest(ctx, over = {}) {
  const req = ctx.rankService.submitDeclaration({ guildId: 'g1', userId: 'u1', playlist: '3v3', rank: 'gold', ...over });
  return ctx.rankService.approve(req.id, 'mod').request.id;
}

describe('Notifier', () => {
  it('envoie une annonce unique par validation', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const id = approvedRequest(ctx);
    expect(await ctx.notifier.deliver(id)).toBe('sent');
    expect(await ctx.notifier.deliver(id)).toBe('skipped');
    await ctx.notifier.dispatchPending();
    expect(ctx.transport.sent).toHaveLength(1);
    expect(ctx.repo.getRequest(id).notify_state).toBe('sent');
  });

  it('une livraison concurrente (double clic) ne produit qu’un message', async () => {
    const ctx = makeCtx();
    ctx.transport.delay = 10;
    configureGuild(ctx.repo);
    const id = approvedRequest(ctx);
    await Promise.all([ctx.notifier.deliver(id), ctx.notifier.deliver(id), ctx.notifier.dispatchPending()]);
    expect(ctx.transport.sent).toHaveLength(1);
  });

  it('réessaie après un échec puis abandonne après le nombre max de tentatives', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    ctx.transport.failNext = 1;
    const id = approvedRequest(ctx);
    expect(await ctx.notifier.deliver(id)).toBe('retry');
    expect(await ctx.notifier.deliver(id)).toBe('sent');
    expect(ctx.transport.sent).toHaveLength(1);

    const ctx2 = makeCtx();
    configureGuild(ctx2.repo);
    ctx2.transport.failNext = 99;
    const id2 = approvedRequest(ctx2);
    expect(await ctx2.notifier.deliver(id2)).toBe('retry');
    expect(await ctx2.notifier.deliver(id2)).toBe('retry');
    expect(await ctx2.notifier.deliver(id2)).toBe('failed');
    expect(await ctx2.notifier.deliver(id2)).toBe('skipped');
  });

  it('échoue proprement si aucun salon d’annonces n’est configuré', async () => {
    const ctx = makeCtx();
    const id = approvedRequest(ctx);
    expect(await ctx.notifier.deliver(id)).toBe('retry');
    expect(ctx.transport.sent).toHaveLength(0);
  });

  it('survit à un redémarrage : annonce en attente envoyée une seule fois', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rlbot-'));
    const path = join(dir, 'bot.sqlite');
    try {
      let repo = makeRepo(path);
      configureGuild(repo);
      const svc = new RankService(repo);
      const req = svc.submitDeclaration({ guildId: 'g1', userId: 'u1', playlist: '3v3', rank: 'gold' });
      svc.approve(req.id, 'mod');
      repo.db.close(); // arrêt avant l'envoi

      repo = makeRepo(path);
      const transport = makeTransport();
      const notifier = new Notifier({ repo, transport, logger: silentLogger });
      await notifier.recover();
      expect(transport.sent).toHaveLength(1);
      expect(repo.getValidatedRank('g1', 'u1', '3v3').rank).toBe('gold');
      repo.db.close();

      repo = makeRepo(path); // second redémarrage
      const transport2 = makeTransport();
      await new Notifier({ repo, transport: transport2, logger: silentLogger }).recover();
      expect(transport2.sent).toHaveLength(0);
      repo.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('après un crash pendant l’envoi, ne renvoie pas si l’annonce existe déjà dans le salon', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const id = approvedRequest(ctx);
    ctx.repo.claimNotification(id); // état « sending » laissé par un crash
    ctx.transport.markers.set(`chan-announce:${footerMarker(id)}`, 'msg-existant');
    await ctx.notifier.recover();
    expect(ctx.transport.sent).toHaveLength(0);
    expect(ctx.repo.getRequest(id)).toMatchObject({ notify_state: 'sent', notify_message_id: 'msg-existant' });
  });

  it('après un crash pendant l’envoi, renvoie si aucune annonce n’existe', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const id = approvedRequest(ctx);
    ctx.repo.claimNotification(id);
    await ctx.notifier.recover();
    expect(ctx.transport.sent).toHaveLength(1);
  });

  it('n’envoie rien pour un rang non annoncé ou une rétrogradation', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    approvedRequest(ctx, { rank: 'platinum' });
    approvedRequest(ctx, { userId: 'u2', rank: 'gold' });
    approvedRequest(ctx, { userId: 'u2', rank: 'silver' }); // rétrogradation
    await ctx.notifier.dispatchPending();
    expect(ctx.transport.sent).toHaveLength(1); // seul le Gold de u2
  });
});
