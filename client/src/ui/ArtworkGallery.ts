import type { HeroId } from '@shared/types/hero';
import type { MapId } from '@shared/types/map';
import type { WeaponId } from '@shared/types/weapon';
import { HEROES_CONFIG } from '@shared/heroes/heroesConfig';
import { WEAPONS_CONFIG } from '@shared/weapons/weaponsConfig';
import { RARITY_COLORS } from '@shared/constants/game';

/**
 * Galerie d'illustrations vectorielles sur mesure pour chaque Héros, chaque Arme et chaque Carte.
 * Offre des visuels nets, contrastés et sans dépendance réseau externe.
 */
export function getHeroPortraitSvg(heroId: HeroId): string {
  const hero = HEROES_CONFIG[heroId];
  const p = hero.palette.primary;
  const s = hero.palette.secondary;
  const a = hero.palette.accent;
  const skin = hero.palette.skin;

  const emblems: Record<HeroId, string> = {
    sundiata: `
      <path d="M24 14 L32 8 L40 16 L48 8 L56 14 L52 26 L28 26 Z" fill="${a}" stroke="#1c1108" stroke-width="1.8"/>
      <circle cx="40" cy="41" r="15" fill="${skin}" stroke="${a}" stroke-width="2.2"/>
      <path d="M22 40 Q20 26 40 24 Q60 26 58 40 Q56 32 40 31 Q24 32 22 40 Z" fill="${p}"/>
      <path d="M26 58 Q40 50 54 58 L58 76 L22 76 Z" fill="${p}" stroke="${a}" stroke-width="1.6"/>
      <circle cx="40" cy="64" r="5.5" fill="${a}"/>
    `,
    amina: `
      <path d="M27 25 L34 11 L40 19 L46 11 L53 25 Z" fill="${a}" stroke="#1c1108" stroke-width="1.5"/>
      <circle cx="40" cy="40" r="14" fill="${skin}" stroke="${a}" stroke-width="2"/>
      <path d="M26 36 C28 24 52 24 54 36 C49 30 31 30 26 36 Z" fill="${s}"/>
      <path d="M16 24 L24 62 M64 24 L56 62" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 58 Q40 50 56 58 L59 76 L21 76 Z" fill="${p}" stroke="${a}" stroke-width="1.6"/>
    `,
    shaka: `
      <path d="M22 22 Q40 12 58 22 L54 30 Q40 23 26 30 Z" fill="${s}"/>
      <circle cx="40" cy="40" r="14" fill="${skin}" stroke="${a}" stroke-width="2"/>
      <ellipse cx="62" cy="52" rx="9" ry="18" fill="#f8fafc" stroke="${p}" stroke-width="2.2"/>
      <line x1="62" y1="36" x2="62" y2="68" stroke="#1e293b" stroke-width="2"/>
      <path d="M24 58 Q40 51 54 58 L56 76 L22 76 Z" fill="${p}"/>
    `,
    nzinga: `
      <path d="M26 24 Q40 10 54 24 L50 29 Q40 21 30 29 Z" fill="${a}"/>
      <circle cx="40" cy="40" r="14" fill="${skin}" stroke="${a}" stroke-width="2"/>
      <path d="M27 33 Q40 25 53 33" stroke="${p}" stroke-width="4" fill="none"/>
      <path d="M24 57 Q40 49 56 57 L60 76 L20 76 Z" fill="${p}" stroke="${a}" stroke-width="1.6"/>
      <path d="M32 62 L40 69 L48 62" stroke="${a}" stroke-width="2.4" fill="none"/>
    `,
    makeda: `
      <circle cx="40" cy="15" r="7" fill="${a}" opacity="0.9"/>
      <path d="M36 22 L44 22 L42 6 L38 6 Z" fill="#fef08a" opacity="0.85"/>
      <circle cx="40" cy="40" r="14" fill="${skin}" stroke="${a}" stroke-width="2.2"/>
      <path d="M24 58 Q40 50 56 58 L58 76 L22 76 Z" fill="${p}" stroke="${a}" stroke-width="1.8"/>
      <polygon points="40,58 46,66 40,74 34,66" fill="${a}"/>
    `,
    ogun: `
      <rect x="26" y="16" width="28" height="10" rx="3" fill="#475569" stroke="${a}" stroke-width="1.6"/>
      <circle cx="40" cy="40" r="14" fill="${skin}" stroke="${a}" stroke-width="2"/>
      <path d="M23 58 Q40 49 57 58 L60 76 L20 76 Z" fill="${p}" stroke="${a}" stroke-width="1.8"/>
      <path d="M33 65 L40 58 L47 65 L44 73 L36 73 Z" fill="${a}"/>
      <path d="M16 44 L22 36 L19 46 L25 42" stroke="#fde047" stroke-width="2" fill="none"/>
    `,
  };

  return `
    <svg viewBox="0 0 80 80" class="art-svg art-hero-svg" aria-hidden="true">
      <defs>
        <radialGradient id="hg-${heroId}" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#120a05" stop-opacity="0.96"/>
        </radialGradient>
      </defs>
      <rect width="80" height="80" rx="12" fill="url(#hg-${heroId})"/>
      <circle cx="40" cy="40" r="34" fill="none" stroke="${a}" stroke-opacity="0.28" stroke-width="1.2" stroke-dasharray="4 3"/>
      ${emblems[heroId]}
    </svg>
  `;
}

export function getWeaponIllustrationSvg(weaponId: WeaponId): string {
  const w = WEAPONS_CONFIG[weaponId];
  const body = w.visual.bodyColor;
  const barrel = w.visual.barrelColor;
  const accent = w.visual.accentColor;
  const rarityHex = RARITY_COLORS[w.rarity];

  let shape = '';
  switch (weaponId) {
    case 'flintlock_musket':
    case 'royal_long_rifle':
      shape = `
        <path d="M10 44 L24 38 L70 35 L70 39 L27 44 L15 51 Z" fill="${body}" stroke="${accent}" stroke-width="1"/>
        <rect x="26" y="31" width="66" height="4.5" rx="1.5" fill="${barrel}"/>
        <circle cx="32" cy="36" r="3.5" fill="${accent}"/>
        ${weaponId === 'royal_long_rifle' ? `<rect x="44" y="25" width="24" height="4" rx="1.5" fill="#1e293b" stroke="${accent}" stroke-width="0.9"/>` : ''}
      `;
      break;
    case 'repeating_rifle':
    case 'imperial_carbine':
      shape = `
        <path d="M12 45 L28 36 L68 35 L68 41 L30 43 L17 51 Z" fill="${body}"/>
        <rect x="30" y="30" width="58" height="5" rx="1.5" fill="${barrel}"/>
        <rect x="44" y="40" width="9" height="12" rx="1.5" fill="#1e293b" stroke="${accent}" stroke-width="1"/>
        <circle cx="39" cy="36" r="2.6" fill="${accent}"/>
      `;
      break;
    case 'hand_cannon':
    case 'double_barrel_shotgun':
      shape = `
        <path d="M14 44 L28 36 L60 36 L60 43 L30 44 L18 52 Z" fill="${body}"/>
        <rect x="28" y="29" width="56" height="8" rx="2" fill="${barrel}" stroke="${accent}" stroke-width="1"/>
        <rect x="78" y="27.5" width="8" height="11" rx="1.5" fill="${accent}"/>
      `;
      break;
    case 'dueling_pistol':
      shape = `
        <path d="M26 48 L35 35 L58 35 L56 41 L39 41 L34 52 Z" fill="${body}" stroke="${accent}" stroke-width="1"/>
        <rect x="37" y="29" width="38" height="6" rx="2" fill="${barrel}"/>
        <circle cx="42" cy="36" r="2.8" fill="${accent}"/>
      `;
      break;
    case 'siege_gatling':
      shape = `
        <rect x="18" y="32" width="32" height="14" rx="3" fill="${body}" stroke="${accent}" stroke-width="1.2"/>
        <rect x="48" y="29" width="42" height="3" fill="${barrel}"/>
        <rect x="48" y="35" width="42" height="3" fill="${barrel}"/>
        <rect x="48" y="41" width="42" height="3" fill="${barrel}"/>
        <rect x="74" y="28" width="5" height="17" rx="1" fill="${accent}"/>
        <path d="M24 46 L16 54 M44 46 L52 54" stroke="#64748b" stroke-width="3" stroke-linecap="round"/>
      `;
      break;
    case 'incendiary_mortar':
      shape = `
        <path d="M20 50 L36 38 L78 24 L83 34 L42 48 Z" fill="${barrel}" stroke="${accent}" stroke-width="1.4"/>
        <circle cx="34" cy="47" r="7" fill="${body}" stroke="${accent}" stroke-width="1.4"/>
        <circle cx="81" cy="28" r="4" fill="#fb923c"/>
      `;
      break;
    case 'war_bow':
      shape = `
        <path d="M38 10 Q66 36 38 62" fill="none" stroke="${body}" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="38" y1="12" x2="38" y2="60" stroke="#e2e8f0" stroke-width="1.3"/>
        <line x1="22" y1="36" x2="78" y2="36" stroke="${accent}" stroke-width="2.4"/>
        <polygon points="78,36 70,32 70,40" fill="#cbd5e1"/>
      `;
      break;
    case 'crossbow':
      shape = `
        <rect x="20" y="34" width="56" height="5" rx="2" fill="${body}"/>
        <path d="M58 14 Q74 36 58 58" fill="none" stroke="${barrel}" stroke-width="4" stroke-linecap="round"/>
        <line x1="58" y1="15" x2="38" y2="36.5" stroke="#e2e8f0" stroke-width="1.3"/>
        <line x1="58" y1="57" x2="38" y2="36.5" stroke="#e2e8f0" stroke-width="1.3"/>
        <polygon points="84,36.5 74,33 74,40" fill="${accent}"/>
      `;
      break;
    case 'explosive_sling':
      shape = `
        <path d="M22 48 Q46 58 68 38" fill="none" stroke="${body}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="64" cy="28" r="8" fill="#dc2626" stroke="${accent}" stroke-width="1.6"/>
        <path d="M68 20 L74 14" stroke="#fde047" stroke-width="2"/>
      `;
      break;
    case 'throwing_axes':
      shape = `
        <rect x="30" y="22" width="5" height="36" rx="2" transform="rotate(24 32 40)" fill="${body}"/>
        <path d="M35 19 L55 15 L52 32 L36 28 Z" fill="#cbd5e1" stroke="${accent}" stroke-width="1.2"/>
        <rect x="58" y="20" width="4.5" height="32" rx="2" transform="rotate(-18 60 36)" fill="${body}"/>
        <path d="M58 18 L76 16 L74 30 L58 26 Z" fill="#94a3b8" stroke="${accent}" stroke-width="1.2"/>
      `;
      break;
    case 'spear':
    case 'war_staff':
      shape = `
        <line x1="12" y1="48" x2="76" y2="24" stroke="${body}" stroke-width="4.2" stroke-linecap="round"/>
        <polygon points="88,19 72,21 76,30" fill="${weaponId === 'spear' ? '#e2e8f0' : accent}" stroke="${accent}" stroke-width="1"/>
        <circle cx="71" cy="26" r="3" fill="${accent}"/>
      `;
      break;
    case 'machete':
    case 'short_sword':
    case 'imperial_sabre':
    default:
      shape = `
        <path d="M20 48 L30 42 L34 46 L24 52 Z" fill="${body}"/>
        <rect x="29" y="38" width="4" height="12" rx="1.5" transform="rotate(35 31 44)" fill="${accent}"/>
        <path d="M34 42 Q60 28 84 18 Q74 32 38 46 Z" fill="#e2e8f0" stroke="${accent}" stroke-width="1.1"/>
      `;
      break;
  }

  return `
    <svg viewBox="0 0 100 68" class="art-svg art-weapon-svg" aria-hidden="true">
      <defs>
        <linearGradient id="wg-${weaponId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e140c"/>
          <stop offset="100%" stop-color="${rarityHex}" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="100" height="68" rx="10" fill="url(#wg-${weaponId})"/>
      ${shape}
    </svg>
  `;
}

export function getMapBannerSvg(mapId: MapId): string {
  const scenes: Record<MapId, { skyTop: string; skyBot: string; art: string }> = {
    africa_open_world: {
      skyTop: '#7c2d12',
      skyBot: '#f59e0b',
      art: `
        <circle cx="70" cy="22" r="11" fill="#fde047" opacity="0.9"/>
        <polygon points="95,56 122,22 148,56" fill="#d97706"/>
        <path d="M0 56 Q35 44 70 52 Q110 48 160 56 L160 80 L0 80 Z" fill="#3f6212"/>
        <path d="M55 80 Q76 62 96 54 L106 54 Q88 66 72 80 Z" fill="#0ea5e9" opacity="0.85"/>
        <path d="M20 54 L20 34 M12 36 Q20 26 28 36" stroke="#14532d" stroke-width="3" fill="none"/>
      `,
    },
    tombouctou: {
      skyTop: '#92400e',
      skyBot: '#fbbf24',
      art: `
        <circle cx="122" cy="22" r="10" fill="#fef08a"/>
        <rect x="26" y="34" width="38" height="26" fill="#b45309"/>
        <polygon points="36,34 45,16 54,34" fill="#92400e"/>
        <path d="M0 58 Q45 50 95 56 Q130 50 160 58 L160 80 L0 80 Z" fill="#d97706"/>
      `,
    },
    great_zimbabwe: {
      skyTop: '#78350f',
      skyBot: '#facc15',
      art: `
        <circle cx="38" cy="22" r="9" fill="#fde047"/>
        <path d="M62 24 L82 24 L86 58 L58 58 Z" fill="#78716c"/>
        <rect x="30" y="42" width="102" height="16" fill="#57534e"/>
        <path d="M0 58 L160 58 L160 80 L0 80 Z" fill="#65a30d"/>
      `,
    },
    alexandria: {
      skyTop: '#0c4a6e',
      skyBot: '#38bdf8',
      art: `
        <polygon points="116,12 130,12 134,56 112,56" fill="#f1f5f9"/>
        <polygon points="116,14 25,4 25,24" fill="#fef08a" opacity="0.32"/>
        <rect x="0" y="56" width="160" height="24" fill="#0284c7"/>
        <rect x="20" y="40" width="44" height="16" fill="#e2e8f0"/>
      `,
    },
    kongo_forest: {
      skyTop: '#064e3b',
      skyBot: '#10b981',
      art: `
        <circle cx="30" cy="40" r="22" fill="#15803d"/>
        <circle cx="72" cy="36" r="24" fill="#166534"/>
        <circle cx="128" cy="42" r="22" fill="#14532d"/>
        <path d="M0 62 Q80 50 160 64 L160 80 L0 80 Z" fill="#0ea5e9"/>
        <rect x="52" y="54" width="56" height="6" fill="#78350f"/>
      `,
    },
    giza_pyramids: {
      skyTop: '#7c2d12',
      skyBot: '#fb923c',
      art: `
        <circle cx="126" cy="22" r="10" fill="#fde047"/>
        <polygon points="22,58 58,18 94,58" fill="#d97706"/>
        <polygon points="74,58 106,24 138,58" fill="#b45309"/>
        <path d="M0 58 L160 58 L160 80 L0 80 Z" fill="#eab308"/>
      `,
    },
    victoria_falls: {
      skyTop: '#1e3a8a',
      skyBot: '#38bdf8',
      art: `
        <rect x="0" y="34" width="60" height="46" fill="#14532d"/>
        <rect x="100" y="34" width="60" height="46" fill="#166534"/>
        <rect x="58" y="32" width="44" height="48" fill="#e0f2fe"/>
        <circle cx="80" cy="68" r="18" fill="#ffffff" opacity="0.55"/>
        <path d="M30 34 Q80 20 130 34" stroke="#94a3b8" stroke-width="3" fill="none"/>
      `,
    },
  };

  const sc = scenes[mapId] ?? scenes.africa_open_world;
  return `
    <svg viewBox="0 0 160 80" class="art-svg art-map-svg" aria-hidden="true">
      <defs>
        <linearGradient id="mg-${mapId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${sc.skyTop}"/>
          <stop offset="100%" stop-color="${sc.skyBot}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="80" rx="10" fill="url(#mg-${mapId})"/>
      ${sc.art}
    </svg>
  `;
}
