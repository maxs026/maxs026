import { describe, expect, it } from 'vitest';
import { recapSlot, summarizeWeek } from '../src/domain/recap.js';
import { routeInteraction } from '../src/discord/router.js';
import { REACTIONS } from '../src/notifications/notifier.js';
import { WeeklyRecap, buildRecap } from '../src/notifications/recap.js';
import { configureGuild, makeCtx, makeTransport, silentLogger } from './helpers.js';
import { IDS, PERM, makeEnv, opt, sentEmbeds, sentTexts, slash, textChannel } from './realInteraction.js';

// 25/10/2026 : passage à l'heure d'hiver (Paris = UTC+1 le soir).
const SUN_1959 = Date.UTC(2026, 9, 25, 18, 59);
const SUN_2000 = Date.UTC(2026, 9, 25, 19, 0);
const MON = Date.UTC(2026, 9, 26, 21, 0);
const TUE = Date.UTC(2026, 9, 27, 9, 0);

describe('Créneau du récap (heure de Paris)', () => {
  it('dimanche 20 h jusqu’au lundi soir, clé = date du dimanche', () => {
    expect(recapSlot(SUN_1959)).toBeNull();
    expect(recapSlot(SUN_2000)).toBe('2026-10-25');
    expect(recapSlot(MON)).toBe('2026-10-25');
    expect(recapSlot(TUE)).toBeNull();
  });
  it('respecte l’heure d’été', () => {
    expect(recapSlot(Date.UTC(2026, 6, 5, 17, 59))).toBeNull(); // 19 h 59 à Paris
    expect(recapSlot(Date.UTC(2026, 6, 5, 18, 0))).toBe('2026-07-05');
  });
});

describe('Résumé de la semaine', () => {
  it('grimpeur, clown et plus longue série', () => {
    const s = summarizeWeek(
      [
        { user_id: 'a', change_type: 'promotion', points_delta: 10 },
        { user_id: 'a', change_type: 'promotion', points_delta: 20 },
        { user_id: 'b', change_type: 'promotion', points_delta: 10 },
        { user_id: 'b', change_type: 'demotion', points_delta: -5 },
        { user_id: 'c', change_type: 'demotion', points_delta: -10 },
        { user_id: 'c', change_type: 'demotion', points_delta: -5 },
        { user_id: 'd', change_type: 'first', points_delta: 5 },
      ],
      [{ user_id: 'a', streak: 2 }, { user_id: 'e', streak: 4 }, { user_id: 'c', streak: -2 }],
    );
    expect(s.climber).toMatchObject({ user_id: 'a', points: 30, promotions: 2 });
    expect(s.clown).toMatchObject({ user_id: 'c', demotions: 2 });
    expect(s.hot).toMatchObject({ user_id: 'e', streak: 4 });
    expect(s.totals).toEqual({ changes: 7, promotions: 3, demotions: 3 });
    const text = buildRecap(s).toJSON().description;
    expect(text).toMatch(/Grimpeur de la semaine\*\* : <@a> \(2 montées, \+30 pts\)/);
    expect(text).toMatch(/Clown de la semaine\*\* : <@c> \(2 chutes\)/);
    expect(text).toMatch(/<@e>, 4 montées d’affilée/);
  });
  it('semaine calme : pas de récap', () => {
    expect(buildRecap(summarizeWeek([], []))).toBeNull();
  });
});

describe('Envoi automatique du récap', () => {
  const setup = (now) => {
    const ctx = makeCtx({ now: () => now.value });
    configureGuild(ctx.repo);
    ctx.repo.setGuildSetting('g1', 'fun_mode', 1);
    const recap = new WeeklyRecap({ repo: ctx.repo, transport: ctx.transport, logger: silentLogger, now: () => now.value });
    const record = (rank, userId = 'u1') =>
      ctx.rankService.recordTrusted({ guildId: 'g1', userId, playlist: '2v2', rank, reviewerId: userId, origin: 'auto' });
    return { ctx, recap, record };
  };

  it('un seul récap par semaine, même après plusieurs passages', async () => {
    const now = { value: SUN_2000 - 3600 * 1000 };
    const { ctx, recap, record } = setup(now);
    record('silver');
    record('gold');
    expect(await recap.tick()).toEqual([]); // avant 20 h
    now.value = SUN_2000;
    expect(await recap.tick()).toEqual(['g1']);
    now.value = MON;
    expect(await recap.tick()).toEqual([]);
    const recaps = ctx.transport.sent.filter((s) => /Récap/.test(s.payload.embeds?.[0]?.toJSON().title ?? ''));
    expect(recaps).toHaveLength(1);
    expect(recaps[0].channelId).toBe('chan-announce');
    expect(recaps[0].payload.allowedMentions).toEqual({ parse: [] });
  });

  it('rien hors mode potes, rien pour une semaine calme', async () => {
    const now = { value: SUN_2000 };
    const { ctx, recap, record } = setup(now);
    expect(await recap.tick()).toEqual([]); // aucune activité
    ctx.repo.setGuildSetting('g1', 'fun_mode', 0);
    ctx.repo.setGuildSetting('g1', 'last_recap_key', null);
    record('gold');
    expect(await recap.tick()).toEqual([]);
    expect(ctx.transport.sent.filter((s) => !s.payload.content)).toHaveLength(0);
  });

  it('un échec d’envoi est retenté au passage suivant', async () => {
    const now = { value: SUN_2000 };
    const { ctx, recap, record } = setup(now);
    record('gold');
    await ctx.notifier.dispatchPending();
    ctx.transport.failNext = 1;
    expect(await recap.tick()).toEqual([]);
    expect(await recap.tick()).toEqual(['g1']);
  });
});

describe('Réactions sous les annonces', () => {
  const approved = (ctx, fun) => {
    configureGuild(ctx.repo);
    ctx.repo.setGuildSetting('g1', 'fun_mode', fun ? 1 : 0);
    return ctx.rankService.recordTrusted({ guildId: 'g1', userId: 'u1', playlist: '2v2', rank: 'gold', reviewerId: 'm', origin: 'auto' }).request.id;
  };

  it('mode potes : réactions de départ sur le message envoyé', async () => {
    const ctx = makeCtx();
    const id = approved(ctx, true);
    expect(await ctx.notifier.deliver(id)).toBe('sent');
    expect(ctx.transport.reactions).toEqual([{ channelId: 'chan-announce', messageId: 'msg-1', emojis: REACTIONS.first }]);
  });

  it('une réaction impossible ne remet pas l’annonce en échec', async () => {
    const ctx = makeCtx({ transport: Object.assign(makeTransport(), { failReact: true }) });
    const id = approved(ctx, true);
    expect(await ctx.notifier.deliver(id)).toBe('sent');
    expect(ctx.repo.getRequest(id).notify_state).toBe('sent');
  });

  it('hors mode potes : aucune réaction', async () => {
    const ctx = makeCtx();
    const id = approved(ctx, false);
    await ctx.notifier.deliver(id);
    expect(ctx.transport.reactions).toEqual([]);
  });
});

describe('/rang recap (aperçu privé, vrais objets discord.js)', () => {
  it('montre le récap des 7 derniers jours sans rien publier', async () => {
    const env = makeEnv({ channels: [textChannel('1000000000000000501')] });
    const ctx = makeCtx({ transport: makeTransport() });
    ctx.repo.setGuildSetting(IDS.guild, 'announce_channel_id', '1000000000000000501');
    ctx.repo.setGuildSetting(IDS.guild, 'fun_mode', 1);
    const member = { id: IDS.member, permissions: PERM.EVERYONE };
    for (const rank of ['silver', 'gold']) {
      await routeInteraction(slash(env.client, { name: 'rang', sub: 'declarer', member, options: [opt.string('playlist', '2v2'), opt.string('rang', rank)] }), ctx);
    }
    const sentBefore = ctx.transport.sent.length;
    await routeInteraction(slash(env.client, { name: 'rang', sub: 'recap', member }), ctx);
    expect(ctx.transport.sent.length).toBe(sentBefore);
    const embed = sentEmbeds(env.calls).find((e) => /Récap/.test(e.title));
    expect(embed.description).toMatch(new RegExp(`Grimpeur de la semaine\\*\\* : <@${IDS.member}>`));
    expect(sentTexts(env.calls).join()).toMatch(/dimanche à 20 h/);
  });
});
