// Fabrique de VRAIES interactions discord.js (sans réseau) à partir de charges utiles brutes,
// pour tester le code face aux vrais objets (cache de guilde, résolution des options, overwrites de salons).
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  PermissionFlagsBits as P,
} from 'discord.js';

export const IDS = {
  guild: '1000000000000000001',
  bot: '1000000000000000002',
  admin: '1000000000000000003',
  app: '1000000000000000004',
  botRole: '1000000000000000009',
  member: '1000000000000000010',
  modRole: '1000000000000000011',
  otherGuild: '2000000000000000001',
};
export const PERM = {
  ALL_BASIC: String(P.ViewChannel | P.SendMessages | P.EmbedLinks | P.AttachFiles | P.ReadMessageHistory),
  EVERYONE: String(P.ViewChannel | P.SendMessages | P.ReadMessageHistory),
  ADMIN: String(P.Administrator),
  MANAGE_GUILD: String(P.ManageGuild),
  NONE: '0',
};

export const apiError = (status, code, message) => new DiscordAPIError({ code, message }, code, status, 'GET', '/test', {});

export const roleData = (id, position, permissions = '0', extra = {}) => ({
  id, name: `role-${id.slice(-2)}`, color: 0, hoist: false, position, permissions, managed: false, mentionable: false, flags: 0, ...extra,
});

export const textChannel = (id, overwrites = [], extra = {}) => ({
  id, type: 0, name: `salon-${id.slice(-3)}`, guild_id: IDS.guild, permission_overwrites: overwrites, position: 0, ...extra,
});

/**
 * Client discord.js hors ligne. `calls` enregistre les écritures REST (réponses d'interaction, messages).
 * `restGet` : table { '/chemin': () => réponse | throw } pour simuler l'API en lecture.
 */
export function makeEnv({
  guildCached = true,
  botMemberCached = true,
  botRolePerms = PERM.ALL_BASIC,
  everyonePerms = PERM.EVERYONE,
  channels = [],
  extraRoles = [],
  restGet = {},
} = {}) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.user = { id: IDS.bot, tag: 'bot#0000' };
  const calls = [];
  client.rest.post = async (route, opts) => (calls.push({ method: 'POST', route, body: opts?.body }), {});
  client.rest.patch = async (route, opts) => (calls.push({ method: 'PATCH', route, body: opts?.body }), {});
  const botMember = { user: { id: IDS.bot, username: 'bot' }, roles: [IDS.botRole], joined_at: '2024-01-01T00:00:00Z' };
  const handlers = {
    [`/guilds/${IDS.guild}/channels`]: () => channels,
    [`/guilds/${IDS.guild}/members/${IDS.bot}`]: () => botMember,
    ...restGet,
  };
  client.rest.get = async (route) => {
    if (!handlers[route]) throw new Error(`REST non simulé : GET ${route}`);
    return handlers[route]();
  };
  const guildData = {
    id: IDS.guild,
    name: 'BonServeur',
    owner_id: IDS.admin,
    roles: [roleData(IDS.guild, 0, everyonePerms, { name: '@everyone' }), roleData(IDS.botRole, 5, botRolePerms), ...extraRoles],
    channels,
    members: botMemberCached ? [botMember] : [],
    emojis: [],
    stickers: [],
  };
  if (guildCached) client.guilds._add(guildData);
  return { client, calls, guildData };
}

export const opt = {
  string: (name, value) => ({ name, type: 3, value }),
  bool: (name, value) => ({ name, type: 5, value }),
  user: (name, value) => ({ name, type: 6, value }),
  channel: (name, value) => ({ name, type: 7, value }),
  role: (name, value) => ({ name, type: 8, value }),
  attachment: (name, value) => ({ name, type: 11, value }),
};

const baseInteraction = (member) => ({
  id: '1000000000000000100',
  application_id: IDS.app,
  token: 'jeton-factice-interaction',
  version: 1,
  guild_id: IDS.guild,
  channel_id: '1000000000000000200',
  app_permissions: '0',
  locale: 'fr',
  entitlements: [],
  authorizing_integration_owners: { 0: IDS.guild },
  context: 0,
  member: { user: { id: member.id, username: `u${member.id.slice(-2)}` }, roles: member.roles ?? [], permissions: member.permissions ?? PERM.NONE, joined_at: '2024-01-01T00:00:00Z' },
});

/** /commande [sous-commande] avec options brutes. */
export function slash(client, { name, sub, options = [], resolved = {}, member = { id: IDS.admin, permissions: PERM.ADMIN } }) {
  return new ChatInputCommandInteraction(client, {
    ...baseInteraction(member),
    type: 2,
    data: {
      id: '1000000000000000300',
      name,
      type: 1,
      options: sub ? [{ name: sub, type: 1, options }] : options,
      resolved,
    },
  });
}

/** Clic sur un bouton d'un message du bot. */
export function button(client, { customId, member }) {
  return new ButtonInteraction(client, {
    ...baseInteraction(member),
    type: 3,
    message: {
      id: '1000000000000000400', channel_id: '1000000000000000200', author: { id: IDS.bot, username: 'bot' },
      content: '', embeds: [], components: [], attachments: [], mentions: [], mention_roles: [],
      pinned: false, tts: false, timestamp: '2024-01-01T00:00:00Z', edited_timestamp: null, flags: 0, type: 0,
    },
    data: { custom_id: customId, component_type: 2 },
  });
}

/** Textes envoyés à l'utilisateur (réponse, édition, suivi). */
export const sentTexts = (calls) =>
  calls.map((c) => c.body?.data?.content ?? c.body?.content).filter((t) => typeof t === 'string');
export const sentEmbeds = (calls) => calls.flatMap((c) => c.body?.data?.embeds ?? c.body?.embeds ?? []);
/** Écritures REST qui répondent à l'interaction (callback ou webhook @original/suivi). */
export const interactionWrites = (calls) => calls.filter((c) => /interactions|webhooks/.test(c.route));
