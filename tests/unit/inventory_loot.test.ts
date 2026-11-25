import { describe, it, expect } from 'vitest';
import { InventoryManager } from '@client/weapons/InventoryManager';
import { LootManager } from '@client/loot/LootManager';
import { ProjectileManager } from '@client/weapons/ProjectileManager';
import { getScaledWeaponStats } from '@shared/weapons/weaponsConfig';

describe('InventoryManager, LootManager & ProjectileManager (v0.3)', () => {
  it('gère les 3 emplacements d’armes, le cycle à la molette, l’objet et le bouclier', () => {
    const invMgr = new InventoryManager();
    const inv = invMgr.createInitialInventory('flintlock_musket', 'dueling_pistol', 'machete');

    expect(inv.weaponSlots[0]?.weaponId).toBe('flintlock_musket');
    expect(inv.weaponSlots[1]?.weaponId).toBe('dueling_pistol');
    expect(inv.weaponSlots[2]?.weaponId).toBe('machete');
    expect(inv.itemSlot?.itemId).toBe('frag_grenade');
    expect(inv.shieldSlot).toBeNull();

    // Cycle molette suivant/précédent
    invMgr.cycleWeaponSlot(inv, 1);
    expect(inv.activeWeaponIndex).toBe(1);
    invMgr.cycleWeaponSlot(inv, 1);
    expect(inv.activeWeaponIndex).toBe(2);
    invMgr.cycleWeaponSlot(inv, -1);
    expect(inv.activeWeaponIndex).toBe(1);
    invMgr.switchWeaponSlot(inv, 0);

    // Ramasser une nouvelle arme remplace l'arme active et retourne l'ancienne
    const replaced = invMgr.pickupWeapon(inv, 'hand_cannon', 'legendary');
    expect(replaced.pickedUp).toBe(true);
    expect(replaced.replaced?.weaponId).toBe('flintlock_musket');
    expect(inv.weaponSlots[0]?.weaponId).toBe('hand_cannon');

    // Équiper un bouclier métallique et absorber des dégâts
    const shieldRes = invMgr.equipShield(inv, 'metal_shield');
    expect(shieldRes.equipped).toBe(true);
    const remainingDmg = invMgr.applyShieldAbsorption(inv, 40);
    expect(remainingDmg).toBeLessThan(40);
    expect(inv.shieldSlot!.currentShield).toBeLessThan(inv.shieldSlot!.maxShield);

    // Consommer les 2 grenades initiales
    const used = invMgr.consumeItem(inv);
    expect(used).toBe('frag_grenade');
    expect(inv.itemSlot?.quantity).toBe(1);
    invMgr.consumeItem(inv);
    expect(inv.itemSlot).toBeNull();
  });

  it('applique la mise à l’échelle de rareté et ouvre un coffre de loot', () => {
    const common = getScaledWeaponStats('war_bow', 'common');
    const legendary = getScaledWeaponStats('war_bow', 'legendary');
    expect(legendary.damage).toBeGreaterThan(common.damage);
    expect(legendary.reloadTime).toBeLessThan(common.reloadTime);

    const lootMgr = new LootManager();
    const spawned = lootMgr.spawnChestRewards({ x: 0, y: 0.4, z: 6 });
    expect(spawned.length).toBeGreaterThanOrEqual(2);
    expect(lootMgr.findNearestDrop({ x: -0.8, y: 0.4, z: 6 })).not.toBeNull();
  });

  it('simule la trajectoire physique d’une grenade et déclenche l’impact au sol', () => {
    const pm = new ProjectileManager();
    pm.spawnThrowable({
      ownerId: 'player',
      itemId: 'frag_grenade',
      origin: { x: 0, y: 1.5, z: 0 },
      direction: { x: 0, y: 0.2, z: -1 },
    });

    let exploded = false;
    for (let i = 0; i < 40; i++) {
      pm.update({
        dt: 0.05,
        colliders: [
          {
            id: 'floor',
            minX: -50,
            maxX: 50,
            minY: -1,
            maxY: 0,
            minZ: -50,
            maxZ: 50,
            isRamp: false,
          },
        ],
        combatants: [],
        onImpact: (imp) => {
          if (imp.explosionRadius > 0) exploded = true;
        },
      });
    }
    expect(exploded).toBe(true);
  });
});
