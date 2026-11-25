import type { MapBlock, MapDefinition } from '../types/map.js';

function buildMarbleStaircase(
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
      material: 'sandstone',
      collidable: true,
      isRamp: true,
      castShadow: true,
      receiveShadow: true,
    });
  }
  return blocks;
}

/**
 * Carte 3 (v0.6) : ALEXANDRIE ANTIQUE.
 * Esplanade de la Grande Bibliothèque, colonnades méditerranéennes,
 * bassin du port et Tour du Phare.
 */
export const ALEXANDRIA_MAP: MapDefinition = {
  id: 'alexandria',
  nameFr: 'Alexandrie Antique',
  nameEn: 'Ancient Alexandria',
  descriptionFr:
    'Port méditerranéen dominé par les colonnades de la Grande Bibliothèque et la tour du Phare.',
  descriptionEn:
    'Mediterranean harbor dominated by the Great Library colonnades and the Pharos beacon tower.',
  environmentType: 'mediterranean_port',
  ambientAudioTag: 'harbor_breeze',
  bounds: {
    minX: -80,
    maxX: 80,
    minY: -2,
    maxY: 32,
    minZ: -80,
    maxZ: 80,
  },
  lighting: {
    sunColor: '#fff7ed',
    sunIntensity: 2.1,
    sunPosition: { x: 36, y: 56, z: -28 },
    ambientColor: '#e0f2fe',
    ambientIntensity: 0.55,
    hemisphereSky: '#7dd3fc',
    hemisphereGround: '#d6b488',
    skyTopColor: '#0369a1',
    skyHorizonColor: '#bae6fd',
  },
  weather: {
    fogColor: '#e0f2fe',
    fogNear: 60,
    fogFar: 185,
    dustParticles: 110,
    windDirection: { x: -0.5, y: 0.05, z: 0.4 },
  },
  spawnPoints: [
    { id: 'ax_sp_0', position: { x: 0, y: 0.1, z: 66 }, yaw: 0, team: 'alpha' },
    { id: 'ax_sp_1', position: { x: 0, y: 0.1, z: -66 }, yaw: Math.PI, team: 'beta' },
    { id: 'ax_sp_2', position: { x: -65, y: 0.1, z: 0 }, yaw: -Math.PI / 2, team: 'alpha' },
    { id: 'ax_sp_3', position: { x: 65, y: 0.1, z: 0 }, yaw: Math.PI / 2, team: 'beta' },
    { id: 'ax_sp_4', position: { x: -34, y: 0.1, z: 54 }, yaw: -Math.PI / 4, team: 'any' },
    { id: 'ax_sp_5', position: { x: 46, y: 0.1, z: 46 }, yaw: Math.PI / 4, team: 'any' },
    { id: 'ax_sp_6', position: { x: -46, y: 0.1, z: -46 }, yaw: -3 * (Math.PI / 4), team: 'any' },
    { id: 'ax_sp_7', position: { x: 34, y: 0.1, z: -54 }, yaw: 3 * (Math.PI / 4), team: 'any' },
  ],
  zones: [
    {
      id: 'great_library',
      nameFr: 'Grande Bibliothèque',
      nameEn: 'Great Library',
      center: { x: 0, y: 2.2, z: -12 },
      radius: 12,
      type: 'high_ground',
    },
    {
      id: 'harbor_basin',
      nameFr: 'Bassin du Port',
      nameEn: 'Harbor Basin',
      center: { x: 0, y: 0, z: 14 },
      radius: 10,
      type: 'oasis',
    },
    {
      id: 'pharos_plaza',
      nameFr: 'Tour du Phare',
      nameEn: 'Pharos Tower',
      center: { x: 20, y: 0, z: 0 },
      radius: 9,
      type: 'landmark',
    },
  ],
  lootPoints: [
    { id: 'ax_loot_health', position: { x: 0, y: 2.6, z: -12 }, type: 'health', respawnSeconds: 18 },
    { id: 'ax_loot_armor', position: { x: 18, y: 0.5, z: 0 }, type: 'armor', respawnSeconds: 22 },
    { id: 'ax_loot_ammo_w', position: { x: -16, y: 0.5, z: 4 }, type: 'ammo', respawnSeconds: 15 },
    { id: 'ax_crate_lib', position: { x: 4, y: 2.65, z: -14 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'ax_crate_harbor', position: { x: -7, y: 0.45, z: 14 }, type: 'weapon_crate', respawnSeconds: 26 },
    { id: 'ax_crate_east', position: { x: 14, y: 0.45, z: -14 }, type: 'weapon_crate', respawnSeconds: 28 },
  ],
  blocks: [
    {
      id: 'ax_floor_main',
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: 168, y: 1, z: 168 },
      material: 'sandstone',
      collidable: true,
      receiveShadow: true,
    },
    // Bassin d'eau du port au sud
    {
      id: 'ax_harbor_water',
      position: { x: 0, y: 0.04, z: 14 },
      size: { x: 22, y: 0.08, z: 12 },
      material: 'water',
      collidable: false,
      receiveShadow: true,
    },
    // Ponton de bois traversant le bassin
    {
      id: 'ax_harbor_bridge',
      position: { x: 0, y: 0.25, z: 14 },
      size: { x: 3.4, y: 0.5, z: 14 },
      material: 'wood',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    // Grands remparts côtiers (156x156m)
    {
      id: 'ax_wall_n',
      position: { x: 0, y: 3.5, z: -78 },
      size: { x: 158, y: 7, z: 3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_wall_s',
      position: { x: 0, y: 3.5, z: 78 },
      size: { x: 158, y: 7, z: 3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_wall_w',
      position: { x: -78, y: 3.5, z: 0 },
      size: { x: 3, y: 7, z: 158 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_wall_e',
      position: { x: 78, y: 3.5, z: 0 },
      size: { x: 3, y: 7, z: 158 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    // Entrepôts du port & tours escaladables extérieures
    {
      id: 'ax_outer_warehouse_w',
      position: { x: -50, y: 2.2, z: 42 },
      size: { x: 12, y: 4.4, z: 8 },
      material: 'terracotta',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_outer_warehouse_e',
      position: { x: 50, y: 2.2, z: -42 },
      size: { x: 12, y: 4.4, z: 8 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
    },
    // Terrasse surélevée de la Grande Bibliothèque
    {
      id: 'ax_lib_deck',
      position: { x: 0, y: 1.1, z: -13 },
      size: { x: 20, y: 2.2, z: 11 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    ...buildMarbleStaircase('ax_stair_s', 0, 0, -3.5, 0, -1, 5, 0.44, 0.75, 5.0),
    ...buildMarbleStaircase('ax_stair_w', -14, 0, -13, 1, 0, 5, 0.44, 0.75, 4.2),
    // Colonnes de la Bibliothèque
    {
      id: 'ax_col_1',
      position: { x: -8, y: 4.5, z: -9 },
      size: { x: 1.3, y: 4.6, z: 1.3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_col_2',
      position: { x: 8, y: 4.5, z: -9 },
      size: { x: 1.3, y: 4.6, z: 1.3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_col_3',
      position: { x: -8, y: 4.5, z: -17 },
      size: { x: 1.3, y: 4.6, z: 1.3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_col_4',
      position: { x: 8, y: 4.5, z: -17 },
      size: { x: 1.3, y: 4.6, z: 1.3 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_lib_roof',
      position: { x: 0, y: 7.2, z: -13 },
      size: { x: 19, y: 0.9, z: 10 },
      material: 'gold_trim',
      collidable: true,
      castShadow: true,
    },
    // Tour du Phare à l'est
    {
      id: 'ax_pharos_base',
      position: { x: 22, y: 3.5, z: 0 },
      size: { x: 5.5, y: 7, z: 5.5 },
      material: 'sandstone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_pharos_mid',
      position: { x: 22, y: 9.0, z: 0 },
      size: { x: 4.0, y: 4.0, z: 4.0 },
      material: 'carved_stone',
      collidable: true,
      castShadow: true,
    },
    {
      id: 'ax_pharos_flame',
      position: { x: 22, y: 12.2, z: 0 },
      size: { x: 2.2, y: 2.4, z: 2.2 },
      material: 'gold_trim',
      collidable: true,
      castShadow: true,
    },
    // Échoppes & couverts méditerranéens
    {
      id: 'ax_cover_w1',
      position: { x: -15, y: 0.9, z: 8 },
      size: { x: 3.2, y: 1.8, z: 1.4 },
      material: 'terracotta',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
    {
      id: 'ax_cover_e1',
      position: { x: 13, y: 0.9, z: 12 },
      size: { x: 3.2, y: 1.8, z: 1.4 },
      material: 'market_cloth_blue',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
    {
      id: 'ax_cover_c',
      position: { x: 0, y: 0.8, z: 2 },
      size: { x: 4.0, y: 1.6, z: 1.4 },
      material: 'carved_stone',
      collidable: true,
      isCover: true,
      castShadow: true,
    },
  ],
};
