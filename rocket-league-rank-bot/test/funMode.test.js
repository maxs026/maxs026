import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUN_TEMPLATES, buildMessage } from '../src/domain/messages.js';
import { applyReward, rewardLine, titleFor } from '../src/domain/rewards.js';
import { routeInteraction } from '../src/discord/router.js';
import { DEFAULT_DEMOTION_GIF, buildAnnouncement } from '../src/notifications/embed.js';
import { configureGuild, makeCtx, makeRepo, makeTransport } from './helpers.js';
import { IDS, PERM, makeEnv, opt, sentEmbeds, sentTexts, slash, textChannel } from './realInteraction.js';

const ZERO = { points: 0, promotions: 0, demotions: 0, streak: 0 };

describe('Points et séries', () => {
  it('première déclaration : bonus de bienvenue, sans série', () => {
    expect(applyReward('first', null, 'gold', ZERO)).toMatchObject({ delta: 5, points: 5, streak: 0 });
  });
  it('montée : +10 par rang gagné, bonus à partir de 3 montées d’affilée', () => {
    let s = applyReward('promotion', 'bronze', 'gold', ZERO); // 2 rangs
    expect(s).toMatchObject({ delta: 20, points: 20, streak: 1, promotions: 1 });
    s = applyReward('promotion', 'gold', 'platinum', s);
    expect(s).toMatchObject({ delta: 10, streak: 2 });
    s = applyReward('promotion', 'platinum', 'diamond', s);
    expect(s).toMatchObject({ delta: 15, points: 45, streak: 3 });
  });
  it('chute : −5 par rang perdu, la série repart dans l’autre sens', () => {
    let s = applyReward('promotion', 'silver', 'gold', ZERO);
    s = applyReward('demotion', 'gold', 'bronze', s);
    expect(s).toMatchObject({ delta: -10, points: 0, streak: -1, demotions: 1 });
    s = applyReward('demotion', 'bronze', 'bronze', { ...s, streak: -1 });
    expect(s.streak).toBe(-2);
  });
  it('« same » ne change rien', () => {
    expect(applyReward('same', 'gold', 'gold', { ...ZERO, points: 7, streak: 2 })).toMatchObject({ delta: 0, points: 7, streak: 2 });
  });
  it('textes de récompense et titres', () => {
    expect(rewardLine({ change_type: 'first', points_delta: 5, points_total: 5, streak: 0 })).toBe('+5 pts de bienvenue (total 5)');
    expect(rewardLine({ change_type: 'promotion', points_delta: 15, points_total: 45, streak: 3 })).toMatch(/\+15 pts \(total 45\) · 🔥 3 montées d’affilée \(bonus \+5\)/);
    expect(rewardLine({ change_type: 'demotion', points_delta: -5, points_total: 10, streak: -2 })).toBe('−5 pts (total 10) · 🤡 2 chutes d’affilée');
    expect(rewardLine({ change_type: 'promotion', points_delta: null })).toBeNull();
    expect(titleFor({ streak: 3 })).toMatch(/En feu/);
    expect(titleFor({ streak: -2 })).toMatch(/chute libre/);
    expect(titleFor({ streak: 1 })).toBe('');
  });
});

describe('Mode potes — service', () => {
  const funCtx = () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    ctx.repo.setGuildSetting('g1', 'fun_mode', 1);
    return ctx;
  };
  const record = (ctx, rank, over = {}) =>
    ctx.rankService.recordTrusted({ guildId: 'g1', userId: 'u1', playlist: '2v2', rank, reviewerId: 'u1', origin: 'auto', ...over });

  it('annonce tous les rangs et les chutes, mais respecte un rang désactivé explicitement', () => {
    const ctx = funCtx();
    expect(record(ctx, 'platinum').shouldNotify).toBe(true);
    const drop = record(ctx, 'bronze');
    expect(drop.changeType).toBe('demotion');
    expect(drop.shouldNotify).toBe(true);
    ctx.repo.setRankSetting('g1', 'diamond', 'notify', 0);
    expect(record(ctx, 'diamond').shouldNotify).toBe(false);
  });

  it('hors mode potes, une chute n’est toujours pas annoncée (mais compte dans les points)', () => {
    const ctx = makeCtx();
    record(ctx, 'gold');
    const drop = record(ctx, 'silver');
    expect(drop.shouldNotify).toBe(false);
    expect(ctx.repo.getMemberStats('g1', 'u1')).toMatchObject({ points: 0, demotions: 1, streak: -1 });
  });

  it('points enregistrés sur la demande et classement trié', () => {
    const ctx = funCtx();
    record(ctx, 'silver');
    const up = record(ctx, 'gold');
    expect(ctx.repo.getRequest(up.request.id)).toMatchObject({ points_delta: 10, points_total: 15, streak: 1 });
    record(ctx, 'diamond', { userId: 'u2' });
    expect(ctx.rankService.getLeaderboard('g1').map((r) => r.user_id)).toEqual(['u1', 'u2']);
  });
});

describe('Mode potes — annonces', () => {
  const req = (over) => ({ id: 7, user_id: '1', playlist: '2v2', rank: 'silver', previous_rank: 'gold', change_type: 'demotion', points_delta: -5, points_total: 10, streak: -1, ...over });

  it('une chute a son titre, son GIF (par défaut ou perso) et une sanction', () => {
    const json = buildAnnouncement(req(), { gif_url: 'https://x/silver.gif', message_template: null }, { fun_mode: 1 }).embeds[0].toJSON();
    expect(json.title).toMatch(/Chute libre/);
    expect(json.image.url).toBe(DEFAULT_DEMOTION_GIF);
    expect(json.fields.find((f) => f.name === 'Sanction').value).toMatch(/−5 pts/);
    const custom = buildAnnouncement(req(), { gif_url: null, message_template: null }, { fun_mode: 1, demotion_gif_url: 'https://x/chute.gif' });
    expect(custom.embeds[0].toJSON().image.url).toBe('https://x/chute.gif');
  });

  it('la phrase de chambrage dépend du numéro de demande (stable en cas de renvoi) et ignore le message perso', () => {
    const base = { changeType: 'demotion', userId: '1', rank: 'silver', previousRank: 'gold', playlist: '2v2', template: 'GG {membre}' };
    const a = buildMessage({ ...base, variant: 7 });
    expect(a).toBe(buildMessage({ ...base, variant: 7 }));
    expect(a).not.toMatch(/^GG/);
    const pool = FUN_TEMPLATES.demotion.map((t) => t.slice(0, 3));
    expect(pool).toContain(a.slice(0, 3));
    // Montée : le message personnalisé garde la priorité.
    expect(buildMessage({ ...base, changeType: 'promotion', variant: 7 })).toBe('GG <@1>');
  });

  it('hors mode potes, l’annonce classique ne change pas', () => {
    const json = buildAnnouncement(req({ change_type: 'promotion', rank: 'gold', previous_rank: 'silver', points_delta: null }), { gif_url: 'https://x/g.gif', message_template: null }).embeds[0].toJSON();
    expect(json.title).toBe('🏆 Promotion Rocket League');
    expect(json.image.url).toBe('https://x/g.gif');
    expect(json.description).toMatch(/^🚀 Félicitations/);
  });
});

describe('Mode potes — commandes (vrais objets discord.js)', () => {
  const CH_ANNOUNCE = '1000000000000000501';
  const MEMBER = { id: IDS.member, permissions: PERM.EVERYONE };
  const setup = () => {
    const env = makeEnv({ channels: [textChannel(CH_ANNOUNCE)] });
    const ctx = makeCtx({ transport: makeTransport() });
    ctx.repo.setGuildSetting(IDS.guild, 'announce_channel_id', CH_ANNOUNCE);
    ctx.repo.setGuildSetting(IDS.guild, 'fun_mode', 1);
    return { env, ctx };
  };
  const declare = async (env, ctx, rank) => {
    const i = slash(env.client, { name: 'rang', sub: 'declarer', member: MEMBER, options: [opt.string('playlist', '2v2'), opt.string('rang', rank)] });
    await routeInteraction(i, ctx);
  };

  it('/rang declarer enregistre tout de suite, sans salon de validation, et annonce montée puis chute', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    await declare(env, ctx, 'bronze');
    expect(ctx.repo.getValidatedRank(IDS.guild, IDS.member, '2v2').rank).toBe('bronze');
    const announced = ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE);
    expect(announced).toHaveLength(2);
    expect(announced[1].payload.embeds[0].toJSON().title).toMatch(/Chute libre/);
    const texts = sentTexts(env.calls).join('\n');
    expect(texts).toMatch(/✅ \*\*Gold\*\* en \*\*Double 2v2\*\* enregistré \(première déclaration\)/);
    expect(texts).toMatch(/rétrogradation/);
    expect(texts).not.toMatch(/inattendue/);
  });

  it('/rang declarer refuse un rang identique au rang actuel', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    await declare(env, ctx, 'gold');
    expect(sentTexts(env.calls).join()).toMatch(/déjà validé/);
    expect(ctx.transport.sent).toHaveLength(1);
  });

  it('/rang classement affiche les points', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'silver');
    await declare(env, ctx, 'gold');
    await routeInteraction(slash(env.client, { name: 'rang', sub: 'classement', member: MEMBER }), ctx);
    const embed = sentEmbeds(env.calls).find((e) => /Classement/.test(e.title));
    expect(embed.description).toMatch(new RegExp(`🥇 <@${IDS.member}> — \\*\\*15 pts\\*\\* · ⬆️ 1 · ⬇️ 0`));
  });
});

describe('Migration d’une base existante', () => {
  it('ajoute les nouvelles colonnes sans perdre la configuration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rlbot-mig-'));
    const path = join(dir, 'bot.sqlite');
    try {
      const old = new Database(path);
      old.exec(`CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY, announce_channel_id TEXT, review_channel_id TEXT,
        moderator_role_id TEXT, roles_enabled INTEGER NOT NULL DEFAULT 0);
        INSERT INTO guild_settings (guild_id, announce_channel_id) VALUES ('g1', 'chan-a');`);
      old.close();
      const repo = makeRepo(path);
      expect(repo.getGuildSettings('g1')).toMatchObject({ announce_channel_id: 'chan-a', fun_mode: 0, demotion_gif_url: null });
      repo.setGuildSetting('g1', 'fun_mode', 1);
      repo.db.close();
      const again = makeRepo(path); // deuxième ouverture : migration sans effet
      expect(again.getGuildSettings('g1').fun_mode).toBe(1);
      again.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
