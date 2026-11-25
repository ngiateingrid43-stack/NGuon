import { describe, it, expect } from 'vitest';
import { PhysicsManager } from '@client/physics/PhysicsManager';
import { TOMBOUCTOU_MAP } from '@shared/maps/tombouctou';
import { OPEN_WORLD_ADVENTURE, STORY_CHAPTERS } from '@shared/story/storyCampaign';
import { StoryManager } from '@client/story/StoryManager';
import { SaveManager } from '@client/storage/SaveManager';

describe('Escalade & Mode Histoire (v1.1)', () => {
  it('détecte une surface escaladable face à une tour ou un rempart', () => {
    const physics = new PhysicsManager();
    physics.loadMapColliders(TOMBOUCTOU_MAP);

    // Tour nord-ouest à (-56, 3.5, -56) taille 6x7x6 => minZ=-59, maxZ=-53, targetTopY=7
    const surface = physics.findClimbableSurface({ x: -56, y: 0.2, z: -52.2 }, 0);
    expect(surface).not.toBeNull();
    expect(surface!.canClimb).toBe(true);
    expect(surface!.targetTopY).toBeCloseTo(7, 1);
  });

  it('gère la campagne Histoire complète avec les 6 héros africains et la libération des bastions', () => {
    expect(STORY_CHAPTERS.length).toBe(6);
    const heroes = new Set(STORY_CHAPTERS.map((c) => c.heroId));
    expect(heroes).toEqual(new Set(['sundiata', 'amina', 'shaka', 'nzinga', 'makeda', 'ogun']));

    const story = new StoryManager();
    const ch = story.startChapter('ch1_manden');
    expect(ch.strongholds.length).toBe(3);

    for (const sh of ch.strongholds) {
      const res = story.update(5.0, sh.position, true);
      expect(res.newlyLiberated?.id).toBe(sh.id);
    }

    const hud = story.getHudState('fr');
    expect(hud?.liberatedCount).toBe(3);
    expect(hud?.completed).toBe(true);
  });

  it('sauvegarde la complétion d’un chapitre et attribue les Cauris', () => {
    const mem = new Map<string, string>();
    const saveMgr = new SaveManager({
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
    });

    const initial = saveMgr.loadProgress();
    expect(initial.completedChapters).toEqual([]);

    const updated = saveMgr.completeStoryChapter('ch1_manden', 120);
    expect(updated.completedChapters).toContain('ch1_manden');
    expect(updated.cauris).toBe(initial.cauris + 120);
  });

  it('gère la grande aventure continue en Monde Ouvert avec 6 bastions et distance HUD', () => {
    expect(OPEN_WORLD_ADVENTURE.strongholds.length).toBe(6);
    const story = new StoryManager();
    story.startOpenWorldAdventure();
    expect(story.isOpenWorldActive()).toBe(true);

    const hudStart = story.getHudState('fr', { x: 0, y: 1, z: 0 });
    expect(hudStart?.nearestTargetName).not.toBeNull();
    expect(hudStart?.nearestTargetDist).toBeGreaterThan(0);

    for (const sh of OPEN_WORLD_ADVENTURE.strongholds) {
      const res = story.update(5.0, sh.position, true);
      expect(res.newlyLiberated?.id).toBe(sh.id);
    }

    const hudEnd = story.getHudState('fr', { x: 0, y: 1, z: 0 });
    expect(hudEnd?.liberatedCount).toBe(6);
    expect(hudEnd?.completed).toBe(true);
  });
});
