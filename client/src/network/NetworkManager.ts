import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  NetChatMessage,
  NetMatchSnapshot,
  NetPlayerSnapshot,
  NetShotTracerEvent,
  PublicRoomListing,
  RoomStateInfo,
  ServerToClientEvents,
} from '@shared/protocols/network';
import type { DamageEvent, KillFeedEntry, Vec3 } from '@shared/types/common';
import type { MatchSummary } from '@shared/types/entity';
import type { HeroId } from '@shared/types/hero';
import type { MapId } from '@shared/types/map';
import type { WeaponId } from '@shared/types/weapon';
import {
  stepCombatantKinematics,
  type PlayerMoveInput,
} from '@shared/physics/MovementSimulation';
import type { AxisAlignedBox } from '@shared/physics/types';
import { PeerHostSession } from './PeerHostServer';

export interface SequencedMoveInput extends PlayerMoveInput {
  seq: number;
  dt: number;
}

export interface InterpolatedRemotePlayer {
  snapshot: NetPlayerSnapshot;
  position: Vec3;
  yaw: number;
  speed: number;
}

interface TimestampedSnapshot {
  receivedAt: number;
  snapshot: NetMatchSnapshot;
}

export interface NetworkCallbacks {
  onStatusChange?: (
    status: 'disconnected' | 'connecting' | 'connected' | 'p2p_host' | 'p2p_client',
    pingMs: number
  ) => void;
  onRoomUpdated?: (room: RoomStateInfo) => void;
  onRoomKicked?: (reason: string) => void;
  onRoomError?: (message: string) => void;
  onChatMessage?: (msg: NetChatMessage) => void;
  onMatchStarted?: (payload: {
    roomId: string;
    mapId: MapId;
    killLimit: number;
    durationSeconds: number;
    snapshot: NetMatchSnapshot;
  }) => void;
  onSnapshot?: (snapshot: NetMatchSnapshot) => void;
  onShotTracer?: (event: NetShotTracerEvent) => void;
  onDamage?: (event: DamageEvent) => void;
  onKillFeed?: (entry: KillFeedEntry) => void;
  onMatchEnded?: (summary: MatchSummary) => void;
}

/**
 * Gère la connexion multijoueur unifiée :
 * 1) Serveur Socket.IO (si disponible)
 * 2) Hôte P2P / Serveur Local embarqué dans le navigateur (style Blur, démarre chez n'importe qui)
 */
export class NetworkManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'p2p_host' | 'p2p_client' =
    'disconnected';
  private pingMs = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private localPlayerId: string | null = null;
  private currentRoom: RoomStateInfo | null = null;
  private activeTransport: 'none' | 'socket' | 'p2p' = 'none';
  private readonly peerHost: PeerHostSession;

  private inputSeq = 0;
  private pendingInputs: SequencedMoveInput[] = [];
  private snapshotBuffer: TimestampedSnapshot[] = [];
  private readonly interpolationDelayMs = 95;

  constructor(private callbacks: NetworkCallbacks = {}) {
    this.peerHost = new PeerHostSession({
      onRoomUpdated: (room) => {
        if (this.activeTransport === 'p2p') {
          this.currentRoom = room;
          this.callbacks.onRoomUpdated?.(room);
        }
      },
      onRoomKicked: (reason) => {
        if (this.activeTransport === 'p2p') {
          this.currentRoom = null;
          this.activeTransport = 'none';
          this.callbacks.onRoomKicked?.(reason);
        }
      },
      onRoomError: (message) => {
        if (this.activeTransport === 'p2p') {
          this.callbacks.onRoomError?.(message);
        }
      },
      onChatMessage: (msg) => {
        if (this.activeTransport === 'p2p') {
          this.callbacks.onChatMessage?.(msg);
        }
      },
      onMatchStarted: (payload) => {
        if (this.activeTransport === 'p2p') {
          this.inputSeq = 0;
          this.pendingInputs = [];
          this.snapshotBuffer = [{ receivedAt: performance.now(), snapshot: payload.snapshot }];
          this.callbacks.onMatchStarted?.(payload);
        }
      },
      onSnapshot: (snapshot) => {
        if (this.activeTransport === 'p2p') {
          this.snapshotBuffer.push({ receivedAt: performance.now(), snapshot });
          if (this.snapshotBuffer.length > 30) {
            this.snapshotBuffer.shift();
          }
          this.callbacks.onSnapshot?.(snapshot);
        }
      },
      onShotTracer: (ev) => {
        if (this.activeTransport === 'p2p') this.callbacks.onShotTracer?.(ev);
      },
      onDamage: (ev) => {
        if (this.activeTransport === 'p2p') this.callbacks.onDamage?.(ev);
      },
      onKillFeed: (entry) => {
        if (this.activeTransport === 'p2p') this.callbacks.onKillFeed?.(entry);
      },
      onMatchEnded: (summary) => {
        if (this.activeTransport === 'p2p') this.callbacks.onMatchEnded?.(summary);
      },
    });
  }

  public connect(serverUrl?: string): void {
    if (this.socket?.connected) return;
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      // Exécution PC hors ligne : Hôte P2P / LAN prêt immédiatement
      this.status = 'p2p_host';
      this.callbacks.onStatusChange?.(this.status, 0);
      return;
    }

    this.status = 'connecting';
    this.callbacks.onStatusChange?.(this.status, this.pingMs);

    this.socket = serverUrl
      ? io(serverUrl, { transports: ['websocket', 'polling'], reconnectionAttempts: 2 })
      : io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnectionAttempts: 2 });

    this.socket.on('connect', () => {
      this.localPlayerId = this.socket?.id ?? null;
      this.status = 'connected';
      this.callbacks.onStatusChange?.(this.status, this.pingMs);
      this.startPingLoop();
    });

    this.socket.on('disconnect', () => {
      if (this.activeTransport !== 'p2p') {
        this.status = 'disconnected';
        this.stopPingLoop();
        this.callbacks.onStatusChange?.(this.status, this.pingMs);
      }
    });

    this.socket.on('connect_error', () => {
      if (this.activeTransport !== 'p2p') {
        this.status = 'disconnected';
        this.callbacks.onStatusChange?.(this.status, 0);
      }
    });

    this.socket.on('pong:check', ({ clientTime }) => {
      this.pingMs = Math.max(1, Math.round(performance.now() - clientTime));
      this.callbacks.onStatusChange?.(this.status, this.pingMs);
    });

    this.socket.on('room:updated', (room) => {
      this.activeTransport = 'socket';
      this.currentRoom = room;
      this.callbacks.onRoomUpdated?.(room);
    });

    this.socket.on('room:kicked', ({ reason }) => {
      this.currentRoom = null;
      this.callbacks.onRoomKicked?.(reason);
    });

    this.socket.on('room:error', ({ message }) => {
      this.callbacks.onRoomError?.(message);
    });

    this.socket.on('chat:message', (msg) => {
      this.callbacks.onChatMessage?.(msg);
    });

    this.socket.on('match:started', (payload) => {
      this.activeTransport = 'socket';
      this.inputSeq = 0;
      this.pendingInputs = [];
      this.snapshotBuffer = [{ receivedAt: performance.now(), snapshot: payload.snapshot }];
      this.callbacks.onMatchStarted?.(payload);
    });

    this.socket.on('match:snapshot', (snapshot) => {
      this.snapshotBuffer.push({ receivedAt: performance.now(), snapshot });
      if (this.snapshotBuffer.length > 30) {
        this.snapshotBuffer.shift();
      }
      this.callbacks.onSnapshot?.(snapshot);
    });

    this.socket.on('match:shotTracer', (ev) => this.callbacks.onShotTracer?.(ev));
    this.socket.on('match:damage', (ev) => this.callbacks.onDamage?.(ev));
    this.socket.on('match:killFeed', (entry) => this.callbacks.onKillFeed?.(entry));
    this.socket.on('match:ended', (summary) => this.callbacks.onMatchEnded?.(summary));
  }

  public disconnect(): void {
    this.stopPingLoop();
    this.peerHost.dispose();
    this.socket?.disconnect();
    this.socket = null;
    this.localPlayerId = null;
    this.currentRoom = null;
    this.activeTransport = 'none';
    this.status = 'disconnected';
    this.callbacks.onStatusChange?.(this.status, 0);
  }

  public getStatus(): 'disconnected' | 'connecting' | 'connected' | 'p2p_host' | 'p2p_client' {
    return this.status;
  }

  public getPingMs(): number {
    return this.pingMs;
  }

  public getLocalPlayerId(): string | null {
    if (this.activeTransport === 'p2p') {
      return this.peerHost.localPlayerId;
    }
    return this.localPlayerId;
  }

  public getCurrentRoom(): RoomStateInfo | null {
    return this.currentRoom;
  }

  public isHostingP2P(): boolean {
    return this.activeTransport === 'p2p' && this.peerHost.getRole() === 'host';
  }

  public setP2PHostConfig(opts: { mapId?: MapId; botFillCount?: number }): void {
    if (opts.mapId) this.peerHost.setHostMapId(opts.mapId);
    if (typeof opts.botFillCount === 'number') this.peerHost.setBotFillCount(opts.botFillCount);
  }

  public getP2PBotFillCount(): number {
    return this.peerHost.getBotFillCount();
  }

  /**
   * Crée un salon : si un serveur Node est connecté et preferLocalHost n'est pas forcé,
   * utilise Socket.IO ; sinon promeut IMMÉDIATEMENT cet appareil en Serveur Hôte P2P (style Blur).
   */
  public async createRoom(params: {
    playerName: string;
    roomName: string;
    mapId?: MapId;
    killLimit?: number;
    heroId?: HeroId;
    weaponId?: WeaponId;
    isPrivate?: boolean;
    preferLocalHost?: boolean;
    botFillCount?: number;
  }): Promise<{ ok: boolean; room?: RoomStateInfo; error?: string }> {
    const useP2PHost = params.preferLocalHost || !this.socket?.connected;
    if (useP2PHost) {
      this.activeTransport = 'p2p';
      this.localPlayerId = this.peerHost.localPlayerId;
      this.status = 'p2p_host';
      this.callbacks.onStatusChange?.('p2p_host', 1);
      const room = this.peerHost.hostCreateRoom({
        playerName: params.playerName,
        roomName: params.roomName,
        mapId: params.mapId ?? 'tombouctou',
        killLimit: params.killLimit ?? 15,
        heroId: params.heroId,
        weaponId: params.weaponId,
        botFillCount: params.botFillCount ?? 3,
      });
      this.currentRoom = room;
      return { ok: true, room };
    }

    return new Promise((resolve) => {
      this.socket!.emit(
        'room:create',
        {
          playerName: params.playerName,
          roomName: params.roomName,
          mode: 'deathmatch',
          mapId: params.mapId ?? 'tombouctou',
          killLimit: params.killLimit ?? 15,
          isPrivate: params.isPrivate ?? false,
          heroId: params.heroId ?? 'sundiata',
          weaponId: params.weaponId ?? 'flintlock_musket',
        },
        (res) => {
          if (res.ok && res.room) {
            this.activeTransport = 'socket';
            this.currentRoom = res.room;
          }
          resolve(res);
        }
      );
    });
  }

  public async joinRoom(params: {
    code: string;
    playerName: string;
    heroId?: HeroId;
    weaponId?: WeaponId;
  }): Promise<{ ok: boolean; room?: RoomStateInfo; error?: string }> {
    // 1. Tenter le salon local LAN (BroadcastChannel) d'abord si pas de serveur Socket.IO ou si code trouvé en LAN
    const lanRes = await this.peerHost.joinLanRoomByCode({
      code: params.code,
      playerName: params.playerName,
      heroId: params.heroId ?? 'sundiata',
      weaponId: params.weaponId ?? 'flintlock_musket',
    });
    if (lanRes.ok && lanRes.room) {
      this.activeTransport = 'p2p';
      this.localPlayerId = this.peerHost.localPlayerId;
      this.currentRoom = lanRes.room;
      this.status = 'p2p_client';
      this.callbacks.onStatusChange?.('p2p_client', 4);
      return lanRes;
    }

    // 2. Sinon tenter le serveur Socket.IO
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({
          ok: false,
          error: 'Code introuvable en LAN. Utilisez le Code d’Invitation P2P (HRA-OFFER) pour rejoindre un hôte distant.',
        });
        return;
      }
      this.socket.emit(
        'room:join',
        {
          code: params.code,
          playerName: params.playerName,
          heroId: params.heroId ?? 'sundiata',
          weaponId: params.weaponId ?? 'flintlock_musket',
        },
        (res) => {
          if (res.ok && res.room) {
            this.activeTransport = 'socket';
            this.currentRoom = res.room;
          }
          resolve(res);
        }
      );
    });
  }

  public async createWebRtcInvite(): Promise<string> {
    return this.peerHost.createWebRtcInviteToken();
  }

  public async joinViaWebRtcOffer(params: {
    offerToken: string;
    playerName: string;
    heroId?: HeroId;
    weaponId?: WeaponId;
  }): Promise<string> {
    this.activeTransport = 'p2p';
    this.localPlayerId = this.peerHost.localPlayerId;
    this.status = 'p2p_client';
    this.callbacks.onStatusChange?.('p2p_client', 12);
    return this.peerHost.acceptWebRtcOfferToken({
      offerToken: params.offerToken,
      playerName: params.playerName,
      heroId: params.heroId ?? 'sundiata',
      weaponId: params.weaponId ?? 'flintlock_musket',
    });
  }

  public async acceptWebRtcAnswer(answerToken: string): Promise<void> {
    await this.peerHost.completeWebRtcAnswerToken(answerToken);
  }

  public async listRooms(): Promise<PublicRoomListing[]> {
    const lanRooms = await this.peerHost.discoverLanRooms();
    if (!this.socket?.connected) {
      return lanRooms;
    }
    const serverRooms = await new Promise<PublicRoomListing[]>((resolve) => {
      this.socket!.emit('room:list', (rooms) => resolve(rooms));
    });
    const seen = new Set(lanRooms.map((r) => r.roomId));
    return [...lanRooms, ...serverRooms.filter((r) => !seen.has(r.roomId))];
  }

  public leaveRoom(): void {
    if (this.activeTransport === 'p2p') {
      this.peerHost.leaveRoom();
    } else {
      this.socket?.emit('room:leave');
    }
    this.activeTransport = 'none';
    this.currentRoom = null;
    if (this.socket?.connected) {
      this.status = 'connected';
      this.callbacks.onStatusChange?.('connected', this.pingMs);
    }
  }

  public setReady(ready: boolean): void {
    if (this.activeTransport === 'p2p') this.peerHost.setReady(ready);
    else this.socket?.emit('room:ready', { ready });
  }

  public setLoadout(heroId: HeroId, weaponId: WeaponId): void {
    if (this.activeTransport === 'p2p') this.peerHost.setLoadout(heroId, weaponId);
    else this.socket?.emit('room:loadout', { heroId, weaponId });
  }

  public kickPlayer(targetPlayerId: string): void {
    if (this.activeTransport === 'p2p') this.peerHost.kickPlayer(targetPlayerId);
    else this.socket?.emit('room:kick', { targetPlayerId });
  }

  public startMatch(): void {
    if (this.activeTransport === 'p2p') this.peerHost.startMatch();
    else this.socket?.emit('room:start');
  }

  public sendChat(text: string, channel: 'lobby' | 'quick' = 'lobby'): void {
    if (this.activeTransport === 'p2p') this.peerHost.sendChat(text, channel);
    else this.socket?.emit('chat:send', { text, channel });
  }

  public sendInput(input: PlayerMoveInput, dt: number): number {
    const seq = ++this.inputSeq;
    const item: SequencedMoveInput = { ...input, seq, dt };
    this.pendingInputs.push(item);
    if (this.pendingInputs.length > 60) {
      this.pendingInputs.shift();
    }
    if (this.activeTransport === 'p2p') {
      this.peerHost.sendInput(item);
    } else {
      this.socket?.emit('game:input', item);
    }
    return seq;
  }

  public sendShoot(origin: Vec3, direction: Vec3, isAiming: boolean): void {
    if (this.activeTransport === 'p2p') {
      this.peerHost.sendShoot(origin, direction, isAiming);
    } else {
      this.socket?.emit('game:shoot', {
        seq: this.inputSeq,
        origin,
        direction,
        isAiming,
        clientTime: performance.now(),
      });
    }
  }

  public sendReload(): void {
    if (this.activeTransport === 'p2p') this.peerHost.sendReload();
    else this.socket?.emit('game:reload');
  }

  public sendSwitchWeapon(weaponId: WeaponId): void {
    if (this.activeTransport === 'p2p') this.peerHost.sendSwitchWeapon(weaponId);
    else this.socket?.emit('game:switchWeapon', { weaponId });
  }

  public reconcileLocalPlayer(
    serverPlayer: NetPlayerSnapshot,
    colliders: readonly AxisAlignedBox[]
  ): {
    position: Vec3;
    velocity: Vec3;
    isGrounded: boolean;
    isCrouching: boolean;
    isSprinting: boolean;
  } {
    this.pendingInputs = this.pendingInputs.filter(
      (inp) => inp.seq > serverPlayer.lastProcessedSeq
    );

    let state = {
      position: { ...serverPlayer.position },
      velocity: { ...serverPlayer.velocity },
      isGrounded: serverPlayer.isGrounded,
      isCrouching: serverPlayer.isCrouching,
      isSprinting: serverPlayer.isSprinting,
    };

    for (const inp of this.pendingInputs) {
      state = stepCombatantKinematics({
        ...state,
        input: inp,
        dt: inp.dt,
        colliders,
      });
    }

    return state;
  }

  public getInterpolatedRemotePlayers(nowMs = performance.now()): InterpolatedRemotePlayer[] {
    if (this.snapshotBuffer.length === 0) return [];
    const renderTime = nowMs - this.interpolationDelayMs;

    let older = this.snapshotBuffer[0];
    let newer = this.snapshotBuffer[this.snapshotBuffer.length - 1];

    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      const a = this.snapshotBuffer[i];
      const b = this.snapshotBuffer[i + 1];
      if (a.receivedAt <= renderTime && b.receivedAt >= renderTime) {
        older = a;
        newer = b;
        break;
      }
    }

    const span = newer.receivedAt - older.receivedAt;
    const t = span > 1 ? Math.min(1, Math.max(0, (renderTime - older.receivedAt) / span)) : 1;

    const results: InterpolatedRemotePlayer[] = [];
    for (const np of newer.snapshot.players) {
      if (np.id === this.localPlayerId) continue;
      const op = older.snapshot.players.find((p) => p.id === np.id) ?? np;

      const pos: Vec3 = {
        x: op.position.x + (np.position.x - op.position.x) * t,
        y: op.position.y + (np.position.y - op.position.y) * t,
        z: op.position.z + (np.position.z - op.position.z) * t,
      };
      const yaw = lerpAngle(op.yaw, np.yaw, t);
      const speed = Math.hypot(np.velocity.x, np.velocity.z);

      results.push({ snapshot: np, position: pos, yaw, speed });
    }
    return results;
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.socket?.emit('ping:check', performance.now());
    this.pingTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping:check', performance.now());
      }
    }, 2500);
  }

  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
