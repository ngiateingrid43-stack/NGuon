import type { MapDefinition, SpawnPoint } from '@shared/types/map';
import type { TimeOfDay } from '@shared/maps/mapRegistry';
import type { CombatantState } from '@shared/types/entity';
import type { SceneManager } from '@client/renderer/SceneManager';
import type { PhysicsManager } from '@client/physics/PhysicsManager';
import type { QualityPreset } from '@client/performance/PerformanceManager';
import { getWeaponDefinition } from '@shared/weapons/weaponsConfig';
import type { LootManager } from '@client/loot/LootManager';
import type { EventBus } from '@client/core/EventBus';

interface LootRuntimeState {
  id: string;
  type: 'ammo' | 'health' | 'armor' | 'weapon_crate';
  position: { x: number; y: number; z: number };
  respawnSeconds: number;
  active: boolean;
  cooldown: number;
}

/**
 * Charge et décharge une carte (MapDefinition) vers le moteur de rendu et la physique,
 * et gère la réapparition des caisses de munitions / santé / armure.
 */
export class MapLoader {
  private activeMap: MapDefinition | null = null;
  private lootStates: LootRuntimeState[] = [];

  public load(
    map: MapDefinition,
    sceneManager: SceneManager,
    physicsManager: PhysicsManager,
    preset: QualityPreset,
    timeOfDay: TimeOfDay = 'day'
  ): void {
    this.activeMap = map;
    sceneManager.loadMap(map, preset, timeOfDay);
    physicsManager.loadMapColliders(map);

    this.lootStates = map.lootPoints.map((lp) => ({
      id: lp.id,
      type: lp.type,
      position: { ...lp.position },
      respawnSeconds: lp.respawnSeconds,
      active: true,
      cooldown: 0,
    }));
  }

  public getActiveMap(): MapDefinition | null {
    return this.activeMap;
  }

  public pickBestSpawnPoint(combatants: readonly CombatantState[]): SpawnPoint {
    if (!this.activeMap || this.activeMap.spawnPoints.length === 0) {
      return { id: 'fallback', position: { x: 0, y: 0.5, z: 0 }, yaw: 0 };
    }

    let bestSpawn = this.activeMap.spawnPoints[0];
    let bestMinDist = -1;

    for (const sp of this.activeMap.spawnPoints) {
      let minDist = Infinity;
      for (const c of combatants) {
        if (!c.isAlive) continue;
        const d = Math.hypot(c.position.x - sp.position.x, c.position.z - sp.position.z);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestSpawn = sp;
      }
    }

    return bestSpawn;
  }

  public findNearestChest(position: { x: number; y: number; z: number }): LootRuntimeState | null {
    for (const item of this.lootStates) {
      if (!item.active || item.type !== 'weapon_crate') continue;
      const d = Math.hypot(item.position.x - position.x, item.position.z - position.z);
      if (d <= 2.6 && Math.abs(item.position.y - position.y) < 1.8) {
        return item;
      }
    }
    return null;
  }

  public tryOpenChest(
    chestId: string,
    sceneManager: SceneManager,
    lootManager: LootManager
  ): boolean {
    const item = this.lootStates.find((l) => l.id === chestId && l.active);
    if (!item || item.type !== 'weapon_crate') return false;
    item.active = false;
    item.cooldown = item.respawnSeconds;
    sceneManager.setPickupActive(item.id, false);
    lootManager.spawnChestRewards(item.position, sceneManager.scene);
    return true;
  }

  public updatePickups(
    dt: number,
    combatants: readonly CombatantState[],
    sceneManager: SceneManager,
    eventBus: EventBus
  ): void {
    for (const item of this.lootStates) {
      if (!item.active) {
        item.cooldown -= dt;
        if (item.cooldown <= 0) {
          item.active = true;
          sceneManager.setPickupActive(item.id, true);
        }
        continue;
      }

      if (item.type === 'weapon_crate') continue;

      for (const c of combatants) {
        if (!c.isAlive) continue;
        const dx = c.position.x - item.position.x;
        const dy = c.position.y - item.position.y;
        const dz = c.position.z - item.position.z;
        if (dx * dx + dz * dz < 1.8 && Math.abs(dy) < 1.6) {
          const collected = this.applyPickup(c, item.type);
          if (collected > 0) {
            item.active = false;
            item.cooldown = item.respawnSeconds;
            sceneManager.setPickupActive(item.id, false);
            if (!c.isBot) {
              eventBus.emit('pickup:collected', { type: item.type, value: collected });
            }
            break;
          }
        }
      }
    }
  }

  private applyPickup(
    combatant: CombatantState,
    type: 'ammo' | 'health' | 'armor' | 'weapon_crate'
  ): number {
    const bonusMult = combatant.heroId === 'makeda' ? 1.25 : 1.0;
    if (type === 'health') {
      if (combatant.health >= combatant.maxHealth) return 0;
      const before = combatant.health;
      combatant.health = Math.min(combatant.maxHealth, combatant.health + Math.round(35 * bonusMult));
      return combatant.health - before;
    }
    if (type === 'armor') {
      if (combatant.armor >= combatant.maxArmor) return 0;
      const before = combatant.armor;
      combatant.armor = Math.min(combatant.maxArmor, combatant.armor + Math.round(30 * bonusMult));
      return combatant.armor - before;
    }
    const weaponDef = getWeaponDefinition(combatant.activeWeapon.weaponId);
    if (combatant.activeWeapon.reserveAmmo >= weaponDef.stats.reserveAmmoMax) return 0;
    const before = combatant.activeWeapon.reserveAmmo;
    combatant.activeWeapon.reserveAmmo = Math.min(
      weaponDef.stats.reserveAmmoMax,
      combatant.activeWeapon.reserveAmmo + Math.round(weaponDef.stats.magazineSize * 2 * bonusMult)
    );
    return combatant.activeWeapon.reserveAmmo - before;
  }

  public unload(sceneManager: SceneManager, physicsManager: PhysicsManager): void {
    sceneManager.clearMap();
    physicsManager.clearMapColliders();
    this.lootStates = [];
    this.activeMap = null;
  }
}
