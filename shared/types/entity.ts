import type { BotDifficulty, GameMode, KillFeedEntry, MatchPhase, Vec3 } from './common.js';
import type { HeroId } from './hero.js';
import type { MapId } from './map.js';
import type { TimeOfDay } from '../maps/mapRegistry.js';
import type { WeaponId, WeaponRuntimeState } from './weapon.js';

export interface CombatantStats {
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
}

export interface CombatantState {
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  team?: 'alpha' | 'beta';
  heroId: HeroId;
  position: Vec3;
  yaw: number;
  pitch: number;
  velocity: Vec3;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  isAlive: boolean;
  respawnTimer: number;
  isGrounded: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  activeWeapon: WeaponRuntimeState;
  stats: CombatantStats;
}

export type BotAIState = 'patrol' | 'alert' | 'combat' | 'seek_cover' | 'reload' | 'dead';

export interface MatchConfig {
  mode: GameMode;
  mapId: MapId;
  timeOfDay?: TimeOfDay;
  botCount: number;
  botDifficulty: BotDifficulty;
  durationSeconds: number;
  killLimit: number;
  playerHeroId: HeroId;
  playerWeaponId: WeaponId;
  storyChapterId?: string;
  storyTeamMode?: boolean;
  storyAllyCount?: number;
}

export interface MatchSummary {
  victory: boolean;
  reason: 'kill_limit' | 'time_up' | 'aborted';
  durationPlayed: number;
  playerStats: CombatantStats;
  leaderboard: Array<{
    id: string;
    name: string;
    isBot: boolean;
    heroId: HeroId;
    kills: number;
    deaths: number;
    damageDealt: number;
  }>;
  killFeed: KillFeedEntry[];
}

export interface MatchSnapshot {
  phase: MatchPhase;
  timeRemaining: number;
  killLimit: number;
  player: CombatantState;
  bots: CombatantState[];
}
