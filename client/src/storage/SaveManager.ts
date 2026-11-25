import {
  DEFAULT_PLAYER_SAVE,
  DEFAULT_USER_SETTINGS,
  PlayerProgressSaveSchema,
  UserSettingsSchema,
  type PlayerProgressSave,
  type UserSettings,
} from '@shared/validation/schemas';

const SETTINGS_STORAGE_KEY = 'heritage_roa_settings_v1';
const SAVE_STORAGE_KEY = 'heritage_roa_progress_v1';

export interface VirtualShopSkin {
  id: string;
  nameFr: string;
  nameEn: string;
  costCauris: number;
  accentColor: string;
}

/**
 * Boutique virtuelle 100 % gratuite (débloquée uniquement via les Cauris gagnés en jeu).
 */
export const FREE_SHOP_SKINS: VirtualShopSkin[] = [
  {
    id: 'standard_heritage',
    nameFr: 'Patine Héritage (Base)',
    nameEn: 'Heritage Patina (Default)',
    costCauris: 0,
    accentColor: '#eab308',
  },
  {
    id: 'imperial_gold',
    nameFr: 'Or Impérial du Mali',
    nameEn: 'Mali Imperial Gold',
    costCauris: 120,
    accentColor: '#facc15',
  },
  {
    id: 'sahel_indigo',
    nameFr: 'Indigo de Tombouctou',
    nameEn: 'Timbuktu Indigo',
    costCauris: 180,
    accentColor: '#38bdf8',
  },
  {
    id: 'kongo_emerald',
    nameFr: 'Émeraude du Kongo',
    nameEn: 'Kongo Emerald',
    costCauris: 240,
    accentColor: '#4ade80',
  },
  {
    id: 'zazzau_crimson',
    nameFr: 'Pourpre de Zazzau',
    nameEn: 'Zazzau Crimson',
    costCauris: 300,
    accentColor: '#f87171',
  },
];

export function getPlayerRankTitle(level: number): string {
  if (level >= 12) return 'Légende d’Afrique';
  if (level >= 8) return 'Stratège Impérial';
  if (level >= 5) return 'Capitaine du Mandé';
  if (level >= 3) return 'Garde Royal';
  return 'Éclaireur du Sahel';
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Gestionnaire de sauvegarde locale validée par Zod.
 * Compatible navigateur (localStorage) et tests unitaires (storage injecté).
 */
export class SaveManager {
  private storage: KeyValueStorage | null;

  constructor(storage?: KeyValueStorage) {
    if (storage) {
      this.storage = storage;
      return;
    }
    this.storage = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.storage = window.localStorage;
      }
    } catch {
      this.storage = null;
    }
  }

  public loadSettings(): UserSettings {
    if (!this.storage) return { ...DEFAULT_USER_SETTINGS };
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_USER_SETTINGS };
      const parsed = UserSettingsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : { ...DEFAULT_USER_SETTINGS };
    } catch {
      return { ...DEFAULT_USER_SETTINGS };
    }
  }

  public saveSettings(settings: UserSettings): UserSettings {
    const validated = UserSettingsSchema.parse(settings);
    if (this.storage) {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated));
    }
    return validated;
  }

  public loadProgress(): PlayerProgressSave {
    if (!this.storage) return { ...DEFAULT_PLAYER_SAVE };
    try {
      const raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PLAYER_SAVE };
      const parsed = PlayerProgressSaveSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : { ...DEFAULT_PLAYER_SAVE };
    } catch {
      return { ...DEFAULT_PLAYER_SAVE };
    }
  }

  public unlockOrEquipSkin(skinId: string): { ok: boolean; save: PlayerProgressSave; error?: string } {
    const current = this.loadProgress();
    const skin = FREE_SHOP_SKINS.find((s) => s.id === skinId);
    if (!skin) {
      return { ok: false, save: current, error: 'Skin introuvable.' };
    }
    if (current.unlockedSkins.includes(skinId)) {
      const updated = PlayerProgressSaveSchema.parse({ ...current, equippedSkin: skinId });
      this.persistProgress(updated);
      return { ok: true, save: updated };
    }
    if (current.cauris < skin.costCauris) {
      return { ok: false, save: current, error: 'Cauris insuffisants.' };
    }
    const updated = PlayerProgressSaveSchema.parse({
      ...current,
      cauris: current.cauris - skin.costCauris,
      unlockedSkins: [...current.unlockedSkins, skinId],
      equippedSkin: skinId,
    });
    this.persistProgress(updated);
    return { ok: true, save: updated };
  }

  public recordMatchResult(result: {
    mapId: string;
    kills: number;
    deaths: number;
    headshots: number;
    victory: boolean;
    difficulty: 'beginner' | 'intermediate' | 'expert';
  }): PlayerProgressSave {
    const current = this.loadProgress();
    const gainedXp = 50 + result.kills * 25 + result.headshots * 10 + (result.victory ? 100 : 0);
    const gainedCauris = 20 + result.kills * 6 + result.headshots * 3 + (result.victory ? 45 : 0);
    const totalXp = current.xp + gainedXp;
    const level = Math.max(1, Math.floor(totalXp / 350) + 1);

    const updated: PlayerProgressSave = {
      ...current,
      matchesPlayed: current.matchesPlayed + 1,
      wins: current.wins + (result.victory ? 1 : 0),
      totalKills: current.totalKills + result.kills,
      totalDeaths: current.totalDeaths + result.deaths,
      totalHeadshots: current.totalHeadshots + result.headshots,
      xp: totalXp,
      level,
      cauris: current.cauris + gainedCauris,
      lastMatchHistory: [
        {
          dateIso: new Date().toISOString(),
          mapId: result.mapId,
          kills: result.kills,
          deaths: result.deaths,
          victory: result.victory,
          difficulty: result.difficulty,
        },
        ...current.lastMatchHistory,
      ].slice(0, 20),
    };

    const validated = PlayerProgressSaveSchema.parse(updated);
    this.persistProgress(validated);
    return validated;
  }

  public completeStoryChapter(chapterId: string, bonusCauris: number): PlayerProgressSave {
    const current = this.loadProgress();
    const alreadyDone = current.completedChapters.includes(chapterId);
    const updated = PlayerProgressSaveSchema.parse({
      ...current,
      cauris: current.cauris + (alreadyDone ? Math.round(bonusCauris * 0.25) : bonusCauris),
      completedChapters: alreadyDone
        ? current.completedChapters
        : [...current.completedChapters, chapterId],
    });
    this.persistProgress(updated);
    return updated;
  }

  private persistProgress(save: PlayerProgressSave): void {
    if (this.storage) {
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    }
  }
}
