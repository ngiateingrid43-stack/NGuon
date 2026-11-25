import { describe, it, expect } from 'vitest';
import { CombatManager } from '@client/combat/CombatManager';
import { WeaponManager } from '@client/weapons/WeaponManager';
import { CollisionManager } from '@client/physics/CollisionManager';
import { EventBus } from '@client/core/EventBus';
import { createInitialWeaponState } from '@shared/weapons/weaponsConfig';
import type { CombatantState } from '@shared/types/entity';

function createFighter(id: string, health = 100, armor = 50): CombatantState {
  return {
    id,
    name: id,
    isBot: id !== 'player',
    heroId: 'sundiata',
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    velocity: { x: 0, y: 0, z: 0 },
    health,
    maxHealth: 100,
    armor,
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

describe('CombatManager', () => {
  it('absorbe 50% des dégâts sur armure tant que armure > 0', () => {
    const combat = new CombatManager();
    const attacker = createFighter('player');
    const target = createFighter('bot_1', 100, 50);

    const ev = combat.applyDamage({
      attacker,
      target,
      weaponId: 'flintlock_musket',
      isHeadshot: false,
      hitPoint: { x: 0, y: 1, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    });

    expect(ev).not.toBeNull();
    expect(ev!.finalDamage).toBe(34);
    expect(ev!.armorDamage).toBe(17);
    expect(ev!.healthDamage).toBe(17);
    expect(target.armor).toBe(33);
    expect(target.health).toBe(83);
  });

  it('applique le multiplicateur headshot et déclenche le kill feed à l’élimination', () => {
    const bus = new EventBus();
    const feedEvents: string[] = [];
    bus.on('combat:killFeed', (e) => feedEvents.push(`${e.killerName}->${e.victimName}`));

    const combat = new CombatManager(bus);
    const attacker = createFighter('player');
    const target = createFighter('bot_1', 40, 0);

    const ev = combat.applyDamage({
      attacker,
      target,
      weaponId: 'flintlock_musket',
      isHeadshot: true,
      hitPoint: { x: 0, y: 1.6, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    });

    expect(ev?.isHeadshot).toBe(true);
    expect(ev?.isElimination).toBe(true);
    expect(target.isAlive).toBe(false);
    expect(attacker.stats.kills).toBe(1);
    expect(attacker.stats.headshots).toBe(1);
    expect(target.stats.deaths).toBe(1);
    expect(feedEvents).toEqual(['player->bot_1']);
  });

  it('empêche le tir allié en mode Team Deathmatch (v0.5)', () => {
    const combat = new CombatManager();
    const wm = new WeaponManager();
    const col = new CollisionManager();

    const shooter = createFighter('player');
    shooter.team = 'alpha';
    const ally = createFighter('bot_ally');
    ally.team = 'alpha';
    ally.position = { x: 0, y: 0, z: -8 };

    const res = wm.fireWeapon({
      shooter,
      origin: { x: 0, y: 1.2, z: 0 },
      forwardDir: { x: 0, y: 0, z: -1 },
      isAiming: true,
      colliders: [],
      combatants: [shooter, ally],
      collisionManager: col,
      combatManager: combat,
    });

    expect(res.fired).toBe(true);
    expect(res.hitCombatantId).toBeUndefined();
    expect(ally.health).toBe(100);
  });

  it('applique des multiplicateurs distincts pour la tête, le cœur, le corps et les membres', () => {
    const combat = new CombatManager();
    const attacker = createFighter('player');

    const headTarget = createFighter('t_head', 200, 0);
    const heartTarget = createFighter('t_heart', 200, 0);
    const bodyTarget = createFighter('t_body', 200, 0);
    const limbTarget = createFighter('t_limb', 200, 0);

    const headDmg = combat.applyDamage({
      attacker,
      target: headTarget,
      weaponId: 'flintlock_musket',
      isHeadshot: true,
      hitZone: 'head',
      hitPoint: { x: 0, y: 1.56, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    })!.finalDamage;

    const heartDmg = combat.applyDamage({
      attacker,
      target: heartTarget,
      weaponId: 'flintlock_musket',
      isHeadshot: false,
      hitZone: 'heart',
      hitPoint: { x: 0, y: 1.14, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    })!.finalDamage;

    const bodyDmg = combat.applyDamage({
      attacker,
      target: bodyTarget,
      weaponId: 'flintlock_musket',
      isHeadshot: false,
      hitZone: 'body',
      hitPoint: { x: 0, y: 0.9, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    })!.finalDamage;

    const limbDmg = combat.applyDamage({
      attacker,
      target: limbTarget,
      weaponId: 'flintlock_musket',
      isHeadshot: false,
      hitZone: 'limb',
      hitPoint: { x: 0, y: 0.4, z: 0 },
      sourceDirection: { x: 0, y: 0, z: -1 },
    })!.finalDamage;

    expect(headDmg).toBeGreaterThan(heartDmg);
    expect(heartDmg).toBeGreaterThan(bodyDmg);
    expect(bodyDmg).toBeGreaterThan(limbDmg);
  });
});
