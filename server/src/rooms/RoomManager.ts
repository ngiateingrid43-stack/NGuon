import type { PublicRoomListing } from '../../../shared/protocols/network.js';
import type { GameMode } from '../../../shared/types/common.js';
import type { HeroId } from '../../../shared/types/hero.js';
import type { MapId } from '../../../shared/types/map.js';
import type { WeaponId } from '../../../shared/types/weapon.js';
import { AntiCheatManager } from '../anti-cheat/AntiCheatManager.js';
import { GameRoom, type RoomBroadcaster } from './GameRoom.js';

/**
 * Gestionnaire des salons multijoueurs : création, accès par code, fermeture automatique des salons vides.
 */
export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private codeToRoomId = new Map<string, string>();
  private playerToRoomId = new Map<string, string>();
  private roomSeq = 0;

  constructor(
    private antiCheat: AntiCheatManager,
    private broadcaster: RoomBroadcaster
  ) {}

  public createRoom(params: {
    hostId: string;
    playerName: string;
    roomName: string;
    mode: GameMode;
    mapId: MapId;
    maxPlayers: number;
    killLimit: number;
    isPrivate: boolean;
    heroId: HeroId;
    weaponId: WeaponId;
  }): { ok: boolean; room?: GameRoom; error?: string } {
    // Quitter un éventuel salon précédent
    this.leaveCurrentRoom(params.hostId);

    const roomId = `room_${++this.roomSeq}_${Date.now().toString(36)}`;
    const code = this.generateRoomCode();

    const room = new GameRoom({
      roomId,
      code,
      name: params.roomName,
      mode: params.mode,
      mapId: params.mapId,
      maxPlayers: params.maxPlayers,
      killLimit: params.killLimit,
      hostId: params.hostId,
      isPrivate: params.isPrivate,
      antiCheat: this.antiCheat,
      broadcaster: this.broadcaster,
    });

    const joined = room.addPlayer({
      playerId: params.hostId,
      name: params.playerName,
      heroId: params.heroId,
      weaponId: params.weaponId,
    });

    if (!joined.ok) {
      return { ok: false, error: joined.error };
    }

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(code, roomId);
    this.playerToRoomId.set(params.hostId, roomId);

    return { ok: true, room };
  }

  public joinRoomByCode(params: {
    code: string;
    playerId: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }): { ok: boolean; room?: GameRoom; error?: string } {
    const normalizedCode = params.code.trim().toUpperCase();
    const roomId = this.codeToRoomId.get(normalizedCode);
    if (!roomId) {
      return { ok: false, error: 'Code de salon introuvable.' };
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      return { ok: false, error: 'Ce salon n’existe plus.' };
    }

    this.leaveCurrentRoom(params.playerId);

    const res = room.addPlayer({
      playerId: params.playerId,
      name: params.playerName,
      heroId: params.heroId,
      weaponId: params.weaponId,
    });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    this.playerToRoomId.set(params.playerId, roomId);
    return { ok: true, room };
  }

  public leaveCurrentRoom(playerId: string): string | null {
    const roomId = this.playerToRoomId.get(playerId);
    if (!roomId) return null;

    this.playerToRoomId.delete(playerId);
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.removePlayer(playerId);
    if (room.getPlayerCount() === 0) {
      room.destroy();
      this.rooms.delete(roomId);
      this.codeToRoomId.delete(room.code);
    }
    return roomId;
  }

  public kickFromRoom(requesterId: string, targetPlayerId: string): boolean {
    const room = this.getRoomOfPlayer(requesterId);
    if (!room) return false;
    const kicked = room.kickPlayer(requesterId, targetPlayerId);
    if (kicked) {
      this.playerToRoomId.delete(targetPlayerId);
      if (room.getPlayerCount() === 0) {
        room.destroy();
        this.rooms.delete(room.roomId);
        this.codeToRoomId.delete(room.code);
      }
    }
    return kicked;
  }

  public getRoomOfPlayer(playerId: string): GameRoom | undefined {
    const roomId = this.playerToRoomId.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  public listPublicRooms(): PublicRoomListing[] {
    const listings: PublicRoomListing[] = [];
    for (const room of this.rooms.values()) {
      if (room.isPrivate) continue;
      listings.push({
        roomId: room.roomId,
        code: room.code,
        name: room.name,
        mode: room.mode,
        mapId: room.mapId,
        playerCount: room.getPlayerCount(),
        maxPlayers: room.maxPlayers,
        status: room.status,
      });
    }
    return listings;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public destroyAll(): void {
    for (const room of this.rooms.values()) {
      room.destroy();
    }
    this.rooms.clear();
    this.codeToRoomId.clear();
    this.playerToRoomId.clear();
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.codeToRoomId.has(code));
    return code;
  }
}
