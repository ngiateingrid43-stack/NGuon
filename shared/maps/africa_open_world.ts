import { MapBlock, MapDefinition } from '../types/map.js';

/** Palmier africain multi-étages (tronc courbé + couronne en croix dense) */
function makePalm(prefix: string, x: number, z: number, height = 7.2): MapBlock[] {
  return [
    {
      id: `${prefix}_trunk_base`,
      position: { x, y: height * 0.28, z },
      size: { x: 1.0, y: height * 0.56, z: 1.0 },
      material: 'palm_trunk',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_trunk_top`,
      position: { x: x + 0.25, y: height * 0.78, z: z + 0.15 },
      size: { x: 0.75, y: height * 0.46, z: 0.75 },
      material: 'palm_trunk',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_canopy_ew`,
      position: { x: x + 0.25, y: height + 0.5, z: z + 0.15 },
      size: { x: 5.6, y: 1.1, z: 2.2 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
    {
      id: `${prefix}_canopy_ns`,
      position: { x: x + 0.25, y: height + 0.6, z: z + 0.15 },
      size: { x: 2.2, y: 1.1, z: 5.6 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
    {
      id: `${prefix}_canopy_top`,
      position: { x: x + 0.25, y: height + 1.35, z: z + 0.15 },
      size: { x: 3.0, y: 0.9, z: 3.0 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
  ];
}

/** Baobab monumental à tronc évasé et couronne tabulaire */
function makeBaobab(prefix: string, x: number, z: number, scale = 1.0): MapBlock[] {
  const th = 7.2 * scale;
  const tw = 2.4 * scale;
  return [
    {
      id: `${prefix}_root`,
      position: { x, y: 1.1 * scale, z },
      size: { x: tw * 1.45, y: 2.2 * scale, z: tw * 1.45 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_trunk`,
      position: { x, y: th * 0.55, z },
      size: { x: tw, y: th * 0.9, z: tw },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_crown_main`,
      position: { x, y: th + 0.8 * scale, z },
      size: { x: 8.8 * scale, y: 1.8 * scale, z: 7.4 * scale },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
    {
      id: `${prefix}_crown_top`,
      position: { x: x + 0.6 * scale, y: th + 2.1 * scale, z: z - 0.5 * scale },
      size: { x: 5.6 * scale, y: 1.3 * scale, z: 5.2 * scale },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
  ];
}

/** Acacia parasol typique de la savane africaine */
function makeAcacia(prefix: string, x: number, z: number): MapBlock[] {
  return [
    {
      id: `${prefix}_trunk`,
      position: { x, y: 2.6, z },
      size: { x: 0.85, y: 5.2, z: 0.85 },
      material: 'wood',
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_canopy`,
      position: { x, y: 5.4, z },
      size: { x: 7.8, y: 0.9, z: 6.4 },
      material: 'palm_leaf',
      collidable: false,
      castShadow: true,
    },
  ];
}

/** Escalier praticable vers une plateforme haute */
function makeStairsZ(
  prefix: string,
  x: number,
  startZ: number,
  dirZ: 1 | -1,
  totalHeight: number,
  width: number,
  steps: number,
  material: MapBlock['material']
): MapBlock[] {
  const out: MapBlock[] = [];
  const stepH = totalHeight / steps;
  const stepD = 1.15;
  for (let i = 0; i < steps; i++) {
    const h = stepH * (i + 1);
    out.push({
      id: `${prefix}_step_${i}`,
      position: { x, y: h / 2, z: startZ + dirZ * i * stepD },
      size: { x: width, y: h, z: stepD + 0.08 },
      material,
      collidable: true,
      receiveShadow: true,
      castShadow: true,
    });
  }
  return out;
}

/** Arche monumentale africaine (2 piliers + linteau doré) */
function makeArchway(
  prefix: string,
  x: number,
  z: number,
  span = 11,
  height = 6.5,
  material: MapBlock['material'] = 'sandstone'
): MapBlock[] {
  const half = span / 2;
  return [
    {
      id: `${prefix}_pL`,
      position: { x: x - half, y: height / 2, z },
      size: { x: 2.2, y: height, z: 2.4 },
      material,
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_pR`,
      position: { x: x + half, y: height / 2, z },
      size: { x: 2.2, y: height, z: 2.4 },
      material,
      collidable: true,
      castShadow: true,
    },
    {
      id: `${prefix}_lintel`,
      position: { x, y: height + 0.7, z },
      size: { x: span + 3.2, y: 1.5, z: 2.8 },
      material: 'gold_trim',
      collidable: true,
      castShadow: true,
    },
  ];
}

/**
 * Grand Monde Ouvert Historique de l'Afrique (520×520m, sans murs artificiels).
 * Réunit en continu : Sahel & Tombouctou (N-O), Nil & Pyramides (N-E),
 * Forêt Tropicale & Fleuve Kongo (Centre), Savane & Enceintes de Pierre (S-O),
 * et Chutes du Zambèze / Côte Maritime (S-E / Est).
 */
const blocks: MapBlock[] = [
  // Sol continu ouvert du continent (aucun mur périmétrique)
  {
    id: 'aow_floor_continent',
    position: { x: 0, y: -0.5, z: 0 },
    size: { x: 560, y: 1, z: 560 },
    material: 'grass_oasis',
    collidable: true,
    receiveShadow: true,
  },

  // === CARREFOUR CENTRAL & VOIE ROYALE (visible dès l'apparition du joueur) ===
  {
    id: 'aow_plaza_paving',
    position: { x: 0, y: 0.03, z: -8 },
    size: { x: 34, y: 0.06, z: 32 },
    material: 'sandstone',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'aow_royal_road_north',
    position: { x: 0, y: 0.025, z: -65 },
    size: { x: 9, y: 0.05, z: 95 },
    material: 'sandstone',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'aow_royal_road_east',
    position: { x: 64, y: 0.025, z: -12 },
    size: { x: 105, y: 0.05, z: 7 },
    material: 'sand',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'aow_royal_road_west',
    position: { x: -64, y: 0.025, z: -12 },
    size: { x: 105, y: 0.05, z: 7 },
    material: 'sand',
    collidable: false,
    receiveShadow: true,
  },
  ...makeArchway('aow_crossroads_arch', 0, -4, 12, 6.2, 'carved_stone'),
  // 4 obélisques dorés encadrant la place du carrefour
  {
    id: 'aow_plaza_obelisk_1',
    position: { x: -13, y: 3.0, z: -2 },
    size: { x: 1.6, y: 6.0, z: 1.6 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_plaza_obelisk_1_cap',
    position: { x: -13, y: 6.4, z: -2 },
    size: { x: 1.1, y: 0.9, z: 1.1 },
    material: 'gold_trim',
    collidable: true,
  },
  {
    id: 'aow_plaza_obelisk_2',
    position: { x: 13, y: 3.0, z: -2 },
    size: { x: 1.6, y: 6.0, z: 1.6 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_plaza_obelisk_2_cap',
    position: { x: 13, y: 6.4, z: -2 },
    size: { x: 1.1, y: 0.9, z: 1.1 },
    material: 'gold_trim',
    collidable: true,
  },
  // Étalages du marché central (abris tactiques)
  {
    id: 'aow_central_market_e',
    position: { x: 15, y: 1.5, z: -16 },
    size: { x: 6, y: 3.0, z: 4.5 },
    material: 'market_cloth_gold',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_central_market_w',
    position: { x: -12, y: 1.5, z: -36 },
    size: { x: 6.5, y: 3.0, z: 4.5 },
    material: 'market_cloth_red',
    collidable: true,
    castShadow: true,
  },

  // === BIOME 1 (NORD-OUEST : SAHEL & TOMBOUCTOU, x: -190..-30, z: -190..-40) ===
  {
    id: 'aow_sahel_desert',
    position: { x: -120, y: 0.02, z: -120 },
    size: { x: 220, y: 0.04, z: 220 },
    material: 'sand',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'aow_timbuktu_fort',
    position: { x: -135, y: 2.6, z: -135 },
    size: { x: 20, y: 5.2, z: 18 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_timbuktu_stairs', -135, -120, -1, 5.2, 5.0, 7, 'adobe_dark'),
  {
    id: 'aow_timbuktu_tower',
    position: { x: -124, y: 5.2, z: -124 },
    size: { x: 6.5, y: 10.4, z: 6.5 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_timbuktu_minaret_cap',
    position: { x: -124, y: 11.2, z: -124 },
    size: { x: 4.2, y: 1.6, z: 4.2 },
    material: 'gold_trim',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_timbuktu_courtyard_wall',
    position: { x: -152, y: 2.1, z: -135 },
    size: { x: 3.0, y: 4.2, z: 22 },
    material: 'adobe',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_sahel_market_1',
    position: { x: -102, y: 1.6, z: -110 },
    size: { x: 10, y: 3.2, z: 6 },
    material: 'market_cloth_gold',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_sahel_market_2',
    position: { x: -102, y: 1.5, z: -98 },
    size: { x: 8, y: 3.0, z: 5 },
    material: 'market_cloth_red',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_sahel_dune_1',
    position: { x: -185, y: 1.8, z: -70 },
    size: { x: 32, y: 3.6, z: 24 },
    material: 'sand',
    collidable: true,
  },
  {
    id: 'aow_sahel_dune_1b',
    position: { x: -188, y: 4.2, z: -72 },
    size: { x: 16, y: 1.8, z: 12 },
    material: 'sand',
    collidable: true,
  },
  {
    id: 'aow_sahel_dune_2',
    position: { x: -72, y: 1.4, z: -165 },
    size: { x: 26, y: 2.8, z: 20 },
    material: 'sand',
    collidable: true,
  },
  ...makePalm('aow_palm_nw1', -90, -145, 7.6),
  ...makePalm('aow_palm_nw2', -155, -100, 6.8),
  ...makePalm('aow_palm_nw3', -112, -148, 7.2),
  ...makePalm('aow_palm_nw4', -76, -86, 6.6),

  // === BIOME 2 (NORD-EST : NIL, PYRAMIDES & CÔTE D'ALEXANDRIE, x: +30..+210, z: -190..-30) ===
  {
    id: 'aow_nile_sand',
    position: { x: 120, y: 0.02, z: -120 },
    size: { x: 220, y: 0.04, z: 210 },
    material: 'sand',
    collidable: false,
    receiveShadow: true,
  },
  {
    id: 'aow_pyramid_1',
    position: { x: 135, y: 2.0, z: -135 },
    size: { x: 32, y: 4.0, z: 32 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_pyramid_2',
    position: { x: 135, y: 5.5, z: -135 },
    size: { x: 22, y: 3.0, z: 22 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_pyramid_3',
    position: { x: 135, y: 8.5, z: -135 },
    size: { x: 12, y: 3.0, z: 12 },
    material: 'gold_trim',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_pyramid_stairs', 135, -113, -1, 10.0, 5.5, 11, 'sandstone'),
  // Petite pyramide secondaire + gardien du désert
  {
    id: 'aow_pyramid_sub_1',
    position: { x: 88, y: 1.5, z: -148 },
    size: { x: 16, y: 3.0, z: 16 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_pyramid_sub_2',
    position: { x: 88, y: 4.0, z: -148 },
    size: { x: 9, y: 2.0, z: 9 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_nile_obelisk',
    position: { x: 102, y: 5.5, z: -102 },
    size: { x: 2.4, y: 11.0, z: 2.4 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_nile_obelisk_tip',
    position: { x: 102, y: 11.8, z: -102 },
    size: { x: 1.6, y: 1.6, z: 1.6 },
    material: 'gold_trim',
    collidable: true,
  },
  {
    id: 'aow_alex_colonial_fort',
    position: { x: 168, y: 2.4, z: -68 },
    size: { x: 18, y: 4.8, z: 16 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_alex_stairs', 168, -54, -1, 4.8, 4.8, 6, 'carved_stone'),
  {
    id: 'aow_alex_pier',
    position: { x: 204, y: 0.5, z: -68 },
    size: { x: 24, y: 1.0, z: 6.5 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_alex_lighthouse',
    position: { x: 208, y: 6.0, z: -86 },
    size: { x: 5.0, y: 12.0, z: 5.0 },
    material: 'sandstone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_alex_lighthouse_beacon',
    position: { x: 208, y: 13.0, z: -86 },
    size: { x: 3.4, y: 2.0, z: 3.4 },
    material: 'gold_trim',
    collidable: true,
  },
  {
    id: 'aow_ocean_east',
    position: { x: 245, y: 0.03, z: 0 },
    size: { x: 70, y: 0.06, z: 540 },
    material: 'water',
    collidable: false,
  },
  ...makePalm('aow_palm_ne1', 155, -92, 7.2),
  ...makePalm('aow_palm_ne2', 186, -48, 6.8),

  // === BIOME 3 (CENTRE : FORÊT TROPICALE & FLEUVE KONGO, x: -70..+70, z: -45..+55) ===
  {
    id: 'aow_kongo_river',
    position: { x: 0, y: 0.04, z: 12 },
    size: { x: 430, y: 0.08, z: 14 },
    material: 'water',
    collidable: false,
  },
  {
    id: 'aow_bridge_center',
    position: { x: 0, y: 0.45, z: 12 },
    size: { x: 8.5, y: 0.9, z: 18 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  // Garde-corps du pont central
  {
    id: 'aow_bridge_rail_l',
    position: { x: -4.0, y: 1.25, z: 12 },
    size: { x: 0.45, y: 0.7, z: 18 },
    material: 'wood',
    collidable: true,
  },
  {
    id: 'aow_bridge_rail_r',
    position: { x: 4.0, y: 1.25, z: 12 },
    size: { x: 0.45, y: 0.7, z: 18 },
    material: 'wood',
    collidable: true,
  },
  {
    id: 'aow_bridge_west',
    position: { x: -105, y: 0.45, z: 12 },
    size: { x: 7.0, y: 0.9, z: 18 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_bridge_east',
    position: { x: 110, y: 0.45, z: 12 },
    size: { x: 7.0, y: 0.9, z: 18 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_kongo_sanctuary',
    position: { x: -24, y: 1.5, z: -20 },
    size: { x: 16, y: 3.0, z: 14 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_kongo_stairs', -24, -8, -1, 3.0, 4.5, 5, 'wood'),
  {
    id: 'aow_kongo_totem',
    position: { x: -30, y: 4.4, z: -25 },
    size: { x: 1.6, y: 2.8, z: 1.6 },
    material: 'gold_trim',
    collidable: true,
  },
  ...makeBaobab('aow_baobab_c1', -38, 36, 1.15),
  ...makeBaobab('aow_baobab_c2', 38, -28, 1.1),
  ...makeBaobab('aow_baobab_c3', 56, 38, 1.0),
  ...makeAcacia('aow_acacia_c1', -20, 42),
  ...makeAcacia('aow_acacia_c2', 26, -12),
  ...makeAcacia('aow_acacia_c3', -52, -32),
  ...makePalm('aow_palm_c1', -62, -16, 7.6),
  ...makePalm('aow_palm_c2', 24, 42, 7.0),
  ...makePalm('aow_palm_c3', 10, 22, 6.8),
  ...makePalm('aow_palm_c4', -10, 22, 6.8),

  // === BIOME 4 (SUD-OUEST : SAVANE, ZAZZAU & GRAND ZIMBABWE, x: -195..-35, z: +45..+195) ===
  {
    id: 'aow_zimbabwe_citadel',
    position: { x: -125, y: 2.4, z: 125 },
    size: { x: 24, y: 4.8, z: 22 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_zimb_stairs', -125, 108, 1, 4.8, 5.2, 6, 'carved_stone'),
  {
    id: 'aow_zimbabwe_conical',
    position: { x: -102, y: 5.0, z: 125 },
    size: { x: 7.5, y: 10.0, z: 7.5 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_zimbabwe_chevron',
    position: { x: -102, y: 8.6, z: 125 },
    size: { x: 8.1, y: 1.0, z: 8.1 },
    material: 'gold_trim',
    collidable: true,
  },
  {
    id: 'aow_zazzau_wall_1',
    position: { x: -148, y: 2.0, z: 92 },
    size: { x: 22, y: 4.0, z: 3.2 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_zazzau_wall_2',
    position: { x: -158, y: 2.0, z: 118 },
    size: { x: 3.2, y: 4.0, z: 24 },
    material: 'adobe_dark',
    collidable: true,
    castShadow: true,
  },
  ...makeBaobab('aow_baobab_sw1', -82, 152, 1.2),
  ...makeBaobab('aow_baobab_sw2', -168, 155, 1.1),
  ...makeAcacia('aow_acacia_sw1', -72, 88),
  ...makeAcacia('aow_acacia_sw2', -112, 74),

  // === BIOME 5 (SUD-EST : CHUTES VICTORIA & BASTION COLONIAL DU SUD, x: +35..+195, z: +45..+195) ===
  {
    id: 'aow_falls_pool',
    position: { x: 125, y: 0.05, z: 128 },
    size: { x: 48, y: 0.1, z: 38 },
    material: 'water',
    collidable: false,
  },
  {
    id: 'aow_falls_cliff',
    position: { x: 125, y: 3.5, z: 100 },
    size: { x: 46, y: 7.0, z: 14 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_falls_waterfall',
    position: { x: 125, y: 4.0, z: 108 },
    size: { x: 36, y: 8.0, z: 1.8 },
    material: 'water',
    collidable: false,
  },
  {
    id: 'aow_falls_overlook_bridge',
    position: { x: 88, y: 0.55, z: 130 },
    size: { x: 6.0, y: 1.1, z: 22 },
    material: 'wood',
    collidable: true,
    castShadow: true,
  },
  {
    id: 'aow_colonial_headquarters',
    position: { x: 118, y: 2.5, z: 162 },
    size: { x: 22, y: 5.0, z: 16 },
    material: 'terracotta',
    collidable: true,
    castShadow: true,
  },
  ...makeStairsZ('aow_hq_stairs', 118, 148, 1, 5.0, 5.2, 6, 'carved_stone'),
  {
    id: 'aow_hq_watchtower',
    position: { x: 132, y: 5.0, z: 166 },
    size: { x: 5.5, y: 10.0, z: 5.5 },
    material: 'carved_stone',
    collidable: true,
    castShadow: true,
  },
  ...makePalm('aow_palm_se1', 76, 114, 7.4),
  ...makePalm('aow_palm_se2', 162, 128, 7.0),
  ...makeAcacia('aow_acacia_se1', 64, 158),

  // Collines naturelles douces en bordure lointaine (sans fermer le monde en boîte)
  {
    id: 'aow_ridge_nw',
    position: { x: -225, y: 2.5, z: -210 },
    size: { x: 52, y: 5.0, z: 26 },
    material: 'sandstone',
    collidable: true,
  },
  {
    id: 'aow_ridge_sw',
    position: { x: -220, y: 3.0, z: 210 },
    size: { x: 58, y: 6.0, z: 28 },
    material: 'carved_stone',
    collidable: true,
  },
  {
    id: 'aow_ridge_ne',
    position: { x: 190, y: 2.4, z: -205 },
    size: { x: 46, y: 4.8, z: 22 },
    material: 'sandstone',
    collidable: true,
  },
];

export const AFRICA_OPEN_WORLD_MAP: MapDefinition = {
  id: 'africa_open_world',
  nameFr: 'Monde Ouvert — L’Afrique Historique',
  nameEn: 'Open World — Historic Africa',
  descriptionFr:
    'Continent continu sans murs fermés (520×520m) : Sahel, Nil & Pyramides, Forêt du Kongo, Savane du Zimbabwe et Chutes Victoria.',
  descriptionEn:
    'Seamless open continent without box walls (520×520m): Sahel, Nile & Pyramids, Kongo Rainforest, Zimbabwe Savannah, and Victoria Falls.',
  environmentType: 'stone_citadel',
  ambientAudioTag: 'savanna_wind',
  bounds: {
    minX: -260,
    maxX: 260,
    minY: -2,
    maxY: 42,
    minZ: -260,
    maxZ: 260,
  },
  lighting: {
    sunColor: '#fff5d6',
    sunIntensity: 2.15,
    sunPosition: { x: 85, y: 120, z: 65 },
    ambientColor: '#fef3c7',
    ambientIntensity: 0.62,
    hemisphereSky: '#60a5fa',
    hemisphereGround: '#527328',
    skyTopColor: '#0369a1',
    skyHorizonColor: '#fde68a',
  },
  weather: {
    fogColor: '#e2d8be',
    fogNear: 120,
    fogFar: 380,
    dustParticles: 340,
    windDirection: { x: 0.5, y: 0.05, z: 0.3 },
  },
  spawnPoints: [
    { id: 'aow_sp_center', position: { x: 0, y: 0.2, z: 32 }, yaw: 0, team: 'alpha' },
    { id: 'aow_sp_ally1', position: { x: -12, y: 0.2, z: 38 }, yaw: 0.2, team: 'alpha' },
    { id: 'aow_sp_ally2', position: { x: 14, y: 0.2, z: 38 }, yaw: -0.2, team: 'alpha' },
    { id: 'aow_sp_sahel', position: { x: -115, y: 0.2, z: -102 }, yaw: Math.PI, team: 'beta' },
    { id: 'aow_sp_nile', position: { x: 140, y: 0.2, z: -85 }, yaw: Math.PI, team: 'beta' },
    { id: 'aow_sp_zimbabwe', position: { x: -95, y: 0.2, z: 100 }, yaw: 0.5, team: 'beta' },
    { id: 'aow_sp_falls', position: { x: 92, y: 0.2, z: 138 }, yaw: -0.5, team: 'beta' },
    { id: 'aow_sp_coast', position: { x: 185, y: 0.2, z: -42 }, yaw: 1.5, team: 'beta' },
  ],
  zones: [
    {
      id: 'region_sahel',
      nameFr: 'Sahel & Tombouctou',
      nameEn: 'Sahel & Timbuktu',
      center: { x: -125, y: 0, z: -125 },
      radius: 45,
      type: 'landmark',
    },
    {
      id: 'region_nile',
      nameFr: 'Nil & Pyramides de Gizeh',
      nameEn: 'Nile & Giza Pyramids',
      center: { x: 140, y: 0, z: -110 },
      radius: 48,
      type: 'high_ground',
    },
    {
      id: 'region_kongo',
      nameFr: 'Forêt & Fleuve Kongo',
      nameEn: 'Kongo Rainforest & River',
      center: { x: 0, y: 0, z: 0 },
      radius: 48,
      type: 'oasis',
    },
    {
      id: 'region_zimbabwe',
      nameFr: 'Savane & Grand Zimbabwe',
      nameEn: 'Savannah & Great Zimbabwe',
      center: { x: -125, y: 0, z: 125 },
      radius: 48,
      type: 'landmark',
    },
    {
      id: 'region_zambezi',
      nameFr: 'Chutes du Zambèze',
      nameEn: 'Zambezi Falls',
      center: { x: 125, y: 0, z: 135 },
      radius: 48,
      type: 'high_ground',
    },
  ],
  lootPoints: [
    { id: 'aow_loot_c', position: { x: 0, y: 0.5, z: -8 }, type: 'weapon_crate', respawnSeconds: 20 },
    { id: 'aow_loot_sahel', position: { x: -118, y: 0.5, z: -118 }, type: 'ammo', respawnSeconds: 15 },
    { id: 'aow_loot_nile', position: { x: 120, y: 0.5, z: -110 }, type: 'armor', respawnSeconds: 20 },
    { id: 'aow_loot_zimb', position: { x: -110, y: 0.5, z: 112 }, type: 'health', respawnSeconds: 18 },
    { id: 'aow_loot_falls', position: { x: 98, y: 0.5, z: 146 }, type: 'weapon_crate', respawnSeconds: 24 },
  ],
  blocks,
};
