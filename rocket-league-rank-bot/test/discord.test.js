import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { commandsJson } from '../src/discord/commands/index.js';
import * as configCmd from '../src/discord/commands/config.js';
import * as rangCmd from '../src/discord/commands/rang.js';
import * as rangDefinir from '../src/discord/commands/rang-definir.js';
import { handleReviewButton } from '../src/discord/interactions/reviewButtons.js';
import { syncMemberRoles } from '../src/discord/roleSync.js';
import { buildAnnouncement } from '../src/notifications/embed.js';
import { configureGuild, fakeButton, makeCtx } from './helpers.js';

const pendingRequest = (ctx, over = {}) =>
  ctx.rankService.submitDeclaration({ guildId: 'g1', userId: 'member', playlist: '3v3', rank: 'gold', ...over });

describe('embed d’annonce', () => {
  const request = { id: 7, user_id: '42', playlist: '3v3', rank: 'gold', previous_rank: 'silver', change_type: 'promotion', reviewed_at: 1 };
  it('mentionne le membre, affiche rang, playlist et GIF configuré', () => {
    const p = buildAnnouncement(request, { gif_url: 'https://x.test/a.gif', message_template: null });
    const e = p.embeds[0].toJSON();
    expect(p.content).toBe('<@42>');
    expect(e.description).toContain('<@42>');
    expect(e.fields.map((f) => f.value)).toEqual(expect.arrayContaining(['Gold', 'Standard 3v3', 'Silver', 'Promotion']));
    expect(e.image.url).toBe('https://x.test/a.gif');
    expect(e.footer.text).toBe('Demande #7');
  });
  it('omet le GIF si non configuré et n’autorise que la mention du membre', () => {
    const p = buildAnnouncement(request, { gif_url: null, message_template: 'Yo {membre} @everyone' });
    expect(p.embeds[0].toJSON().image).toBeUndefined();
    expect(p.allowedMentions).toEqual({ parse: [], users: ['42'] });
  });
  it('distingue visuellement première déclaration et promotion', () => {
    const first = buildAnnouncement({ ...request, change_type: 'first', previous_rank: null }, { gif_url: null }).embeds[0].toJSON();
    const promo = buildAnnouncement(request, { gif_url: null }).embeds[0].toJSON();
    expect(first.title).not.toBe(promo.title);
    expect(first.fields.some((f) => f.name === 'Ancien rang')).toBe(false);
  });
});

describe('boutons de validation', () => {
  const click = (ctx, id, who) =>
    handleReviewButton(fakeButton({ customId: `rank:approve:${id}`, ...who }), ctx);

  it('un modérateur valide : une mise à jour et une seule annonce', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    ctx.repo.setGuildSetting('g1', 'moderator_role_id', 'modrole');
    const { id } = pendingRequest(ctx);
    const i = fakeButton({ customId: `rank:approve:${id}`, userId: 'mod', roles: ['modrole'] });
    await handleReviewButton(i, ctx);
    expect(i.calls.updates).toHaveLength(1);
    expect(ctx.transport.sent).toHaveLength(1);
    expect(ctx.repo.getValidatedRank('g1', 'member', '3v3').rank).toBe('gold');
  });

  it('double clic (deux modérateurs en même temps) : une seule annonce', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const { id } = pendingRequest(ctx);
    const a = fakeButton({ customId: `rank:approve:${id}`, userId: 'admin1', admin: true });
    const b = fakeButton({ customId: `rank:approve:${id}`, userId: 'admin2', admin: true });
    await Promise.all([handleReviewButton(a, ctx), handleReviewButton(b, ctx)]);
    expect(ctx.transport.sent).toHaveLength(1);
    expect(a.calls.updates.length + b.calls.updates.length).toBe(1);
    const loser = a.calls.updates.length ? b : a;
    expect(loser.calls.replies[0].content).toMatch(/déjà été traitée/);
  });

  it('refuse un membre sans droits et ne change rien', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const { id } = pendingRequest(ctx);
    const i = fakeButton({ customId: `rank:approve:${id}`, userId: 'intrus' });
    await handleReviewButton(i, ctx);
    expect(i.calls.replies[0].content).toMatch(/modérateurs/);
    expect(ctx.repo.getRequest(id).status).toBe('pending');
    expect(ctx.transport.sent).toHaveLength(0);
  });

  it('un modérateur ne valide pas sa propre demande, un administrateur le peut', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const { id } = pendingRequest(ctx, { userId: 'mod' });
    const modClick = fakeButton({ customId: `rank:approve:${id}`, userId: 'mod', manage: true });
    await handleReviewButton(modClick, ctx);
    expect(modClick.calls.replies[0].content).toMatch(/propre demande/);
    const admin = fakeButton({ customId: `rank:approve:${id}`, userId: 'mod', admin: true });
    await handleReviewButton(admin, ctx);
    expect(ctx.repo.getRequest(id).status).toBe('approved');
  });

  it('refuser ne notifie pas et ne crée aucun rang', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const { id } = pendingRequest(ctx);
    const i = fakeButton({ customId: `rank:reject:${id}`, userId: 'adm', admin: true });
    await handleReviewButton(i, ctx);
    expect(i.calls.updates).toHaveLength(1);
    expect(ctx.transport.sent).toHaveLength(0);
    expect(ctx.rankService.getValidatedRanks('g1', 'member')).toHaveLength(0);
  });

  it('ignore une demande d’un autre serveur ou inconnue', async () => {
    const ctx = makeCtx();
    const { id } = pendingRequest(ctx);
    const other = fakeButton({ customId: `rank:approve:${id}`, userId: 'a', admin: true, guildId: 'autre' });
    await handleReviewButton(other, ctx);
    expect(other.calls.replies[0].content).toMatch(/introuvable/);
    const unknown = fakeButton({ customId: 'rank:approve:9999', userId: 'a', admin: true });
    await handleReviewButton(unknown, ctx);
    expect(unknown.calls.replies[0].content).toMatch(/introuvable/);
  });

  it('un bouton cliqué après redémarrage fonctionne (état en base)', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const { id } = pendingRequest(ctx);
    const ctx2 = makeCtx({ repo: ctx.repo }); // nouveaux services, même base
    await click(ctx2, id, { userId: 'adm', admin: true });
    expect(ctx2.transport.sent).toHaveLength(1);
  });
});

describe('commandes slash', () => {
  const json = commandsJson();
  it('sont valides et uniques', () => {
    const names = json.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(['lier', 'rang', 'rang-definir', 'config']);
    for (const c of json) expect(c.description.length).toBeLessThanOrEqual(100);
  });
  it('config et rang-definir exigent « Gérer le serveur » par défaut', () => {
    const need = String(PermissionFlagsBits.ManageGuild);
    expect(json.find((c) => c.name === 'config').default_member_permissions).toBe(need);
    expect(json.find((c) => c.name === 'rang-definir').default_member_permissions).toBe(need);
    expect(json.find((c) => c.name === 'rang').default_member_permissions ?? null).toBeNull();
  });
  it('sont limitées aux serveurs (pas de MP)', () => {
    for (const c of json) expect(c.contexts).toEqual([0]);
  });
  it('proposent tous les rangs et playlists en choix', () => {
    const declarer = json.find((c) => c.name === 'rang').options.find((o) => o.name === 'declarer');
    expect(declarer.options.find((o) => o.name === 'rang').choices).toHaveLength(8);
    expect(declarer.options.find((o) => o.name === 'playlist').choices).toHaveLength(7);
  });

  function fakeCommand({ sub, opts = {}, userId = 'member', admin = false, manage = false, guild }) {
    const out = { replies: [], edits: [] };
    return {
      out,
      guildId: 'g1',
      guild,
      user: { id: userId, username: 'x' },
      member: { roles: [] },
      memberPermissions: { has: (b) => (b === PermissionFlagsBits.Administrator ? admin : b === PermissionFlagsBits.ManageGuild ? manage : false) },
      options: {
        getSubcommand: () => sub,
        getString: (n) => opts[n] ?? null,
        getBoolean: (n) => opts[n] ?? null,
        getAttachment: (n) => opts[n] ?? null,
        getUser: (n) => opts[n] ?? null,
        getChannel: (n) => opts[n] ?? null,
        getRole: (n) => opts[n] ?? null,
      },
      reply: async (p) => out.replies.push(p),
      deferReply: async () => {},
      editReply: async (p) => out.edits.push(p),
    };
  }

  it('/rang declarer refuse tant que le salon de validation n’est pas configuré', async () => {
    const ctx = makeCtx();
    const i = fakeCommand({ sub: 'declarer', opts: { playlist: '3v3', rang: 'gold' } });
    await rangCmd.execute(i, ctx);
    expect(i.out.replies[0].content).toMatch(/canal-validation/);
    expect(ctx.repo.findPendingRequest('g1', 'member', '3v3')).toBeUndefined();
  });

  it('/rang declarer crée la demande et poste le message de validation avec boutons', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const i = fakeCommand({ sub: 'declarer', opts: { playlist: '3v3', rang: 'gold' } });
    await rangCmd.execute(i, ctx);
    expect(ctx.transport.sent).toHaveLength(1);
    expect(ctx.transport.sent[0].channelId).toBe('chan-review');
    expect(ctx.transport.sent[0].payload.components).toHaveLength(1);
    expect(i.out.edits[0]).toMatch(/Demande n°/);
  });

  it('/rang declarer refuse une pièce jointe qui n’est pas une image', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const i = fakeCommand({ sub: 'declarer', opts: { playlist: '3v3', rang: 'gold', capture: { contentType: 'application/pdf', size: 10, url: 'https://x' } } });
    await rangCmd.execute(i, ctx);
    expect(i.out.replies[0].content).toMatch(/PNG, JPEG ou WebP/);
    expect(ctx.transport.sent).toHaveLength(0);
  });

  it('/rang declarer annule la demande si le salon de validation est injoignable', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    ctx.transport.failNext = 1;
    const i = fakeCommand({ sub: 'declarer', opts: { playlist: '3v3', rang: 'gold' } });
    await rangCmd.execute(i, ctx);
    expect(i.out.edits[0]).toMatch(/Impossible de transmettre/);
    expect(ctx.repo.findPendingRequest('g1', 'member', '3v3')).toBeUndefined();
  });

  it('/rang voir affiche le rang validé par playlist', async () => {
    const ctx = makeCtx();
    ctx.rankService.recordTrusted({ guildId: 'g1', userId: 'member', playlist: '3v3', rank: 'gold', reviewerId: 'a' });
    const i = fakeCommand({ sub: 'voir', opts: {} });
    await rangCmd.execute(i, ctx);
    expect(i.out.replies[0].embeds[0].toJSON().description).toContain('Standard 3v3** : Gold');
    const empty = fakeCommand({ sub: 'voir', opts: { membre: { id: 'inconnu', username: 'z' } } });
    await rangCmd.execute(empty, ctx);
    expect(empty.out.replies[0].embeds[0].toJSON().description).toMatch(/Aucun rang validé/);
  });

  it('/config refuse un non-administrateur, même avec le rôle modérateur', async () => {
    const ctx = makeCtx();
    ctx.repo.setGuildSetting('g1', 'moderator_role_id', 'mod');
    const i = fakeCommand({ sub: 'roles-actifs', opts: { actif: true } });
    i.member = { roles: ['mod'] };
    await configCmd.execute(i, ctx);
    expect(i.out.replies[0].content).toMatch(/administrateurs/);
    expect(ctx.repo.getGuildSettings('g1').roles_enabled).toBe(0);
  });

  it('/rang-definir : réservé aux modérateurs, applique la même détection de changement', async () => {
    const ctx = makeCtx();
    configureGuild(ctx.repo);
    const target = { id: 'cible', bot: false };
    const denied = fakeCommand({ sub: null, opts: { membre: target, playlist: '3v3', rang: 'gold' } });
    await rangDefinir.execute(denied, ctx);
    expect(denied.out.replies[0].content).toMatch(/modérateurs/);

    const run = () => {
      const i = fakeCommand({ sub: null, opts: { membre: target, playlist: '3v3', rang: 'gold' }, manage: true, userId: 'mod', guild: { id: 'g1' } });
      return rangDefinir.execute(i, ctx).then(() => i);
    };
    const ok = await run();
    expect(ok.out.edits[0].content).toMatch(/première déclaration/);
    expect(ctx.transport.sent).toHaveLength(1);
    const again = await run();
    expect(again.out.edits[0].content).toMatch(/aucun changement/);
    expect(ctx.transport.sent).toHaveLength(1);

    const self = fakeCommand({ sub: null, opts: { membre: { id: 'mod', bot: false }, playlist: '3v3', rang: 'gold' }, manage: true, userId: 'mod' });
    await rangDefinir.execute(self, ctx);
    expect(self.out.replies[0].content).toMatch(/propre rang/);
  });
});

describe('synchronisation des rôles', () => {
  function fakeGuild({ position = 10, rolePositions = { rS: 1, rG: 2 }, current = ['rS'], manage = true } = {}) {
    const calls = { added: [], removed: [] };
    const roles = new Map(Object.entries(rolePositions).map(([id, pos]) => [id, { id, position: pos, managed: false }]));
    const member = {
      roles: {
        cache: new Map(current.map((id) => [id, {}])),
        add: async (r) => calls.added.push(r.id),
        remove: async (r) => calls.removed.push(r.id),
      },
    };
    return {
      calls,
      guild: {
        id: 'g1',
        roles: { cache: roles, fetch: async () => null },
        members: {
          me: { permissions: { has: () => manage }, roles: { highest: { position } } },
          fetch: async () => member,
        },
      },
    };
  }
  const setup = () => {
    const ctx = makeCtx();
    ctx.repo.setGuildSetting('g1', 'roles_enabled', 1);
    ctx.repo.setRankSetting('g1', 'silver', 'role_id', 'rS');
    ctx.repo.setRankSetting('g1', 'gold', 'role_id', 'rG');
    ctx.rankService.recordTrusted({ guildId: 'g1', userId: 'u', playlist: '3v3', rank: 'gold', reviewerId: 'a' });
    return ctx;
  };

  it('ne fait rien si la fonction est désactivée', async () => {
    const ctx = setup();
    ctx.repo.setGuildSetting('g1', 'roles_enabled', 0);
    const { guild, calls } = fakeGuild();
    expect(await syncMemberRoles(guild, 'u', ctx)).toEqual([]);
    expect(calls.added).toEqual([]);
  });
  it('attribue le rôle du meilleur rang et retire l’ancien', async () => {
    const ctx = setup();
    const { guild, calls } = fakeGuild();
    expect(await syncMemberRoles(guild, 'u', ctx)).toEqual([]);
    expect(calls.added).toEqual(['rG']);
    expect(calls.removed).toEqual(['rS']);
  });
  it('resynchronise aussi quand le rang est inchangé (réparation)', async () => {
    const ctx = setup();
    const again = ctx.rankService.recordTrusted({ guildId: 'g1', userId: 'u', playlist: '3v3', rank: 'gold', reviewerId: 'a' });
    expect(again.changeType).toBe('same');
    const { guild, calls } = fakeGuild();
    guild.id = 'g1';
    const { afterApproval } = await import('../src/discord/postApproval.js');
    await afterApproval(guild, again, ctx);
    expect(calls.added).toEqual(['rG']);
  });
  it('signale un rôle placé au-dessus du bot sans lever d’erreur', async () => {
    const ctx = setup();
    const { guild, calls } = fakeGuild({ position: 1 });
    const warnings = await syncMemberRoles(guild, 'u', ctx);
    expect(warnings.join()).toMatch(/au-dessus/);
    expect(calls.added).toEqual([]);
  });
  it('signale l’absence de la permission Gérer les rôles', async () => {
    const ctx = setup();
    const { guild } = fakeGuild({ manage: false });
    expect((await syncMemberRoles(guild, 'u', ctx))[0]).toMatch(/Gérer les rôles/);
  });
});

describe('configuration d’environnement', () => {
  const valid = { DISCORD_TOKEN: 'abc', DISCORD_CLIENT_ID: '123456789012345678' };
  it('accepte une configuration minimale et applique les valeurs par défaut', () => {
    const c = loadConfig(valid);
    expect(c.DATABASE_PATH).toMatch(/data[\\/]bot\.sqlite$/);
    expect(c.LOG_LEVEL).toBe('info');
    expect(c.DISCORD_GUILD_ID).toBeUndefined();
    expect(loadConfig({ ...valid, DISCORD_GUILD_ID: '' }).DISCORD_GUILD_ID).toBeUndefined();
  });
  it('refuse une configuration invalide sans afficher le token', () => {
    expect(() => loadConfig({ DISCORD_TOKEN: 'secret-token-xyz', DISCORD_CLIENT_ID: 'pas-un-id' })).toThrow(/DISCORD_CLIENT_ID/);
    try {
      loadConfig({ DISCORD_TOKEN: 'secret-token-xyz', DISCORD_CLIENT_ID: 'pas-un-id' });
    } catch (e) {
      expect(e.message).not.toContain('secret-token-xyz');
    }
    expect(() => loadConfig({ DISCORD_CLIENT_ID: '123456789012345678' })).toThrow(/DISCORD_TOKEN/);
  });
});
