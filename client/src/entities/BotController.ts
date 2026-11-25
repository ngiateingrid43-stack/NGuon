import type { BotDifficulty } from '@shared/types/common';
import type { BotAIState, CombatantState } from '@shared/types/entity';
import type { MapDefinition } from '@shared/types/map';
import { PHYSICS_CONSTANTS } from '@shared/constants/game';
import type { PhysicsManager } from '@client/physics/PhysicsManager';
import type { CollisionManager } from '@client/physics/CollisionManager';
import type { WeaponManager } from '@client/weapons/WeaponManager';
import type { CombatManager } from '@client/combat/CombatManager';
import type { SceneManager } from '@client/renderer/SceneManager';
import type { AudioManager } from '@client/audio/AudioManager';
import type { EventBus } from '@client/core/EventBus';

interface DifficultyProfile {
  reactionDelay: number;
  aimJitter: number;
  detectionRange: number;
  damageMultiplier: number;
  moveSpeedScale: number;
}

const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  beginner: {
    reactionDelay: 0.75,
    aimJitter: 0.14,
    detectionRange: 28,
    damageMultiplier: 0.55,
    moveSpeedScale: 0.78,
  },
  intermediate: {
    reactionDelay: 0.42,
    aimJitter: 0.08,
    detectionRange: 38,
    damageMultiplier: 0.8,
    moveSpeedScale: 0.92,
  },
  expert: {
    reactionDelay: 0.2,
    aimJitter: 0.035,
    detectionRange: 48,
    damageMultiplier: 1.0,
    moveSpeedScale: 1.02,
  },
};

export interface BotRuntimeMemory {
  aiState: BotAIState;
  patrolTarget: { x: number; z: number };
  patrolTimer: number;
  strafeSign: number;
  strafeTimer: number;
  targetAcquireTimer: number;
  lastKnownTargetPos: { x: number; y: number; z: number } | null;
}

/**
 * Intelligence artificielle modulaire des bots par machine à états :
 * PATROL -> ALERT -> COMBAT -> SEEK_COVER -> RELOAD -> DEAD.
 */
export class BotController {
  private memoryMap = new Map<string, BotRuntimeMemory>();

  public getBotMemory(botId: string): BotRuntimeMemory {
    let mem = this.memoryMap.get(botId);
    if (!mem) {
      mem = {
        aiState: 'patrol',
        patrolTarget: { x: (Math.random() - 0.5) * 40, z: (Math.random() - 0.5) * 40 },
        patrolTimer: 0,
        strafeSign: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: 1.5,
        targetAcquireTimer: 0,
        lastKnownTargetPos: null,
      };
      this.memoryMap.set(botId, mem);
    }
    return mem;
  }

  public clear(): void {
    this.memoryMap.clear();
  }

  public updateBot(params: {
    dt: number;
    bot: CombatantState;
    allCombatants: CombatantState[];
    map: MapDefinition;
    physics: PhysicsManager;
    collisionManager: CollisionManager;
    weaponManager: WeaponManager;
    combatManager: CombatManager;
    sceneManager?: SceneManager;
    audioManager?: AudioManager;
    eventBus?: EventBus;
    onBotFired?: (botId: string) => void;
    onBotReload?: (botId: string, duration: number) => void;
  }): void {
    const {
      dt,
      bot,
      allCombatants,
      map,
      physics,
      collisionManager,
      weaponManager,
      combatManager,
      sceneManager,
      audioManager,
      eventBus,
      onBotFired,
      onBotReload,
    } = params;

    const mem = this.getBotMemory(bot.id);
    if (!bot.isAlive) {
      mem.aiState = 'dead';
      return;
    }

    const difficulty = bot.botDifficulty ?? 'intermediate';
    const profile = DIFFICULTY_PROFILES[difficulty];
    weaponManager.tickWeaponTimers(bot.activeWeapon, dt);

    // Recherche de la cible vivante la plus proche visible
    const botEye = { x: bot.position.x, y: bot.position.y + 1.5, z: bot.position.z };
    let visibleTarget: CombatantState | null = null;
    let visibleDist = Infinity;

    for (const candidate of allCombatants) {
      if (!candidate.isAlive || candidate.id === bot.id) continue;
      if (bot.team && candidate.team === bot.team) continue;
      const dx = candidate.position.x - bot.position.x;
      const dz = candidate.position.z - bot.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > profile.detectionRange || dist >= visibleDist) continue;

      const targetEye = {
        x: candidate.position.x,
        y: candidate.position.y + 1.35,
        z: candidate.position.z,
      };
      if (collisionManager.hasLineOfSight(botEye, targetEye, physics.getColliders())) {
        visibleTarget = candidate;
        visibleDist = dist;
      }
    }

    // Transitions d'états IA
    if (bot.activeWeapon.isReloading) {
      mem.aiState = 'reload';
    } else if (visibleTarget) {
      mem.lastKnownTargetPos = { ...visibleTarget.position };
      if (bot.health < 30 && visibleDist < 16) {
        mem.aiState = 'seek_cover';
      } else {
        mem.aiState = 'combat';
      }
    } else if (mem.lastKnownTargetPos) {
      mem.aiState = 'alert';
    } else {
      mem.aiState = 'patrol';
    }

    // Calcul du déplacement selon l'état
    let moveDirX = 0;
    let moveDirZ = 0;
    let speed = PHYSICS_CONSTANTS.WALK_SPEED * profile.moveSpeedScale;

    if (mem.aiState === 'patrol') {
      mem.patrolTimer -= dt;
      const leader =
        bot.team === 'alpha'
          ? allCombatants.find((c) => !c.isBot && c.isAlive && c.team === 'alpha')
          : undefined;
      if (leader) {
        const ldx = leader.position.x - bot.position.x;
        const ldz = leader.position.z - bot.position.z;
        if (Math.hypot(ldx, ldz) > 15 && mem.patrolTimer <= 1.2) {
          mem.patrolTarget = {
            x: leader.position.x + (Math.random() - 0.5) * 12,
            z: leader.position.z + (Math.random() - 0.5) * 12,
          };
          mem.patrolTimer = 2.5;
        }
      }
      const dx = mem.patrolTarget.x - bot.position.x;
      const dz = mem.patrolTarget.z - bot.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.2 || mem.patrolTimer <= 0) {
        if (leader) {
          mem.patrolTarget = {
            x: leader.position.x + (Math.random() - 0.5) * 12,
            z: leader.position.z + (Math.random() - 0.5) * 12,
          };
        } else if (Math.random() < 0.5 && map.spawnPoints.length > 0) {
          const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
          mem.patrolTarget = {
            x: sp.position.x + (Math.random() - 0.5) * 16,
            z: sp.position.z + (Math.random() - 0.5) * 16,
          };
        } else {
          const zone = map.zones[Math.floor(Math.random() * map.zones.length)];
          mem.patrolTarget = {
            x: zone.center.x + (Math.random() - 0.5) * 26,
            z: zone.center.z + (Math.random() - 0.5) * 26,
          };
        }
        mem.patrolTimer = leader ? 2.5 : 6 + Math.random() * 4;
      } else {
        moveDirX = dx / dist;
        moveDirZ = dz / dist;
      }
      bot.yaw = Math.atan2(-moveDirX, -moveDirZ);
      mem.targetAcquireTimer = profile.reactionDelay;
    } else if (mem.aiState === 'alert' && mem.lastKnownTargetPos) {
      const dx = mem.lastKnownTargetPos.x - bot.position.x;
      const dz = mem.lastKnownTargetPos.z - bot.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.0) {
        mem.lastKnownTargetPos = null;
      } else {
        moveDirX = dx / dist;
        moveDirZ = dz / dist;
        bot.yaw = Math.atan2(-moveDirX, -moveDirZ);
      }
    } else if (visibleTarget && (mem.aiState === 'combat' || mem.aiState === 'seek_cover' || mem.aiState === 'reload')) {
      const dx = visibleTarget.position.x - bot.position.x;
      const dz = visibleTarget.position.z - bot.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const toTargetX = dx / dist;
      const toTargetZ = dz / dist;

      // Orienter le bot vers sa cible
      bot.yaw = Math.atan2(-toTargetX, -toTargetZ);

      // Strafe latéral pour éviter de rester statique
      mem.strafeTimer -= dt;
      if (mem.strafeTimer <= 0) {
        mem.strafeSign *= -1;
        mem.strafeTimer = 1.1 + Math.random() * 1.4;
      }

      const strafeX = -toTargetZ * mem.strafeSign;
      const strafeZ = toTargetX * mem.strafeSign;

      if (mem.aiState === 'seek_cover' || mem.aiState === 'reload') {
        moveDirX = -toTargetX * 0.7 + strafeX * 0.6;
        moveDirZ = -toTargetZ * 0.7 + strafeZ * 0.6;
        speed *= 1.05;
      } else {
        const approach = dist > 18 ? 0.65 : dist < 8 ? -0.5 : 0;
        moveDirX = toTargetX * approach + strafeX * 0.75;
        moveDirZ = toTargetZ * approach + strafeZ * 0.75;
      }

      // Normaliser le vecteur mouvement
      const mLen = Math.hypot(moveDirX, moveDirZ);
      if (mLen > 0.01) {
        moveDirX /= mLen;
        moveDirZ /= mLen;
      }

      // Tir si en état COMBAT et temps de réaction écoulé
      if (mem.aiState === 'combat') {
        mem.targetAcquireTimer -= dt;
        if (mem.targetAcquireTimer <= 0) {
          const aimX = visibleTarget.position.x - botEye.x;
          const aimY = visibleTarget.position.y + 1.25 - botEye.y;
          const aimZ = visibleTarget.position.z - botEye.z;
          const aimLen = Math.hypot(aimX, aimY, aimZ) || 1;
          const dir = {
            x: aimX / aimLen + (Math.random() - 0.5) * profile.aimJitter,
            y: aimY / aimLen + (Math.random() - 0.5) * profile.aimJitter * 0.6,
            z: aimZ / aimLen + (Math.random() - 0.5) * profile.aimJitter,
          };
          const dLen = Math.hypot(dir.x, dir.y, dir.z) || 1;
          dir.x /= dLen;
          dir.y /= dLen;
          dir.z /= dLen;

          const hadReloadBefore = bot.activeWeapon.isReloading;
          const outcome = weaponManager.fireWeapon({
            shooter: bot,
            origin: botEye,
            forwardDir: dir,
            isAiming: true,
            colliders: physics.getColliders(),
            combatants: allCombatants,
            collisionManager,
            combatManager,
            sceneManager,
            eventBus,
            damageMultiplier: profile.damageMultiplier,
          });

          if (outcome.fired) {
            onBotFired?.(bot.id);
            const player = allCombatants.find((c) => !c.isBot);
            const distToPlayer = player
              ? Math.hypot(
                  player.position.x - bot.position.x,
                  player.position.z - bot.position.z
                )
              : 30;
            const pan =
              player && audioManager
                ? audioManager.computeStereoPan(player.position, player.yaw, bot.position)
                : 0;
            audioManager?.playWeaponFire(bot.activeWeapon.weaponId, false, distToPlayer, pan);
          } else if (!hadReloadBefore && bot.activeWeapon.isReloading) {
            onBotReload?.(bot.id, bot.activeWeapon.reloadTimer);
          }
        }
      }
    }

    // Application vitesse + gravité + collisions
    bot.velocity.x = moveDirX * speed;
    bot.velocity.z = moveDirZ * speed;
    bot.velocity.y += PHYSICS_CONSTANTS.GRAVITY * dt;

    const prevX = bot.position.x;
    const prevZ = bot.position.z;
    const moved = physics.moveEntity({
      position: bot.position,
      velocity: bot.velocity,
      radius: PHYSICS_CONSTANTS.PLAYER_RADIUS,
      height: PHYSICS_CONSTANTS.PLAYER_HEIGHT,
      dt,
    });
    bot.position = moved.position;
    bot.velocity = moved.velocity;
    bot.isGrounded = moved.isGrounded;

    // Si le bot reste bloqué contre un mur en patrouille, choisir un autre point
    const movedDist = Math.hypot(bot.position.x - prevX, bot.position.z - prevZ);
    if (mem.aiState === 'patrol' && movedDist < 0.01 * speed * dt && bot.isGrounded) {
      mem.patrolTimer = 0;
    }
  }
}
