import { buildAnnouncement, footerMarker } from './embed.js';

/**
 * Envoie les annonces. Ne connaît ni la source des rangs ni Discord :
 * il parle à un `transport` ({ send, findMarker }) injecté.
 *
 * Garantie : une demande validée produit au plus une annonce.
 *  - pending -> sending est atomique (double clic, tick concurrent) ;
 *  - après un crash, les envois restés en `sending` sont recherchés dans le
 *    salon (marqueur dans le pied d'embed) avant tout nouvel envoi.
 */
export class Notifier {
  constructor({ repo, transport, logger, maxAttempts = 5 }) {
    this.repo = repo;
    this.transport = transport;
    this.log = logger;
    this.maxAttempts = maxAttempts;
  }

  /** @returns {Promise<'sent'|'skipped'|'failed'|'retry'>} */
  async deliver(requestId) {
    if (!this.repo.claimNotification(requestId)) return 'skipped';
    const request = this.repo.getRequest(requestId);
    try {
      const settings = this.repo.getGuildSettings(request.guild_id);
      if (!settings.announce_channel_id) throw new Error('Salon d’annonces non configuré');
      const payload = buildAnnouncement(request, this.repo.getRankSettings(request.guild_id, request.rank), settings);
      const messageId = await this.transport.send(settings.announce_channel_id, payload);
      this.repo.markNotificationSent(requestId, messageId);
      return 'sent';
    } catch (err) {
      this.repo.failNotification(requestId, this.maxAttempts);
      const state = this.repo.getRequest(requestId).notify_state;
      this.log.error({ err, requestId, state }, 'Échec de l’envoi de l’annonce');
      return state === 'failed' ? 'failed' : 'retry';
    }
  }

  /** À appeler au démarrage : rattrape les envois interrompus par un arrêt. */
  async recover() {
    for (const request of this.repo.listNotifications('sending')) {
      const { announce_channel_id: channelId } = this.repo.getGuildSettings(request.guild_id);
      let found = null;
      try {
        found = channelId ? await this.transport.findMarker(channelId, footerMarker(request.id)) : null;
      } catch (err) {
        this.log.error({ err, requestId: request.id }, 'Vérification de l’annonce impossible');
        // Dans le doute, on ne renvoie pas : mieux vaut une annonce manquante qu’un doublon.
        this.repo.releaseNotification(request.id, 'failed');
        continue;
      }
      if (found) this.repo.markNotificationSent(request.id, found);
      else this.repo.releaseNotification(request.id, 'pending');
    }
    return this.dispatchPending();
  }

  async dispatchPending() {
    const results = [];
    for (const request of this.repo.listNotifications('pending')) {
      results.push(await this.deliver(request.id));
    }
    return results;
  }
}
