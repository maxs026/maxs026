/** Implémentation Discord du transport utilisé par le Notifier. */
export class DiscordTransport {
  constructor(client) {
    this.client = client;
  }

  async #channel(channelId) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !('send' in channel)) {
      throw new Error(`Salon ${channelId} introuvable ou non textuel`);
    }
    return channel;
  }

  async send(channelId, payload) {
    const message = await (await this.#channel(channelId)).send(payload);
    return message.id;
  }

  /** Ajoute des réactions, dans l'ordre, à un message du salon. */
  async react(channelId, messageId, emojis) {
    const message = await (await this.#channel(channelId)).messages.fetch(messageId);
    for (const emoji of emojis) await message.react(emoji);
  }

  /** Cherche, parmi les derniers messages du bot, un embed dont le pied contient le marqueur. */
  async findMarker(channelId, marker) {
    const channel = await this.#channel(channelId);
    const messages = await channel.messages.fetch({ limit: 50 });
    const hit = messages.find(
      (m) => m.author.id === this.client.user.id && m.embeds.some((e) => e.footer?.text === marker),
    );
    return hit?.id ?? null;
  }
}
