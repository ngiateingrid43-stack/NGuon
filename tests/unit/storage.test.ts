import { describe, it, expect } from 'vitest';
import { getPlayerRankTitle, SaveManager, type KeyValueStorage } from '@client/storage/SaveManager';
import { DEFAULT_USER_SETTINGS } from '@shared/validation/schemas';

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('SaveManager', () => {
  it('sauvegarde et recharge des paramètres validés par Zod', () => {
    const saveMgr = new SaveManager(new MemoryStorage());
    const custom = { ...DEFAULT_USER_SETTINGS, mouseSensitivity: 1.65, language: 'en' as const };
    saveMgr.saveSettings(custom);

    const loaded = saveMgr.loadSettings();
    expect(loaded.mouseSensitivity).toBe(1.65);
    expect(loaded.language).toBe('en');
  });

  it('retombe sur les valeurs par défaut si le JSON stocké est corrompu', () => {
    const mem = new MemoryStorage();
    mem.setItem('heritage_roa_settings_v1', '{invalid-json');
    const saveMgr = new SaveManager(mem);

    const loaded = saveMgr.loadSettings();
    expect(loaded).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('calcule XP, niveau et historique après une partie', () => {
    const saveMgr = new SaveManager(new MemoryStorage());
    const updated = saveMgr.recordMatchResult({
      mapId: 'tombouctou',
      kills: 15,
      deaths: 2,
      headshots: 4,
      victory: true,
      difficulty: 'intermediate',
    });

    expect(updated.matchesPlayed).toBe(1);
    expect(updated.wins).toBe(1);
    expect(updated.totalKills).toBe(15);
    expect(updated.xp).toBeGreaterThan(400);
    expect(updated.level).toBeGreaterThanOrEqual(2);
    expect(updated.lastMatchHistory).toHaveLength(1);
    expect(updated.cauris).toBeGreaterThan(200);
    expect(getPlayerRankTitle(updated.level)).toBeTruthy();

    // Boutique gratuite : débloquer et équiper un skin avec les Cauris gagnés
    const unlock = saveMgr.unlockOrEquipSkin('imperial_gold');
    expect(unlock.ok).toBe(true);
    expect(unlock.save.equippedSkin).toBe('imperial_gold');
    expect(unlock.save.unlockedSkins).toContain('imperial_gold');
  });
});
