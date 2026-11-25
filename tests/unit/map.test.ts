import { describe, it, expect } from 'vitest';
import { TOMBOUCTOU_MAP } from '@shared/maps/tombouctou';
import { GREAT_ZIMBABWE_MAP } from '@shared/maps/great_zimbabwe';
import { ALEXANDRIA_MAP } from '@shared/maps/alexandria';
import { KONGO_FOREST_MAP } from '@shared/maps/kongo_forest';
import { GIZA_PYRAMIDS_MAP } from '@shared/maps/giza_pyramids';
import { VICTORIA_FALLS_MAP } from '@shared/maps/victoria_falls';
import { AFRICA_OPEN_WORLD_MAP } from '@shared/maps/africa_open_world';
import { getMapDefinition } from '@shared/maps/mapRegistry';
import { PhysicsManager } from '@client/physics/PhysicsManager';

describe('Les 7 Cartes Africaines (6 Arènes 160x160m + Monde Ouvert 520x520m)', () => {
  const arenaMaps = [
    TOMBOUCTOU_MAP,
    GREAT_ZIMBABWE_MAP,
    ALEXANDRIA_MAP,
    KONGO_FOREST_MAP,
    GIZA_PYRAMIDS_MAP,
    VICTORIA_FALLS_MAP,
  ];
  const allMaps = [AFRICA_OPEN_WORLD_MAP, ...arenaMaps];

  it('possède des définitions complètes avec spawns, loot, zones et limites valides', () => {
    expect(AFRICA_OPEN_WORLD_MAP.bounds.minX).toBe(-260);
    expect(AFRICA_OPEN_WORLD_MAP.bounds.maxX).toBe(260);
    expect(AFRICA_OPEN_WORLD_MAP.bounds.minZ).toBe(-260);
    expect(AFRICA_OPEN_WORLD_MAP.bounds.maxZ).toBe(260);
    expect(AFRICA_OPEN_WORLD_MAP.zones.length).toBeGreaterThanOrEqual(5);
    expect(AFRICA_OPEN_WORLD_MAP.blocks.some((b) => b.id.includes('perimeter_wall'))).toBe(false);

    for (const map of arenaMaps) {
      expect(map.bounds.minX).toBe(-80);
      expect(map.bounds.maxX).toBe(80);
      expect(map.bounds.minZ).toBe(-80);
      expect(map.bounds.maxZ).toBe(80);
    }

    for (const map of allMaps) {
      expect(map.spawnPoints.length).toBeGreaterThanOrEqual(6);
      expect(map.lootPoints.length).toBeGreaterThanOrEqual(4);
      expect(map.zones.length).toBeGreaterThanOrEqual(2);
      expect(map.blocks.length).toBeGreaterThan(20);
      expect(getMapDefinition(map.id).id).toBe(map.id);
    }
  });

  it('tous les points de spawn sont à l’intérieur des limites et sans chevauchement solide', () => {
    for (const map of allMaps) {
      const physics = new PhysicsManager();
      physics.loadMapColliders(map);
      const colliders = physics.getColliders();

      for (const sp of map.spawnPoints) {
        expect(sp.position.x).toBeGreaterThan(map.bounds.minX);
        expect(sp.position.x).toBeLessThan(map.bounds.maxX);
        expect(sp.position.z).toBeGreaterThan(map.bounds.minZ);
        expect(sp.position.z).toBeLessThan(map.bounds.maxZ);

        for (const box of colliders) {
          if (
            box.id === 'ground_main' ||
            box.id.includes('_floor_') ||
            box.id.startsWith('ow_biome_')
          ) {
            continue;
          }
          const insideX = sp.position.x > box.minX - 0.3 && sp.position.x < box.maxX + 0.3;
          const insideZ = sp.position.z > box.minZ - 0.3 && sp.position.z < box.maxZ + 0.3;
          const insideY = sp.position.y + 0.2 > box.minY && sp.position.y < box.maxY;
          expect(insideX && insideZ && insideY).toBe(false);
        }
      }
    }
  });
});
