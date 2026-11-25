import { z } from 'zod';

/**
 * Schémas de validation Zod pour les paramètres, sauvegardes et configurations de match.
 */

export const GraphicsProfileSchema = z.enum(['low', 'medium', 'high', 'ultra', 'auto']);
export const LanguageSchema = z.enum(['fr', 'en']);
export const ColorblindModeSchema = z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia']);
export const BotDifficultySchema = z.enum(['beginner', 'intermediate', 'expert']);

export const UserSettingsSchema = z.object({
  language: LanguageSchema,
  mouseSensitivity: z.number().min(0.1).max(3.0),
  fov: z.number().min(60).max(110),
  invertY: z.boolean(),
  aimAssist: z.boolean().default(true),
  masterVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  ambienceVolume: z.number().min(0).max(1),
  muted: z.boolean(),
  graphicsProfile: GraphicsProfileSchema,
  showDiagnostics: z.boolean(),
  highContrast: z.boolean(),
  largeText: z.boolean(),
  colorblindMode: ColorblindModeSchema,
  reduceCameraShake: z.boolean(),
  subtitlesEnabled: z.boolean(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'fr',
  mouseSensitivity: 1.0,
  fov: 78,
  invertY: false,
  aimAssist: true,
  masterVolume: 0.75,
  sfxVolume: 0.85,
  ambienceVolume: 0.45,
  muted: false,
  graphicsProfile: 'high',
  showDiagnostics: true,
  highContrast: false,
  largeText: false,
  colorblindMode: 'none',
  reduceCameraShake: false,
  subtitlesEnabled: true,
};

export const PlayerProgressSaveSchema = z.object({
  version: z.literal(1),
  playerName: z.string().min(2).max(24),
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  totalKills: z.number().int().min(0),
  totalDeaths: z.number().int().min(0),
  totalHeadshots: z.number().int().min(0),
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  cauris: z.number().int().min(0).default(150),
  unlockedSkins: z.array(z.string()).default(['standard_heritage']),
  equippedSkin: z.string().default('standard_heritage'),
  completedChapters: z.array(z.string()).default([]),
  lastMatchHistory: z
    .array(
      z.object({
        dateIso: z.string(),
        mapId: z.string(),
        kills: z.number().int().min(0),
        deaths: z.number().int().min(0),
        victory: z.boolean(),
        difficulty: BotDifficultySchema,
      })
    )
    .max(20),
});

export type PlayerProgressSave = z.infer<typeof PlayerProgressSaveSchema>;

export const DEFAULT_PLAYER_SAVE: PlayerProgressSave = {
  version: 1,
  playerName: 'Voyageur',
  matchesPlayed: 0,
  wins: 0,
  totalKills: 0,
  totalDeaths: 0,
  totalHeadshots: 0,
  xp: 0,
  level: 1,
  cauris: 150,
  unlockedSkins: ['standard_heritage'],
  equippedSkin: 'standard_heritage',
  completedChapters: [],
  lastMatchHistory: [],
};
