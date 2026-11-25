import { BotDifficulty, Vec3 } from '../types/common.js';
import { HeroId } from '../types/hero.js';
import { MapId } from '../types/map.js';
import { WeaponId } from '../types/weapon.js';

export interface StoryStronghold {
  id: string;
  nameFr: string;
  nameEn: string;
  position: Vec3;
  captureRadius: number;
}

export interface StoryChapter {
  id: string;
  order: number;
  eraLabel: string;
  titleFr: string;
  titleEn: string;
  regionFr: string;
  regionEn: string;
  historySummaryFr: string;
  historySummaryEn: string;
  objectiveFr: string;
  objectiveEn: string;
  mapId: MapId;
  heroId: HeroId;
  recommendedWeaponId: WeaponId;
  allyCount: number;
  enemyCount: number;
  enemyDifficulty: BotDifficulty;
  rewardCauris: number;
  strongholds: StoryStronghold[];
}

/**
 * Campagne Histoire « Libération de l'Afrique » — 6 chapitres mettant en scène TOUS les 6 héros africains
 * avec mode escouade alliée contre l'armée adverse en uniforme blanc.
 */
export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1_manden',
    order: 1,
    eraLabel: '1235 · Empire du Mali',
    titleFr: 'Chapitre I — La Charte du Manden (Soundiata)',
    titleEn: 'Chapter I — The Manden Charter (Sundiata)',
    regionFr: 'Mali · Tombouctou',
    regionEn: 'Mali · Timbuktu',
    historySummaryFr:
      'Après la bataille de Kirina (1235) et la proclamation du Kouroukan Fouga, Soundiata Keïta et ses alliés sécurisent les routes du savoir de Tombouctou.',
    historySummaryEn:
      'Following Kirina (1235) and the Kouroukan Fouga charter, Sundiata Keita and allies secure the Sahel caravan routes of Timbuktu.',
    objectiveFr: 'Libérez les 3 bastions caravaniers et repoussez les soldats adverses.',
    objectiveEn: 'Liberate all 3 caravan strongholds and repel enemy soldiers.',
    mapId: 'tombouctou',
    heroId: 'sundiata',
    recommendedWeaponId: 'imperial_carbine',
    allyCount: 3,
    enemyCount: 5,
    enemyDifficulty: 'beginner',
    rewardCauris: 120,
    strongholds: [
      {
        id: 'sh_manden_gate',
        nameFr: 'Porte Caravanière Sud',
        nameEn: 'South Caravan Gate',
        position: { x: 0, y: 0.4, z: 42 },
        captureRadius: 6,
      },
      {
        id: 'sh_manden_market',
        nameFr: 'Grand Marché du Sel',
        nameEn: 'Great Salt Market',
        position: { x: -30, y: 0.4, z: -8 },
        captureRadius: 6,
      },
      {
        id: 'sh_manden_citadel',
        nameFr: 'Citadelle des Manuscrits (Escaladez !)',
        nameEn: 'Manuscript Citadel (Climb!)',
        position: { x: 0, y: 4.9, z: -58 },
        captureRadius: 7,
      },
    ],
  },
  {
    id: 'ch2_zazzau',
    order: 2,
    eraLabel: '1576 · Royaume de Zazzau',
    titleFr: 'Chapitre II — Les Remparts d’Amina (Reine Amina)',
    titleEn: 'Chapter II — Ramparts of Queen Amina',
    regionFr: 'Afrique Australe · Grand Zimbabwe',
    regionEn: 'Southern Africa · Great Zimbabwe',
    historySummaryFr:
      'Stratège et bâtisseuse des murailles ganuwa, la Reine Amina de Zazzau mène son escouade pour reprendre les citadelles de pierre sèche.',
    historySummaryEn:
      'Master strategist and builder of the ganuwa walls, Queen Amina leads her squad to reclaim the dry-stone citadels.',
    objectiveFr: 'Escaladez le bastion sud-ouest et libérez la Cour puis l’Acropole Royale.',
    objectiveEn: 'Climb the SW bastion and liberate the Courtyard and Royal Acropolis.',
    mapId: 'great_zimbabwe',
    heroId: 'amina',
    recommendedWeaponId: 'double_barrel_shotgun',
    allyCount: 3,
    enemyCount: 6,
    enemyDifficulty: 'intermediate',
    rewardCauris: 150,
    strongholds: [
      {
        id: 'sh_zazzau_bastion',
        nameFr: 'Bastion de Granit S-O (Escaladez !)',
        nameEn: 'SW Granite Bastion (Climb!)',
        position: { x: -54, y: 5.1, z: 54 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_zazzau_tower',
        nameFr: 'Cour de la Tour Conique',
        nameEn: 'Conical Tower Courtyard',
        position: { x: 18, y: 0.4, z: 0 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_zazzau_acropolis',
        nameFr: 'Acropole Royale Centrale',
        nameEn: 'Central Royal Acropolis',
        position: { x: 0, y: 2.5, z: 0 },
        captureRadius: 7,
      },
    ],
  },
  {
    id: 'ch3_zulu',
    order: 3,
    eraLabel: '1818 · Royaume Zoulou',
    titleFr: 'Chapitre III — La Corne du Buffle (Shaka Zulu)',
    titleEn: 'Chapter III — Horns of the Buffalo (Shaka Zulu)',
    regionFr: 'Zambèze · Chutes Victoria',
    regionEn: 'Zambezi · Victoria Falls',
    historySummaryFr:
      'Stratège légendaire, Shaka déploie la formation en Corne du Buffle pour encercler les garnisons adverses le long des Chutes Victoria (Mosi-oa-Tunya).',
    historySummaryEn:
      'Legendary tactician Shaka deploys the Horns of the Buffalo formation to encircle enemy garrisons along Victoria Falls.',
    objectiveFr: 'Prenez le Pont du Zambèze, le Belvédère et les Falaises des Chutes.',
    objectiveEn: 'Capture Zambezi Bridge, the Belvedere, and the Falls Basalt Cliffs.',
    mapId: 'victoria_falls',
    heroId: 'shaka',
    recommendedWeaponId: 'spear',
    allyCount: 4,
    enemyCount: 7,
    enemyDifficulty: 'intermediate',
    rewardCauris: 170,
    strongholds: [
      {
        id: 'sh_zulu_belvedere',
        nameFr: 'Belvédère Panoramique',
        nameEn: 'Scenic Belvedere',
        position: { x: 0, y: 3.1, z: 32 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_zulu_bridge',
        nameFr: 'Pont du Zambèze',
        nameEn: 'Zambezi Bridge',
        position: { x: 0, y: 1.0, z: 0 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_zulu_cliffs',
        nameFr: 'Falaises Nord des Chutes (Escaladez !)',
        nameEn: 'North Falls Cliffs (Climb!)',
        position: { x: -34, y: 6.1, z: -26 },
        captureRadius: 7.5,
      },
    ],
  },
  {
    id: 'ch4_matamba',
    order: 4,
    eraLabel: '1624 · Ndongo & Matamba',
    titleFr: 'Chapitre IV — La Résistance de Nzinga (Reine Nzinga)',
    titleEn: 'Chapter IV — Nzinga’s Resistance (Queen Nzinga)',
    regionFr: 'Bassin du Kongo · Forêt du Kongo',
    regionEn: 'Kongo Basin · Kongo Forest',
    historySummaryFr:
      'Souveraine du Ndongo et du Matamba (Angola), la Reine Nzinga Mbande mène durant trente ans la résistance le long du fleuve contre les forts adverses.',
    historySummaryEn:
      'Ruler of Ndongo and Matamba, Queen Nzinga leads a thirty-year river and forest campaign against invading garrisons.',
    objectiveFr: 'Reprenez les gués du fleuve, le mirador N-O et le Sanctuaire Royal.',
    objectiveEn: 'Reclaim the river crossing, NW watchtower, and Royal Sanctuary.',
    mapId: 'kongo_forest',
    heroId: 'nzinga',
    recommendedWeaponId: 'throwing_axes',
    allyCount: 3,
    enemyCount: 6,
    enemyDifficulty: 'intermediate',
    rewardCauris: 190,
    strongholds: [
      {
        id: 'sh_kongo_river',
        nameFr: 'Gué du Fleuve Kongo',
        nameEn: 'Kongo River Crossing',
        position: { x: -24, y: 0.4, z: 12 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_kongo_watchtower',
        nameFr: 'Mirador Nord-Ouest (Escaladez !)',
        nameEn: 'NW Watchtower (Climb!)',
        position: { x: -50, y: 5.1, z: -50 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_kongo_sanctuary',
        nameFr: 'Sanctuaire Royal de Matamba',
        nameEn: 'Royal Sanctuary of Matamba',
        position: { x: 0, y: 2.5, z: 0 },
        captureRadius: 7,
      },
    ],
  },
  {
    id: 'ch5_aksum',
    order: 5,
    eraLabel: '350 · Aksoum & Alexandrie',
    titleFr: 'Chapitre V — Les Gardiens de la Lumière (Reine Makeda)',
    titleEn: 'Chapter V — Guardians of the Light (Queen Makeda)',
    regionFr: 'Méditerranée · Alexandrie',
    regionEn: 'Mediterranean · Alexandria',
    historySummaryFr:
      'Des royaumes d’Aksoum jusqu’aux quais d’Alexandrie, la lignée de Makeda défend le Phare et les archives millénaires.',
    historySummaryEn:
      'From Aksum to Alexandria’s docks, Makeda’s lineage defends the Pharos and ancient African archives.',
    objectiveFr: 'Libérez l’Entrepôt du Port, la Tour du Phare et la Grande Bibliothèque.',
    objectiveEn: 'Liberate the Harbor Warehouse, Pharos Tower, and Great Library.',
    mapId: 'alexandria',
    heroId: 'makeda',
    recommendedWeaponId: 'royal_long_rifle',
    allyCount: 4,
    enemyCount: 7,
    enemyDifficulty: 'expert',
    rewardCauris: 220,
    strongholds: [
      {
        id: 'sh_aksum_warehouse',
        nameFr: 'Entrepôt du Port Ouest (Escaladez !)',
        nameEn: 'West Harbor Warehouse (Climb!)',
        position: { x: -50, y: 4.5, z: 42 },
        captureRadius: 7,
      },
      {
        id: 'sh_aksum_pharos',
        nameFr: 'Esplanade du Phare',
        nameEn: 'Pharos Plaza',
        position: { x: 20, y: 0.4, z: 0 },
        captureRadius: 6.5,
      },
      {
        id: 'sh_aksum_library',
        nameFr: 'Grande Bibliothèque',
        nameEn: 'Great Library',
        position: { x: 0, y: 2.5, z: -12 },
        captureRadius: 7,
      },
    ],
  },
  {
    id: 'ch6_giza',
    order: 6,
    eraLabel: '1400 · Forge d’Ogun & Nil',
    titleFr: 'Chapitre VI — Le Feu des Pyramides (Ogun le Forgeron)',
    titleEn: 'Chapter VI — Fire of the Pyramids (Ogun the Smith)',
    regionFr: 'Égypte · Pyramides de Gizeh',
    regionEn: 'Egypt · Giza Pyramids',
    historySummaryFr:
      'Maître du fer et de la forge sacrée, Ogun unit les champions africains au pied des Pyramides de Gizeh pour briser la dernière armée d’invasion.',
    historySummaryEn:
      'Master of sacred iron and the forge, Ogun rallies African champions at Giza to shatter the final invading army.',
    objectiveFr: 'Libérez le Temple Solaire, le Grand Sphinx et escaladez la Grande Pyramide.',
    objectiveEn: 'Liberate the Sun Temple, Great Sphinx, and climb the Great Pyramid.',
    mapId: 'giza_pyramids',
    heroId: 'ogun',
    recommendedWeaponId: 'siege_gatling',
    allyCount: 4,
    enemyCount: 8,
    enemyDifficulty: 'expert',
    rewardCauris: 300,
    strongholds: [
      {
        id: 'sh_giza_temple',
        nameFr: 'Temple Solaire S-O',
        nameEn: 'SW Sun Temple',
        position: { x: -44, y: 1.3, z: 36 },
        captureRadius: 7,
      },
      {
        id: 'sh_giza_sphinx',
        nameFr: 'Esplanade du Grand Sphinx',
        nameEn: 'Great Sphinx Plaza',
        position: { x: 34, y: 0.4, z: 14 },
        captureRadius: 7,
      },
      {
        id: 'sh_giza_pyramid',
        nameFr: 'Sommet de la Grande Pyramide (Escaladez !)',
        nameEn: 'Great Pyramid Summit (Climb!)',
        position: { x: 0, y: 9.1, z: -20 },
        captureRadius: 8,
      },
    ],
  },
];

export function getStoryChapter(id: string): StoryChapter {
  return STORY_CHAPTERS.find((c) => c.id === id) ?? STORY_CHAPTERS[0];
}

export interface OpenWorldStronghold extends StoryStronghold {
  regionFr: string;
  regionEn: string;
  loreFr: string;
  loreEn: string;
  heroPatron: HeroId;
}

export const OPEN_WORLD_ADVENTURE = {
  id: 'africa_resistance_open_world',
  mapId: 'africa_open_world' as MapId,
  titleFr: 'Épopée de la Résistance Africaine',
  titleEn: 'African Resistance Open-World Odyssey',
  subtitleFr:
    'Parcourez librement le continent africain (Sahel, Nil, Forêt du Kongo, Savane, Chutes Victoria) sans murs fermés et libérez les 6 bastions occupés par les garnisons coloniales.',
  subtitleEn:
    'Roam freely across the African continent (Sahel, Nile, Kongo Rainforest, Savannah, Victoria Falls) with no artificial walls and liberate all 6 colonial strongholds.',
  strongholds: [
    {
      id: 'ow_kongo_sanctuary',
      nameFr: 'Sanctuaire du Fleuve Kongo',
      nameEn: 'Kongo River Sanctuary',
      regionFr: 'Bassin du Kongo · Forêt Tropicale',
      regionEn: 'Kongo Basin · Rainforest',
      loreFr: '1624 : La Reine Nzinga rallie les guerriers de la forêt pour briser l’encerclement du fleuve.',
      loreEn: '1624: Queen Nzinga rallies rainforest fighters to break the river encirclement.',
      heroPatron: 'nzinga' as HeroId,
      position: { x: -24, y: 3.1, z: -20 },
      captureRadius: 9,
    },
    {
      id: 'ow_sahel_timbuktu',
      nameFr: 'Fort du Sahel & Tombouctou',
      nameEn: 'Sahel & Timbuktu Fort',
      regionFr: 'Nord-Ouest · Désert du Sahara',
      regionEn: 'North-West · Sahara Desert',
      loreFr: 'Héritage du Manden : les cavaliers du Sahel protègent les manuscrits et les routes caravanières.',
      loreEn: 'Mandé Legacy: Sahel riders protect the ancient manuscripts and caravan roads.',
      heroPatron: 'sundiata' as HeroId,
      position: { x: -135, y: 5.3, z: -135 },
      captureRadius: 10,
    },
    {
      id: 'ow_nile_pyramids',
      nameFr: 'Citadelle du Nil & Pyramides',
      nameEn: 'Nile & Pyramids Citadel',
      regionFr: 'Nord-Est · Plateau de Gizeh',
      regionEn: 'North-East · Giza Plateau',
      loreFr: 'Des royaumes d’Aksoum au Nil, les gardiens escaladent les gradins millénaires pour hisser l’étendard.',
      loreEn: 'From Aksum to the Nile, guardians climb the ancient steps to raise the banner.',
      heroPatron: 'makeda' as HeroId,
      position: { x: 135, y: 10.1, z: -135 },
      captureRadius: 10,
    },
    {
      id: 'ow_east_coast',
      nameFr: 'Fort Colonial de la Côte Est',
      nameEn: 'East Coast Colonial Fort',
      regionFr: 'Côte Maritime · Port d’Alexandrie',
      regionEn: 'Maritime Coast · Alexandria Port',
      loreFr: 'Ogun le Forgeron et ses troupes détruisent les pièces d’artillerie débarquées sur le littoral.',
      loreEn: 'Ogun the Smith and his troops dismantle naval artillery landed along the shore.',
      heroPatron: 'ogun' as HeroId,
      position: { x: 168, y: 4.9, z: -68 },
      captureRadius: 10,
    },
    {
      id: 'ow_zazzau_zimbabwe',
      nameFr: 'Enceinte de Zazzau & Zimbabwe',
      nameEn: 'Zazzau & Zimbabwe Enclosure',
      regionFr: 'Sud-Ouest · Savane & Pierre Sèche',
      regionEn: 'South-West · Savannah & Stone Citadel',
      loreFr: 'La Reine Amina reprend les citadelles de granit et fortifie la savane dorée.',
      loreEn: 'Queen Amina reclaims the granite citadels and fortifies the golden savannah.',
      heroPatron: 'amina' as HeroId,
      position: { x: -125, y: 4.9, z: 125 },
      captureRadius: 11,
    },
    {
      id: 'ow_victoria_hq',
      nameFr: 'Quartier Général Colonial du Zambèze',
      nameEn: 'Zambezi Colonial Headquarters',
      regionFr: 'Sud-Est · Chutes Victoria',
      regionEn: 'South-East · Victoria Falls',
      loreFr: 'Assaut final mené par Shaka Zulu face aux Chutes Mosi-oa-Tunya pour la libération totale.',
      loreEn: 'Final assault led by Shaka Zulu at Mosi-oa-Tunya Falls for full liberation.',
      heroPatron: 'shaka' as HeroId,
      position: { x: 118, y: 5.1, z: 162 },
      captureRadius: 11,
    },
  ] satisfies OpenWorldStronghold[],
};

