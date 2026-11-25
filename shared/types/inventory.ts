import type { Rarity, Vec3 } from './common.js';
import type { WeaponId, WeaponRuntimeState } from './weapon.js';

export type ConsumableId = 'frag_grenade' | 'incendiary_potion';
export type ShieldId = 'wooden_shield' | 'metal_shield';

export interface WeaponSlotItem {
  weaponId: WeaponId;
  rarity: Rarity;
  state: WeaponRuntimeState;
}

export interface ConsumableSlotItem {
  itemId: ConsumableId;
  rarity: Rarity;
  quantity: number;
}

export interface ShieldSlotItem {
  shieldId: ShieldId;
  rarity: Rarity;
  currentShield: number;
  maxShield: number;
}

export interface PlayerInventory {
  weaponSlots: [WeaponSlotItem | null, WeaponSlotItem | null, WeaponSlotItem | null];
  activeWeaponIndex: 0 | 1 | 2;
  itemSlot: ConsumableSlotItem | null;
  shieldSlot: ShieldSlotItem | null;
}

export type LootDropKind = 'weapon' | 'item' | 'shield' | 'ammo' | 'health' | 'armor';

export interface WorldLootDrop {
  id: string;
  kind: LootDropKind;
  rarity: Rarity;
  position: Vec3;
  weaponId?: WeaponId;
  itemId?: ConsumableId;
  shieldId?: ShieldId;
  amount: number;
  createdAt: number;
}
