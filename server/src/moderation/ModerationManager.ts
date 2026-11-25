/**
 * Modération basique côté serveur : anti-spam du chat et filtrage/assainissement des messages.
 */
export class ModerationManager {
  private lastMessageTimestamps = new Map<string, number>();
  private readonly minIntervalMs = 800;
  private readonly blockedTerms = ['spamword_forbidden'];

  public canSendChat(playerId: string, now = Date.now()): boolean {
    const prev = this.lastMessageTimestamps.get(playerId) ?? 0;
    if (now - prev < this.minIntervalMs) {
      return false;
    }
    this.lastMessageTimestamps.set(playerId, now);
    return true;
  }

  public sanitizeMessage(raw: string): string {
    let clean = raw.replace(/[<>]/g, '').trim().slice(0, 200);
    for (const term of this.blockedTerms) {
      const re = new RegExp(term, 'gi');
      clean = clean.replace(re, '***');
    }
    return clean;
  }

  public clearPlayer(playerId: string): void {
    this.lastMessageTimestamps.delete(playerId);
  }
}
