import { GAMEPLAY_CONSTANTS } from '@shared/constants/game';
import { getHeroDefinition } from '@shared/heroes/heroesConfig';
import { getMapDefinition } from '@shared/maps/mapRegistry';
import {
  buildMapColliders,
  raycastWorldAndCombatants,
} from '@shared/physics/AabbCollision';
import {
  stepCombatantKinematics,
  type PlayerMoveInput,
} from '@shared/physics/MovementSimulation';
import type { AxisAlignedBox } from '@shared/physics/types';
import type {
  NetChatMessage,
  NetMatchSnapshot,
  NetPlayerSnapshot,
  NetShotTracerEvent,
  PublicRoomListing,
  RoomMemberInfo,
  RoomStateInfo,
} from '@shared/protocols/network';
import type { DamageEvent, KillFeedEntry, Vec3 } from '@shared/types/common';
import type { CombatantState, MatchSummary } from '@shared/types/entity';
import type { HeroId } from '@shared/types/hero';
import type { MapId } from '@shared/types/map';
import type { WeaponId } from '@shared/types/weapon';
import {
  createInitialWeaponState,
  getWeaponDefinition,
} from '@shared/weapons/weaponsConfig';

export interface PeerTransportCallbacks {
  onRoomUpdated: (room: RoomStateInfo) => void;
  onRoomKicked: (reason: string) => void;
  onRoomError: (message: string) => void;
  onChatMessage: (msg: NetChatMessage) => void;
  onMatchStarted: (payload: {
    roomId: string;
    mapId: MapId;
    killLimit: number;
    durationSeconds: number;
    snapshot: NetMatchSnapshot;
  }) => void;
  onSnapshot: (snapshot: NetMatchSnapshot) => void;
  onShotTracer: (event: NetShotTracerEvent) => void;
  onDamage: (event: DamageEvent) => void;
  onKillFeed: (entry: KillFeedEntry) => void;
  onMatchEnded: (summary: MatchSummary) => void;
}

interface QueuedPeerInput extends PlayerMoveInput {
  seq: number;
  dt: number;
}

interface HostPlayerEntity {
  member: RoomMemberInfo;
  combatant: CombatantState;
  lastProcessedSeq: number;
  inputQueue: QueuedPeerInput[];
  isBot?: boolean;
  botCooldown?: number;
  botTurnTimer?: number;
}

type LanWireEnvelope =
  | { kind: 'lan:discover'; requesterId: string }
  | { kind: 'lan:announce'; listing: PublicRoomListing }
  | { kind: 'lan:join'; roomCode: string; playerId: string; playerName: string; heroId: HeroId; weaponId: WeaponId }
  | { kind: 'lan:joinAck'; targetId: string; ok: boolean; room?: RoomStateInfo; error?: string }
  | { kind: 'peer:msg'; roomId: string; fromId: string; targetId?: string; event: string; payload: unknown };

const LAN_CHANNEL_NAME = 'heritage-p2p-lan-v1';
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Serveur autoritaire embarqué dans le navigateur du joueur Hôte (style Blur / LAN & P2P).
 * Permet à N'IMPORTE QUI qui crée un salon de devenir immédiatement le serveur du match,
 * sans nécessiter de serveur Node central, tout en supportant :
 * - Multi-onglets / local via BroadcastChannel
 * - Connexion directe entre différents PC / appareils via WebRTC DataChannel (Offre/Réponse)
 * - Démarrage immédiat même seul avec bots IA de remplissage
 */
export class PeerHostSession {
  public readonly localPlayerId: string;
  private role: 'none' | 'host' | 'client' = 'none';
  private lanChannel: BroadcastChannel | null = null;
  private rtcPeers = new Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel | null }>();
  private clientRtc: { pc: RTCPeerConnection; dc: RTCDataChannel | null } | null = null;

  // État côté Hôte (Serveur autoritaire)
  private roomId = '';
  private roomCode = '';
  private roomName = '';
  private mapId: MapId = 'tombouctou';
  private killLimit = 15;
  private durationSeconds = GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION;
  private botFillCount = 3;
  private status: 'waiting' | 'in_game' | 'ended' = 'waiting';
  private players = new Map<string, HostPlayerEntity>();
  private colliders: AxisAlignedBox[] = [];
  private killFeed: KillFeedEntry[] = [];
  private tickCounter = 0;
  private timeRemaining: number = GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION;
  private loopHandle: ReturnType<typeof setInterval> | null = null;

  // État côté Client P2P
  private joinedRoom: RoomStateInfo | null = null;
  private pendingJoinResolve: ((res: { ok: boolean; room?: RoomStateInfo; error?: string }) => void) | null = null;
  private discoveredRooms = new Map<string, { listing: PublicRoomListing; seenAt: number }>();

  constructor(private callbacks: PeerTransportCallbacks) {
    this.localPlayerId = `p2p_${Math.random().toString(36).slice(2, 10)}`;
    this.initLanChannel();
  }

  private initLanChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.lanChannel = new BroadcastChannel(LAN_CHANNEL_NAME);
      this.lanChannel.onmessage = (ev: MessageEvent<LanWireEnvelope>) => {
        this.handleLanEnvelope(ev.data);
      };
    } catch {
      this.lanChannel = null;
    }
  }

  public getRole(): 'none' | 'host' | 'client' {
    return this.role;
  }

  public getCurrentRoom(): RoomStateInfo | null {
    if (this.role === 'host') return this.buildRoomState();
    return this.joinedRoom;
  }

  public setBotFillCount(count: number): void {
    this.botFillCount = Math.max(0, Math.min(8, Math.floor(count)));
  }

  public getBotFillCount(): number {
    return this.botFillCount;
  }

  public setHostMapId(mapId: MapId): void {
    if (this.role !== 'host' || this.status !== 'waiting') return;
    this.mapId = mapId;
    this.broadcastRoomState();
  }

  /**
   * Démarre immédiatement cet appareil comme Serveur Hôte (style Blur).
   */
  public hostCreateRoom(params: {
    playerName: string;
    roomName: string;
    mapId?: MapId;
    killLimit?: number;
    heroId?: HeroId;
    weaponId?: WeaponId;
    botFillCount?: number;
  }): RoomStateInfo {
    this.leaveRoom();
    this.role = 'host';
    this.roomId = `p2p_room_${Date.now().toString(36)}`;
    this.roomCode = this.generateCode();
    this.roomName = params.roomName.trim() || 'Salon P2P';
    this.mapId = params.mapId ?? 'tombouctou';
    this.killLimit = params.killLimit ?? 15;
    this.durationSeconds = GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION;
    this.timeRemaining = this.durationSeconds;
    this.botFillCount = params.botFillCount ?? 3;
    this.status = 'waiting';
    this.players.clear();

    const mapDef = getMapDefinition(this.mapId);
    this.colliders = buildMapColliders(mapDef);

    const sp = mapDef.spawnPoints[0] ?? { position: { x: 0, y: 0.2, z: 0 }, yaw: 0 };
    const member: RoomMemberInfo = {
      playerId: this.localPlayerId,
      name: params.playerName.trim() || 'Hôte',
      heroId: params.heroId ?? 'sundiata',
      weaponId: params.weaponId ?? 'flintlock_musket',
      isHost: true,
      isReady: true,
      connected: true,
    };
    this.players.set(this.localPlayerId, {
      member,
      combatant: this.createCombatant(member, sp.position, sp.yaw),
      lastProcessedSeq: 0,
      inputQueue: [],
    });

    const state = this.buildRoomState();
    this.callbacks.onRoomUpdated(state);
    this.announceLanRoom();
    return state;
  }

  public async discoverLanRooms(): Promise<PublicRoomListing[]> {
    const now = Date.now();
    for (const [k, v] of this.discoveredRooms.entries()) {
      if (now - v.seenAt > 6000) this.discoveredRooms.delete(k);
    }
    this.lanChannel?.postMessage({
      kind: 'lan:discover',
      requesterId: this.localPlayerId,
    } satisfies LanWireEnvelope);
    await new Promise((r) => setTimeout(r, 180));
    const list = Array.from(this.discoveredRooms.values()).map((x) => x.listing);
    if (this.role === 'host') {
      list.unshift(this.buildPublicListing());
    }
    return list;
  }

  public async joinLanRoomByCode(params: {
    code: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }): Promise<{ ok: boolean; room?: RoomStateInfo; error?: string }> {
    if (!this.lanChannel) {
      return { ok: false, error: 'Salon local introuvable.' };
    }
    const normalized = params.code.trim().toUpperCase();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingJoinResolve) {
          this.pendingJoinResolve = null;
          resolve({ ok: false, error: 'Aucun hôte local trouvé avec ce code.' });
        }
      }, 900);

      this.pendingJoinResolve = (res) => {
        clearTimeout(timer);
        if (res.ok && res.room) {
          this.role = 'client';
          this.joinedRoom = res.room;
          this.roomId = res.room.roomId;
          this.roomCode = res.room.code;
          this.callbacks.onRoomUpdated(res.room);
        }
        resolve(res);
      };

      this.lanChannel!.postMessage({
        kind: 'lan:join',
        roomCode: normalized,
        playerId: this.localPlayerId,
        playerName: params.playerName,
        heroId: params.heroId,
        weaponId: params.weaponId,
      } satisfies LanWireEnvelope);
    });
  }

  /**
   * HÔTE : génère un code d'invitation WebRTC P2P direct (fonctionne entre 2 PC sans serveur central).
   */
  public async createWebRtcInviteToken(): Promise<string> {
    if (this.role !== 'host') {
      throw new Error('Créez d’abord un salon pour devenir Hôte.');
    }
    const peerId = `rtc_${Math.random().toString(36).slice(2, 9)}`;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const dc = pc.createDataChannel('heritage-match', { ordered: false, maxRetransmits: 2 });
    this.setupHostDataChannel(peerId, dc);
    this.rtcPeers.set(peerId, { pc, dc });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, 2200);

    const payload = {
      v: 1,
      peerId,
      roomCode: this.roomCode,
      roomName: this.roomName,
      sdp: pc.localDescription?.sdp ?? '',
      type: pc.localDescription?.type ?? 'offer',
    };
    return 'HRA-OFFER:' + encodeToken(payload);
  }

  /**
   * CLIENT : accepte un code `HRA-OFFER:...` reçu d'un Hôte et renvoie un code réponse `HRA-ANS:...`.
   */
  public async acceptWebRtcOfferToken(params: {
    offerToken: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }): Promise<string> {
    const clean = params.offerToken.trim();
    if (!clean.startsWith('HRA-OFFER:')) {
      throw new Error('Code d’invitation invalide (doit commencer par HRA-OFFER:).');
    }
    const decoded = decodeToken<{
      peerId: string;
      roomCode: string;
      roomName: string;
      sdp: string;
      type: RTCSdpType;
    }>(clean.slice('HRA-OFFER:'.length));

    this.leaveRoom();
    this.role = 'client';
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.clientRtc = { pc, dc: null };

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      if (this.clientRtc) this.clientRtc.dc = dc;
      dc.onopen = () => {
        this.sendToHost('p2p:hello', {
          playerId: this.localPlayerId,
          playerName: params.playerName,
          heroId: params.heroId,
          weaponId: params.weaponId,
        });
      };
      dc.onmessage = (msgEv) => {
        try {
          const parsed = JSON.parse(String(msgEv.data)) as { event: string; payload: unknown };
          this.handleClientServerEvent(parsed.event, parsed.payload);
        } catch {
          // ignore malformed
        }
      };
    };

    await pc.setRemoteDescription({ type: decoded.type, sdp: decoded.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc, 2200);

    return (
      'HRA-ANS:' +
      encodeToken({
        peerId: decoded.peerId,
        sdp: pc.localDescription?.sdp ?? '',
        type: pc.localDescription?.type ?? 'answer',
      })
    );
  }

  /**
   * HÔTE : finalise la connexion d'un joueur distant en collant son `HRA-ANS:...`.
   */
  public async completeWebRtcAnswerToken(answerToken: string): Promise<void> {
    if (this.role !== 'host') {
      throw new Error('Vous n’êtes pas Hôte d’un salon.');
    }
    const clean = answerToken.trim();
    if (!clean.startsWith('HRA-ANS:')) {
      throw new Error('Code réponse invalide (doit commencer par HRA-ANS:).');
    }
    const decoded = decodeToken<{ peerId: string; sdp: string; type: RTCSdpType }>(
      clean.slice('HRA-ANS:'.length)
    );
    const peer = this.rtcPeers.get(decoded.peerId);
    if (!peer) {
      throw new Error('Session d’invitation expirée ou introuvable. Générez un nouveau code.');
    }
    await peer.pc.setRemoteDescription({ type: decoded.type, sdp: decoded.sdp });
  }

  private setupHostDataChannel(peerId: string, dc: RTCDataChannel): void {
    let remotePlayerId: string | null = null;
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { event: string; payload: unknown };
        if (msg.event === 'p2p:hello') {
          const p = msg.payload as {
            playerId: string;
            playerName: string;
            heroId: HeroId;
            weaponId: WeaponId;
          };
          remotePlayerId = p.playerId;
          this.hostAddRemotePlayer(p);
          return;
        }
        if (remotePlayerId) {
          this.handleHostInboundEvent(remotePlayerId, msg.event, msg.payload);
        }
      } catch {
        // ignore
      }
    };
    dc.onclose = () => {
      if (remotePlayerId) {
        this.hostRemovePlayer(remotePlayerId);
      }
      this.rtcPeers.delete(peerId);
    };
  }

  private handleLanEnvelope(env: LanWireEnvelope): void {
    if (env.kind === 'lan:discover') {
      if (this.role === 'host' && env.requesterId !== this.localPlayerId) {
        this.announceLanRoom();
      }
      return;
    }

    if (env.kind === 'lan:announce') {
      if (this.role !== 'host') {
        this.discoveredRooms.set(env.listing.roomId, {
          listing: env.listing,
          seenAt: Date.now(),
        });
      }
      return;
    }

    if (env.kind === 'lan:join') {
      if (this.role !== 'host' || env.roomCode !== this.roomCode) return;
      const added = this.hostAddRemotePlayer({
        playerId: env.playerId,
        playerName: env.playerName,
        heroId: env.heroId,
        weaponId: env.weaponId,
      });
      this.lanChannel?.postMessage({
        kind: 'lan:joinAck',
        targetId: env.playerId,
        ok: added.ok,
        room: added.ok ? this.buildRoomState() : undefined,
        error: added.error,
      } satisfies LanWireEnvelope);
      return;
    }

    if (env.kind === 'lan:joinAck' && env.targetId === this.localPlayerId) {
      this.pendingJoinResolve?.({ ok: env.ok, room: env.room, error: env.error });
      this.pendingJoinResolve = null;
      return;
    }

    if (env.kind === 'peer:msg' && env.roomId === this.roomId) {
      if (env.targetId && env.targetId !== this.localPlayerId) return;
      if (this.role === 'host' && env.fromId !== this.localPlayerId) {
        this.handleHostInboundEvent(env.fromId, env.event, env.payload);
      } else if (this.role === 'client' && env.fromId !== this.localPlayerId) {
        this.handleClientServerEvent(env.event, env.payload);
      }
    }
  }

  private announceLanRoom(): void {
    if (this.role !== 'host') return;
    this.lanChannel?.postMessage({
      kind: 'lan:announce',
      listing: this.buildPublicListing(),
    } satisfies LanWireEnvelope);
  }

  private hostAddRemotePlayer(params: {
    playerId: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }): { ok: boolean; error?: string } {
    if (this.status !== 'waiting') {
      return { ok: false, error: 'Partie déjà en cours.' };
    }
    if (this.players.size >= 12) {
      return { ok: false, error: 'Salon complet (12/12).' };
    }
    const mapDef = getMapDefinition(this.mapId);
    const sp = mapDef.spawnPoints[this.players.size % mapDef.spawnPoints.length];
    const member: RoomMemberInfo = {
      playerId: params.playerId,
      name: params.playerName.trim() || 'Joueur',
      heroId: params.heroId,
      weaponId: params.weaponId,
      isHost: false,
      isReady: true,
      connected: true,
    };
    this.players.set(params.playerId, {
      member,
      combatant: this.createCombatant(member, sp.position, sp.yaw),
      lastProcessedSeq: 0,
      inputQueue: [],
    });
    this.broadcastRoomState();
    return { ok: true };
  }

  private hostRemovePlayer(playerId: string): void {
    if (!this.players.delete(playerId)) return;
    this.broadcastRoomState();
  }

  public startMatch(): void {
    if (this.role !== 'host') return;
    const mapDef = getMapDefinition(this.mapId);
    this.colliders = buildMapColliders(mapDef);

    // Supprimer d'anciens bots avant de recréer les bots de remplissage
    for (const [id, ent] of this.players.entries()) {
      if (ent.isBot) this.players.delete(id);
    }

    const humanCount = this.players.size;
    const botsToAdd = humanCount === 1 ? Math.max(1, this.botFillCount) : this.botFillCount;
    const botHeroes: HeroId[] = ['amina', 'shaka', 'nzinga', 'makeda', 'ogun'];
    const botWeapons: WeaponId[] = ['flintlock_musket', 'repeating_rifle', 'imperial_carbine', 'war_bow'];
    const botNames = ['Amina-Bot', 'Shaka-Bot', 'Nzinga-Bot', 'Makeda-Bot', 'Ogun-Bot', 'Kankou-Bot', 'Gao-Bot', 'Zazzau-Bot'];

    for (let i = 0; i < botsToAdd; i++) {
      const botId = `host_bot_${i + 1}`;
      const member: RoomMemberInfo = {
        playerId: botId,
        name: botNames[i % botNames.length],
        heroId: botHeroes[i % botHeroes.length],
        weaponId: botWeapons[i % botWeapons.length],
        isHost: false,
        isReady: true,
        connected: true,
      };
      const sp = mapDef.spawnPoints[(humanCount + i) % mapDef.spawnPoints.length];
      this.players.set(botId, {
        member,
        combatant: this.createCombatant(member, sp.position, sp.yaw),
        lastProcessedSeq: 0,
        inputQueue: [],
        isBot: true,
        botCooldown: 0.6 + i * 0.25,
        botTurnTimer: 0,
      });
    }

    this.status = 'in_game';
    this.tickCounter = 0;
    this.timeRemaining = this.durationSeconds;
    this.killFeed = [];

    let idx = 0;
    for (const ent of this.players.values()) {
      const sp = mapDef.spawnPoints[idx % mapDef.spawnPoints.length];
      idx++;
      ent.combatant = this.createCombatant(ent.member, sp.position, sp.yaw);
      ent.lastProcessedSeq = 0;
      ent.inputQueue = [];
    }

    const snapshot = this.buildSnapshot();
    this.emitRoomEvent('match:started', {
      roomId: this.roomId,
      mapId: this.mapId,
      killLimit: this.killLimit,
      durationSeconds: this.durationSeconds,
      snapshot,
    });
    this.broadcastRoomState();

    this.stopLoop();
    this.loopHandle = setInterval(() => this.stepHostTick(0.05), 50);
  }

  public setReady(ready: boolean): void {
    if (this.role === 'host') {
      const me = this.players.get(this.localPlayerId);
      if (me) me.member.isReady = ready;
      this.broadcastRoomState();
    } else if (this.role === 'client') {
      this.sendToHost('room:ready', { ready });
    }
  }

  public setLoadout(heroId: HeroId, weaponId: WeaponId): void {
    if (this.role === 'host') {
      const me = this.players.get(this.localPlayerId);
      if (me) {
        me.member.heroId = heroId;
        me.member.weaponId = weaponId;
      }
      this.broadcastRoomState();
    } else if (this.role === 'client') {
      this.sendToHost('room:loadout', { heroId, weaponId });
    }
  }

  public kickPlayer(targetPlayerId: string): void {
    if (this.role !== 'host' || targetPlayerId === this.localPlayerId) return;
    this.emitPlayerEvent(targetPlayerId, 'room:kicked', { reason: 'Expulsé par l’hôte.' });
    this.hostRemovePlayer(targetPlayerId);
  }

  public sendChat(text: string, channel: 'lobby' | 'quick' = 'lobby'): void {
    if (this.role === 'host') {
      const sender = this.players.get(this.localPlayerId)?.member.name ?? 'Hôte';
      this.emitRoomEvent('chat:message', {
        id: `c_${Date.now().toString(36)}`,
        roomId: this.roomId,
        senderId: this.localPlayerId,
        senderName: sender,
        text: text.slice(0, 160),
        channel,
        timestamp: Date.now(),
      } satisfies NetChatMessage);
    } else if (this.role === 'client') {
      this.sendToHost('chat:send', { text, channel });
    }
  }

  public sendInput(input: QueuedPeerInput): void {
    if (this.role === 'host') {
      const me = this.players.get(this.localPlayerId);
      if (me && me.combatant.isAlive) {
        if (me.inputQueue.length >= 16) me.inputQueue.shift();
        me.inputQueue.push(input);
      }
    } else if (this.role === 'client') {
      this.sendToHost('game:input', input);
    }
  }

  public sendShoot(origin: Vec3, direction: Vec3, isAiming: boolean): void {
    if (this.role === 'host') {
      this.processHostShoot(this.localPlayerId, { origin, direction, isAiming });
    } else if (this.role === 'client') {
      this.sendToHost('game:shoot', { origin, direction, isAiming });
    }
  }

  public sendReload(): void {
    if (this.role === 'host') {
      const me = this.players.get(this.localPlayerId);
      if (me && me.combatant.isAlive) {
        const w = getWeaponDefinition(me.combatant.activeWeapon.weaponId);
        me.combatant.activeWeapon.isReloading = true;
        me.combatant.activeWeapon.reloadTimer = w.stats.reloadTime;
      }
    } else if (this.role === 'client') {
      this.sendToHost('game:reload', {});
    }
  }

  public sendSwitchWeapon(weaponId: WeaponId): void {
    if (this.role === 'host') {
      const me = this.players.get(this.localPlayerId);
      if (me) me.combatant.activeWeapon = createInitialWeaponState(weaponId);
    } else if (this.role === 'client') {
      this.sendToHost('game:switchWeapon', { weaponId });
    }
  }

  public leaveRoom(): void {
    this.stopLoop();
    for (const p of this.rtcPeers.values()) {
      p.dc?.close();
      p.pc.close();
    }
    this.rtcPeers.clear();
    if (this.clientRtc) {
      this.clientRtc.dc?.close();
      this.clientRtc.pc.close();
      this.clientRtc = null;
    }
    if (this.role === 'client' && this.roomId) {
      this.sendToHost('room:leave', {});
    }
    this.role = 'none';
    this.status = 'waiting';
    this.joinedRoom = null;
    this.players.clear();
  }

  private handleHostInboundEvent(fromId: string, event: string, payload: unknown): void {
    const ent = this.players.get(fromId);
    if (!ent) return;
    if (event === 'room:leave') {
      this.hostRemovePlayer(fromId);
    } else if (event === 'room:ready') {
      ent.member.isReady = Boolean((payload as { ready?: boolean }).ready);
      this.broadcastRoomState();
    } else if (event === 'room:loadout') {
      const p = payload as { heroId: HeroId; weaponId: WeaponId };
      ent.member.heroId = p.heroId;
      ent.member.weaponId = p.weaponId;
      this.broadcastRoomState();
    } else if (event === 'chat:send') {
      const p = payload as { text: string; channel?: 'lobby' | 'quick' };
      this.emitRoomEvent('chat:message', {
        id: `c_${Date.now().toString(36)}`,
        roomId: this.roomId,
        senderId: fromId,
        senderName: ent.member.name,
        text: String(p.text ?? '').slice(0, 160),
        channel: p.channel ?? 'lobby',
        timestamp: Date.now(),
      } satisfies NetChatMessage);
    } else if (event === 'game:input') {
      const inp = payload as QueuedPeerInput;
      if (ent.combatant.isAlive && inp.seq > ent.lastProcessedSeq) {
        if (ent.inputQueue.length >= 16) ent.inputQueue.shift();
        ent.inputQueue.push(inp);
      }
    } else if (event === 'game:shoot') {
      const s = payload as { origin: Vec3; direction: Vec3; isAiming: boolean };
      this.processHostShoot(fromId, s);
    } else if (event === 'game:reload') {
      const w = getWeaponDefinition(ent.combatant.activeWeapon.weaponId);
      ent.combatant.activeWeapon.isReloading = true;
      ent.combatant.activeWeapon.reloadTimer = w.stats.reloadTime;
    } else if (event === 'game:switchWeapon') {
      const sw = payload as { weaponId: WeaponId };
      ent.combatant.activeWeapon = createInitialWeaponState(sw.weaponId);
    }
  }

  private handleClientServerEvent(event: string, payload: unknown): void {
    if (event === 'room:updated') {
      this.joinedRoom = payload as RoomStateInfo;
      this.callbacks.onRoomUpdated(this.joinedRoom);
    } else if (event === 'room:kicked') {
      this.leaveRoom();
      this.callbacks.onRoomKicked((payload as { reason: string }).reason);
    } else if (event === 'room:error') {
      this.callbacks.onRoomError((payload as { message: string }).message);
    } else if (event === 'chat:message') {
      this.callbacks.onChatMessage(payload as NetChatMessage);
    } else if (event === 'match:started') {
      const p = payload as {
        roomId: string;
        mapId: MapId;
        killLimit: number;
        durationSeconds: number;
        snapshot: NetMatchSnapshot;
      };
      this.callbacks.onMatchStarted(p);
    } else if (event === 'match:snapshot') {
      this.callbacks.onSnapshot(payload as NetMatchSnapshot);
    } else if (event === 'match:shotTracer') {
      this.callbacks.onShotTracer(payload as NetShotTracerEvent);
    } else if (event === 'match:damage') {
      this.callbacks.onDamage(payload as DamageEvent);
    } else if (event === 'match:killFeed') {
      this.callbacks.onKillFeed(payload as KillFeedEntry);
    } else if (event === 'match:ended') {
      this.callbacks.onMatchEnded(payload as MatchSummary);
    }
  }

  private emitRoomEvent(event: string, payload: unknown): void {
    this.handleClientServerEvent(event, payload);
    this.lanChannel?.postMessage({
      kind: 'peer:msg',
      roomId: this.roomId,
      fromId: this.localPlayerId,
      event,
      payload,
    } satisfies LanWireEnvelope);
    const json = JSON.stringify({ event, payload });
    for (const p of this.rtcPeers.values()) {
      if (p.dc && p.dc.readyState === 'open') {
        p.dc.send(json);
      }
    }
  }

  private emitPlayerEvent(targetId: string, event: string, payload: unknown): void {
    if (targetId === this.localPlayerId) {
      this.handleClientServerEvent(event, payload);
      return;
    }
    this.lanChannel?.postMessage({
      kind: 'peer:msg',
      roomId: this.roomId,
      fromId: this.localPlayerId,
      targetId,
      event,
      payload,
    } satisfies LanWireEnvelope);
    const json = JSON.stringify({ event, payload });
    for (const p of this.rtcPeers.values()) {
      if (p.dc && p.dc.readyState === 'open') {
        p.dc.send(json);
      }
    }
  }

  private sendToHost(event: string, payload: unknown): void {
    if (this.clientRtc?.dc && this.clientRtc.dc.readyState === 'open') {
      this.clientRtc.dc.send(JSON.stringify({ event, payload }));
      return;
    }
    this.lanChannel?.postMessage({
      kind: 'peer:msg',
      roomId: this.roomId,
      fromId: this.localPlayerId,
      event,
      payload,
    } satisfies LanWireEnvelope);
  }

  private stepHostTick(dt: number): void {
    if (this.status !== 'in_game') return;
    this.tickCounter++;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const mapDef = getMapDefinition(this.mapId);

    for (const ent of this.players.values()) {
      const c = ent.combatant;
      if (!c.isAlive) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          const sp = mapDef.spawnPoints[Math.floor(Math.random() * mapDef.spawnPoints.length)];
          c.isAlive = true;
          c.health = c.maxHealth;
          c.armor = c.maxArmor;
          c.position = { ...sp.position };
          c.velocity = { x: 0, y: 0, z: 0 };
          c.yaw = sp.yaw;
        }
        continue;
      }

      if (c.activeWeapon.fireCooldown > 0) {
        c.activeWeapon.fireCooldown = Math.max(0, c.activeWeapon.fireCooldown - dt);
      }
      if (c.activeWeapon.isReloading) {
        c.activeWeapon.reloadTimer -= dt;
        if (c.activeWeapon.reloadTimer <= 0) {
          const wDef = getWeaponDefinition(c.activeWeapon.weaponId);
          c.activeWeapon.isReloading = false;
          c.activeWeapon.ammoInMag = wDef.stats.magazineSize;
        }
      }

      if (ent.isBot) {
        this.stepHostBot(ent, dt);
        continue;
      }

      let processed = 0;
      while (ent.inputQueue.length > 0 && processed < 4) {
        const inp = ent.inputQueue.shift()!;
        const stepDt = Math.min(0.05, Math.max(0.005, inp.dt));
        const res = stepCombatantKinematics({
          position: c.position,
          velocity: c.velocity,
          isGrounded: c.isGrounded,
          isCrouching: c.isCrouching,
          isSprinting: c.isSprinting,
          input: inp,
          dt: stepDt,
          colliders: this.colliders,
        });
        c.position = res.position;
        c.velocity = res.velocity;
        c.isGrounded = res.isGrounded;
        c.isCrouching = res.isCrouching;
        c.isSprinting = res.isSprinting;
        c.yaw = inp.yaw;
        c.pitch = inp.pitch;
        ent.lastProcessedSeq = inp.seq;
        processed++;
      }
    }

    this.emitRoomEvent('match:snapshot', this.buildSnapshot());

    for (const ent of this.players.values()) {
      if (ent.combatant.stats.kills >= this.killLimit) {
        this.endHostMatch('kill_limit');
        return;
      }
    }
    if (this.timeRemaining <= 0) {
      this.endHostMatch('time_up');
    }
  }

  private stepHostBot(botEnt: HostPlayerEntity, dt: number): void {
    const c = botEnt.combatant;
    let nearest: HostPlayerEntity | null = null;
    let nearestDist = Infinity;
    for (const other of this.players.values()) {
      if (other === botEnt || !other.combatant.isAlive) continue;
      const d = Math.hypot(
        other.combatant.position.x - c.position.x,
        other.combatant.position.z - c.position.z
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearest = other;
      }
    }

    let forward = 0;
    let right = 0;
    if (nearest) {
      const dx = nearest.combatant.position.x - c.position.x;
      const dz = nearest.combatant.position.z - c.position.z;
      c.yaw = Math.atan2(-dx, -dz);
      if (nearestDist > 12) forward = 1;
      else if (nearestDist < 6) forward = -0.5;
      botEnt.botTurnTimer = (botEnt.botTurnTimer ?? 0) + dt;
      right = Math.sin(botEnt.botTurnTimer * 1.4) * 0.7;

      botEnt.botCooldown = (botEnt.botCooldown ?? 0.5) - dt;
      if (botEnt.botCooldown <= 0 && nearestDist < 42) {
        botEnt.botCooldown = 0.85 + Math.random() * 0.75;
        const len = Math.max(0.01, Math.hypot(dx, dz));
        const spread = 0.06;
        const dir: Vec3 = {
          x: dx / len + (Math.random() - 0.5) * spread,
          y: (nearest.combatant.position.y - c.position.y) / len + (Math.random() - 0.5) * 0.03,
          z: dz / len + (Math.random() - 0.5) * spread,
        };
        const dLen = Math.hypot(dir.x, dir.y, dir.z);
        this.processHostShoot(botEnt.member.playerId, {
          origin: { x: c.position.x, y: c.position.y + 1.5, z: c.position.z },
          direction: { x: dir.x / dLen, y: dir.y / dLen, z: dir.z / dLen },
          isAiming: false,
        });
      }
    }

    const res = stepCombatantKinematics({
      position: c.position,
      velocity: c.velocity,
      isGrounded: c.isGrounded,
      isCrouching: false,
      isSprinting: false,
      input: {
        moveForward: forward,
        moveRight: right,
        jump: false,
        sprint: false,
        crouch: false,
        isAiming: false,
        yaw: c.yaw,
        pitch: 0,
      },
      dt,
      colliders: this.colliders,
    });
    c.position = res.position;
    c.velocity = res.velocity;
    c.isGrounded = res.isGrounded;
  }

  private processHostShoot(
    shooterId: string,
    payload: { origin: Vec3; direction: Vec3; isAiming: boolean }
  ): void {
    const shooterEnt = this.players.get(shooterId);
    if (!shooterEnt || !shooterEnt.combatant.isAlive || this.status !== 'in_game') return;
    const shooter = shooterEnt.combatant;
    const wDef = getWeaponDefinition(shooter.activeWeapon.weaponId);

    if (shooter.activeWeapon.fireCooldown > 0 || shooter.activeWeapon.isReloading) return;
    if (wDef.category !== 'melee' && shooter.activeWeapon.ammoInMag <= 0) return;

    shooter.activeWeapon.fireCooldown = (1 / Math.max(0.2, wDef.stats.fireRate)) * 0.85;
    if (wDef.category !== 'melee') shooter.activeWeapon.ammoInMag -= 1;
    shooter.stats.shotsFired += 1;

    const allCombatants = Array.from(this.players.values()).map((e) => e.combatant);
    const ray = raycastWorldAndCombatants({
      origin: payload.origin,
      direction: payload.direction,
      maxDistance: wDef.stats.range,
      shooterId,
      combatants: allCombatants,
      colliders: this.colliders,
    });

    const hitTarget = ray.combatantId ? this.players.get(ray.combatantId) ?? null : null;
    const isHeadshot = Boolean(ray.isHeadshot);
    const hitPoint = ray.point;

    this.emitRoomEvent('match:shotTracer', {
      shooterId,
      origin: payload.origin,
      hitPoint,
      normal: ray.normal,
      hitWorldOrPlayer: ray.hit,
      isCharacterHit: Boolean(hitTarget),
    } satisfies NetShotTracerEvent);

    if (hitTarget) {
      const target = hitTarget.combatant;
      const dmg = Math.round(wDef.stats.damage * (isHeadshot ? wDef.stats.headshotMultiplier : 1));
      shooter.stats.shotsHit += 1;
      shooter.stats.damageDealt += dmg;
      if (isHeadshot) shooter.stats.headshots += 1;

      const armorAbsorb = Math.min(target.armor, Math.round(dmg * 0.45));
      target.armor -= armorAbsorb;
      const hpDmg = Math.max(1, dmg - armorAbsorb);
      target.health = Math.max(0, target.health - hpDmg);
      const isElimination = target.health <= 0;

      this.emitRoomEvent('match:damage', {
        attackerId: shooterId,
        targetId: target.id,
        weaponId: wDef.id,
        rawDamage: dmg,
        finalDamage: hpDmg + armorAbsorb,
        armorDamage: armorAbsorb,
        healthDamage: hpDmg,
        isHeadshot,
        isElimination,
        hitPoint,
        sourceDirection: payload.direction,
      } satisfies DamageEvent);

      if (isElimination) {
        target.isAlive = false;
        target.respawnTimer = 3.2;
        target.stats.deaths += 1;
        shooter.stats.kills += 1;
        const entry: KillFeedEntry = {
          id: `kf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          killerId: shooter.id,
          killerName: shooter.name,
          victimId: target.id,
          victimName: target.name,
          weaponName: wDef.nameFr,
          isHeadshot,
          timestamp: Date.now(),
        };
        this.killFeed.push(entry);
        this.emitRoomEvent('match:killFeed', entry);
      }
    }
  }

  private endHostMatch(reason: 'kill_limit' | 'time_up'): void {
    this.stopLoop();
    this.status = 'ended';
    const leaderboard = Array.from(this.players.values())
      .map((e) => ({
        id: e.combatant.id,
        name: e.combatant.name,
        isBot: Boolean(e.isBot),
        heroId: e.combatant.heroId,
        kills: e.combatant.stats.kills,
        deaths: e.combatant.stats.deaths,
        damageDealt: e.combatant.stats.damageDealt,
      }))
      .sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt);

    const hostStats = this.players.get(this.localPlayerId)?.combatant.stats ?? {
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
    };

    this.emitRoomEvent('match:ended', {
      victory: leaderboard[0]?.id === this.localPlayerId,
      reason,
      durationPlayed: Math.round(this.durationSeconds - this.timeRemaining),
      playerStats: { ...hostStats },
      leaderboard,
      killFeed: [...this.killFeed],
    } satisfies MatchSummary);
  }

  private stopLoop(): void {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
  }

  private createCombatant(member: RoomMemberInfo, pos: Vec3, yaw: number): CombatantState {
    const hero = getHeroDefinition(member.heroId);
    return {
      id: member.playerId,
      name: member.name,
      isBot: member.playerId.startsWith('host_bot_'),
      heroId: member.heroId,
      position: { ...pos },
      yaw,
      pitch: 0,
      velocity: { x: 0, y: 0, z: 0 },
      health: hero.stats.maxHealth,
      maxHealth: hero.stats.maxHealth,
      armor: hero.stats.maxArmor,
      maxArmor: hero.stats.maxArmor,
      isAlive: true,
      respawnTimer: 0,
      isGrounded: true,
      isSprinting: false,
      isCrouching: false,
      isSliding: false,
      activeWeapon: createInitialWeaponState(member.weaponId),
      stats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        headshots: 0,
        shotsFired: 0,
        shotsHit: 0,
      },
    };
  }

  private buildSnapshot(): NetMatchSnapshot {
    const players: NetPlayerSnapshot[] = Array.from(this.players.values()).map((e) => ({
      id: e.combatant.id,
      name: e.combatant.name,
      heroId: e.combatant.heroId,
      position: { ...e.combatant.position },
      velocity: { ...e.combatant.velocity },
      yaw: e.combatant.yaw,
      pitch: e.combatant.pitch,
      health: e.combatant.health,
      maxHealth: e.combatant.maxHealth,
      armor: e.combatant.armor,
      maxArmor: e.combatant.maxArmor,
      isAlive: e.combatant.isAlive,
      respawnTimer: e.combatant.respawnTimer,
      isGrounded: e.combatant.isGrounded,
      isSprinting: e.combatant.isSprinting,
      isCrouching: e.combatant.isCrouching,
      isSliding: e.combatant.isSliding,
      activeWeapon: { ...e.combatant.activeWeapon },
      stats: { ...e.combatant.stats },
      lastProcessedSeq: e.lastProcessedSeq,
    }));
    return {
      tick: this.tickCounter,
      serverTime: Date.now(),
      timeRemaining: this.timeRemaining,
      killLimit: this.killLimit,
      players,
    };
  }

  private buildPublicListing(): PublicRoomListing {
    return {
      roomId: this.roomId,
      code: this.roomCode,
      name: `${this.roomName} (Hôte P2P)`,
      mode: 'deathmatch',
      mapId: this.mapId,
      playerCount: this.players.size,
      maxPlayers: 12,
      status: this.status,
    };
  }

  private buildRoomState(): RoomStateInfo {
    return {
      roomId: this.roomId,
      code: this.roomCode,
      name: this.roomName,
      mode: 'deathmatch',
      mapId: this.mapId,
      status: this.status,
      maxPlayers: 12,
      killLimit: this.killLimit,
      durationSeconds: this.durationSeconds,
      hostId: this.localPlayerId,
      isPrivate: false,
      members: Array.from(this.players.values()).map((e) => ({ ...e.member })),
    };
  }

  private broadcastRoomState(): void {
    const state = this.buildRoomState();
    this.emitRoomEvent('room:updated', state);
    this.announceLanRoom();
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  public dispose(): void {
    this.leaveRoom();
    this.lanChannel?.close();
    this.lanChannel = null;
  }
}

async function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const handler = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', handler);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', handler);
  });
}

function encodeToken(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function decodeToken<T>(b64: string): T {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
