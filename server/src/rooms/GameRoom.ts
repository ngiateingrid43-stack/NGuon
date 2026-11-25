import { GAMEPLAY_CONSTANTS } from '../../../shared/constants/game.js';
import { getHeroDefinition } from '../../../shared/heroes/heroesConfig.js';
import type {
  NetMatchSnapshot,
  NetPlayerSnapshot,
  RoomMemberInfo,
  RoomStateInfo,
  RoomStatus,
} from '../../../shared/protocols/network.js';
import type { GameMode, KillFeedEntry, Vec3 } from '../../../shared/types/common.js';
import type { CombatantState, MatchSummary } from '../../../shared/types/entity.js';
import type { HeroId } from '../../../shared/types/hero.js';
import type { MapId } from '../../../shared/types/map.js';
import type { WeaponId } from '../../../shared/types/weapon.js';
import {
  createInitialWeaponState,
  getWeaponDefinition,
} from '../../../shared/weapons/weaponsConfig.js';
import { AntiCheatManager } from '../anti-cheat/AntiCheatManager.js';
import { ServerCombatManager } from '../combat/ServerCombatManager.js';
import { ServerPhysics } from '../physics/ServerPhysics.js';
import type { PlayerMoveInput } from '../../../shared/physics/MovementSimulation.js';

export interface QueuedInput extends PlayerMoveInput {
  seq: number;
  dt: number;
}

interface ServerPlayerEntity {
  member: RoomMemberInfo;
  combatant: CombatantState;
  lastProcessedSeq: number;
  inputQueue: QueuedInput[];
}

export interface RoomBroadcaster {
  toRoom: <E extends string>(roomId: string, event: E, payload: unknown) => void;
  toPlayer: <E extends string>(playerId: string, event: E, payload: unknown) => void;
}

/**
 * Salon de jeu autoritaire gérant l'attente en lobby, la boucle Deathmatch à 20 Hz,
 * la physique serveur, la validation des tirs et les réapparitions.
 */
export class GameRoom {
  public readonly roomId: string;
  public readonly code: string;
  public name: string;
  public mode: GameMode;
  public mapId: MapId;
  public status: RoomStatus = 'waiting';
  public maxPlayers: number;
  public killLimit: number;
  public durationSeconds: number;
  public hostId: string;
  public isPrivate: boolean;

  private readonly physics: ServerPhysics;
  private readonly combat = new ServerCombatManager();
  private readonly antiCheat: AntiCheatManager;
  private readonly broadcaster: RoomBroadcaster;

  private players = new Map<string, ServerPlayerEntity>();
  private killFeed: KillFeedEntry[] = [];
  private tickCounter = 0;
  private timeRemaining: number;
  private loopHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = Date.now();

  constructor(params: {
    roomId: string;
    code: string;
    name: string;
    mode: GameMode;
    mapId: MapId;
    maxPlayers: number;
    killLimit: number;
    durationSeconds?: number;
    hostId: string;
    isPrivate: boolean;
    antiCheat: AntiCheatManager;
    broadcaster: RoomBroadcaster;
  }) {
    this.roomId = params.roomId;
    this.code = params.code;
    this.name = params.name;
    this.mode = params.mode;
    this.mapId = params.mapId;
    this.maxPlayers = params.maxPlayers;
    this.killLimit = params.killLimit;
    this.durationSeconds = params.durationSeconds ?? GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION;
    this.timeRemaining = this.durationSeconds;
    this.hostId = params.hostId;
    this.isPrivate = params.isPrivate;
    this.antiCheat = params.antiCheat;
    this.broadcaster = params.broadcaster;
    this.physics = new ServerPhysics(this.mapId);
  }

  public addPlayer(params: {
    playerId: string;
    name: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }): { ok: boolean; error?: string } {
    if (this.players.size >= this.maxPlayers) {
      return { ok: false, error: 'Salon complet.' };
    }
    if (this.status === 'in_game') {
      return { ok: false, error: 'Une partie est déjà en cours dans ce salon.' };
    }

    const isHost = this.players.size === 0 || this.hostId === params.playerId;
    if (isHost) this.hostId = params.playerId;

    const member: RoomMemberInfo = {
      playerId: params.playerId,
      name: params.name,
      heroId: params.heroId,
      weaponId: params.weaponId,
      isHost,
      isReady: isHost,
      connected: true,
    };

    const spawn = this.pickSpawnPoint();
    const combatant = this.createCombatant(member, spawn.position, spawn.yaw);
    this.players.set(params.playerId, {
      member,
      combatant,
      lastProcessedSeq: 0,
      inputQueue: [],
    });

    this.broadcastRoomState();
    return { ok: true };
  }

  public removePlayer(playerId: string): boolean {
    const existed = this.players.delete(playerId);
    if (!existed) return false;
    this.antiCheat.clearPlayer(playerId);

    if (this.players.size === 0) {
      this.stopLoop();
      return true;
    }

    if (this.hostId === playerId) {
      const next = this.players.values().next().value;
      if (next) {
        this.hostId = next.member.playerId;
        next.member.isHost = true;
        next.member.isReady = true;
      }
    }

    if (this.status === 'in_game' && this.players.size < 2) {
      this.endMatch('aborted');
    } else {
      this.broadcastRoomState();
    }
    return true;
  }

  public kickPlayer(requesterId: string, targetPlayerId: string): boolean {
    if (requesterId !== this.hostId || requesterId === targetPlayerId) return false;
    if (!this.players.has(targetPlayerId)) return false;

    this.broadcaster.toPlayer(targetPlayerId, 'room:kicked', {
      reason: 'Expulsé par l’hôte du salon.',
    });
    this.removePlayer(targetPlayerId);
    return true;
  }

  public setReady(playerId: string, ready: boolean): void {
    const p = this.players.get(playerId);
    if (!p || this.status !== 'waiting') return;
    p.member.isReady = ready;
    this.broadcastRoomState();
  }

  public setLoadout(playerId: string, heroId: HeroId, weaponId: WeaponId): void {
    const p = this.players.get(playerId);
    if (!p || this.status !== 'waiting') return;
    p.member.heroId = heroId;
    p.member.weaponId = weaponId;
    this.broadcastRoomState();
  }

  public startMatch(requesterId: string): { ok: boolean; error?: string } {
    if (requesterId !== this.hostId) {
      return { ok: false, error: 'Seul l’hôte peut lancer la partie.' };
    }
    if (this.players.size < 2) {
      return { ok: false, error: 'Au moins 2 joueurs sont nécessaires.' };
    }
    if (this.status === 'in_game') {
      return { ok: false, error: 'La partie est déjà lancée.' };
    }

    this.status = 'in_game';
    this.tickCounter = 0;
    this.timeRemaining = this.durationSeconds;
    this.killFeed = [];

    const spawns = this.physics.getMap().spawnPoints;
    let idx = 0;
    for (const p of this.players.values()) {
      const sp = spawns[idx % spawns.length];
      idx += 1;
      p.combatant = this.createCombatant(p.member, sp.position, sp.yaw);
      p.lastProcessedSeq = 0;
      p.inputQueue = [];
    }

    const initialSnapshot = this.buildSnapshot();
    this.broadcaster.toRoom(this.roomId, 'match:started', {
      roomId: this.roomId,
      mapId: this.mapId,
      killLimit: this.killLimit,
      durationSeconds: this.durationSeconds,
      snapshot: initialSnapshot,
    });
    this.broadcastRoomState();

    this.startLoop();
    return { ok: true };
  }

  public queueInput(playerId: string, input: QueuedInput): void {
    if (this.status !== 'in_game') return;
    const p = this.players.get(playerId);
    if (!p || !p.combatant.isAlive) return;
    if (input.seq <= p.lastProcessedSeq) return;
    if (p.inputQueue.length >= 16) {
      p.inputQueue.shift();
    }
    p.inputQueue.push(input);
  }

  public processShoot(
    playerId: string,
    payload: { seq: number; origin: Vec3; direction: Vec3; isAiming: boolean }
  ): void {
    if (this.status !== 'in_game') return;
    const shooterEntity = this.players.get(playerId);
    if (!shooterEntity) return;
    const shooter = shooterEntity.combatant;

    if (!this.antiCheat.validateShotTimingAndAmmo(shooter)) return;
    if (!this.antiCheat.validateShotOrigin(shooter, payload.origin)) return;

    const def = getWeaponDefinition(shooter.activeWeapon.weaponId);
    shooter.activeWeapon.ammoInMag -= 1;
    shooter.activeWeapon.fireCooldown = 1 / def.stats.fireRate;
    shooter.stats.shotsFired += 1;

    const len = Math.hypot(payload.direction.x, payload.direction.y, payload.direction.z) || 1;
    const dir: Vec3 = {
      x: payload.direction.x / len,
      y: payload.direction.y / len,
      z: payload.direction.z / len,
    };

    const allCombatants = Array.from(this.players.values()).map((e) => e.combatant);
    const hit = this.physics.raycastShot({
      origin: payload.origin,
      direction: dir,
      maxDistance: def.stats.range,
      shooterId: shooter.id,
      combatants: allCombatants,
    });

    this.broadcaster.toRoom(this.roomId, 'match:shotTracer', {
      shooterId: shooter.id,
      origin: payload.origin,
      hitPoint: hit.point,
      normal: hit.normal,
      hitWorldOrPlayer: hit.hit,
      isCharacterHit: hit.hitType === 'combatant',
    });

    if (hit.hitType === 'combatant' && hit.combatantId) {
      const targetEntity = this.players.get(hit.combatantId);
      if (targetEntity) {
        const result = this.combat.applyServerDamage({
          attacker: shooter,
          target: targetEntity.combatant,
          weaponId: shooter.activeWeapon.weaponId,
          isHeadshot: Boolean(hit.isHeadshot),
          hitPoint: hit.point,
          sourceDirection: dir,
        });
        if (result) {
          this.broadcaster.toRoom(this.roomId, 'match:damage', result.damageEvent);
          if (result.killFeedEntry) {
            this.killFeed.push(result.killFeedEntry);
            this.broadcaster.toRoom(this.roomId, 'match:killFeed', result.killFeedEntry);
          }
        }
      }
    }

    if (shooter.activeWeapon.ammoInMag === 0 && shooter.activeWeapon.reserveAmmo > 0) {
      this.startReload(playerId);
    }
  }

  public startReload(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p || this.status !== 'in_game' || !p.combatant.isAlive) return;
    const weapon = p.combatant.activeWeapon;
    const def = getWeaponDefinition(weapon.weaponId);
    if (weapon.isReloading || weapon.ammoInMag >= def.stats.magazineSize || weapon.reserveAmmo <= 0) {
      return;
    }
    weapon.isReloading = true;
    weapon.reloadTimer = def.stats.reloadTime;
  }

  public switchWeapon(playerId: string, weaponId: WeaponId): void {
    const p = this.players.get(playerId);
    if (!p || this.status !== 'in_game' || !p.combatant.isAlive) return;
    p.combatant.activeWeapon = createInitialWeaponState(weaponId);
  }

  /**
   * Exécute un pas de simulation serveur (appelé à 20 Hz par la boucle, ou manuellement en test).
   */
  public stepTick(dtSeconds: number): void {
    if (this.status !== 'in_game') return;

    this.tickCounter += 1;
    this.timeRemaining = Math.max(0, this.timeRemaining - dtSeconds);

    const allCombatants = Array.from(this.players.values()).map((p) => p.combatant);

    for (const p of this.players.values()) {
      const c = p.combatant;

      // Gestion respawn
      if (!c.isAlive) {
        c.respawnTimer -= dtSeconds;
        if (c.respawnTimer <= 0) {
          const sp = this.pickSpawnPoint(allCombatants);
          c.position = { ...sp.position };
          c.velocity = { x: 0, y: 0, z: 0 };
          c.yaw = sp.yaw;
          c.pitch = 0;
          c.health = c.maxHealth;
          c.armor = c.maxArmor;
          c.isAlive = true;
          c.activeWeapon = createInitialWeaponState(p.member.weaponId);
        }
        continue;
      }

      // Timers d'arme
      const w = c.activeWeapon;
      if (w.fireCooldown > 0) w.fireCooldown = Math.max(0, w.fireCooldown - dtSeconds);
      if (w.isReloading) {
        w.reloadTimer -= dtSeconds;
        if (w.reloadTimer <= 0) {
          const def = getWeaponDefinition(w.weaponId);
          const needed = def.stats.magazineSize - w.ammoInMag;
          const transfer = Math.min(needed, w.reserveAmmo);
          w.ammoInMag += transfer;
          w.reserveAmmo -= transfer;
          w.isReloading = false;
          w.reloadTimer = 0;
        }
      }

      // Simulation physique des entrées en attente
      while (p.inputQueue.length > 0) {
        const inp = p.inputQueue.shift()!;
        const prevPos = { ...c.position };
        this.physics.stepPlayer(c, inp, inp.dt);
        this.antiCheat.validateTeleportGuard(c.id, prevPos, c.position, inp.dt);
        p.lastProcessedSeq = inp.seq;
      }
    }

    const snapshot = this.buildSnapshot();
    this.broadcaster.toRoom(this.roomId, 'match:snapshot', snapshot);

    const limitWinner = allCombatants.find((c) => c.stats.kills >= this.killLimit);
    if (limitWinner) {
      this.endMatch('kill_limit');
    } else if (this.timeRemaining <= 0) {
      this.endMatch('time_up');
    }
  }

  private endMatch(reason: 'kill_limit' | 'time_up' | 'aborted'): void {
    this.stopLoop();
    this.status = 'waiting';

    const all = Array.from(this.players.values())
      .map((p) => p.combatant)
      .sort((a, b) => b.stats.kills - a.stats.kills);
    const top = all[0];

    const summary: MatchSummary = {
      victory: Boolean(top),
      reason,
      durationPlayed: this.durationSeconds - this.timeRemaining,
      playerStats: top ? { ...top.stats } : {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        headshots: 0,
        shotsFired: 0,
        shotsHit: 0,
      },
      leaderboard: all.map((c) => ({
        id: c.id,
        name: c.name,
        isBot: false,
        heroId: c.heroId,
        kills: c.stats.kills,
        deaths: c.stats.deaths,
        damageDealt: c.stats.damageDealt,
      })),
      killFeed: [...this.killFeed],
    };

    this.broadcaster.toRoom(this.roomId, 'match:ended', summary);
    this.broadcastRoomState();
  }

  public getRoomStateInfo(): RoomStateInfo {
    return {
      roomId: this.roomId,
      code: this.code,
      name: this.name,
      mode: this.mode,
      mapId: this.mapId,
      status: this.status,
      maxPlayers: this.maxPlayers,
      killLimit: this.killLimit,
      durationSeconds: this.durationSeconds,
      hostId: this.hostId,
      isPrivate: this.isPrivate,
      members: Array.from(this.players.values()).map((p) => ({ ...p.member })),
    };
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  public getCombatant(playerId: string): CombatantState | undefined {
    return this.players.get(playerId)?.combatant;
  }

  public buildSnapshot(): NetMatchSnapshot {
    const players: NetPlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.combatant.id,
      name: p.combatant.name,
      heroId: p.combatant.heroId,
      position: { ...p.combatant.position },
      velocity: { ...p.combatant.velocity },
      yaw: p.combatant.yaw,
      pitch: p.combatant.pitch,
      health: p.combatant.health,
      maxHealth: p.combatant.maxHealth,
      armor: p.combatant.armor,
      maxArmor: p.combatant.maxArmor,
      isAlive: p.combatant.isAlive,
      respawnTimer: p.combatant.respawnTimer,
      isGrounded: p.combatant.isGrounded,
      isSprinting: p.combatant.isSprinting,
      isCrouching: p.combatant.isCrouching,
      isSliding: p.combatant.isSliding,
      activeWeapon: { ...p.combatant.activeWeapon },
      stats: { ...p.combatant.stats },
      lastProcessedSeq: p.lastProcessedSeq,
    }));

    return {
      tick: this.tickCounter,
      serverTime: Date.now(),
      timeRemaining: this.timeRemaining,
      killLimit: this.killLimit,
      players,
    };
  }

  private createCombatant(
    member: RoomMemberInfo,
    position: Vec3,
    yaw: number
  ): CombatantState {
    const hero = getHeroDefinition(member.heroId);
    return {
      id: member.playerId,
      name: member.name,
      isBot: false,
      heroId: member.heroId,
      position: { ...position },
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

  private pickSpawnPoint(combatants: readonly CombatantState[] = []) {
    const spawns = this.physics.getMap().spawnPoints;
    if (combatants.length === 0) {
      return spawns[this.players.size % spawns.length];
    }
    let best = spawns[0];
    let bestMinDist = -1;
    for (const sp of spawns) {
      let minDist = Infinity;
      for (const c of combatants) {
        if (!c.isAlive) continue;
        const d = Math.hypot(c.position.x - sp.position.x, c.position.z - sp.position.z);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = sp;
      }
    }
    return best;
  }

  private broadcastRoomState(): void {
    this.broadcaster.toRoom(this.roomId, 'room:updated', this.getRoomStateInfo());
  }

  private startLoop(): void {
    this.stopLoop();
    const intervalMs = Math.round(1000 / GAMEPLAY_CONSTANTS.NETWORK_TICK_RATE);
    this.lastTickTime = Date.now();
    this.loopHandle = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;
      this.stepTick(dt);
    }, intervalMs);
  }

  public stopLoop(): void {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
  }

  public destroy(): void {
    this.stopLoop();
    this.players.clear();
  }
}
