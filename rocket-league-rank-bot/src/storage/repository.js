import { DEFAULT_NOTIFY_RANKS } from '../domain/ranks.js';

/** Accès aux données. Aucune logique métier ici. */
export class Repository {
  constructor(db) {
    this.db = db;
  }

  transaction(fn) {
    return this.db.transaction(fn)();
  }

  // --- Configuration du serveur -------------------------------------------
  getGuildSettings(guildId) {
    return (
      this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) ?? {
        guild_id: guildId,
        announce_channel_id: null,
        review_channel_id: null,
        moderator_role_id: null,
        roles_enabled: 0,
        fun_mode: 0,
        demotion_gif_url: null,
      }
    );
  }

  setGuildSetting(guildId, column, value) {
    const allowed = ['announce_channel_id', 'review_channel_id', 'moderator_role_id', 'roles_enabled', 'fun_mode', 'demotion_gif_url', 'last_recap_key'];
    if (!allowed.includes(column)) throw new Error(`Colonne non autorisée : ${column}`);
    this.db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    this.db.prepare(`UPDATE guild_settings SET ${column} = ? WHERE guild_id = ?`).run(value, guildId);
  }

  getRankSettings(guildId, rank) {
    const row = this.db
      .prepare('SELECT * FROM rank_settings WHERE guild_id = ? AND rank = ?')
      .get(guildId, rank);
    const notify = row?.notify ?? null;
    return {
      rank,
      notify: notify === null ? DEFAULT_NOTIFY_RANKS.includes(rank) : Boolean(notify),
      notify_configured: notify !== null,
      gif_url: row?.gif_url ?? null,
      message_template: row?.message_template ?? null,
      role_id: row?.role_id ?? null,
    };
  }

  setRankSetting(guildId, rank, column, value) {
    const allowed = ['notify', 'gif_url', 'message_template', 'role_id'];
    if (!allowed.includes(column)) throw new Error(`Colonne non autorisée : ${column}`);
    this.db.prepare('INSERT OR IGNORE INTO rank_settings (guild_id, rank) VALUES (?, ?)').run(guildId, rank);
    this.db
      .prepare(`UPDATE rank_settings SET ${column} = ? WHERE guild_id = ? AND rank = ?`)
      .run(value, guildId, rank);
  }

  // --- Comptes liés --------------------------------------------------------
  linkAccount(guildId, userId, platform, handle, now) {
    this.db
      .prepare(
        `INSERT INTO accounts (guild_id, user_id, platform, handle, updated_at) VALUES (?,?,?,?,?)
         ON CONFLICT (guild_id, user_id) DO UPDATE SET platform=excluded.platform,
           handle=excluded.handle, updated_at=excluded.updated_at`,
      )
      .run(guildId, userId, platform, handle, now);
  }

  getAccount(guildId, userId) {
    return this.db.prepare('SELECT * FROM accounts WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  }

  // --- Demandes ------------------------------------------------------------
  insertRequest(r) {
    const info = this.db
      .prepare(
        `INSERT INTO rank_requests (guild_id, user_id, playlist, rank, screenshot_url, origin, status, created_at)
         VALUES (@guild_id, @user_id, @playlist, @rank, @screenshot_url, @origin, 'pending', @created_at)`,
      )
      .run({ screenshot_url: null, origin: 'declaration', ...r });
    return Number(info.lastInsertRowid);
  }

  getRequest(id) {
    return this.db.prepare('SELECT * FROM rank_requests WHERE id = ?').get(id);
  }

  findPendingRequest(guildId, userId, playlist) {
    return this.db
      .prepare(
        `SELECT * FROM rank_requests WHERE guild_id=? AND user_id=? AND playlist=? AND status='pending'`,
      )
      .get(guildId, userId, playlist);
  }

  setReviewMessage(id, messageId) {
    this.db.prepare('UPDATE rank_requests SET review_message_id = ? WHERE id = ?').run(messageId, id);
  }

  deleteRequest(id) {
    this.db.prepare('DELETE FROM rank_requests WHERE id = ?').run(id);
  }

  /** Passage atomique pending -> approved. Retourne false si déjà traitée. */
  claimForApproval(id, reviewerId, now) {
    const info = this.db
      .prepare(
        `UPDATE rank_requests SET status='approved', reviewer_id=?, reviewed_at=?
         WHERE id=? AND status='pending'`,
      )
      .run(reviewerId, now, id);
    return info.changes === 1;
  }

  claimForRejection(id, reviewerId, now) {
    const info = this.db
      .prepare(
        `UPDATE rank_requests SET status='rejected', reviewer_id=?, reviewed_at=?
         WHERE id=? AND status='pending'`,
      )
      .run(reviewerId, now, id);
    return info.changes === 1;
  }

  setChangeInfo(id, changeType, previousRank, notifyState) {
    this.db
      .prepare('UPDATE rank_requests SET change_type=?, previous_rank=?, notify_state=? WHERE id=?')
      .run(changeType, previousRank, notifyState, id);
  }

  setRewardInfo(id, delta, total, streak) {
    this.db
      .prepare('UPDATE rank_requests SET points_delta=?, points_total=?, streak=? WHERE id=?')
      .run(delta, total, streak, id);
  }

  // --- Points et séries ----------------------------------------------------
  getMemberStats(guildId, userId) {
    return (
      this.db.prepare('SELECT * FROM member_stats WHERE guild_id=? AND user_id=?').get(guildId, userId) ?? {
        guild_id: guildId,
        user_id: userId,
        points: 0,
        promotions: 0,
        demotions: 0,
        streak: 0,
      }
    );
  }

  saveMemberStats(guildId, userId, { points, promotions, demotions, streak }) {
    this.db
      .prepare(
        `INSERT INTO member_stats (guild_id, user_id, points, promotions, demotions, streak) VALUES (?,?,?,?,?,?)
         ON CONFLICT (guild_id, user_id) DO UPDATE SET points=excluded.points, promotions=excluded.promotions,
           demotions=excluded.demotions, streak=excluded.streak`,
      )
      .run(guildId, userId, points, promotions, demotions, streak);
  }

  // --- Récap hebdomadaire -------------------------------------------------
  listFunGuilds() {
    return this.db.prepare('SELECT * FROM guild_settings WHERE fun_mode = 1').all();
  }

  /** Changements de rang validés depuis `since` (ms). */
  listChangesSince(guildId, since) {
    return this.db
      .prepare(
        `SELECT * FROM rank_requests WHERE guild_id=? AND status='approved' AND reviewed_at >= ?
           AND change_type IN ('first','promotion','demotion') ORDER BY reviewed_at`,
      )
      .all(guildId, since);
  }

  /** Réserve le récap `key` (atomique) : false s'il a déjà été pris. */
  claimRecap(guildId, key) {
    const info = this.db
      .prepare(
        `UPDATE guild_settings SET last_recap_key=? WHERE guild_id=? AND (last_recap_key IS NULL OR last_recap_key <> ?)`,
      )
      .run(key, guildId, key);
    return info.changes === 1;
  }

  listMemberStats(guildId) {
    return this.db.prepare('SELECT * FROM member_stats WHERE guild_id=?').all(guildId);
  }

  listLeaderboard(guildId, limit = 10) {
    return this.db
      .prepare('SELECT * FROM member_stats WHERE guild_id=? ORDER BY points DESC, promotions DESC LIMIT ?')
      .all(guildId, limit);
  }

  // --- Rangs validés -------------------------------------------------------
  getValidatedRank(guildId, userId, playlist) {
    return this.db
      .prepare('SELECT * FROM validated_ranks WHERE guild_id=? AND user_id=? AND playlist=?')
      .get(guildId, userId, playlist);
  }

  listValidatedRanks(guildId, userId) {
    return this.db
      .prepare('SELECT * FROM validated_ranks WHERE guild_id=? AND user_id=? ORDER BY playlist')
      .all(guildId, userId);
  }

  upsertValidatedRank(guildId, userId, playlist, rank, requestId, now) {
    this.db
      .prepare(
        `INSERT INTO validated_ranks (guild_id, user_id, playlist, rank, request_id, updated_at)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT (guild_id, user_id, playlist) DO UPDATE SET rank=excluded.rank,
           request_id=excluded.request_id, updated_at=excluded.updated_at`,
      )
      .run(guildId, userId, playlist, rank, requestId, now);
  }

  // --- Boîte d'envoi des notifications ------------------------------------
  /** pending -> sending de façon atomique : un seul envoi concurrent possible. */
  claimNotification(id) {
    const info = this.db
      .prepare(
        `UPDATE rank_requests SET notify_state='sending' WHERE id=? AND notify_state='pending'`,
      )
      .run(id);
    return info.changes === 1;
  }

  markNotificationSent(id, messageId) {
    this.db
      .prepare(`UPDATE rank_requests SET notify_state='sent', notify_message_id=? WHERE id=?`)
      .run(messageId, id);
  }

  /** Échec d'envoi : réessaie plus tard, ou abandonne après maxAttempts. */
  failNotification(id, maxAttempts) {
    this.db
      .prepare(
        `UPDATE rank_requests SET notify_attempts = notify_attempts + 1,
           notify_state = CASE WHEN notify_attempts + 1 >= ? THEN 'failed' ELSE 'pending' END
         WHERE id = ?`,
      )
      .run(maxAttempts, id);
  }

  releaseNotification(id, state) {
    this.db.prepare('UPDATE rank_requests SET notify_state=? WHERE id=?').run(state, id);
  }

  listNotifications(state) {
    return this.db
      .prepare('SELECT * FROM rank_requests WHERE notify_state = ? ORDER BY id')
      .all(state);
  }
}
