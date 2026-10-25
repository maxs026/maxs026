import { AttachmentBuilder, MessagePayload, PermissionFlagsBits as P } from 'discord.js';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildInviteUrl } from '../src/discord/invite.js';
import { memberInfo } from '../src/discord/member.js';
import { routeInteraction } from '../src/discord/router.js';
import { createLogger } from '../src/logger.js';
import { buildAnnouncement } from '../src/notifications/embed.js';
import { buildReviewMessage } from '../src/notifications/reviewMessage.js';
import { configureGuild, makeCtx, makeTransport } from './helpers.js';
import { IDS, PERM, apiError, button, interactionWrites, makeEnv, opt, roleData, sentEmbeds, sentTexts, slash, textChannel } from './realInteraction.js';

const CH_REVIEW = '1000000000000000500';
const CH_ANNOUNCE = '1000000000000000501';
const MEMBER = { id: IDS.member, permissions: PERM.EVERYONE };
const MOD = { id: '1000000000000000020', roles: [IDS.modRole], permissions: PERM.EVERYONE };
const ADMIN = { id: IDS.admin, permissions: PERM.ADMIN };

const setup = (envOver = {}) => {
  const env = makeEnv({ channels: [textChannel(CH_REVIEW), textChannel(CH_ANNOUNCE)], extraRoles: [roleData(IDS.modRole, 2)], ...envOver });
  const ctx = makeCtx({ transport: makeTransport() });
  const logs = [];
  ctx.logger = { error: (...a) => logs.push(a), warn() {}, info() {}, debug() {} };
  configureGuild(ctx.repo, IDS.guild);
  ctx.repo.setGuildSetting(IDS.guild, 'review_channel_id', CH_REVIEW);
  ctx.repo.setGuildSetting(IDS.guild, 'announce_channel_id', CH_ANNOUNCE);
  ctx.repo.setGuildSetting(IDS.guild, 'moderator_role_id', IDS.modRole);
  return { env, ctx, logs };
};
const go = async (env, ctx, interaction) => (await routeInteraction(interaction, ctx), interaction);
const declare = (env, ctx, rank, playlist = '3v3', member = MEMBER) =>
  go(env, ctx, slash(env.client, { name: 'rang', sub: 'declarer', member, options: [opt.string('playlist', playlist), opt.string('rang', rank)] }));
const pendingId = (ctx) => ctx.repo.db.prepare("SELECT id FROM rank_requests WHERE status='pending' ORDER BY id DESC").get().id;
const click = (env, ctx, id, who, verb = 'approve') => go(env, ctx, button(env.client, { customId: `rank:${verb}:${id}`, member: who }));
const callbackTypes = (calls) => calls.filter((c) => /callback/.test(c.route)).map((c) => c.body.type);

describe('AUDIT — parcours complet avec de vrais objets discord.js', () => {
  it('/lier enregistre le compte', async () => {
    const { env, ctx } = setup();
    await go(env, ctx, slash(env.client, { name: 'lier', member: MEMBER, options: [opt.string('plateforme', 'epic'), opt.string('pseudo', 'MaxRL')] }));
    expect(ctx.repo.getAccount(IDS.guild, IDS.member)).toMatchObject({ platform: 'epic', handle: 'MaxRL' });
    expect(sentTexts(env.calls).join()).toMatch(/Compte enregistré/);
  });

  it('/rang declarer envoie la demande, avec boutons, dans le salon de validation', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    const sent = ctx.transport.sent[0];
    expect(sent.channelId).toBe(CH_REVIEW);
    expect(sent.payload.components[0].components.map((c) => c.data.custom_id)).toEqual([`rank:approve:1`, `rank:reject:1`]);
    expect(sentTexts(env.calls).join()).toMatch(/Demande n°1 envoyée/);
  });

  it('/rang declarer avec une capture : fichier ré-hébergé et image rattachée', async () => {
    const { env, ctx } = setup();
    const att = { id: '1000000000000000600', filename: 's.png', size: 1234, url: 'https://cdn.example/s.png', proxy_url: 'https://cdn.example/s.png', content_type: 'image/png' };
    await go(env, ctx, slash(env.client, { name: 'rang', sub: 'declarer', member: MEMBER, options: [opt.string('playlist', '3v3'), opt.string('rang', 'silver'), opt.attachment('capture', att.id)], resolved: { attachments: { [att.id]: att } } }));
    const sent = ctx.transport.sent[0].payload;
    expect(sent.files).toHaveLength(1);
    expect(sent.embeds[0].toJSON().image.url).toMatch(/^attachment:\/\/capture-1\.png$/);
  });

  it('/rang declarer rejette une pièce jointe non image et un doublon en attente', async () => {
    const { env, ctx } = setup();
    const att = { id: '1000000000000000601', filename: 'a.pdf', size: 10, url: 'https://cdn.example/a.pdf', proxy_url: 'https://cdn.example/a.pdf', content_type: 'application/pdf' };
    await go(env, ctx, slash(env.client, { name: 'rang', sub: 'declarer', member: MEMBER, options: [opt.string('playlist', '3v3'), opt.string('rang', 'silver'), opt.attachment('capture', att.id)], resolved: { attachments: { [att.id]: att } } }));
    expect(sentTexts(env.calls).join()).toMatch(/PNG, JPEG ou WebP/);
    await declare(env, ctx, 'silver');
    await declare(env, ctx, 'gold');
    expect(sentTexts(env.calls).join()).toMatch(/déjà en attente/);
  });

  it('un modérateur (rôle configuré) valide : une annonce dans le salon d’annonces', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    const i = await click(env, ctx, 1, MOD);
    expect(callbackTypes(env.calls).at(-1)).toBe(7); // UpdateMessage
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(1);
    expect(ctx.repo.getValidatedRank(IDS.guild, IDS.member, '3v3').rank).toBe('gold');
    expect(memberInfo(i).roleIds).toContain(IDS.modRole); // chemin GuildMember (roles.cache) avec un vrai objet
  });

  it('DOUBLE CLIC simultané de deux modérateurs : une validation, une annonce, un refus poli', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    const before = env.calls.length;
    await Promise.all([click(env, ctx, 1, MOD), click(env, ctx, 1, ADMIN)]);
    const types = callbackTypes(env.calls.slice(before));
    expect(types.filter((t) => t === 7)).toHaveLength(1);
    expect(types.filter((t) => t === 4)).toHaveLength(1);
    expect(sentTexts(env.calls.slice(before)).join()).toMatch(/déjà été traitée/);
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(1);
  });

  it('un membre ordinaire ne peut pas valider ; un modérateur ne valide pas sa propre demande', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    await click(env, ctx, 1, { id: '1000000000000000030', permissions: PERM.EVERYONE });
    expect(sentTexts(env.calls).join()).toMatch(/Seuls les modérateurs/);
    expect(ctx.repo.getRequest(1).status).toBe('pending');

    await declare(env, ctx, 'silver', '2v2', MOD);
    await click(env, ctx, 2, MOD);
    expect(sentTexts(env.calls).join()).toMatch(/propre demande/);
    expect(ctx.repo.getRequest(2).status).toBe('pending');
  });

  it('refuser : aucune annonce, aucun rang', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    await click(env, ctx, 1, ADMIN, 'reject');
    expect(ctx.repo.getRequest(1).status).toBe('rejected');
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(0);
  });

  it('promotion annoncée, rétrogradation non annoncée', async () => {
    const { env, ctx } = setup();
    const announced = () => ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE).length;
    await declare(env, ctx, 'silver'); await click(env, ctx, 1, ADMIN);
    await declare(env, ctx, 'gold'); await click(env, ctx, 2, ADMIN);
    expect(announced()).toBe(2); // première déclaration + promotion
    await declare(env, ctx, 'silver'); await click(env, ctx, 3, ADMIN);
    expect(announced()).toBe(2); // rétrogradation : rien
    expect(ctx.repo.getValidatedRank(IDS.guild, IDS.member, '3v3').rank).toBe('silver');
  });

  it('bouton cliqué alors que le bot n’est plus membre : demande laissée en attente + message clair', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    const env2 = makeEnv({ guildCached: false });
    env2.client.rest.get = async () => { throw apiError(404, 10004, 'Unknown Guild'); };
    await click(env2, ctx, 1, ADMIN);
    expect(ctx.repo.getRequest(1).status).toBe('pending');
    expect(sentTexts(env2.calls).join()).toMatch(/n’est pas membre de ce serveur/);
  });

  it('/rang voir et /rang-definir (réservé aux modérateurs, annonce unique)', async () => {
    const { env, ctx } = setup();
    const user = { id: IDS.member, username: 'joueur', discriminator: '0', avatar: null, global_name: 'Joueur' };
    const defOpts = [opt.user('membre', IDS.member), opt.string('playlist', '3v3'), opt.string('rang', 'gold')];
    const resolved = { users: { [IDS.member]: user } };
    await go(env, ctx, slash(env.client, { name: 'rang-definir', member: MEMBER, options: defOpts, resolved }));
    expect(sentTexts(env.calls).join()).toMatch(/réservée aux modérateurs/);
    await go(env, ctx, slash(env.client, { name: 'rang-definir', member: MOD, options: defOpts, resolved }));
    await go(env, ctx, slash(env.client, { name: 'rang-definir', member: MOD, options: defOpts, resolved }));
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(1);
    await go(env, ctx, slash(env.client, { name: 'rang', sub: 'voir', member: MEMBER, options: [opt.user('membre', IDS.member)], resolved }));
    expect(JSON.stringify(sentEmbeds(env.calls))).toMatch(/Standard 3v3\*\* : Gold/);
  });

  it('chaque interaction reçoit exactement une réponse initiale', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    await click(env, ctx, 1, ADMIN);
    const initial = callbackTypes(env.calls);
    expect(initial.every((t) => [4, 5, 7].includes(t))).toBe(true);
    expect(interactionWrites(env.calls).length).toBeGreaterThan(0);
  });

  it('erreur inattendue dans un bouton : une réponse avec référence, stack dans les logs', async () => {
    const { env, ctx, logs } = setup();
    await declare(env, ctx, 'gold');
    ctx.rankService.approve = () => { throw new Error('disque plein'); };
    await click(env, ctx, 1, ADMIN);
    expect(sentTexts(env.calls).join()).toMatch(/réf\. [0-9a-f]{6}/);
    expect(logs[0][0].err.stack).toMatch(/disque plein/);
  });
});

describe('notifications après redémarrage (vrais objets de config)', () => {
  it('validation puis crash avant envoi : un seul envoi à la reprise, aucun au redémarrage suivant', async () => {
    const { env, ctx } = setup();
    await declare(env, ctx, 'gold');
    ctx.notifier.deliver = async () => 'retry'; // l'envoi échoue : l'annonce reste en base
    await click(env, ctx, 1, ADMIN);
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(0);
    const ctx2 = makeCtx({ repo: ctx.repo, transport: ctx.transport }); // « redémarrage »
    await ctx2.notifier.recover();
    await ctx2.notifier.recover();
    expect(ctx.transport.sent.filter((s) => s.channelId === CH_ANNOUNCE)).toHaveLength(1);
  });
});

describe('validité des messages envoyés à Discord', () => {
  it('les payloads d’annonce et de validation sont acceptés par discord.js (vrai salon)', () => {
    const { env } = setup();
    const channel = env.client.guilds.cache.get(IDS.guild).channels.cache.get(CH_REVIEW);
    const req = { id: 1, guild_id: IDS.guild, user_id: IDS.member, playlist: '3v3', rank: 'gold', previous_rank: 'silver', change_type: 'promotion', status: 'pending', created_at: Date.now(), reviewed_at: Date.now() };
    const ann = MessagePayload.create(channel, buildAnnouncement(req, { gif_url: 'https://media.example.com/g.gif', message_template: null })).resolveBody().body;
    expect(ann.embeds[0].image.url).toBe('https://media.example.com/g.gif');
    expect(ann.allowed_mentions.users).toEqual([IDS.member]);
    const rev = MessagePayload.create(channel, { ...buildReviewMessage(req, { previousRank: 'silver', screenshot: { name: 'capture-1.png' } }), files: [new AttachmentBuilder(Buffer.from('x'), { name: 'capture-1.png' })] }).resolveBody().body;
    expect(rev.components[0].components).toHaveLength(2);
  });
  it('la longueur d’un message personnalisé maximal reste sous la limite des embeds', () => {
    const big = 'x'.repeat(500);
    const body = buildAnnouncement({ id: 1, user_id: '1', playlist: '3v3', rank: 'gold', change_type: 'first', previous_rank: null }, { gif_url: null, message_template: big });
    expect(body.embeds[0].toJSON().description.length).toBeLessThanOrEqual(4096);
  });
});

describe('logs, configuration et invitation', () => {
  it('le logger écrit la stack trace des erreurs et masque le token', () => {
    const chunks = [];
    const log = createLogger('info', new Writable({ write: (c, _e, cb) => (chunks.push(c.toString()), cb()) }));
    log.error({ err: new Error('boom'), token: 'SECRET-TOKEN-123', DISCORD_TOKEN: 'SECRET-TOKEN-123' }, 'test');
    const line = chunks.join('');
    expect(JSON.parse(line).err.stack).toMatch(/Error: boom\n\s+at /);
    expect(line).not.toContain('SECRET-TOKEN-123');
  });
  it('un chemin SQLite relatif est résolu depuis la racine du projet, pas le dossier courant', () => {
    const base = { DISCORD_TOKEN: 'x', DISCORD_CLIENT_ID: '123456789012345678' };
    expect(loadConfig(base, { root: '/srv/bot' }).DATABASE_PATH).toBe('/srv/bot/data/bot.sqlite');
    expect(loadConfig({ ...base, DATABASE_PATH: '/var/lib/bot.sqlite' }, { root: '/srv/bot' }).DATABASE_PATH).toBe('/var/lib/bot.sqlite');
    expect(loadConfig({ ...base, DATABASE_PATH: ':memory:' }).DATABASE_PATH).toBe(':memory:');
  });
  it('le lien d’invitation contient les scopes bot ET applications.commands', () => {
    const u = new URL(buildInviteUrl('123456789012345678'));
    expect(u.searchParams.get('scope')).toBe('bot applications.commands');
    const bits = BigInt(u.searchParams.get('permissions'));
    expect(bits & P.SendMessages).toBeTruthy();
    expect(bits & P.ManageRoles).toBe(0n);
    expect(BigInt(new URL(buildInviteUrl('123456789012345678', { roles: true })).searchParams.get('permissions')) & P.ManageRoles).toBeTruthy();
  });
});

describe('rôles automatiques (vrais objets discord.js, hiérarchie des rôles)', () => {
  const RS = '1000000000000000701';
  const RG = '1000000000000000702';
  const target = '1000000000000000050';

  function rolesEnv({ botRolePosition }) {
    const env = makeEnv({
      botRolePerms: String(P.ManageRoles | P.ViewChannel),
      extraRoles: [roleData(RS, 3), roleData(RG, 4)],
      restGet: { [`/guilds/${IDS.guild}/members/${target}`]: () => ({ user: { id: target, username: 'joueur' }, roles: [RS], joined_at: '2024-01-01T00:00:00Z' }) },
    });
    env.guild = env.client.guilds.cache.get(IDS.guild);
    env.guild.roles.cache.get(IDS.botRole).rawPosition = botRolePosition;
    env.puts = [];
    env.deletes = [];
    env.client.rest.put = async (route) => (env.puts.push(route), {});
    env.client.rest.delete = async (route) => (env.deletes.push(route), {});
    const ctx = makeCtx();
    ctx.repo.setGuildSetting(IDS.guild, 'roles_enabled', 1);
    ctx.repo.setRankSetting(IDS.guild, 'silver', 'role_id', RS);
    ctx.repo.setRankSetting(IDS.guild, 'gold', 'role_id', RG);
    ctx.rankService.recordTrusted({ guildId: IDS.guild, userId: target, playlist: '3v3', rank: 'gold', reviewerId: 'a' });
    return { env, ctx };
  }

  it('rôle du bot au-dessus : attribue Gold et retire Silver', async () => {
    const { syncMemberRoles } = await import('../src/discord/roleSync.js');
    const { env, ctx } = rolesEnv({ botRolePosition: 10 });
    const warnings = await syncMemberRoles(env.guild, target, ctx);
    expect(warnings).toEqual([]);
    expect(env.puts.join()).toContain(RG);
    expect(env.deletes.join()).toContain(RS);
  });

  it('rôle du bot en dessous des rôles de rang : aucune modification, avertissement explicite', async () => {
    const { syncMemberRoles } = await import('../src/discord/roleSync.js');
    const { env, ctx } = rolesEnv({ botRolePosition: 2 });
    const warnings = await syncMemberRoles(env.guild, target, ctx);
    expect(warnings.join()).toMatch(/au-dessus/);
    expect(env.puts).toEqual([]);
    expect(env.deletes).toEqual([]);
  });
});
