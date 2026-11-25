import type { MapBlock, MapDefinition } from '../types/map.js';

/**
 * Helper d'escalier en pierre sèche pour la citadelle du Grand Zimbabwe.
 */
function buildStoneStaircase(
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
    const sizeX = dirX !== 0 ? stepDepth : width;
    const sizeZ = dirZ !== 0 ? stepDepth : width;
    blocks.push({
      id: `${idPrefix}_step_${i}`,
      position: { x, y: startY + h / 2, z },
      size: { x: sizeX, y: h, z: sizeZ },
      material: 'carved_stone',
      collidable: true,
      isRamp: true,
      castShadow: true,
      receiveShadow: true,
    });
  }
  return blocks;
}

/**
 * Helper pour bâtir un acacia / arbre de savane en voxels.
 */
function buildSavannaTree(idPrefix: string, x: number, z: number, height: number): MapBlock[] {
  return [
    {
      id: `${idPrefix}_trunk`,
      position: { x, y: height / 2, z },
      size: { x: 0.85, y: height, z: 0.85 },
      material: 'palm_trunk',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: `${idPrefix}_canopy`,
      position: { x, y: height + 0.5, z },
      size: { x: 4.8, y: 0.9, z: 4.8 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
      receiveShadow: true,
    },
  ];
}

/**
 * Carte 2 (Version 0.4) : GRAND ZIMBABWE.
 * Enceinte monumentale en pierre sèche, Tour Conique emblématique,
 * acropole centrale surélevée et jardins de savane.
 */
export const GREAT_ZIMBABWE_MAP: MapDefinition = {
  id: 'great_zimbabwe',
  nameFr: 'Grand Zimbabwe',
  nameEn: 'Great Zimbabwe',
  descriptionFr:
    'Forteresse royale de pierre sèche entourant la célèbre Tour Conique, avec cours tactiques et remparts.',
  descriptionEn:
    'Monumental dry-stone royal enclosure surrounding the iconic Conical Tower, with tactical courtyards and ramparts.',
  environmentType: 'stone_citadel',
  ambientAudioTag: 'savanna_wind',
  bounds: {
    minX: -80,
    maxX: 80,
    minY: -2,
    maxY: 32,
    minZ: -80,
    maxZ: 80,
  },
  lighting: {
    sunColor: '#fff3d6',
    sunIntensity: 2.0,
    sunPosition: { x: 38, y: 52, z: 32 },
    ambientColor: '#fef3c7',
    ambientIntensity: 0.52,
    hemisphereSky: '#93c5fd',
    hemisphereGround: '#4d7c0f',
    skyTopColor: '#1d4ed8',
    skyHorizonColor: '#bae6fd',
  },
  weather: {
    fogColor: '#cbd5e1',
    fogNear: 58,
    fogFar: 185,
    dustParticles: 160,
    windDirection: { x: 0.4, y: 0.05, z: -0.3 },
  },
  spawnPoints: [
    { id: 'gz_sp_0', position: { x: 0, y: 0.1, z: 66 }, yaw: 0, team: 'alpha' },
    { id: 'gz_sp_1', position: { x: 0, y: 0.1, z: -66 }, yaw: Math.PI, team: 'beta' },
    { id: 'gz_sp_2', position: { x: -65, y: 0.1, z: 0 }, yaw: -Math.PI / 2, team: 'alpha' },
    { id: 'gz_sp_3', position: { x: 65, y: 0.1, z: 0 }, yaw: Math.PI / 2, team: 'beta' },
    { id: 'gz_sp_4', position: { x: -46, y: 0.1, z: 46 }, yaw: -Math.PI / 4, team: 'any' },
    { id: 'gz_sp_5', position: { x: 46, y: 0.1, z: 46 }, yaw: Math.PI / 4, team: 'any' },
    { id: 'gz_sp_6', position: { x: -46, y: 0.1, z: -46 }, yaw: -3 * (Math.PI / 4), team: 'any' },
    { id: 'gz_sp_7', position: { x: 46, y: 0.1, z: -46 }, yaw: 3 * (Math.PI / 4), team: 'any' },
  ],
  zones: [
    {
      id: 'conical_tower_court',
      nameFr: 'Cour de la Tour Conique',
      nameEn: 'Conical Tower Courtyard',
      center: { x: 18, y: 0, z: 0 },
      radius: 11,
      type: 'landmark',
    },
    {
      id: 'royal_citadel',
      nameFr: 'Acropole Centrale',
      nameEn: 'Central Acropolis',
      center: { x: 0, y: 2.4, z: 0 },
      radius: 10,
      type: 'high_ground',
    },
    {
      id: 'savanna_grove',
      nameFr: 'Bosquet des Acacias',
      nameEn: 'Acacia Grove',
      center: { x: -18, y: 0, z: 0 },
      radius: 10,
      type: 'oasis',
    },
  ],
  lootPoints: [
    { id: 'gz_loot_health_center', position: { x: 0, y: 2.8, z: 0 }, type: 'health', respawnSeconds: 18 },
    { id: 'gz_loot_armor_tower', position: { x: 13, y: 0.5, z: 0 }, type: 'armor', respawnSeconds: 22 },
    { id: 'gz_loot_ammo_west', position: { x: -15, y: 0.5, z: 8 }, type: 'ammo', respawnSeconds: 15 },
    { id: 'gz_loot_ammo_east', position: { x: 14, y: 0.5, z: -12 }, type: 'ammo', respawnSeconds: 15 },
    { id: 'gz_crate_north', position: { x: 0, y: 0.45, z: -17 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'gz_crate_south', position: { x: 0, y: 0.45, z: 17 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'gz_crate_citadel', position: { x: -5, y: 2.85, z: -4 }, type: 'weapon_crate', respawnSeconds: 32 },
  ],
  blocks: [
    // Sol de savane élargi (168x168m) & allées dallées
    {
      id: 'gz_floor_savanna',
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: 168, y: 1, z: 168 },
      material: 'grass_oasis',
      collidable: true,
      receiveShadow: true,
    },
    {
      id: 'gz_path_ns',
      position: { x: 0, y: 0.02, z: 0 },
      size: { x: 10, y: 0.04, z: 144 },
      material: 'sandstone',
      collidable: false,
      receiveShadow: true,
    },
    {
      id: 'gz_path_ew',
      position: { x: 0, y: 0.02, z: 0 },
      size: { x: 144, y: 0.04, z: 10 },
      material: 'sandstone',
      collidable: false,
      receiveShadow: true,
    },

    // Remparts extérieurs de la Grande Enceinte (156x156m, pierre sèche sculptée)
    {
      id: 'gz_wall_north',
      position: { x: 0, y: 3.5, z: -78 },
      size: { x: 158, y: 7, z: 3 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_wall_south',
      position: { x: 0, y: 3.5, z: 78 },
      size: { x: 158, y: 7, z: 3 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_wall_west',
      position: { x: -78, y: 3.5, z: 0 },
      size: { x: 3, y: 7, z: 158 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_wall_east',
      position: { x: 78, y: 3.5, z: 0 },
      size: { x: 3, y: 7, z: 158 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    // Bastions de granit extérieurs escaladables
    {
      id: 'gz_outer_bastion_nw',
      position: { x: -54, y: 2.5, z: -54 },
      size: { x: 8, y: 5, z: 8 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'gz_outer_bastion_se',
      position: { x: 54, y: 2.5, z: 54 },
      size: { x: 8, y: 5, z: 8 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'gz_outer_bastion_ne',
      position: { x: 54, y: 2.5, z: -54 },
      size: { x: 8, y: 5, z: 8 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'gz_outer_bastion_sw',
      position: { x: -54, y: 2.5, z: 54 },
      size: { x: 8, y: 5, z: 8 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },

    // Acropole centrale surélevée (y = 2.4m) + 2 escaliers nord/sud
    {
      id: 'gz_citadel_deck',
      position: { x: 0, y: 1.2, z: 0 },
      size: { x: 14, y: 2.4, z: 12 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_citadel_parapet_w',
      position: { x: -6.5, y: 3.0, z: 0 },
      size: { x: 1, y: 1.2, z: 10 },
      material: 'sandstone',
      collidable: true,
      isCover: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_citadel_parapet_e',
      position: { x: 6.5, y: 3.0, z: 0 },
      size: { x: 1, y: 1.2, z: 10 },
      material: 'sandstone',
      collidable: true,
      isCover: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_citadel_monolith_n',
      position: { x: 0, y: 3.7, z: -5.2 },
      size: { x: 1.6, y: 2.6, z: 1.6 },
      material: 'gold_trim',
      collidable: true,
      castShadow: true,
    },
    ...buildStoneStaircase('gz_stair_s', 0, 0, 10, 0, -1, 6, 0.4, 0.7, 4.4),
    ...buildStoneStaircase('gz_stair_n', 0, 0, -10, 0, 1, 6, 0.4, 0.7, 4.4),

    // La célèbre Tour Conique à l'est (3 étages coniques en gradins)
    {
      id: 'gz_conical_base',
      position: { x: 22, y: 2.5, z: 0 },
      size: { x: 5.8, y: 5, z: 5.8 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_conical_mid',
      position: { x: 22, y: 7.0, z: 0 },
      size: { x: 4.4, y: 4, z: 4.4 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_conical_top',
      position: { x: 22, y: 10.6, z: 0 },
      size: { x: 2.8, y: 3.2, z: 2.8 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'gz_conical_crown',
      position: { x: 22, y: 12.6, z: 0 },
      size: { x: 1.4, y: 0.8, z: 1.4 },
      material: 'gold_trim',
      collidable: true,
      castShadow: true,
    },

    // Murs intérieurs en arc (couloirs tactiques typiques du Grand Zimbabwe)
    {
      id: 'gz_inner_arc_ne',
      position: { x: 14, y: 2.2, z: -14 },
      size: { x: 10, y: 4.4, z: 1.6 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_inner_arc_se',
      position: { x: 14, y: 2.2, z: 14 },
      size: { x: 10, y: 4.4, z: 1.6 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_inner_arc_nw',
      position: { x: -14, y: 2.2, z: -14 },
      size: { x: 1.6, y: 4.4, z: 10 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: 'gz_inner_arc_sw',
      position: { x: -14, y: 2.2, z: 14 },
      size: { x: 1.6, y: 4.4, z: 10 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },

    // Couverts de combat (blocs de granit & totems)
    {
      id: 'gz_cover_1',
      position: { x: -8, y: 0.85, z: 18 },
      size: { x: 3.4, y: 1.7, z: 1.4 },
      material: 'sandstone',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
    {
      id: 'gz_cover_2',
      position: { x: 8, y: 0.85, z: -18 },
      size: { x: 3.4, y: 1.7, z: 1.4 },
      material: 'sandstone',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
    {
      id: 'gz_cover_3',
      position: { x: 14, y: 0.85, z: 5 },
      size: { x: 2.0, y: 1.7, z: 2.0 },
      material: 'terracotta',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
    {
      id: 'gz_cover_4',
      position: { x: -16, y: 0.85, z: -4 },
      size: { x: 2.2, y: 1.7, z: 2.2 },
      material: 'terracotta',
      collidable: true,
      isCover: true,
      castShadow: true,
    },

    // Bosquet d'acacias à l'ouest & aux angles
    ...buildSavannaTree('gz_tree_1', -21, 5, 5.2),
    ...buildSavannaTree('gz_tree_2', -23, -7, 5.8),
    ...buildSavannaTree('gz_tree_3', 28, -26, 6.0),
    ...buildSavannaTree('gz_tree_4', -28, 26, 5.5),
  ],
};
