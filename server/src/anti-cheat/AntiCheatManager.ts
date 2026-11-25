import type { Vec3 } from '../../../shared/types/common.js';
import type { CombatantState } from '../../../shared/types/entity.js';
import { getWeaponDefinition } from '../../../shared/weapons/weaponsConfig.js';

export interface SuspiciousLogEntry {
  timestamp: number;
  playerId: string;
  reason: string;
  details: string;
}

interface RateBucket {
  count: number;
  windowStart: number;
}

/**
 * Système anti-triche serveur : limitation de fréquence des paquets,
 * détection de téléportation / vitesse impossible et vérification stricte des tirs.
 */
export class AntiCheatManager {
  private rateBuckets = new Map<string, RateBucket>();
  private suspiciousLogs: SuspiciousLogEntry[] = [];

  public checkRateLimit(key: string, maxPerSecond: number, now = Date.now()): boolean {
    const bucket = this.rateBuckets.get(key);
    if (!bucket || now - bucket.windowStart >= 1000) {
      this.rateBuckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maxPerSecond;
  }

  public validateShotOrigin(player: CombatantState, claimedOrigin: Vec3): boolean {
    const dx = claimedOrigin.x - player.position.x;
    const dy = claimedOrigin.y - (player.position.y + 1.5);
    const dz = claimedOrigin.z - player.position.z;
    const dist = Math.hypot(dx, dy, dz);

    // Tolérance pour compensation de mouvement/latence limitée (max 2.8m autour du joueur)
    if (dist > 2.8) {
      this.logSuspicious(
        player.id,
        'shot_origin_mismatch',
        `Origine tir trop éloignée (${dist.toFixed(2)}m)`
      );
      return false;
    }
    return true;
  }

  public validateShotTimingAndAmmo(player: CombatantState): boolean {
    const weapon = player.activeWeapon;
    if (!player.isAlive || weapon.isReloading) return false;
    if (weapon.ammoInMag <= 0) return false;
    if (weapon.fireCooldown > 0.04) {
      this.logSuspicious(
        player.id,
        'fire_rate_violation',
        `Tir avant fin du cooldown (${weapon.fireCooldown.toFixed(3)}s)`
      );
      return false;
    }
    return true;
  }

  public validateTeleportGuard(
    playerId: string,
    prevPos: Vec3,
    nextPos: Vec3,
    dt: number
  ): boolean {
    const dist = Math.hypot(nextPos.x - prevPos.x, nextPos.z - prevPos.z);
    const maxAllowed = Math.max(1.5, 16 * dt);
    if (dist > maxAllowed) {
      this.logSuspicious(
        playerId,
        'speed_anomaly',
        `Déplacement excessif (${dist.toFixed(2)}m en ${dt.toFixed(3)}s)`
      );
      return false;
    }
    return true;
  }

  public getWeaponRange(player: CombatantState): number {
    return getWeaponDefinition(player.activeWeapon.weaponId).stats.range;
  }

  public logSuspicious(playerId: string, reason: string, details: string): void {
    this.suspiciousLogs.push({
      timestamp: Date.now(),
      playerId,
      reason,
      details,
    });
    if (this.suspiciousLogs.length > 200) {
      this.suspiciousLogs.shift();
    }
  }

  public getLogs(): readonly SuspiciousLogEntry[] {
    return this.suspiciousLogs;
  }

  public clearPlayer(playerId: string): void {
    for (const key of this.rateBuckets.keys()) {
      if (key.startsWith(`${playerId}:`)) {
        this.rateBuckets.delete(key);
      }
    }
  }
}
