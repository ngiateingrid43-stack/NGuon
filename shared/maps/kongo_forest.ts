import type { MapBlock, MapDefinition } from '../types/map.js';

function buildJungleTree(idPrefix: string, x: number, z: number, height: number): MapBlock[] {
  return [
    {
      id: `${idPrefix}_trunk`,
      position: { x, y: height / 2, z },
      size: { x: 1.1, y: height, z: 1.1 },
      material: 'palm_trunk',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: `${idPrefix}_canopy`,
      position: { x, y: height + 0.6, z },
      size: { x: 5.8, y: 1.2, z: 5.8 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
      receiveShadow: true,
    },
  ];
}

function buildWoodRamp(
  idPrefix: string,
  startX: number,
  startY: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  steps: number,
  stepHeight: number,
  stepDepth: number,
  width: number
): MapBlock[] {
  const blocks: MapBlock[] = [];
  for (let i = 0; i < steps; i++) {
    const h = (i + 1) * stepHeight;
    const x = startX + dirX * (i + 0.5) * stepDepth;
    const z = startZ + dirZ * (i + 0.5) * stepDepth;
    blocks.push({
      id: `${idPrefix}_step_${i}`,
      position: { x, y: startY + h / 2, z },
      size: { x: dirX !== 0 ? stepDepth : width, y: h, z: dirZ !== 0 ? stepDepth : width },
      material: 'wood',
      collidable: true,
      isRamp: true,
      castShadow: true,
      receiveShadow: true,
    });
  }
  return blocks;
}

/**
 * Carte 4 (v0.6) : FORÊT DU KONGO.
 * Sanctuaire forestier traversé par un fleuve, passerelles en bois surélevées
 * et autel royal sculpté.
 */
export const KONGO_FOREST_MAP: MapDefinition = {
  id: 'kongo_forest',
  nameFr: 'Forêt du Kongo',
  nameEn: 'Kongo Forest',
  descriptionFr:
    'Canopée tropicale dense traversée par une rivière, des passerelles en bois et un sanctuaire royal.',
  descriptionEn:
    'Dense tropical canopy crossed by a river, elevated wooden walkways, and a royal sanctuary.',
  environmentType: 'tropical_forest',
  ambientAudioTag: 'jungle_canopy',
  bounds: {
    minX: -80,
    maxX: 80,
    minY: -2,
    maxY: 32,
    minZ: -80,
    maxZ: 80,
  },
  lighting: {
    sunColor: '#fef08a',
    sunIntensity: 1.85,
    sunPosition: { x: -34, y: 54, z: 34 },
    ambientColor: '#bbf7d0',
    ambientIntensity: 0.58,
    hemisphereSky: '#4ade80',
    hemisphereGround: '#3f2e1e',
    skyTopColor: '#065f46',
    skyHorizonColor: '#a7f3d0',
  },
  weather: {
    fogColor: '#a7f3d0',
    fogNear: 50,
    fogFar: 170,
    dustParticles: 180,
    windDirection: { x: 0.3, y: 0.1, z: 0.2 },
  },
  spawnPoints: [
    { id: 'kf_sp_0', position: { x: 0, y: 0.1, z: 66 }, yaw: 0, team: 'alpha' },
    { id: 'kf_sp_1', position: { x: 0, y: 0.1, z: -66 }, yaw: Math.PI, team: 'beta' },
    { id: 'kf_sp_2', position: { x: -65, y: 0.1, z: 0 }, yaw: -Math.PI / 2, team: 'alpha' },
    { id: 'kf_sp_3', position: { x: 65, y: 0.1, z: 0 }, yaw: Math.PI / 2, team: 'beta' },
    { id: 'kf_sp_4', position: { x: -46, y: 0.1, z: 46 }, yaw: -Math.PI / 4, team: 'any' },
    { id: 'kf_sp_5', position: { x: 46, y: 0.1, z: 46 }, yaw: Math.PI / 4, team: 'any' },
    { id: 'kf_sp_6', position: { x: -46, y: 0.1, z: -46 }, yaw: -3 * (Math.PI / 4), team: 'any' },
    { id: 'kf_sp_7', position: { x: 46, y: 0.1, z: -46 }, yaw: 3 * (Math.PI / 4), team: 'any' },
  ],
  zones: [
    {
      id: 'royal_sanctuary',
      nameFr: 'Sanctuaire Royal',
      nameEn: 'Royal Sanctuary',
      center: { x: 0, y: 2.2, z: 0 },
      radius: 10,
      type: 'high_ground',
    },
    {
      id: 'kongo_river',
      nameFr: 'Fleuve Kongo',
      nameEn: 'Kongo River',
      center: { x: 0, y: 0, z: 12 },
      radius: 14,
      type: 'oasis',
    },
  ],
  lootPoints: [
    { id: 'kf_loot_health', position: { x: 0, y: 2.6, z: 0 }, type: 'health', respawnSeconds: 18 },
    { id: 'kf_loot_armor', position: { x: -16, y: 0.5, z: -8 }, type: 'armor', respawnSeconds: 22 },
    { id: 'kf_loot_ammo', position: { x: 16, y: 0.5, z: 6 }, type: 'ammo', respawnSeconds: 15 },
    { id: 'kf_crate_center', position: { x: 3.5, y: 2.65, z: 0 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'kf_crate_west', position: { x: -18, y: 0.45, z: 15 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'kf_crate_east', position: { x: 18, y: 0.45, z: -15 }, type: 'weapon_crate', respawnSeconds: 28 },
  ],
  blocks: [
    {
      id: 'kf_floor_jungle',
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: 168, y: 1, z: 168 },
      material: 'grass_oasis',
      collidable: true,
      receiveShadow: true,
    },
    // Fleuve traversant la carte élargie d'est en ouest
    {
      id: 'kf_river_water',
      position: { x: 0, y: 0.04, z: 12 },
      size: { x: 152, y: 0.08, z: 7.5 },
      material: 'water',
      collidable: false,
      receiveShadow: true,
    },
    // Trois ponts en bois sur le fleuve
    {
      id: 'kf_bridge_center',
      position: { x: 0, y: 0.25, z: 12 },
      size: { x: 4.5, y: 0.5, z: 8.5 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_bridge_west',
      position: { x: -18, y: 0.25, z: 12 },
      size: { x: 4.0, y: 0.5, z: 8.5 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_bridge_east',
      position: { x: 18, y: 0.25, z: 12 },
      size: { x: 4.0, y: 0.5, z: 8.5 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    // Limites de la forêt élargie (156x156m) + miradors escaladables
    {
      id: 'kf_wall_n',
      position: { x: 0, y: 3.2, z: -78 },
      size: { x: 158, y: 6.4, z: 3 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_wall_s',
      position: { x: 0, y: 3.2, z: 78 },
      size: { x: 158, y: 6.4, z: 3 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_wall_w',
      position: { x: -78, y: 3.2, z: 0 },
      size: { x: 3, y: 6.4, z: 158 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_wall_e',
      position: { x: 78, y: 3.2, z: 0 },
      size: { x: 3, y: 6.4, z: 158 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_outer_watch_nw',
      position: { x: -50, y: 2.5, z: -50 },
      size: { x: 6, y: 5, z: 6 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'kf_outer_watch_se',
      position: { x: 50, y: 2.5, z: 50 },
      size: { x: 6, y: 5, z: 6 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    // Plateforme surélevée du Sanctuaire Royal
    {
      id: 'kf_sanctuary_deck',
      position: { x: 0, y: 1.1, z: 0 },
      size: { x: 12, y: 2.2, z: 10 },
      material: 'wood',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'kf_sanctuary_totem',
      position: { x: 0, y: 3.6, z: -4.2 },
      size: { x: 1.6, y: 2.8, z: 1.6 },
      material: 'terracotta',
      collidable: true,
      castShadow: true,
    },
    ...buildWoodRamp('kf_ramp_n', 0, 0, -9, 0, 1, 5, 0.44, 0.78, 4.0),
    ...buildWoodRamp('kf_ramp_w', -10, 0, 0, 1, 0, 5, 0.44, 0.78, 4.0),
    // Grands arbres de la canopée servant de couverts naturels
    ...buildJungleTree('kf_tree_1', -12, -14, 7.2),
    ...buildJungleTree('kf_tree_2', 12, -14, 7.8),
    ...buildJungleTree('kf_tree_3', -24, 2, 7.0),
    ...buildJungleTree('kf_tree_4', 24, 2, 7.5),
    ...buildJungleTree('kf_tree_5', -12, 22, 6.8),
    ...buildJungleTree('kf_tree_6', 12, 22, 7.2),
    ...buildJungleTree('kf_tree_7', 0, -20, 8.0),
  ],
};
