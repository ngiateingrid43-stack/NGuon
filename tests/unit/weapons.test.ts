import { describe, it, expect } from 'vitest';
import { WeaponManager } from '@client/weapons/WeaponManager';
import { CollisionManager } from '@client/physics/CollisionManager';
import { CombatManager } from '@client/combat/CombatManager';
import {
  WEAPONS_CONFIG,
  createInitialWeaponState,
  getWeaponDefinition,
} from '@shared/weapons/weaponsConfig';
import type { CombatantState } from '@shared/types/entity';

function makeCombatant(id: string, x = 0, z = 0): CombatantState {
  return {
    id,
    name: id,
    isBot: id !== 'player',
    heroId: 'sundiata',
    position: { x, y: 0, z },
    yaw: 0,
    pitch: 0,
    velocity: { x: 0, y: 0, z: 0 },
    health: 100,
    maxHealth: 100,
    armor: 50,
    maxArmor: 50,
    isAlive: true,
    respawnTimer: 0,
    isGrounded: true,
    isSprinting: false,
    isCrouching: false,
    isSliding: false,
    activeWeapon: createInitialWeaponState('flintlock_musket'),
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

describe('WeaponManager', () => {
  it('consomme des munitions et respecte la cadence de tir', () => {
    const wm = new WeaponManager();
    const collision = new CollisionManager();
    const combat = new CombatManager();
    const shooter = makeCombatant('player', 0, 0);
    const target = makeCombatant('bot_1', 0, -10);

    const firstShot = wm.fireWeapon({
      shooter,
      origin: { x: 0, y: 1.2, z: 0 },
      forwardDir: { x: 0, y: 0, z: -1 },
      isAiming: true,
      colliders: [],
      combatants: [shooter, target],
      collisionManager: collision,
      combatManager: combat,
    });

    expect(firstShot.fired).toBe(true);
    expect(shooter.activeWeapon.ammoInMag).toBe(11);

    // Tir immédiat bloqué par le cooldown
    const secondShot = wm.fireWeapon({
      shooter,
      origin: { x: 0, y: 1.2, z: 0 },
      forwardDir: { x: 0, y: 0, z: -1 },
      isAiming: true,
      colliders: [],
      combatants: [shooter, target],
      collisionManager: collision,
      combatManager: combat,
    });
    expect(secondShot.fired).toBe(false);
  });

  it('recharge correctement le chargeur depuis la réserve', () => {
    const wm = new WeaponManager();
    const state = createInitialWeaponState('flintlock_musket');
    const def = getWeaponDefinition('flintlock_musket');

    state.ammoInMag = 3;
    const started = wm.startReload(state);
    expect(started).toBe(true);
    expect(state.isReloading).toBe(true);

    const done = wm.tickWeaponTimers(state, def.stats.reloadTime + 0.1);
    expect(done).toBe(true);
    expect(state.isReloading).toBe(false);
    expect(state.ammoInMag).toBe(def.stats.magazineSize);
    expect(state.reserveAmmo).toBe(def.stats.reserveAmmoMax - (def.stats.magazineSize - 3));
  });

  it('réduit la dispersion en visée (ADS) et en position accroupie', () => {
    const wm = new WeaponManager();
    const hipSpread = wm.computeSpread({
      weaponId: 'flintlock_musket',
      horizontalSpeed: 6,
      isAiming: false,
      isCrouching: false,
    });
    const adsCrouchSpread = wm.computeSpread({
      weaponId: 'flintlock_musket',
      horizontalSpeed: 0,
      isAiming: true,
      isCrouching: true,
    });

    expect(adsCrouchSpread).toBeLessThan(hipSpread);
  });

  it('inclut les 18 armes dont les armes v1.1 et v1.2', () => {
    const ids = Object.keys(WEAPONS_CONFIG);
    expect(ids.length).toBe(18);
    expect(ids).toContain('double_barrel_shotgun');
    expect(ids).toContain('royal_long_rifle');
    expect(ids).toContain('throwing_axes');
    expect(ids).toContain('war_staff');
    expect(ids).toContain('dueling_pistol');
    expect(ids).toContain('imperial_carbine');
    expect(ids).toContain('siege_gatling');
    expect(ids).toContain('incendiary_mortar');
    expect(ids).toContain('imperial_sabre');
    expect(getWeaponDefinition('double_barrel_shotgun').stats.pelletCount).toBeGreaterThanOrEqual(8);
  });
});
