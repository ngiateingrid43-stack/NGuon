import type { Vec3 } from './common.js';

export type MapId =
  | 'tombouctou'
  | 'great_zimbabwe'
  | 'alexandria'
  | 'kongo_forest'
  | 'giza_pyramids'
  | 'victoria_falls'
  | 'africa_open_world';

export type VoxelMaterialType =
  | 'sand'
  | 'adobe'
  | 'adobe_dark'
  | 'sandstone'
  | 'carved_stone'
  | 'wood'
  | 'gold_trim'
  | 'market_cloth_red'
  | 'market_cloth_blue'
  | 'market_cloth_gold'
  | 'water'
  | 'grass_oasis'
  | 'palm_trunk'
  | 'palm_leaf'
  | 'terracotta';

export interface MapBlock {
  id: string;
  position: Vec3; // Centre du bloc
  size: Vec3; // Largeur, hauteur, profondeur
  material: VoxelMaterialType;
  collidable: boolean;
  isCover?: boolean;
  isRamp?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface MapZone {
  id: string;
  nameFr: string;
  nameEn: string;
  center: Vec3;
  radius: number;
  type: 'landmark' | 'combat' | 'cover' | 'high_ground' | 'oasis';
}

export interface SpawnPoint {
  id: string;
  position: Vec3;
  yaw: number;
  team?: 'alpha' | 'beta' | 'any';
}

export interface LootPoint {
  id: string;
  position: Vec3;
  type: 'ammo' | 'health' | 'armor' | 'weapon_crate';
  respawnSeconds: number;
}

export interface MapLighting {
  sunColor: string;
  sunIntensity: number;
  sunPosition: Vec3;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  skyTopColor: string;
  skyHorizonColor: string;
}

export interface MapWeather {
  fogColor: string;
  fogNear: number;
  fogFar: number;
  dustParticles: number;
  windDirection: Vec3;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface MapDefinition {
  id: MapId;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  environmentType: 'desert_urban' | 'stone_citadel' | 'mediterranean_port' | 'tropical_forest';
  bounds: MapBounds;
  lighting: MapLighting;
  weather: MapWeather;
  ambientAudioTag: string;
  spawnPoints: SpawnPoint[];
  lootPoints: LootPoint[];
  zones: MapZone[];
  blocks: MapBlock[];
}
