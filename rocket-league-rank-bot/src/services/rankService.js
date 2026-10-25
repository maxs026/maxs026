import { classifyChange, highestRank, isPlaylist, isRank } from '../domain/ranks.js';

export class RankError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Logique métier, indépendante de Discord et de la source des rangs.
 *
 * Une source (déclaration manuelle aujourd'hui, API tierce demain) n'a qu'un
 * contrat à respecter : appeler `submitDeclaration` (avec validation humaine)
 * ou `recordTrusted` (source de confiance, sans validation). La détection de
 * changement et l'anti-doublon sont ensuite identiques pour toutes les sources.
 */
export class RankService {
  /**
   * @param {import('../storage/repository.js').Repository} repo
   * @param {{now?: () => number}} [opts]
   */
  constructor(repo, { now = () => Date.now() } = {}) {
    this.repo = repo;
    this.now = now;
  }

  #check({ playlist, rank }) {
    if (!isPlaylist(playlist)) throw new RankError('bad_playlist', 'Playlist inconnue.');
    if (!isRank(rank)) throw new RankError('bad_rank', 'Rang inconnu.');
  }

  /** Crée une demande en attente de validation. */
  submitDeclaration({ guildId, userId, playlist, rank, screenshotUrl = null }) {
    this.#check({ playlist, rank });
    const current = this.repo.getValidatedRank(guildId, userId, playlist);
    if (current?.rank === rank) {
      throw new RankError('already_validated', 'Ce rang est déjà validé pour cette playlist.');
    }
    if (this.repo.findPendingRequest(guildId, userId, playlist)) {
      throw new RankError('already_pending', 'Une demande est déjà en attente pour cette playlist.');
    }
    const id = this.repo.insertRequest({
      guild_id: guildId,
      user_id: userId,
      playlist,
      rank,
      screenshot_url: screenshotUrl,
      created_at: this.now(),
    });
    return this.repo.getRequest(id);
  }

  /**
   * Valide une demande. Idempotent : seul le premier appel gagnant produit un
   * changement d'état et une notification ; les suivants renvoient
   * `{ alreadyProcessed: true }` sans effet de bord.
   */
  approve(requestId, reviewerId) {
    return this.repo.transaction(() => {
      const request = this.repo.getRequest(requestId);
      if (!request) throw new RankError('not_found', 'Demande introuvable.');
      if (!this.repo.claimForApproval(requestId, reviewerId, this.now())) {
        return { alreadyProcessed: true, request: this.repo.getRequest(requestId) };
      }
      return { alreadyProcessed: false, ...this.#applyApproved(request) };
    });
  }

  reject(requestId, reviewerId) {
    const request = this.repo.getRequest(requestId);
    if (!request) throw new RankError('not_found', 'Demande introuvable.');
    const ok = this.repo.claimForRejection(requestId, reviewerId, this.now());
    return { alreadyProcessed: !ok, request: this.repo.getRequest(requestId) };
  }

  /** Source de confiance (saisie admin, future API) : crée et valide d'un coup. */
  recordTrusted({ guildId, userId, playlist, rank, reviewerId, origin = 'admin' }) {
    this.#check({ playlist, rank });
    return this.repo.transaction(() => {
      // Une demande en attente pour la même cible devient caduque.
      const pending = this.repo.findPendingRequest(guildId, userId, playlist);
      if (pending) this.repo.claimForRejection(pending.id, reviewerId, this.now());
      const id = this.repo.insertRequest({
        guild_id: guildId,
        user_id: userId,
        playlist,
        rank,
        origin,
        created_at: this.now(),
      });
      this.repo.claimForApproval(id, reviewerId, this.now());
      return { alreadyProcessed: false, ...this.#applyApproved(this.repo.getRequest(id)) };
    });
  }

  #applyApproved(request) {
    const { guild_id: guildId, user_id: userId, playlist, rank, id } = request;
    const previous = this.repo.getValidatedRank(guildId, userId, playlist)?.rank ?? null;
    const changeType = classifyChange(previous, rank);
    const notifyRank = this.repo.getRankSettings(guildId, rank).notify;
    // Seules les nouveautés et promotions sont annoncées, jamais les rétrogradations.
    const shouldNotify = notifyRank && (changeType === 'first' || changeType === 'promotion');

    if (changeType !== 'same') this.repo.upsertValidatedRank(guildId, userId, playlist, rank, id, this.now());
    this.repo.setChangeInfo(id, changeType, previous, shouldNotify ? 'pending' : 'none');
    return { request: this.repo.getRequest(id), changeType, previousRank: previous, shouldNotify };
  }

  /** Meilleur rang validé du membre, toutes playlists confondues. */
  getHighestRank(guildId, userId) {
    return highestRank(this.repo.listValidatedRanks(guildId, userId).map((r) => r.rank));
  }

  getValidatedRanks(guildId, userId) {
    return this.repo.listValidatedRanks(guildId, userId);
  }
}
