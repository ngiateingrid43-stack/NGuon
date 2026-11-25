import * as THREE from 'three';
import { RARITY_COLORS } from '@shared/constants/game';
import type { Rarity, Vec3 } from '@shared/types/common';
import type { ConsumableId, ShieldId, WorldLootDrop } from '@shared/types/inventory';
import type { WeaponId } from '@shared/types/weapon';
import { WEAPONS_CONFIG } from '@shared/weapons/weaponsConfig';

interface LootMeshEntry {
  drop: WorldLootDrop;
  group: THREE.Group;
}

const LOOT_WEAPON_POOL: WeaponId[] = [
  'repeating_rifle',
  'hand_cannon',
  'double_barrel_shotgun',
  'royal_long_rifle',
  'dueling_pistol',
  'imperial_carbine',
  'siege_gatling',
  'incendiary_mortar',
  'war_bow',
  'crossbow',
  'explosive_sling',
  'throwing_axes',
  'spear',
  'short_sword',
  'war_staff',
  'imperial_sabre',
];

const LOOT_RARITY_POOL: Rarity[] = ['common', 'common', 'rare', 'rare', 'epic', 'legendary'];

/**
 * Gère le loot au sol, les raretés visuelles et l'ouverture des coffres d'équipement.
 */
export class LootManager {
  private drops: LootMeshEntry[] = [];
  private seq = 0;

  public spawnDrop(drop: Omit<WorldLootDrop, 'id' | 'createdAt'>, scene?: THREE.Scene): WorldLootDrop {
    const full: WorldLootDrop = {
      ...drop,
      id: `loot_${++this.seq}`,
      createdAt: Date.now(),
    };

    const group = new THREE.Group();
    if (scene) {
      const color = RARITY_COLORS[full.rarity];
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.35, 0.55),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.45,
          roughness: 0.35,
          metalness: 0.45,
        })
      );
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 })
      );
      beacon.position.y = 0.65;
      group.add(box, beacon);
      group.position.set(full.position.x, full.position.y + 0.3, full.position.z);
      scene.add(group);
    }

    this.drops.push({ drop: full, group });
    return full;
  }

  public spawnChestRewards(position: Vec3, scene?: THREE.Scene): WorldLootDrop[] {
    const weaponId = LOOT_WEAPON_POOL[Math.floor(Math.random() * LOOT_WEAPON_POOL.length)];
    const rarity = LOOT_RARITY_POOL[Math.floor(Math.random() * LOOT_RARITY_POOL.length)];
    const itemId: ConsumableId = Math.random() < 0.55 ? 'frag_grenade' : 'incendiary_potion';
    const shieldId: ShieldId = Math.random() < 0.6 ? 'wooden_shield' : 'metal_shield';

    const spawned: WorldLootDrop[] = [
      this.spawnDrop(
        {
          kind: 'weapon',
          rarity,
          weaponId,
          amount: 1,
          position: { x: position.x - 0.8, y: position.y, z: position.z },
        },
        scene
      ),
      this.spawnDrop(
        {
          kind: 'item',
          rarity: itemId === 'incendiary_potion' ? 'epic' : 'rare',
          itemId,
          amount: 1,
          position: { x: position.x + 0.8, y: position.y, z: position.z },
        },
        scene
      ),
    ];

    if (Math.random() < 0.75) {
      spawned.push(
        this.spawnDrop(
          {
            kind: 'shield',
            rarity: shieldId === 'metal_shield' ? 'epic' : 'common',
            shieldId,
            amount: 1,
            position: { x: position.x, y: position.y, z: position.z + 0.8 },
          },
          scene
        )
      );
    }

    return spawned;
  }

  public findNearestDrop(position: Vec3, maxDist = 2.4): WorldLootDrop | null {
    let best: WorldLootDrop | null = null;
    let bestDist = maxDist;
    for (const entry of this.drops) {
      const d = Math.hypot(
        entry.drop.position.x - position.x,
        entry.drop.position.z - position.z
      );
      if (d < bestDist && Math.abs(entry.drop.position.y - position.y) < 1.8) {
        bestDist = d;
        best = entry.drop;
      }
    }
    return best;
  }

  public describeDrop(drop: WorldLootDrop, lang: 'fr' | 'en'): string {
    if (drop.kind === 'weapon' && drop.weaponId) {
      const def = WEAPONS_CONFIG[drop.weaponId];
      return `${lang === 'fr' ? def.nameFr : def.nameEn} (${drop.rarity.toUpperCase()})`;
    }
    if (drop.kind === 'item' && drop.itemId) {
      return drop.itemId === 'frag_grenade'
        ? lang === 'fr'
          ? 'Grenade de siège'
          : 'Siege Grenade'
        : lang === 'fr'
          ? 'Potion incendiaire'
          : 'Incendiary Potion';
    }
    if (drop.kind === 'shield' && drop.shieldId) {
      return drop.shieldId === 'metal_shield'
        ? lang === 'fr'
          ? 'Bouclier métallique'
          : 'Metal Shield'
        : lang === 'fr'
          ? 'Bouclier en bois'
          : 'Wooden Shield';
    }
    return drop.kind;
  }

  public removeDrop(dropId: string, scene?: THREE.Scene): void {
    const idx = this.drops.findIndex((d) => d.drop.id === dropId);
    if (idx === -1) return;
    const entry = this.drops[idx];
    if (scene) {
      scene.remove(entry.group);
    }
    this.drops.splice(idx, 1);
  }

  public update(elapsedTime: number, dt: number): void {
    for (const entry of this.drops) {
      entry.group.rotation.y += dt * 1.8;
      entry.group.position.y =
        entry.drop.position.y + 0.3 + Math.sin(elapsedTime * 3 + entry.drop.position.x) * 0.08;
    }
  }

  public getDrops(): WorldLootDrop[] {
    return this.drops.map((d) => d.drop);
  }

  public clear(scene?: THREE.Scene): void {
    if (scene) {
      for (const entry of this.drops) {
        scene.remove(entry.group);
      }
    }
    this.drops = [];
  }
}
