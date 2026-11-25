import type { PublicRoomListing } from '../../../shared/protocols/network.js';
import type { GameMode } from '../../../shared/types/common.js';
import type { RoomManager } from '../rooms/RoomManager.js';

/**
 * Service de matchmaking : sélection rapide de salons disponibles et socle
 * extensible vers le matchmaking classé (MMR) dans les versions ultérieures.
 */
export class MatchmakingManager {
  constructor(private roomManager: RoomManager) {}

  public findBestOpenRoom(mode: GameMode = 'deathmatch'): PublicRoomListing | null {
    const candidates = this.roomManager
      .listPublicRooms()
      .filter((r) => r.status === 'waiting' && r.mode === mode && r.playerCount < r.maxPlayers);

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.playerCount - a.playerCount);
    return candidates[0];
  }
}
