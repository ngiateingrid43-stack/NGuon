import * as THREE from 'three';
import type { Rarity } from '@shared/types/common';
import type { WeaponId } from '@shared/types/weapon';
import { getWeaponDefinition } from '@shared/weapons/weaponsConfig';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

/**
 * Constructeur modulaire de modèles 3D détaillés pour tout l'arsenal.
 * Utilisé aussi bien en vue première personne (WeaponManager) qu'en vue tierce personne
 * sur les squelettes des héros et bots (VoxelCharacterRig).
 */
export function buildDetailedWeaponModel(
  weaponId: WeaponId,
  rarity: Rarity = 'common',
  thirdPerson = false
): THREE.Group {
  const root = new THREE.Group();
  const model = new THREE.Group();
  const def = getWeaponDefinition(weaponId);
  const rarityHex = RARITY_COLOR[rarity];

  const woodMat = new THREE.MeshStandardMaterial({
    color: def.visual.bodyColor,
    roughness: 0.68,
    metalness: 0.08,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: def.visual.barrelColor,
    roughness: 0.28,
    metalness: 0.85,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.visual.accentColor,
    roughness: 0.24,
    metalness: 0.9,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: '#29170b',
    roughness: 0.88,
    metalness: 0.05,
  });
  const rarityMat = new THREE.MeshStandardMaterial({
    color: rarityHex,
    emissive: rarity === 'common' ? '#000000' : rarityHex,
    emissiveIntensity: rarity === 'common' ? 0 : 0.45,
    roughness: 0.25,
    metalness: 0.75,
  });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = thirdPerson;
    model.add(mesh);
    return mesh;
  };

  if (weaponId === 'machete') {
    // Machette d'Ébène sculptée : pommeau doré, poignée gainée, garde et large lame biseautée
    addBox(0.044, 0.052, 0.18, 0, -0.02, -0.09, gripMat);
    addBox(0.052, 0.06, 0.03, 0, -0.025, 0.01, accentMat);
    addBox(0.11, 0.036, 0.025, 0, 0.005, -0.19, accentMat);
    addBox(0.018, 0.068, 0.48, 0, 0.02, -0.44, metalMat);
    // Tranchant lumineux + rainure gravée
    addBox(0.008, 0.02, 0.46, 0, -0.014, -0.44, rarityMat);
    addBox(0.024, 0.016, 0.14, 0, 0.04, -0.62, metalMat, 0.28, 0, 0);
  } else if (weaponId === 'spear') {
    // Lance Zoulou (Iklwa) : longue hampe en ébène, virole dorée, touffe rouge, large fer de lance
    addBox(0.034, 0.034, 1.05, 0, -0.01, -0.25, woodMat);
    addBox(0.044, 0.044, 0.08, 0, -0.01, -0.78, accentMat);
    addBox(0.056, 0.056, 0.06, 0, -0.01, -0.71, rarityMat);
    // Fer de lance large à arête centrale
    addBox(0.062, 0.014, 0.34, 0, -0.01, -0.97, metalMat);
    addBox(0.024, 0.026, 0.3, 0, -0.01, -0.95, accentMat);
    addBox(0.028, 0.012, 0.1, 0, -0.01, -1.16, metalMat, 0, Math.PI / 4, 0);
  } else if (weaponId === 'war_staff') {
    // Bâton de Combat Nguni : longue hampe ferrée aux deux extrémités + bagues d'or
    addBox(0.036, 0.036, 1.18, 0, -0.01, -0.32, woodMat);
    addBox(0.048, 0.048, 0.14, 0, -0.01, -0.88, metalMat);
    addBox(0.048, 0.048, 0.12, 0, -0.01, 0.24, metalMat);
    addBox(0.052, 0.052, 0.05, 0, -0.01, -0.58, accentMat);
    addBox(0.052, 0.052, 0.05, 0, -0.01, -0.15, rarityMat);
  } else if (weaponId === 'throwing_axes') {
    // Hache de Jet Kpinga : manche sculpté + triple lame croisée en fer forgé
    addBox(0.034, 0.28, 0.034, 0, -0.05, -0.28, gripMat);
    addBox(0.044, 0.04, 0.14, 0, 0.08, -0.31, accentMat);
    addBox(0.016, 0.16, 0.14, 0, 0.1, -0.39, metalMat);
    addBox(0.016, 0.12, 0.1, 0, 0.02, -0.35, rarityMat, 0.45, 0, 0);
  } else if (weaponId === 'double_barrel_shotgun') {
    // Tromblon Double : crosse large, double canon parallèle et bande dorée
    addBox(0.072, 0.1, 0.52, 0, -0.025, -0.17, woodMat);
    addBox(0.034, 0.036, 0.62, -0.022, 0.038, -0.44, metalMat);
    addBox(0.034, 0.036, 0.62, 0.022, 0.038, -0.44, metalMat);
    addBox(0.084, 0.046, 0.04, 0, 0.02, -0.36, rarityMat);
    addBox(0.082, 0.046, 0.04, 0, 0.02, -0.62, accentMat);
  } else if (weaponId === 'royal_long_rifle') {
    // Fusil Long d'Aksoum : long fût sculpté, lunette/viseur laiton & canon allongé
    addBox(0.06, 0.095, 0.68, 0, -0.02, -0.22, woodMat);
    addBox(0.032, 0.034, 0.92, 0, 0.036, -0.58, metalMat);
    addBox(0.028, 0.028, 0.28, 0, 0.076, -0.26, accentMat);
    addBox(0.04, 0.04, 0.05, 0, 0.076, -0.38, rarityMat);
    addBox(0.066, 0.04, 0.03, 0, 0.02, -0.55, accentMat);
  } else if (weaponId === 'short_sword') {
    // Épée courte d'Oyo : poignée nervurée, quillons dorés, double tranchant & gorge gravée
    addBox(0.04, 0.044, 0.17, 0, -0.01, -0.08, gripMat);
    addBox(0.055, 0.055, 0.035, 0, -0.01, 0.02, accentMat);
    addBox(0.16, 0.028, 0.028, 0, -0.005, -0.18, accentMat);
    addBox(0.052, 0.014, 0.44, 0, -0.005, -0.41, metalMat);
    addBox(0.018, 0.022, 0.34, 0, -0.005, -0.37, rarityMat);
  } else if (weaponId === 'war_bow') {
    // Arc de guerre laminé + corde + flèche empennée prête à tirer
    addBox(0.042, 0.22, 0.046, 0, 0, -0.34, gripMat);
    addBox(0.034, 0.28, 0.034, 0, 0.23, -0.29, woodMat, -0.38, 0, 0);
    addBox(0.028, 0.24, 0.026, 0, 0.44, -0.18, accentMat, -0.78, 0, 0);
    addBox(0.034, 0.28, 0.034, 0, -0.23, -0.29, woodMat, 0.38, 0, 0);
    addBox(0.028, 0.24, 0.026, 0, -0.44, -0.18, accentMat, 0.78, 0, 0);
    // Corde tendue
    addBox(0.006, 0.92, 0.006, 0, 0, -0.08, new THREE.MeshStandardMaterial({ color: '#e5e7eb' }));
    // Flèche encochée
    addBox(0.014, 0.014, 0.58, 0.028, 0.02, -0.34, woodMat);
    addBox(0.026, 0.026, 0.07, 0.028, 0.02, -0.64, metalMat);
    addBox(0.032, 0.032, 0.07, 0.028, 0.02, -0.09, rarityMat);
  } else if (weaponId === 'crossbow') {
    // Arbalète du Nil : arbrier sculpté, étrier avant, arcs horizontaux & carreau chargé
    addBox(0.056, 0.075, 0.56, 0, -0.02, -0.26, woodMat);
    addBox(0.048, 0.11, 0.05, 0, -0.08, -0.18, gripMat, 0.25, 0, 0);
    addBox(0.28, 0.028, 0.036, -0.15, 0.02, -0.5, woodMat, 0, 0.28, 0);
    addBox(0.28, 0.028, 0.036, 0.15, 0.02, -0.5, woodMat, 0, -0.28, 0);
    addBox(0.06, 0.034, 0.04, -0.28, 0.02, -0.45, accentMat);
    addBox(0.06, 0.034, 0.04, 0.28, 0.02, -0.45, accentMat);
    // Rail + carreau
    addBox(0.024, 0.022, 0.44, 0, 0.024, -0.34, metalMat);
    addBox(0.014, 0.014, 0.36, 0, 0.038, -0.38, rarityMat);
  } else if (weaponId === 'explosive_sling') {
    // Fronde explosive : fourche sculptée, lanières tressées & charge incandescente
    addBox(0.04, 0.16, 0.04, 0, -0.06, -0.24, woodMat);
    addBox(0.028, 0.14, 0.03, -0.06, 0.05, -0.25, woodMat, 0, 0, 0.4);
    addBox(0.028, 0.14, 0.03, 0.06, 0.05, -0.25, woodMat, 0, 0, -0.4);
    addBox(0.05, 0.05, 0.05, 0, 0.08, -0.28, accentMat);
    const emberMat = new THREE.MeshStandardMaterial({
      color: '#f97316',
      emissive: '#ea580c',
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    addBox(0.065, 0.065, 0.065, 0, 0.08, -0.33, emberMat);
  } else if (weaponId === 'hand_cannon') {
    // Canon de Forge : canon bronze évasé, bagues de fer forgé, crosse lourde & mèche ardente
    addBox(0.085, 0.11, 0.46, 0, -0.03, -0.16, woodMat);
    addBox(0.068, 0.12, 0.06, 0, -0.09, -0.04, gripMat, 0.28, 0, 0);
    // Canon principal épais + gueule évasée (tromblon)
    addBox(0.074, 0.074, 0.44, 0, 0.045, -0.38, metalMat);
    addBox(0.11, 0.11, 0.1, 0, 0.045, -0.62, accentMat);
    // Bagues de renfort
    addBox(0.086, 0.086, 0.035, 0, 0.045, -0.24, rarityMat);
    addBox(0.086, 0.086, 0.035, 0, 0.045, -0.45, rarityMat);
    // Serpentin + mèche incandescente
    const fuseMat = new THREE.MeshStandardMaterial({
      color: '#fb923c',
      emissive: '#f97316',
      emissiveIntensity: 1.0,
    });
    addBox(0.018, 0.05, 0.025, 0.042, 0.09, -0.18, fuseMat, -0.4, 0, 0);
  } else if (weaponId === 'repeating_rifle') {
    // Carabine du Mali : boîtier sculpté, levier d'armement, tube magasin, viseur doré
    addBox(0.058, 0.09, 0.56, 0, -0.025, -0.18, woodMat);
    addBox(0.062, 0.07, 0.2, 0, 0.02, -0.16, metalMat);
    addBox(0.042, 0.042, 0.62, 0, 0.038, -0.48, metalMat);
    addBox(0.032, 0.032, 0.5, 0, 0.005, -0.44, accentMat);
    // Levier d'armement sous la poignée + bande de rareté
    addBox(0.022, 0.06, 0.12, 0, -0.075, -0.13, accentMat);
    addBox(0.068, 0.03, 0.04, 0, 0.025, -0.32, rarityMat);
    // Hausse & guidon précis
    addBox(0.026, 0.024, 0.03, 0, 0.068, -0.18, accentMat);
    addBox(0.012, 0.026, 0.02, 0, 0.068, -0.76, accentMat);
  } else if (weaponId === 'dueling_pistol') {
    addBox(0.044, 0.06, 0.26, 0, -0.01, -0.14, woodMat);
    addBox(0.042, 0.1, 0.05, 0, -0.07, -0.03, gripMat, 0.28, 0, 0);
    addBox(0.032, 0.034, 0.28, 0, 0.03, -0.22, metalMat);
    addBox(0.04, 0.03, 0.03, 0, 0.03, -0.32, rarityMat);
  } else if (weaponId === 'imperial_carbine') {
    addBox(0.06, 0.09, 0.54, 0, -0.02, -0.2, woodMat);
    addBox(0.045, 0.045, 0.62, 0, 0.036, -0.45, metalMat);
    addBox(0.036, 0.14, 0.065, 0, -0.09, -0.24, gripMat, 0.12, 0, 0);
    addBox(0.052, 0.032, 0.14, 0, 0.068, -0.2, accentMat);
    addBox(0.068, 0.03, 0.04, 0, 0.02, -0.38, rarityMat);
  } else if (weaponId === 'siege_gatling') {
    addBox(0.11, 0.11, 0.36, 0, 0, -0.16, metalMat);
    addBox(0.028, 0.028, 0.56, -0.03, 0.03, -0.5, metalMat);
    addBox(0.028, 0.028, 0.56, 0.03, 0.03, -0.5, metalMat);
    addBox(0.028, 0.028, 0.56, 0, -0.02, -0.5, accentMat);
    addBox(0.13, 0.12, 0.1, 0, -0.05, -0.22, rarityMat);
    addBox(0.12, 0.03, 0.04, 0, 0.02, -0.66, accentMat);
  } else if (weaponId === 'incendiary_mortar') {
    addBox(0.1, 0.12, 0.44, 0, -0.02, -0.18, woodMat);
    addBox(0.11, 0.11, 0.48, 0, 0.05, -0.4, metalMat);
    addBox(0.13, 0.13, 0.07, 0, 0.05, -0.64, accentMat);
    addBox(0.08, 0.08, 0.08, 0, 0.05, -0.68, rarityMat);
  } else if (weaponId === 'imperial_sabre') {
    addBox(0.04, 0.14, 0.04, 0, -0.04, -0.08, gripMat);
    addBox(0.11, 0.025, 0.045, 0, 0.02, -0.14, accentMat);
    addBox(0.02, 0.042, 0.62, 0, 0.05, -0.46, metalMat, 0.06, 0, 0);
    addBox(0.024, 0.03, 0.18, 0, 0.07, -0.76, rarityMat, 0.18, 0, 0);
  } else {
    // Mousquet Silex de Gao (par défaut) : bois sculpté, platine à silex, baguette & anneaux or
    addBox(0.064, 0.095, 0.62, 0, -0.02, -0.2, woodMat);
    addBox(0.036, 0.038, 0.68, 0, 0.035, -0.44, metalMat);
    addBox(0.016, 0.016, 0.56, 0, 0.004, -0.44, accentMat);
    // Platine silex latérale + chien
    addBox(0.018, 0.05, 0.12, 0.038, 0.018, -0.14, accentMat);
    addBox(0.014, 0.045, 0.03, 0.045, 0.05, -0.12, metalMat, 0.35, 0, 0);
    // Anneaux gravés or / rareté
    addBox(0.072, 0.055, 0.032, 0, 0.016, -0.3, rarityMat);
    addBox(0.072, 0.055, 0.032, 0, 0.016, -0.54, accentMat);
    addBox(0.014, 0.024, 0.02, 0, 0.062, -0.75, accentMat);
  }

  if (thirdPerson) {
    // En vue 3e personne, l'arme est tenue dans la main droite pointant vers +Z local
    model.rotation.y = Math.PI;
    model.position.set(0, -0.46, 0.16);
    model.scale.setScalar(1.05);
  }
  root.add(model);
  return root;
}
