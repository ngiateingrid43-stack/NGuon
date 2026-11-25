import type { MapBlock, MapDefinition } from '../types/map.js';

/**
 * Helper pour construire un escalier en voxels franchissable par le joueur.
 */
function buildStaircase(
  idPrefix: string,
  startX: number,
  startY: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  steps: number,
  stepHeight: number,
  stepDepth: number,
  width: number,
  material: MapBlock['material']
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
      material,
      collidable: true,
      isRamp: true,
      castShadow: true,
      receiveShadow: true,
    });
  }
  return blocks;
}

/**
 * Helper pour créer un palmier en voxels pour l'oasis.
 */
function buildPalmTree(idPrefix: string, x: number, z: number, height: number): MapBlock[] {
  return [
    {
      id: `${idPrefix}_trunk`,
      position: { x, y: height / 2, z },
      size: { x: 0.7, y: height, z: 0.7 },
      material: 'palm_trunk',
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: `${idPrefix}_canopy_base`,
      position: { x, y: height + 0.4, z },
      size: { x: 3.4, y: 0.7, z: 3.4 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: `${idPrefix}_canopy_top`,
      position: { x, y: height + 1.0, z },
      size: { x: 2.0, y: 0.6, z: 2.0 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
      receiveShadow: true,
    },
  ];
}

/**
 * Helper pour créer un étal de marché coloré avec piliers et auvent.
 */
function buildMarketStall(
  idPrefix: string,
  x: number,
  z: number,
  clothMaterial: 'market_cloth_red' | 'market_cloth_blue' | 'market_cloth_gold'
): MapBlock[] {
  return [
    // Comptoir bas servant de couverture
    {
      id: `${idPrefix}_counter`,
      position: { x, y: 0.55, z },
      size: { x: 3.2, y: 1.1, z: 1.4 },
      material: 'wood',
      collidable: true,
      isCover: true,
      castShadow: true,
      receiveShadow: true,
    },
    // Piliers
    {
      id: `${idPrefix}_p1`,
      position: { x: x - 1.45, y: 1.5, z: z - 0.6 },
      size: { x: 0.25, y: 3.0, z: 0.25 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${idPrefix}_p2`,
      position: { x: x + 1.45, y: 1.5, z: z - 0.6 },
      size: { x: 0.25, y: 3.0, z: 0.25 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${idPrefix}_p3`,
      position: { x: x - 1.45, y: 1.5, z: z + 0.6 },
      size: { x: 0.25, y: 3.0, z: 0.25 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${idPrefix}_p4`,
      position: { x: x + 1.45, y: 1.5, z: z + 0.6 },
      size: { x: 0.25, y: 3.0, z: 0.25 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    // Auvent en tissu
    {
      id: `${idPrefix}_awning`,
      position: { x, y: 3.1, z },
      size: { x: 3.8, y: 0.28, z: 2.2 },
      material: clothMaterial,
      collidable: true,
      castShadow: true,
      receiveShadow: true,
    },
  ];
}

const blocks: MapBlock[] = [
  // 1. Sol désertique principal élargi (168x168m)
  {
    id: 'ground_main',
    position: { x: 0, y: -0.5, z: 0 },
    size: { x: 168, y: 1, z: 168 },
    material: 'sand',
    collidable: true,
    castShadow: false,
    receiveShadow: true,
  },

  // 2. Grands remparts périphériques (limites jouables -80 à +80)
  {
    id: 'wall_north',
    position: { x: 0, y: 3.0, z: -78 },
    size: { x: 158, y: 6, z: 3 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'wall_south',
    position: { x: 0, y: 3.0, z: 78 },
    size: { x: 158, y: 6, z: 3 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'wall_west',
    position: { x: -78, y: 3.0, z: 0 },
    size: { x: 3, y: 6, z: 158 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'wall_east',
    position: { x: 78, y: 3.0, z: 0 },
    size: { x: 3, y: 6, z: 158 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },

  // Dunes sculptées aux angles pour briser la géométrie rectangulaire
  {
    id: 'dune_nw_1',
    position: { x: -34, y: 0.75, z: -34 },
    size: { x: 10, y: 1.5, z: 10 },
    material: 'sand',
    collidable: true,
    receiveShadow: true,
  },
  {
    id: 'dune_nw_2',
    position: { x: -36, y: 1.8, z: -36 },
    size: { x: 6, y: 1.2, z: 6 },
    material: 'sand',
    collidable: true,
    receiveShadow: true,
  },
  {
    id: 'dune_sw_1',
    position: { x: -34, y: 0.8, z: 34 },
    size: { x: 11, y: 1.6, z: 9 },
    material: 'sand',
    collidable: true,
    receiveShadow: true,
  },

  // 3. Mosquée stylisée de Djinguereber (Secteur Nord : z = -26 à -36)
  {
    id: 'mosque_base_hall',
    position: { x: 0, y: 2.2, z: -31 },
    size: { x: 18, y: 4.4, z: 10 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  // Minaret pyramidal stylisé
  {
    id: 'mosque_minaret_tier1',
    position: { x: 0, y: 6.2, z: -33 },
    size: { x: 6, y: 3.6, z: 6 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'mosque_minaret_tier2',
    position: { x: 0, y: 9.2, z: -33 },
    size: { x: 4, y: 2.4, z: 4 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'mosque_minaret_finial',
    position: { x: 0, y: 11.1, z: -33 },
    size: { x: 1.0, y: 1.4, z: 1.0 },
    material: 'gold_trim',
    collidable: true,
    castShadow: true,
  },
  // Poutres toron décoratives en façade
  {
    id: 'mosque_toron_1',
    position: { x: -6, y: 3.5, z: -25.8 },
    size: { x: 0.4, y: 0.4, z: 1.2 },
    material: 'wood',
    collidable: false,
    castShadow: true,
  },
  {
    id: 'mosque_toron_2',
    position: { x: -2.5, y: 3.5, z: -25.8 },
    size: { x: 0.4, y: 0.4, z: 1.2 },
    material: 'wood',
    collidable: false,
    castShadow: true,
  },
  {
    id: 'mosque_toron_3',
    position: { x: 2.5, y: 3.5, z: -25.8 },
    size: { x: 0.4, y: 0.4, z: 1.2 },
    material: 'wood',
    collidable: false,
    castShadow: true,
  },
  {
    id: 'mosque_toron_4',
    position: { x: 6, y: 3.5, z: -25.8 },
    size: { x: 0.4, y: 0.4, z: 1.2 },
    material: 'wood',
    collidable: false,
    castShadow: true,
  },
  // Parapet de toit de la mosquée (couverture en hauteur)
  {
    id: 'mosque_parapet_front_l',
    position: { x: -5.5, y: 4.9, z: -26.3 },
    size: { x: 6.5, y: 1.0, z: 0.6 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'mosque_parapet_front_r',
    position: { x: 5.5, y: 4.9, z: -26.3 },
    size: { x: 6.5, y: 1.0, z: 0.6 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  // Escalier d'accès au toit de la mosquée (côté Ouest)
  ...buildStaircase('mosque_stairs_w', -13.5, 0, -30, 1, 0, 9, 0.49, 0.5, 2.8, 'sandstone'),
  // Cour avant de la mosquée (murets de couverture)
  {
    id: 'mosque_courtyard_w',
    position: { x: -8.5, y: 0.75, z: -20 },
    size: { x: 1.0, y: 1.5, z: 8 },
    material: 'adobe',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'mosque_courtyard_e',
    position: { x: 8.5, y: 0.75, z: -20 },
    size: { x: 1.0, y: 1.5, z: 8 },
    material: 'adobe',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },

  // 4. Grand Marché Central (x: -9 à 9, z: -6 à 6)
  ...buildMarketStall('stall_1', -5.5, -3.5, 'market_cloth_red'),
  ...buildMarketStall('stall_2', 5.5, -3.5, 'market_cloth_blue'),
  ...buildMarketStall('stall_3', -5.5, 4.5, 'market_cloth_gold'),
  ...buildMarketStall('stall_4', 5.5, 4.5, 'market_cloth_red'),
  // Fontaines / jarres en terre cuite au centre du marché
  {
    id: 'market_center_plinth',
    position: { x: 0, y: 0.5, z: 0.5 },
    size: { x: 2.6, y: 1.0, z: 2.6 },
    material: 'carved_stone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'market_center_urn',
    position: { x: 0, y: 1.45, z: 0.5 },
    size: { x: 1.1, y: 0.9, z: 1.1 },
    material: 'terracotta',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },

  // 5. Quartier Ouest : Maisons en terre et toits accessibles
  {
    id: 'west_house_1',
    position: { x: -23, y: 1.8, z: -8 },
    size: { x: 9, y: 3.6, z: 10 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'west_house_1_parapet',
    position: { x: -18.8, y: 4.1, z: -8 },
    size: { x: 0.6, y: 1.0, z: 9.6 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
  },
  ...buildStaircase('west_house_stairs', -23, 0, -1.0, 0, -1, 8, 0.45, 0.5, 2.4, 'adobe_dark'),

  {
    id: 'west_house_2',
    position: { x: -25, y: 2.0, z: 10 },
    size: { x: 10, y: 4.0, z: 8 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  // Passage couvert / arche entre maisons
  {
    id: 'west_alley_cover_1',
    position: { x: -16, y: 0.7, z: 1.5 },
    size: { x: 1.6, y: 1.4, z: 3.2 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },

  // 6. Quartier Est : Tour d'observation et bâtiments
  {
    id: 'east_house_1',
    position: { x: 23, y: 1.8, z: -8 },
    size: { x: 9, y: 3.6, z: 10 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'east_house_1_parapet',
    position: { x: 18.8, y: 4.1, z: -8 },
    size: { x: 0.6, y: 1.0, z: 9.6 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
  },
  ...buildStaircase('east_house_stairs', 23, 0, -1.0, 0, -1, 8, 0.45, 0.5, 2.4, 'adobe_dark'),

  {
    id: 'east_alley_cover_1',
    position: { x: 16, y: 0.7, z: 2.0 },
    size: { x: 1.6, y: 1.4, z: 3.2 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },

  // 7. Oasis du Sud-Est (x: 20 à 34, z: 16 à 30)
  {
    id: 'oasis_grass_ring',
    position: { x: 26, y: 0.02, z: 23 },
    size: { x: 16, y: 0.12, z: 14 },
    material: 'grass_oasis',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'oasis_water_pool',
    position: { x: 26, y: 0.06, z: 23 },
    size: { x: 10, y: 0.12, z: 8 },
    material: 'water',
    collidable: false,
    receiveShadow: true,
  },
  ...buildPalmTree('palm_1', 19.5, 17.5, 6.0),
  ...buildPalmTree('palm_2', 32.5, 18.0, 6.8),
  ...buildPalmTree('palm_3', 32.0, 28.5, 5.5),
  ...buildPalmTree('palm_4', 20.0, 28.5, 6.2),

  // 8. Puits des Caravanes au Sud-Ouest (x: -18, z: 24)
  {
    id: 'well_rim',
    position: { x: -18, y: 0.55, z: 24 },
    size: { x: 2.8, y: 1.1, z: 2.8 },
    material: 'carved_stone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'well_pillar_l',
    position: { x: -19.1, y: 1.8, z: 24 },
    size: { x: 0.3, y: 2.6, z: 0.3 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'well_pillar_r',
    position: { x: -16.9, y: 1.8, z: 24 },
    size: { x: 0.3, y: 2.6, z: 0.3 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'well_roof',
    position: { x: -18, y: 3.2, z: 24 },
    size: { x: 3.2, y: 0.35, z: 2.4 },
    material: 'terracotta',
    collidable: true,
    castShadow: true,
  },

  // 9. Quartier Sud : Murets tactiques et caisses de caravane
  {
    id: 'south_gate_left',
    position: { x: -7, y: 1.6, z: 24 },
    size: { x: 6, y: 3.2, z: 2.2 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'south_gate_right',
    position: { x: 7, y: 1.6, z: 24 },
    size: { x: 6, y: 3.2, z: 2.2 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'south_cover_center',
    position: { x: 0, y: 0.65, z: 16 },
    size: { x: 3.6, y: 1.3, z: 1.4 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'north_cover_center',
    position: { x: 0, y: 0.65, z: -15 },
    size: { x: 3.6, y: 1.3, z: 1.4 },
    material: 'sandstone',
    collidable: true,
    isCover: true,
    castShadow: true,
    receiveShadow: true,
  },
  // Quartiers extérieurs & tours de guet escaladables (agrandissement 160x160m)
  {
    id: 'outer_tower_nw',
    position: { x: -56, y: 3.5, z: -56 },
    size: { x: 6, y: 7, z: 6 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_tower_ne',
    position: { x: 56, y: 3.5, z: -56 },
    size: { x: 6, y: 7, z: 6 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_tower_sw',
    position: { x: -56, y: 3.5, z: 56 },
    size: { x: 6, y: 7, z: 6 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_tower_se',
    position: { x: 56, y: 3.5, z: 56 },
    size: { x: 6, y: 7, z: 6 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_caravan_west',
    position: { x: -58, y: 1.8, z: 0 },
    size: { x: 8, y: 3.6, z: 14 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_caravan_east',
    position: { x: 58, y: 1.8, z: 0 },
    size: { x: 8, y: 3.6, z: 14 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_south_gatehouse',
    position: { x: 0, y: 2.2, z: 58 },
    size: { x: 14, y: 4.4, z: 5 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  {
    id: 'outer_north_citadel',
    position: { x: 0, y: 2.4, z: -58 },
    size: { x: 16, y: 4.8, z: 6 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
    receiveShadow: true,
  },
  ...buildPalmTree('outer_palm_1', 50, 32, 6.2),
  ...buildPalmTree('outer_palm_2', -50, -30, 5.8),
  ...buildMarketStall('outer_stall_w', -48, 12, 'market_cloth_gold'),
  ...buildMarketStall('outer_stall_e', 48, -12, 'market_cloth_red'),
];

export const TOMBOUCTOU_MAP: MapDefinition = {
  id: 'tombouctou',
  nameFr: 'Tombouctou — Perle du Désert',
  nameEn: 'Timbuktu — Pearl of the Desert',
  descriptionFr:
    'Vaste cité caravanière (160×160m) mêlant architecture en banco, tours escaladables, grand marché et oasis saharienne.',
  descriptionEn:
    'Expansive caravan city (160×160m) blending earthen banco architecture, climbable towers, market stalls, and desert oasis.',
  environmentType: 'desert_urban',
  bounds: {
    minX: -80,
    maxX: 80,
    minY: -2,
    maxY: 32,
    minZ: -80,
    maxZ: 80,
  },
  lighting: {
    sunColor: '#fff2cc',
    sunIntensity: 2.1,
    sunPosition: { x: 45, y: 58, z: 32 },
    ambientColor: '#f5d0a9',
    ambientIntensity: 0.55,
    hemisphereSky: '#87ceeb',
    hemisphereGround: '#c98a4b',
    skyTopColor: '#2563eb',
    skyHorizonColor: '#f6d399',
  },
  weather: {
    fogColor: '#e8c48e',
    fogNear: 55,
    fogFar: 185,
    dustParticles: 320,
    windDirection: { x: 0.7, y: 0.05, z: 0.3 },
  },
  ambientAudioTag: 'desert_wind',
  spawnPoints: [
    { id: 'sp_south_center', position: { x: 0, y: 0.2, z: 68 }, yaw: 0 },
    { id: 'sp_north_court', position: { x: 0, y: 0.2, z: -48 }, yaw: Math.PI },
    { id: 'sp_west_alley', position: { x: -68, y: 0.2, z: 0 }, yaw: -Math.PI / 2 },
    { id: 'sp_east_alley', position: { x: 68, y: 0.2, z: 0 }, yaw: Math.PI / 2 },
    { id: 'sp_oasis', position: { x: 38, y: 0.2, z: 46 }, yaw: 0.6 },
    { id: 'sp_well', position: { x: -42, y: 0.2, z: 46 }, yaw: -0.6 },
    { id: 'sp_nw_flank', position: { x: -42, y: 0.2, z: -42 }, yaw: -2.4 },
    { id: 'sp_ne_flank', position: { x: 42, y: 0.2, z: -42 }, yaw: 2.4 },
  ],
  lootPoints: [
    { id: 'loot_market_ammo', position: { x: 0, y: 0.4, z: -6 }, type: 'ammo', respawnSeconds: 18 },
    { id: 'loot_oasis_health', position: { x: 19, y: 0.4, z: 23 }, type: 'health', respawnSeconds: 20 },
    { id: 'loot_well_armor', position: { x: -15, y: 0.4, z: 24 }, type: 'armor', respawnSeconds: 25 },
    { id: 'loot_mosque_roof', position: { x: 0, y: 4.8, z: -28 }, type: 'weapon_crate', respawnSeconds: 30 },
    { id: 'loot_west_roof', position: { x: -23, y: 4.0, z: -8 }, type: 'ammo', respawnSeconds: 18 },
    { id: 'loot_east_roof', position: { x: 23, y: 4.0, z: -8 }, type: 'health', respawnSeconds: 20 },
    { id: 'loot_market_chest', position: { x: 0, y: 0.4, z: 6 }, type: 'weapon_crate', respawnSeconds: 28 },
    { id: 'loot_north_chest', position: { x: -12, y: 0.4, z: -20 }, type: 'weapon_crate', respawnSeconds: 28 },
  ],
  zones: [
    {
      id: 'zone_mosque',
      nameFr: 'Mosquée de Djinguereber',
      nameEn: 'Djinguereber Mosque',
      center: { x: 0, y: 0, z: -31 },
      radius: 14,
      type: 'landmark',
    },
    {
      id: 'zone_market',
      nameFr: 'Grand Marché',
      nameEn: 'Grand Market',
      center: { x: 0, y: 0, z: 0 },
      radius: 11,
      type: 'combat',
    },
    {
      id: 'zone_oasis',
      nameFr: 'Oasis des Palmiers',
      nameEn: 'Palm Oasis',
      center: { x: 26, y: 0, z: 23 },
      radius: 10,
      type: 'oasis',
    },
    {
      id: 'zone_west_roofs',
      nameFr: 'Terrasses Ouest',
      nameEn: 'West Terraces',
      center: { x: -23, y: 3.6, z: -8 },
      radius: 7,
      type: 'high_ground',
    },
  ],
  blocks,
};
