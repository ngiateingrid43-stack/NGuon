import type { Vec3 } from './common.js';

export type HeroId = 'sundiata' | 'amina' | 'shaka' | 'nzinga' | 'makeda' | 'ogun';

export type HeroRole =
  | 'offensive_support'
  | 'defense'
  | 'assault'
  | 'tactical_recon'
  | 'healing_support'
  | 'zone_control';

export interface HeroStats {
  maxHealth: number;
  maxArmor: number;
  moveSpeed: number;
  acceleration: number;
  respawnDelay: number;
  abilityCooldown: number;
  damageResistance: number;
  passiveBonus: number;
}

export interface HeroPalette {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  cloth: string;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  title: string;
  inspiration: string;
  role: HeroRole;
  descriptionFr: string;
  descriptionEn: string;
  passiveNameFr: string;
  passiveNameEn: string;
  passiveDescFr: string;
  passiveDescEn: string;
  activeNameFr: string;
  activeNameEn: string;
  activeDescFr: string;
  activeDescEn: string;
  stats: HeroStats;
  palette: HeroPalette;
  accessoryType: 'crown' | 'crest' | 'plume' | 'diadem' | 'solar_halo' | 'forge_mask';
  playableInV01: boolean;
}

export interface HeroRuntimeState {
  heroId: HeroId;
  abilityCooldownRemaining: number;
  abilityActiveRemaining: number;
  originPosition?: Vec3;
}
