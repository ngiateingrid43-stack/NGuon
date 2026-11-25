import { describe, it, expect } from 'vitest';
import { BotController } from '@client/entities/BotController';
import { PhysicsManager } from '@client/physics/PhysicsManager';
import { CollisionManager } from '@client/physics/CollisionManager';
import { WeaponManager } from '@client/weapons/WeaponManager';
import { CombatManager } from '@client/combat/CombatManager';
import { TOMBOUCTOU_MAP } from '@shared/maps/tombouctou';
import { createInitialWeaponState } from '@shared/weapons/weaponsConfig';
import type { CombatantState } from '@shared/types/entity';

function makeActor(id: string, x: number, z: number, isBot: boolean): CombatantState {
  return {
    id,
    name: id,
    isBot,
    botDifficulty: isBot ? 'expert' : undefined,
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

describe('BotController AI', () => {
  it('détecte un joueur en ligne de vue et passe en état combat puis tire', () => {
    const physics = new PhysicsManager();
    physics.loadMapColliders(TOMBOUCTOU_MAP);
    const collision = new CollisionManager();
    const weaponMgr = new WeaponManager();
    const combatMgr = new CombatManager();
    const botCtrl = new BotController();

    // Place les deux acteurs dans la zone dégagée au sud du marché (sans obstacle entre eux)
    const player = makeActor('player', 0, 9, false);
    const bot = makeActor('bot_1', 3, 13, true);
    const all = [player, bot];

    for (let step = 0; step < 15; step++) {
      botCtrl.updateBot({
        dt: 0.05,
        bot,
        allCombatants: all,
        map: TOMBOUCTOU_MAP,
        physics,
        collisionManager: collision,
        weaponManager: weaponMgr,
        combatManager: combatMgr,
      });
    }

    const mem = botCtrl.getBotMemory('bot_1');
    expect(mem.aiState).toBe('combat');
    expect(bot.stats.shotsFired).toBeGreaterThan(0);
  });

  it('passe en seek_cover lorsque sa santé est basse face à un ennemi proche', () => {
    const physics = new PhysicsManager();
    physics.loadMapColliders(TOMBOUCTOU_MAP);
    const collision = new CollisionManager();
    const weaponMgr = new WeaponManager();
    const combatMgr = new CombatManager();
    const botCtrl = new BotController();

    const player = makeActor('player', 0, 9, false);
    const bot = makeActor('bot_1', 3, 13, true);
    bot.health = 20;

    botCtrl.updateBot({
      dt: 0.05,
      bot,
      allCombatants: [player, bot],
      map: TOMBOUCTOU_MAP,
      physics,
      collisionManager: collision,
      weaponManager: weaponMgr,
      combatManager: combatMgr,
    });

    expect(botCtrl.getBotMemory('bot_1').aiState).toBe('seek_cover');
  });
});
