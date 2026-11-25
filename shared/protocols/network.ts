import type { DamageEvent, GameMode, KillFeedEntry, Vec3 } from '../types/common.js';
import type { CombatantStats, MatchSummary } from '../types/entity.js';
import type { HeroId } from '../types/hero.js';
import type { MapId } from '../types/map.js';
import type { WeaponId, WeaponRuntimeState } from '../types/weapon.js';

export type RoomStatus = 'waiting' | 'in_game' | 'ended';

export interface RoomMemberInfo {
  playerId: string;
  name: string;
  heroId: HeroId;
  weaponId: WeaponId;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
}

export interface RoomStateInfo {
  roomId: string;
  code: string;
  name: string;
  mode: GameMode;
  mapId: MapId;
  status: RoomStatus;
  maxPlayers: number;
  killLimit: number;
  durationSeconds: number;
  hostId: string;
  isPrivate: boolean;
  members: RoomMemberInfo[];
}

export interface PublicRoomListing {
  roomId: string;
  code: string;
  name: string;
  mode: GameMode;
  mapId: MapId;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
}

export interface NetPlayerSnapshot {
  id: string;
  name: string;
  heroId: HeroId;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  isAlive: boolean;
  respawnTimer: number;
  isGrounded: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  activeWeapon: WeaponRuntimeState;
  stats: CombatantStats;
  lastProcessedSeq: number;
}

export interface NetMatchSnapshot {
  tick: number;
  serverTime: number;
  timeRemaining: number;
  killLimit: number;
  players: NetPlayerSnapshot[];
}

export interface NetShotTracerEvent {
  shooterId: string;
  origin: Vec3;
  hitPoint: Vec3;
  normal: Vec3;
  hitWorldOrPlayer: boolean;
  isCharacterHit: boolean;
}

export interface NetChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  channel: 'lobby' | 'quick';
  timestamp: number;
}

export interface ClientToServerEvents {
  'ping:check': (clientTime: number) => void;
  'room:create': (
    payload: {
      playerName: string;
      roomName: string;
      mode?: GameMode;
      mapId?: MapId;
      maxPlayers?: number;
      killLimit?: number;
      isPrivate?: boolean;
      heroId?: HeroId;
      weaponId?: WeaponId;
    },
    ack?: (res: { ok: boolean; room?: RoomStateInfo; playerId?: string; error?: string }) => void
  ) => void;
  'room:join': (
    payload: {
      code: string;
      playerName: string;
      heroId?: HeroId;
      weaponId?: WeaponId;
    },
    ack?: (res: { ok: boolean; room?: RoomStateInfo; playerId?: string; error?: string }) => void
  ) => void;
  'room:leave': () => void;
  'room:list': (ack: (rooms: PublicRoomListing[]) => void) => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:loadout': (payload: { heroId: HeroId; weaponId: WeaponId }) => void;
  'room:kick': (payload: { targetPlayerId: string }) => void;
  'room:start': () => void;
  'chat:send': (payload: { text: string; channel?: 'lobby' | 'quick' }) => void;
  'game:input': (payload: {
    seq: number;
    dt: number;
    moveForward: number;
    moveRight: number;
    jump: boolean;
    sprint: boolean;
    crouch: boolean;
    yaw: number;
    pitch: number;
    isAiming: boolean;
  }) => void;
  'game:shoot': (payload: {
    seq: number;
    origin: Vec3;
    direction: Vec3;
    isAiming: boolean;
    clientTime: number;
  }) => void;
  'game:reload': () => void;
  'game:switchWeapon': (payload: { weaponId: WeaponId }) => void;
}

export interface ServerToClientEvents {
  'server:welcome': (payload: { version: string; message: string }) => void;
  'pong:check': (payload: { clientTime: number; serverTime: number }) => void;
  'room:updated': (room: RoomStateInfo) => void;
  'room:kicked': (payload: { reason: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'chat:message': (msg: NetChatMessage) => void;
  'match:started': (payload: {
    roomId: string;
    mapId: MapId;
    killLimit: number;
    durationSeconds: number;
    snapshot: NetMatchSnapshot;
  }) => void;
  'match:snapshot': (snapshot: NetMatchSnapshot) => void;
  'match:shotTracer': (event: NetShotTracerEvent) => void;
  'match:damage': (event: DamageEvent) => void;
  'match:killFeed': (entry: KillFeedEntry) => void;
  'match:ended': (summary: MatchSummary) => void;
}
