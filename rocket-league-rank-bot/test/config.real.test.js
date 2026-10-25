import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PermissionFlagsBits as P } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { routeInteraction } from '../src/discord/router.js';
import { configureGuild, makeCtx, makeRepo } from './helpers.js';
import { IDS, PERM, apiError, interactionWrites, makeEnv, opt, roleData, sentEmbeds, sentTexts, slash, textChannel } from './realInteraction.js';

const CH_REVIEW = '1000000000000000500';
const CH_ANNOUNCE = '1000000000000000501';

function spyLogger() {
  const logs = [];
  const mk = (level) => (...a) => logs.push({ level, args: a });
  return { logs, error: mk('error'), warn: mk('warn'), info: mk('info'), debug: mk('debug') };
}
const ctxWithSpy = (over = {}) => {
  const ctx = makeCtx(over);
  ctx.logger = spyLogger();
  return ctx;
};
const channelOpt = (id) => ({ options: [opt.channel('canal', id)], resolved: { channels: { [id]: { id, type: 0, name: 'x', permissions: '0' } } } });
const run = async (env, ctx, spec) => {
  const interaction = slash(env.client, spec);
  await routeInteraction(interaction, ctx);
  return interaction;
};
const canal = (sub, id, extra = {}) => ({ name: 'config', sub, ...channelOpt(id), ...extra });

describe('RÉGRESSION — /config canal-validation et canal-annonces', () => {
  it('enregistre le salon de validation et confirme clairement', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)] });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBe(CH_REVIEW);
    expect(sentTexts(env.calls).join('\n')).toMatch(/✅ Salon de validation enregistré/);
    expect(ctx.logger.logs.filter((l) => l.level === 'error')).toEqual([]);
  });

  it('enregistre le salon d’annonces (AttachFiles non exigé pour les annonces)', async () => {
    const botRolePerms = String(P.ViewChannel | P.SendMessages | P.EmbedLinks | P.ReadMessageHistory);
    const env = makeEnv({ channels: [textChannel(CH_ANNOUNCE)], botRolePerms });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-annonces', CH_ANNOUNCE));
    expect(ctx.repo.getGuildSettings(IDS.guild).announce_channel_id).toBe(CH_ANNOUNCE);
    expect(sentTexts(env.calls).join()).toMatch(/Salon d’annonces enregistré/);
  });

  it('répond une seule fois (différé puis édition), jamais deux réponses initiales', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)] });
    await run(env, ctxWithSpy(), canal('canal-validation', CH_REVIEW));
    const writes = interactionWrites(env.calls);
    expect(writes.map((w) => w.method)).toEqual(['POST', 'PATCH']); // defer, puis editReply
  });

  it('CAUSE RACINE : guilde absente du cache et bot non membre -> message explicite, pas d’erreur générique', async () => {
    const env = makeEnv({
      guildCached: false,
      restGet: { [`/guilds/${IDS.guild}`]: () => { throw apiError(404, 10004, 'Unknown Guild'); } },
    });
    const ctx = ctxWithSpy();
    const i = await run(env, ctx, canal('canal-validation', CH_REVIEW));
    expect(i.guild).toBeNull(); // c'est bien la situation « guilds: 0 »
    const text = sentTexts(env.calls).join('\n');
    expect(text).toMatch(/n’est pas membre de ce serveur/);
    expect(text).toMatch(/invite-url/);
    expect(text).not.toMatch(/erreur inattendue/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBeNull();
    expect(ctx.logger.logs.filter((l) => l.level === 'error')).toEqual([]); // prévisible : warn, pas error
    expect(ctx.logger.logs.some((l) => l.level === 'warn')).toBe(true);
  });

  it('guilde absente du cache MAIS bot bien membre : la commande fonctionne via l’API', async () => {
    const env = makeEnv({ guildCached: false, channels: [textChannel(CH_REVIEW)] });
    const guildPayload = { id: IDS.guild, name: 'BonServeur', owner_id: IDS.admin, roles: [roleData(IDS.guild, 0, PERM.EVERYONE, { name: '@everyone' }), roleData(IDS.botRole, 5, PERM.ALL_BASIC)], channels: [textChannel(CH_REVIEW)], emojis: [], stickers: [] };
    const origGet = env.client.rest.get;
    env.client.rest.get = async (route) => (route === `/guilds/${IDS.guild}` ? guildPayload : origGet(route));
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBe(CH_REVIEW);
  });

  it('membre « bot » absent du cache : récupéré par l’API, pas de faux refus', async () => {
    const env = makeEnv({ botMemberCached: false, channels: [textChannel(CH_REVIEW)] });
    expect(env.client.guilds.cache.get(IDS.guild).members.me).toBeNull();
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    expect(sentTexts(env.calls).join()).toMatch(/✅/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBe(CH_REVIEW);
  });

  it('refuse un salon où il manque des permissions, les liste, et ne sauvegarde rien', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)], botRolePerms: String(P.ViewChannel | P.SendMessages), everyonePerms: PERM.NONE });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    const text = sentTexts(env.calls).join('\n');
    expect(text).toMatch(/Intégrer des liens/);
    expect(text).toMatch(/Joindre des fichiers/);
    expect(text).not.toMatch(/Voir le salon/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBeNull();
  });

  it('salon PRIVÉ : accepté quand le rôle du bot y est autorisé (pas de faux refus)', async () => {
    const privateCh = textChannel(CH_REVIEW, [
      { id: IDS.guild, type: 0, allow: '0', deny: String(P.ViewChannel) },
      { id: IDS.botRole, type: 0, allow: PERM.ALL_BASIC, deny: '0' },
    ]);
    const env = makeEnv({ channels: [privateCh], botRolePerms: PERM.NONE });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBe(CH_REVIEW);
  });

  it('salon PRIVÉ sans accès pour le bot : refusé avec « Voir le salon » et conseil', async () => {
    const privateCh = textChannel(CH_REVIEW, [{ id: IDS.guild, type: 0, allow: '0', deny: String(P.ViewChannel) }]);
    const env = makeEnv({ channels: [privateCh], botRolePerms: PERM.ALL_BASIC });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    const text = sentTexts(env.calls).join('\n');
    expect(text).toMatch(/Voir le salon/);
    expect(text).toMatch(/salon privé/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBeNull();
  });

  it('salon appartenant à un autre serveur (ou inexistant) : refusé', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)] });
    const ctx = ctxWithSpy();
    await run(env, ctx, canal('canal-validation', '2000000000000000999'));
    expect(sentTexts(env.calls).join()).toMatch(/n’existe pas ou n’appartient pas à ce serveur/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBeNull();
  });

  it('un non-administrateur ne peut rien modifier (même avec le rôle modérateur)', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)] });
    const ctx = ctxWithSpy();
    ctx.repo.setGuildSetting(IDS.guild, 'moderator_role_id', IDS.modRole);
    await run(env, ctx, canal('canal-validation', CH_REVIEW, { member: { id: IDS.member, roles: [IDS.modRole], permissions: PERM.EVERYONE } }));
    expect(sentTexts(env.calls).join()).toMatch(/réservée aux administrateurs/);
    expect(ctx.repo.getGuildSettings(IDS.guild).review_channel_id).toBeNull();
  });

  it('erreur SQLite : message avec référence à l’utilisateur, stack trace dans les logs, une seule réponse', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)] });
    const ctx = ctxWithSpy();
    ctx.repo.setGuildSetting = () => { throw new Error('SQLITE_READONLY: attempt to write a readonly database'); };
    await run(env, ctx, canal('canal-validation', CH_REVIEW));
    const text = sentTexts(env.calls).join('\n');
    const ref = text.match(/réf\. ([0-9a-f]{6})/)?.[1];
    expect(ref).toBeTruthy();
    const logged = ctx.logger.logs.find((l) => l.level === 'error');
    expect(logged.args[0].ref).toBe(ref);
    expect(logged.args[0].err.stack).toMatch(/SQLITE_READONLY/);
    expect(logged.args[0].subcommand).toBe('canal-validation');
    expect(interactionWrites(env.calls)).toHaveLength(2); // defer + une seule édition
  });

  it('la configuration survit à un redémarrage (base sur fichier)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rlbot-cfg-'));
    const path = join(dir, 'bot.sqlite');
    try {
      let repo = makeRepo(path);
      const env = makeEnv({ channels: [textChannel(CH_REVIEW), textChannel(CH_ANNOUNCE)] });
      const ctx = ctxWithSpy({ repo });
      await run(env, ctx, canal('canal-validation', CH_REVIEW));
      await run(env, ctx, canal('canal-annonces', CH_ANNOUNCE));
      repo.db.close();
      repo = makeRepo(path); // « redémarrage »
      expect(repo.getGuildSettings(IDS.guild)).toMatchObject({ review_channel_id: CH_REVIEW, announce_channel_id: CH_ANNOUNCE });
      repo.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('AUDIT — chaque sous-commande de /config, avec de vrais objets discord.js', () => {
  const roleResolved = (id) => ({ roles: { [id]: roleData(id, 2, '0') } });
  const cases = [
    ['afficher', [], {}],
    ['canal-validation', ...Object.values(channelOpt(CH_REVIEW)).map((v) => v)],
    ['role-moderateur', [opt.role('role', IDS.modRole)], roleResolved(IDS.modRole)],
    ['rang-notification', [opt.string('rang', 'platinum'), opt.bool('actif', true)], {}],
    ['rang-gif', [opt.string('rang', 'gold'), opt.string('url', 'https://media.example.com/gold.gif')], {}],
    ['rang-message', [opt.string('rang', 'gold'), opt.string('message', 'GG {membre} !')], {}],
    ['rang-role', [opt.string('rang', 'gold'), opt.role('role', IDS.modRole)], roleResolved(IDS.modRole)],
    ['roles-actifs', [opt.bool('actif', false)], {}],
    ['mode-potes', [opt.bool('actif', true)], {}],
    ['gif-chute', [opt.string('url', 'https://media.example.com/chute.gif')], {}],
  ];

  it('toutes les sous-commandes déclarées sont gérées (aucune n’est « inconnue »)', async () => {
    const { commandsJson } = await import('../src/discord/commands/index.js');
    const declared = commandsJson().find((c) => c.name === 'config').options.map((o) => o.name).sort();
    const tested = [...cases.map((c) => c[0]), 'canal-annonces'].sort();
    expect(tested).toEqual(declared);
  });

  for (const [sub, options, resolved] of cases) {
    it(`/config ${sub} répond sans erreur`, async () => {
      const env = makeEnv({ channels: [textChannel(CH_REVIEW)], extraRoles: [roleData(IDS.modRole, 2)] });
      const ctx = ctxWithSpy();
      const spec = sub === 'canal-validation' ? canal(sub, CH_REVIEW) : { name: 'config', sub, options, resolved };
      await run(env, ctx, spec);
      const texts = sentTexts(env.calls).join('\n');
      expect(ctx.logger.logs.filter((l) => l.level === 'error')).toEqual([]);
      expect(texts).not.toMatch(/inattendue|inconnue/);
      expect(texts + JSON.stringify(sentEmbeds(env.calls))).toMatch(sub === 'afficher' ? /Configuration/ : /✅/);
    });
  }

  it('persistance des réglages par rang et du rôle modérateur', async () => {
    const env = makeEnv({ extraRoles: [roleData(IDS.modRole, 2)] });
    const ctx = ctxWithSpy();
    for (const [sub, options, resolved] of cases.filter((c) => c[0] !== 'canal-validation')) {
      await run(env, ctx, { name: 'config', sub, options, resolved });
    }
    expect(ctx.repo.getRankSettings(IDS.guild, 'gold')).toMatchObject({ gif_url: 'https://media.example.com/gold.gif', message_template: 'GG {membre} !', role_id: IDS.modRole, notify: true });
    expect(ctx.repo.getRankSettings(IDS.guild, 'platinum').notify).toBe(true);
    expect(ctx.repo.getGuildSettings(IDS.guild)).toMatchObject({ moderator_role_id: IDS.modRole, roles_enabled: 0, fun_mode: 1, demotion_gif_url: 'https://media.example.com/chute.gif' });
  });

  it('un lien de GIF invalide produit un message explicite et ne change rien', async () => {
    const env = makeEnv();
    const ctx = ctxWithSpy();
    await run(env, ctx, { name: 'config', sub: 'rang-gif', options: [opt.string('rang', 'gold'), opt.string('url', 'http://pas-https.example/a.gif')] });
    expect(sentTexts(env.calls).join()).toMatch(/URL https valide/);
    expect(ctx.repo.getRankSettings(IDS.guild, 'gold').gif_url).toBeNull();
  });

  it('/config afficher signale un salon configuré devenu inaccessible', async () => {
    const env = makeEnv({ channels: [textChannel(CH_REVIEW)], botRolePerms: String(P.ViewChannel), everyonePerms: PERM.NONE });
    const ctx = ctxWithSpy();
    configureGuild(ctx.repo, IDS.guild);
    ctx.repo.setGuildSetting(IDS.guild, 'review_channel_id', CH_REVIEW);
    await run(env, ctx, { name: 'config', sub: 'afficher' });
    const fields = sentEmbeds(env.calls)[0].fields;
    expect(fields.find((f) => f.name === 'Salon de validation').value).toMatch(/permissions manquantes/);
  });
});
