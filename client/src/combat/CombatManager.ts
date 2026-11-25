import { GAMEPLAY_CONSTANTS } from '@shared/constants/game';
import type { DamageEvent, HitZone, KillFeedEntry, Rarity, Vec3 } from '@shared/types/common';
import type { CombatantState } from '@shared/types/entity';
import { getScaledWeaponStats, getWeaponDefinition } from '@shared/weapons/weaponsConfig';
import type { WeaponId } from '@shared/types/weapon';
import type { EventBus } from '@client/core/EventBus';

/**
 * Calcule et applique les dégâts (bouclier, armure, santé, multiplicateur headshot),
 * gère les éliminations, les statistiques et le kill feed.
 */
export class CombatManager {
  private eventBus?: EventBus;
  private killFeedCounter = 0;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
  }

  public applyDamage(params: {
    attacker: CombatantState;
    target: CombatantState;
    weaponId: WeaponId;
    rarity?: Rarity;
    isHeadshot: boolean;
    hitZone?: HitZone;
    hitPoint: Vec3;
    sourceDirection: Vec3;
    damageMultiplier?: number;
    resistance?: number;
    absorbShield?: (damage: number) => number;
  }): DamageEvent | null {
    const {
      attacker,
      target,
      weaponId,
      rarity,
      isHeadshot,
      hitZone = isHeadshot ? 'head' : 'body',
      hitPoint,
      sourceDirection,
      damageMultiplier = 1,
      resistance = 0,
      absorbShield,
    } = params;

    if (!target.isAlive) return null;

    const weapon = getWeaponDefinition(weaponId);
    const scaled = rarity ? getScaledWeaponStats(weaponId, rarity) : weapon.stats;
    const zoneMultiplier =
      hitZone === 'head'
        ? scaled.headshotMultiplier
        : hitZone === 'heart'
          ? 1.48
          : hitZone === 'limb'
            ? 0.82
            : 1.0;

    const rawDamage =
      scaled.damage *
      zoneMultiplier *
      damageMultiplier *
      (1 - Math.min(0.5, resistance));

    return this.commitDamage({
      attacker,
      target,
      weaponId,
      sourceLabel: weapon.nameFr,
      rawDamage,
      isHeadshot: hitZone === 'head' || isHeadshot,
      hitZone,
      hitPoint,
      sourceDirection,
      countAsShotHit: true,
      absorbShield,
    });
  }

  public applyDirectDamage(params: {
    attacker: CombatantState;
    target: CombatantState;
    sourceLabel: string;
    damage: number;
    hitPoint: Vec3;
    sourceDirection: Vec3;
    resistance?: number;
    absorbShield?: (damage: number) => number;
  }): DamageEvent | null {
    if (!params.target.isAlive) return null;
    const rawDamage = params.damage * (1 - Math.min(0.5, params.resistance ?? 0));
    return this.commitDamage({
      attacker: params.attacker,
      target: params.target,
      weaponId: params.attacker.activeWeapon.weaponId,
      sourceLabel: params.sourceLabel,
      rawDamage,
      isHeadshot: false,
      hitPoint: params.hitPoint,
      sourceDirection: params.sourceDirection,
      countAsShotHit: false,
      absorbShield: params.absorbShield,
    });
  }

  private commitDamage(params: {
    attacker: CombatantState;
    target: CombatantState;
    weaponId: WeaponId;
    sourceLabel: string;
    rawDamage: number;
    isHeadshot: boolean;
    hitZone?: HitZone;
    hitPoint: Vec3;
    sourceDirection: Vec3;
    countAsShotHit: boolean;
    absorbShield?: (damage: number) => number;
  }): DamageEvent {
    const {
      attacker,
      target,
      weaponId,
      sourceLabel,
      rawDamage,
      isHeadshot,
      hitZone = isHeadshot ? 'head' : 'body',
      hitPoint,
      sourceDirection,
      countAsShotHit,
      absorbShield,
    } = params;

    const afterShield = absorbShield ? absorbShield(Math.max(1, Math.round(rawDamage))) : Math.max(1, Math.round(rawDamage));
    const finalDamage = Math.max(0, afterShield);

    let armorDamage = 0;
    let healthDamage = finalDamage;

    if (target.armor > 0 && finalDamage > 0) {
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
    if (countAsShotHit) {
      attacker.stats.shotsHit += 1;
      if (isHeadshot) {
        attacker.stats.headshots += 1;
      }
    }

    const isElimination = target.health <= 0;
    if (isElimination) {
      target.isAlive = false;
      target.respawnTimer = GAMEPLAY_CONSTANTS.RESPAWN_DELAY;
      target.stats.deaths += 1;
      if (attacker.id !== target.id) {
        attacker.stats.kills += 1;
      }

      const entry: KillFeedEntry = {
        id: `kf_${++this.killFeedCounter}`,
        killerId: attacker.id,
        killerName: attacker.name,
        victimId: target.id,
        victimName: target.name,
        weaponName: sourceLabel,
        isHeadshot,
        timestamp: Date.now(),
      };
      this.eventBus?.emit('combat:killFeed', entry);
    }

    const event: DamageEvent = {
      attackerId: attacker.id,
      targetId: target.id,
      weaponId,
      rawDamage,
      finalDamage,
      armorDamage,
      healthDamage,
      isHeadshot,
      hitZone,
      isElimination,
      hitPoint,
      sourceDirection,
    };

    this.eventBus?.emit('combat:damage', event);
    return event;
  }
}
