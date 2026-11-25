/**
 * Constantes globales de simulation et de gameplay.
 */

export const PHYSICS_CONSTANTS = {
  GRAVITY: -24,
  FIXED_TIMESTEP: 1 / 60,
  MAX_SUBSTEPS: 4,
  PLAYER_RADIUS: 0.42,
  PLAYER_HEIGHT: 1.8,
  PLAYER_EYE_HEIGHT: 1.62,
  CROUCH_HEIGHT: 1.15,
  CROUCH_EYE_HEIGHT: 1.0,
  WALK_SPEED: 6.4,
  SPRINT_SPEED: 9.2,
  CROUCH_SPEED: 3.6,
  SLIDE_INITIAL_SPEED: 12.2,
  SLIDE_DURATION: 0.55,
  SLIDE_COOLDOWN: 0.9,
  GROUND_ACCELERATION: 55,
  AIR_ACCELERATION: 18,
  GROUND_FRICTION: 11,
  JUMP_VELOCITY: 8.6,
  MAX_SLOPE_ANGLE_DEG: 48,
} as const;

export const GAMEPLAY_CONSTANTS = {
  DEFAULT_MATCH_DURATION: 300, // 5 minutes pour le prototype v0.1
  DEFAULT_KILL_LIMIT: 15,
  DEFAULT_BOT_COUNT: 5,
  RESPAWN_DELAY: 3.0,
  ARMOR_ABSORPTION_RATIO: 0.5, // L'armure absorbe 50 % des dégâts tant qu'elle est > 0
  NETWORK_TICK_RATE: 20, // Prévu pour v0.2
} as const;

export const RARITY_COLORS = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
} as const;
