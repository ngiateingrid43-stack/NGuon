/**
 * Types communs partagés entre le client, le serveur et les tests.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type HitZone = 'head' | 'heart' | 'body' | 'limb';

export type GameMode = 'deathmatch' | 'team_deathmatch' | 'battle_royale' | 'training' | 'story';

export type GraphicsProfile = 'low' | 'medium' | 'high' | 'ultra' | 'auto';

export type Language = 'fr' | 'en';

export type BotDifficulty = 'beginner' | 'intermediate' | 'expert';

export type MatchPhase = 'menu' | 'loading' | 'playing' | 'paused' | 'ended';

export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface KillFeedEntry {
  id: string;
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface DamageEvent {
  attackerId: string;
  targetId: string;
  weaponId: string;
  rawDamage: number;
  finalDamage: number;
  armorDamage: number;
  healthDamage: number;
  isHeadshot: boolean;
  hitZone?: HitZone;
  isElimination: boolean;
  hitPoint: Vec3;
  sourceDirection: Vec3;
}
