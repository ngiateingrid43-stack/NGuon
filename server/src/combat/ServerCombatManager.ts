import { GAMEPLAY_CONSTANTS } from '../../../shared/constants/game.js';
import type { DamageEvent, KillFeedEntry, Vec3 } from '../../../shared/types/common.js';
import type { CombatantState } from '../../../shared/types/entity.js';
import type { WeaponId } from '../../../shared/types/weapon.js';
import { getWeaponDefinition } from '../../../shared/weapons/weaponsConfig.js';

/**
 * Calcul autoritaire des dégâts, de l'absorption d'armure et des éliminations côté serveur.
 */
export class ServerCombatManager {
  private killSeq = 0;

  public applyServerDamage(params: {
    attacker: CombatantState;
    target: CombatantState;
    weaponId: WeaponId;
    isHeadshot: boolean;
    hitPoint: Vec3;
    sourceDirection: Vec3;
  }): { damageEvent: DamageEvent; killFeedEntry?: KillFeedEntry } | null {
    const { attacker, target, weaponId, isHeadshot, hitPoint, sourceDirection } = params;
    if (!target.isAlive) return null;

    const weapon = getWeaponDefinition(weaponId);
    const rawDamage =
      weapon.stats.damage * (isHeadshot ? weapon.stats.headshotMultiplier : 1);
    const finalDamage = Math.max(1, Math.round(rawDamage));

    let armorDamage = 0;
    let healthDamage = finalDamage;

    if (target.armor > 0) {
      const absorbed = Math.min(
        target.armor,
        Math.round(finalDamage * GAMEPLAY_CONSTANTS.ARMOR_ABSORPTION_RATIO)
      );
      armorDamage = absorbed;
      target.armor = Math.max(0, target.armor - absorbed);
      healthDamage = finalDamage - absorbed;
    }

    target.health = Math.max(0, target.health - healthDamage);
    attacker.stats.damageDealt += finalDamage;
    attacker.stats.shotsHit += 1;
    if (isHeadshot) attacker.stats.headshots += 1;

    const isElimination = target.health <= 0;
    let killFeedEntry: KillFeedEntry | undefined;

    if (isElimination) {
      target.isAlive = false;
      target.respawnTimer = GAMEPLAY_CONSTANTS.RESPAWN_DELAY;
      target.stats.deaths += 1;
      attacker.stats.kills += 1;

      killFeedEntry = {
        id: `skf_${++this.killSeq}`,
        killerId: attacker.id,
        killerName: attacker.name,
        victimId: target.id,
        victimName: target.name,
        weaponName: weapon.nameFr,
        isHeadshot,
        timestamp: Date.now(),
      };
    }

    return {
      damageEvent: {
        attackerId: attacker.id,
        targetId: target.id,
        weaponId,
        rawDamage,
        finalDamage,
        armorDamage,
        healthDamage,
        isHeadshot,
        isElimination,
        hitPoint,
        sourceDirection,
      },
      killFeedEntry,
    };
  }
}
