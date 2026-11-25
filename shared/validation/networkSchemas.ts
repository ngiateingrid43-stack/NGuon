import { z } from 'zod';

/**
 * Validation Zod stricte de tous les messages réseau entrants côté serveur.
 */

export const HeroIdSchema = z.enum(['sundiata', 'amina', 'shaka', 'nzinga', 'makeda', 'ogun']);
export const WeaponIdSchema = z.enum([
  'flintlock_musket',
  'repeating_rifle',
  'hand_cannon',
  'double_barrel_shotgun',
  'royal_long_rifle',
  'dueling_pistol',
  'imperial_carbine',
  'siege_gatling',
  'incendiary_mortar',
  'war_bow',
  'crossbow',
  'explosive_sling',
  'throwing_axes',
  'machete',
  'spear',
  'short_sword',
  'war_staff',
  'imperial_sabre',
]);
export const MapIdSchema = z.enum([
  'tombouctou',
  'great_zimbabwe',
  'alexandria',
  'kongo_forest',
  'giza_pyramids',
  'victoria_falls',
  'africa_open_world',
]);
export const GameModeSchema = z.enum([
  'deathmatch',
  'team_deathmatch',
  'battle_royale',
  'training',
  'story',
]);

export const Vec3Schema = z.object({
  x: z.number().finite().min(-500).max(500),
  y: z.number().finite().min(-100).max(500),
  z: z.number().finite().min(-500).max(500),
});

export const CreateRoomSchema = z.object({
  playerName: z.string().trim().min(2).max(24),
  roomName: z.string().trim().min(2).max(36),
  mode: GameModeSchema.optional().default('deathmatch'),
  mapId: MapIdSchema.optional().default('tombouctou'),
  maxPlayers: z.number().int().min(2).max(10).optional().default(10),
  killLimit: z.number().int().min(3).max(50).optional().default(15),
  isPrivate: z.boolean().optional().default(false),
  heroId: HeroIdSchema.optional().default('sundiata'),
  weaponId: WeaponIdSchema.optional().default('flintlock_musket'),
});

export const JoinRoomSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(10),
  playerName: z.string().trim().min(2).max(24),
  heroId: HeroIdSchema.optional().default('sundiata'),
  weaponId: WeaponIdSchema.optional().default('flintlock_musket'),
});

export const ReadyPayloadSchema = z.object({
  ready: z.boolean(),
});

export const LoadoutPayloadSchema = z.object({
  heroId: HeroIdSchema,
  weaponId: WeaponIdSchema,
});

export const KickPayloadSchema = z.object({
  targetPlayerId: z.string().min(1).max(64),
});

export const ChatMessageSchema = z.object({
  text: z.string().trim().min(1).max(200),
  channel: z.enum(['lobby', 'quick']).optional().default('lobby'),
});

export const PlayerInputSchema = z.object({
  seq: z.number().int().min(0),
  dt: z.number().finite().min(0.001).max(0.1),
  moveForward: z.number().min(-1).max(1),
  moveRight: z.number().min(-1).max(1),
  jump: z.boolean(),
  sprint: z.boolean(),
  crouch: z.boolean(),
  yaw: z.number().finite().min(-100).max(100),
  pitch: z.number().finite().min(-1.6).max(1.6),
  isAiming: z.boolean(),
});

export const PlayerShootSchema = z.object({
  seq: z.number().int().min(0),
  origin: Vec3Schema,
  direction: Vec3Schema,
  isAiming: z.boolean(),
  clientTime: z.number().finite().min(0),
});

export const SwitchWeaponSchema = z.object({
  weaponId: WeaponIdSchema,
});
