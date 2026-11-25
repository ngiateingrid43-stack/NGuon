import type { Rarity } from '@shared/types/common';
import type {
  ConsumableId,
  ConsumableSlotItem,
  PlayerInventory,
  ShieldId,
  ShieldSlotItem,
  WeaponSlotItem,
  WorldLootDrop,
} from '@shared/types/inventory';
import type { WeaponId } from '@shared/types/weapon';
import {
  CONSUMABLES_CONFIG,
  SHIELDS_CONFIG,
  createInitialWeaponState,
  getWeaponDefinition,
} from '@shared/weapons/weaponsConfig';

/**
 * Gère l'inventaire réglementaire du joueur :
 * - 2 emplacements d'armes
 * - 1 emplacement d'objet (Grenade / Potion incendiaire)
 * - 1 emplacement de bouclier (Bouclier en bois / Bouclier métallique)
 */
export class InventoryManager {
  public createInitialInventory(
    primaryWeapon: WeaponId,
    secondaryWeapon: WeaponId = 'dueling_pistol',
    meleeWeapon: WeaponId = 'machete'
  ): PlayerInventory {
    const pDef = getWeaponDefinition(primaryWeapon);
    const sDef = getWeaponDefinition(secondaryWeapon);
    const mDef = getWeaponDefinition(meleeWeapon);
    return {
      weaponSlots: [
        {
          weaponId: primaryWeapon,
          rarity: pDef.rarity,
          state: createInitialWeaponState(primaryWeapon),
        },
        {
          weaponId: secondaryWeapon,
          rarity: sDef.rarity,
          state: createInitialWeaponState(secondaryWeapon),
        },
        {
          weaponId: meleeWeapon,
          rarity: mDef.rarity,
          state: createInitialWeaponState(meleeWeapon),
        },
      ],
      activeWeaponIndex: 0,
      itemSlot: {
        itemId: 'frag_grenade',
        rarity: 'rare',
        quantity: 2,
      },
      shieldSlot: null,
    };
  }

  public getActiveWeaponSlot(inv: PlayerInventory): WeaponSlotItem | null {
    return (
      inv.weaponSlots[inv.activeWeaponIndex] ??
      inv.weaponSlots[0] ??
      inv.weaponSlots[1] ??
      inv.weaponSlots[2]
    );
  }

  public switchWeaponSlot(inv: PlayerInventory, index: 0 | 1 | 2): WeaponSlotItem | null {
    if (!inv.weaponSlots[index]) return null;
    inv.activeWeaponIndex = index;
    return inv.weaponSlots[index];
  }

  public cycleWeaponSlot(inv: PlayerInventory, direction: 1 | -1): WeaponSlotItem | null {
    const total = inv.weaponSlots.length;
    for (let step = 1; step < total; step++) {
      const idx = ((inv.activeWeaponIndex + direction * step) % total + total) % total;
      const slot = inv.weaponSlots[idx as 0 | 1 | 2];
      if (slot) {
        inv.activeWeaponIndex = idx as 0 | 1 | 2;
        return slot;
      }
    }
    return null;
  }

  public pickupWeapon(
    inv: PlayerInventory,
    weaponId: WeaponId,
    rarity: Rarity
  ): { pickedUp: boolean; replaced?: WeaponSlotItem } {
    const newItem: WeaponSlotItem = {
      weaponId,
      rarity,
      state: createInitialWeaponState(weaponId),
    };

    for (let i = 0; i < 3; i++) {
      if (!inv.weaponSlots[i]) {
        inv.weaponSlots[i as 0 | 1 | 2] = newItem;
        inv.activeWeaponIndex = i as 0 | 1 | 2;
        return { pickedUp: true };
      }
    }

    // Remplacer l'emplacement actif
    const replaced = inv.weaponSlots[inv.activeWeaponIndex] ?? undefined;
    inv.weaponSlots[inv.activeWeaponIndex] = newItem;
    return { pickedUp: true, replaced };
  }

  public dropActiveWeapon(inv: PlayerInventory): WeaponSlotItem | null {
    const fallbackIdx = ([0, 1, 2] as const).find(
      (i) => i !== inv.activeWeaponIndex && inv.weaponSlots[i] !== null
    );
    if (fallbackIdx === undefined) return null;

    const dropped = inv.weaponSlots[inv.activeWeaponIndex];
    inv.weaponSlots[inv.activeWeaponIndex] = null;
    inv.activeWeaponIndex = fallbackIdx;
    return dropped;
  }

  public pickupConsumable(
    inv: PlayerInventory,
    itemId: ConsumableId,
    amount = 1
  ): { pickedUp: boolean; replaced?: ConsumableSlotItem } {
    const def = CONSUMABLES_CONFIG[itemId];
    if (!inv.itemSlot) {
      inv.itemSlot = {
        itemId,
        rarity: def.rarity,
        quantity: Math.min(def.maxStack, amount),
      };
      return { pickedUp: true };
    }
    if (inv.itemSlot.itemId === itemId) {
      if (inv.itemSlot.quantity >= def.maxStack) return { pickedUp: false };
      inv.itemSlot.quantity = Math.min(def.maxStack, inv.itemSlot.quantity + amount);
      return { pickedUp: true };
    }
    const replaced = inv.itemSlot;
    inv.itemSlot = {
      itemId,
      rarity: def.rarity,
      quantity: Math.min(def.maxStack, amount),
    };
    return { pickedUp: true, replaced };
  }

  public consumeItem(inv: PlayerInventory): ConsumableId | null {
    if (!inv.itemSlot || inv.itemSlot.quantity <= 0) return null;
    const id = inv.itemSlot.itemId;
    inv.itemSlot.quantity -= 1;
    if (inv.itemSlot.quantity <= 0) {
      inv.itemSlot = null;
    }
    return id;
  }

  public equipShield(
    inv: PlayerInventory,
    shieldId: ShieldId
  ): { equipped: boolean; replaced?: ShieldSlotItem } {
    const def = SHIELDS_CONFIG[shieldId];
    const next: ShieldSlotItem = {
      shieldId,
      rarity: def.rarity,
      currentShield: def.maxShield,
      maxShield: def.maxShield,
    };

    if (
      inv.shieldSlot &&
      inv.shieldSlot.shieldId === shieldId &&
      inv.shieldSlot.currentShield >= inv.shieldSlot.maxShield
    ) {
      return { equipped: false };
    }

    const replaced = inv.shieldSlot ?? undefined;
    inv.shieldSlot = next;
    return { equipped: true, replaced };
  }

  public applyShieldAbsorption(inv: PlayerInventory, incomingDamage: number): number {
    if (!inv.shieldSlot || inv.shieldSlot.currentShield <= 0) {
      return incomingDamage;
    }
    const absorbed = Math.min(inv.shieldSlot.currentShield, Math.round(incomingDamage * 0.65));
    inv.shieldSlot.currentShield -= absorbed;
    if (inv.shieldSlot.currentShield <= 0) {
      inv.shieldSlot = null;
    }
    return Math.max(0, incomingDamage - absorbed);
  }

  public createDropFromSlot(
    slot: WeaponSlotItem,
    position: { x: number; y: number; z: number }
  ): WorldLootDrop {
    return {
      id: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'weapon',
      rarity: slot.rarity,
      position: { ...position },
      weaponId: slot.weaponId,
      amount: 1,
      createdAt: Date.now(),
    };
  }
}
