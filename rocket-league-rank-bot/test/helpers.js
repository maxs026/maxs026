import { PermissionFlagsBits } from 'discord.js';
import { Notifier } from '../src/notifications/notifier.js';
import { RankService } from '../src/services/rankService.js';
import { openDatabase } from '../src/storage/db.js';
import { Repository } from '../src/storage/repository.js';

export const silentLogger = { error() {}, warn() {}, info() {}, debug() {} };

export function makeRepo(path = ':memory:') {
  return new Repository(openDatabase(path));
}

/** Transport factice : mémorise les envois, échecs programmables. */
export function makeTransport() {
  const t = {
    sent: [],
    failNext: 0,
    markers: new Map(),
    delay: 0,
    async send(channelId, payload) {
      if (t.delay) await new Promise((r) => setTimeout(r, t.delay));
      if (t.failNext > 0) {
        t.failNext -= 1;
        throw new Error('Discord indisponible');
      }
      const id = `msg-${t.sent.length + 1}`;
      t.sent.push({ channelId, payload, id });
      return id;
    },
    async findMarker(channelId, marker) {
      return t.markers.get(`${channelId}:${marker}`) ?? null;
    },
    reactions: [],
    failReact: false,
    async react(channelId, messageId, emojis) {
      if (t.failReact) throw new Error('Missing Permissions');
      t.reactions.push({ channelId, messageId, emojis });
    },
  };
  return t;
}

export function makeCtx({ repo = makeRepo(), transport = makeTransport(), now } = {}) {
  const rankService = new RankService(repo, now ? { now } : undefined);
  const notifier = new Notifier({ repo, transport, logger: silentLogger, maxAttempts: 3 });
  return { repo, transport, rankService, notifier, logger: silentLogger };
}

export function configureGuild(repo, guildId = 'g1') {
  repo.setGuildSetting(guildId, 'announce_channel_id', 'chan-announce');
  repo.setGuildSetting(guildId, 'review_channel_id', 'chan-review');
}

/** Interaction de bouton factice. */
export function fakeButton({ customId, userId, guildId = 'g1', admin = false, manage = false, roles = [] }) {
  const calls = { updates: [], replies: [], followUps: [] };
  return {
    calls,
    customId,
    guildId,
    guild: { id: guildId },
    user: { id: userId },
    member: { roles },
    message: { embeds: [] },
    memberPermissions: {
      has: (bit) => (bit === PermissionFlagsBits.Administrator ? admin : bit === PermissionFlagsBits.ManageGuild ? manage : false),
    },
    update: async (p) => calls.updates.push(p),
    reply: async (p) => calls.replies.push(p),
    followUp: async (p) => calls.followUps.push(p),
  };
}
