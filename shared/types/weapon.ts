import type { Rarity } from './common.js';

export type WeaponId =
  | 'flintlock_musket'
  | 'repeating_rifle'
  | 'hand_cannon'
  | 'double_barrel_shotgun'
  | 'royal_long_rifle'
  | 'war_bow'
  | 'crossbow'
  | 'explosive_sling'
  | 'throwing_axes'
  | 'machete'
  | 'spear'
  | 'short_sword'
  | 'war_staff'
  | 'dueling_pistol'
  | 'imperial_carbine'
  | 'siege_gatling'
  | 'incendiary_mortar'
  | 'imperial_sabre';

export type WeaponCategory = 'melee' | 'ranged' | 'fantasy_firearm' | 'explosive';

export interface WeaponStats {
  damage: number;
  headshotMultiplier: number;
  fireRate: number; // Tirs par seconde
  range: number; // En mètres
  accuracy: number; // 0 à 1
  baseSpread: number; // En radians
  moveSpreadPenalty: number;
  adsSpreadMultiplier: number;
  recoilVertical: number;
  recoilHorizontal: number;
  magazineSize: number;
  reserveAmmoMax: number;
  reloadTime: number; // En secondes
  pelletCount: number;
  projectileSpeed: number; // 0 = hitscan
  explosionRadius?: number;
}

export interface ConsumableDefinition {
  id: 'frag_grenade' | 'incendiary_potion';
  nameFr: string;
  nameEn: string;
  rarity: Rarity;
  damage: number;
  radius: number;
  durationSeconds: number;
  throwSpeed: number;
  maxStack: number;
  color: string;
}

export interface ShieldDefinition {
  id: 'wooden_shield' | 'metal_shield';
  nameFr: string;
  nameEn: string;
  rarity: Rarity;
  maxShield: number;
  damageReduction: number;
  color: string;
}

export interface WeaponVisualConfig {
  bodyColor: string;
  barrelColor: string;
  accentColor: string;
  length: number;
  muzzleOffset: { x: number; y: number; z: number };
}

export interface WeaponDefinition {
  id: WeaponId;
  nameFr: string;
  nameEn: string;
  category: WeaponCategory;
  rarity: Rarity;
  descriptionFr: string;
  descriptionEn: string;
  stats: WeaponStats;
  visual: WeaponVisualConfig;
}

export interface WeaponRuntimeState {
  weaponId: WeaponId;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  fireCooldown: number;
}
