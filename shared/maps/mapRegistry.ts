import type { MapDefinition, MapId } from '../types/map.js';
import { TOMBOUCTOU_MAP } from './tombouctou.js';
import { GREAT_ZIMBABWE_MAP } from './great_zimbabwe.js';
import { ALEXANDRIA_MAP } from './alexandria.js';
import { KONGO_FOREST_MAP } from './kongo_forest.js';
import { GIZA_PYRAMIDS_MAP } from './giza_pyramids.js';
import { VICTORIA_FALLS_MAP } from './victoria_falls.js';
import { AFRICA_OPEN_WORLD_MAP } from './africa_open_world.js';

export type TimeOfDay = 'day' | 'sunset' | 'night';

/**
 * Registre central des cartes africaines historiques & du Grand Monde Ouvert.
 */
export const MAPS_CONFIG: Record<MapId, MapDefinition> = {
  tombouctou: TOMBOUCTOU_MAP,
  great_zimbabwe: GREAT_ZIMBABWE_MAP,
  alexandria: ALEXANDRIA_MAP,
  kongo_forest: KONGO_FOREST_MAP,
  giza_pyramids: GIZA_PYRAMIDS_MAP,
  victoria_falls: VICTORIA_FALLS_MAP,
  africa_open_world: AFRICA_OPEN_WORLD_MAP,
};

export function getMapDefinition(mapId: MapId): MapDefinition {
  return MAPS_CONFIG[mapId] ?? TOMBOUCTOU_MAP;
}
