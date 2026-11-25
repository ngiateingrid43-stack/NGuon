import * as THREE from 'three';
import type { Vec3 } from '@shared/types/common';
import type { CombatantState } from '@shared/types/entity';
import type { AxisAlignedBox } from '@shared/physics/types';
import { raycastWorldAndCombatants } from '@shared/physics/AabbCollision';
import type { WeaponId } from '@shared/types/weapon';
import { CONSUMABLES_CONFIG, getWeaponDefinition } from '@shared/weapons/weaponsConfig';

export interface ActiveProjectile {
  id: string;
  ownerId: string;
  kind: 'arrow' | 'bolt' | 'sling_charge' | 'frag_grenade' | 'incendiary_potion';
  weaponId?: WeaponId;
  position: Vec3;
  velocity: Vec3;
  gravity: number;
  damage: number;
  explosionRadius: number;
  ttl: number;
  isIncendiary: boolean;
  mesh?: THREE.Mesh;
}

export interface FireHazardZone {
  id: string;
  ownerId: string;
  position: Vec3;
  radius: number;
  damagePerSecond: number;
  ttl: number;
  tickTimer: number;
  mesh?: THREE.Mesh;
}

export interface ProjectileImpactEvent {
  ownerId: string;
  hitPoint: Vec3;
  directTargetId?: string;
  isHeadshot?: boolean;
  explosionRadius: number;
  damage: number;
  isIncendiary: boolean;
  weaponId?: WeaponId;
}

/**
 * Gère les projectiles balistiques physiques (arcs, arbalète, fronde, grenades, potions)
 * ainsi que les zones incendiaires temporaires.
 */
export class ProjectileManager {
  private projectiles: ActiveProjectile[] = [];
  private fireZones: FireHazardZone[] = [];
  private seq = 0;

  public spawnWeaponProjectile(params: {
    ownerId: string;
    weaponId: WeaponId;
    origin: Vec3;
    direction: Vec3;
    scene?: THREE.Scene;
  }): ActiveProjectile {
    const def = getWeaponDefinition(params.weaponId);
    const speed = Math.max(25, def.stats.projectileSpeed);
    const kind =
      params.weaponId === 'war_bow'
        ? 'arrow'
        : params.weaponId === 'crossbow'
          ? 'bolt'
          : 'sling_charge';

    const proj: ActiveProjectile = {
      id: `proj_${++this.seq}`,
      ownerId: params.ownerId,
      kind,
      weaponId: params.weaponId,
      position: { ...params.origin },
      velocity: {
        x: params.direction.x * speed,
        y: params.direction.y * speed + (kind === 'sling_charge' ? 2.2 : 0.8),
        z: params.direction.z * speed,
      },
      gravity: kind === 'sling_charge' ? -15 : -7.5,
      damage: def.stats.damage,
      explosionRadius: def.stats.explosionRadius ?? 0,
      ttl: 4.0,
      isIncendiary: params.weaponId === 'incendiary_mortar',
    };

    if (params.scene) {
      const color = kind === 'sling_charge' ? '#fb923c' : '#fde047';
      const geo =
        kind === 'sling_charge'
          ? new THREE.BoxGeometry(0.18, 0.18, 0.18)
          : new THREE.BoxGeometry(0.06, 0.06, 0.45);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(proj.position.x, proj.position.y, proj.position.z);
      mesh.lookAt(
        proj.position.x + params.direction.x,
        proj.position.y + params.direction.y,
        proj.position.z + params.direction.z
      );
      params.scene.add(mesh);
      proj.mesh = mesh;
    }

    this.projectiles.push(proj);
    return proj;
  }

  public spawnThrowable(params: {
    ownerId: string;
    itemId: 'frag_grenade' | 'incendiary_potion';
    origin: Vec3;
    direction: Vec3;
    scene?: THREE.Scene;
  }): ActiveProjectile {
    const def = CONSUMABLES_CONFIG[params.itemId];
    const proj: ActiveProjectile = {
      id: `throw_${++this.seq}`,
      ownerId: params.ownerId,
      kind: params.itemId,
      position: { ...params.origin },
      velocity: {
        x: params.direction.x * def.throwSpeed,
        y: params.direction.y * def.throwSpeed + 4.5,
        z: params.direction.z * def.throwSpeed,
      },
      gravity: -20,
      damage: def.damage,
      explosionRadius: def.radius,
      ttl: def.durationSeconds,
      isIncendiary: params.itemId === 'incendiary_potion',
    };

    if (params.scene) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: proj.isIncendiary ? '#ea580c' : '#000000',
          emissiveIntensity: 0.7,
        })
      );
      mesh.position.set(proj.position.x, proj.position.y, proj.position.z);
      params.scene.add(mesh);
      proj.mesh = mesh;
    }

    this.projectiles.push(proj);
    return proj;
  }

  public update(params: {
    dt: number;
    colliders: readonly AxisAlignedBox[];
    combatants: readonly CombatantState[];
    scene?: THREE.Scene;
    onImpact: (impact: ProjectileImpactEvent) => void;
    onFireBurn?: (ownerId: string, target: CombatantState, damage: number) => void;
  }): void {
    const { dt, colliders, combatants, scene, onImpact, onFireBurn } = params;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= dt;
      p.velocity.y += p.gravity * dt;

      const stepVec = {
        x: p.velocity.x * dt,
        y: p.velocity.y * dt,
        z: p.velocity.z * dt,
      };
      const stepDist = Math.hypot(stepVec.x, stepVec.y, stepVec.z);

      let impacted = false;
      if (stepDist > 0.001) {
        const dir = {
          x: stepVec.x / stepDist,
          y: stepVec.y / stepDist,
          z: stepVec.z / stepDist,
        };
        const hit = raycastWorldAndCombatants({
          origin: p.position,
          direction: dir,
          maxDistance: stepDist,
          shooterId: p.ownerId,
          colliders,
          combatants,
        });

        if (hit.hit) {
          impacted = true;
          p.position = { ...hit.point };

          if (p.kind === 'frag_grenade' && hit.hitType === 'world' && p.ttl > 0.15) {
            // Rebond léger de la grenade avant détonation
            impacted = false;
            p.velocity.x *= 0.45;
            p.velocity.z *= 0.45;
            p.velocity.y = Math.abs(p.velocity.y) * 0.35;
          } else {
            onImpact({
              ownerId: p.ownerId,
              hitPoint: hit.point,
              directTargetId: hit.combatantId,
              isHeadshot: hit.isHeadshot,
              explosionRadius: p.explosionRadius,
              damage: p.damage,
              isIncendiary: p.isIncendiary,
              weaponId: p.weaponId,
            });
          }
        }
      }

      if (!impacted) {
        p.position.x += stepVec.x;
        p.position.y += stepVec.y;
        p.position.z += stepVec.z;
        if (p.mesh) {
          p.mesh.position.set(p.position.x, p.position.y, p.position.z);
        }
      }

      if (impacted || p.ttl <= 0) {
        if (!impacted && p.explosionRadius > 0) {
          onImpact({
            ownerId: p.ownerId,
            hitPoint: p.position,
            explosionRadius: p.explosionRadius,
            damage: p.damage,
            isIncendiary: p.isIncendiary,
            weaponId: p.weaponId,
          });
        }
        if (p.isIncendiary) {
          this.spawnFireZone(p.ownerId, p.position, p.explosionRadius, scene);
        }
        if (p.mesh && scene) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Zones de feu (potion incendiaire)
    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const fz = this.fireZones[i];
      fz.ttl -= dt;
      fz.tickTimer -= dt;
      if (fz.tickTimer <= 0) {
        fz.tickTimer = 0.5;
        for (const c of combatants) {
          if (!c.isAlive) continue;
          const d = Math.hypot(c.position.x - fz.position.x, c.position.z - fz.position.z);
          if (d <= fz.radius && Math.abs(c.position.y - fz.position.y) < 2.2) {
            onFireBurn?.(fz.ownerId, c, Math.round(fz.damagePerSecond * 0.5));
          }
        }
      }
      if (fz.ttl <= 0) {
        if (fz.mesh && scene) {
          scene.remove(fz.mesh);
          fz.mesh.geometry.dispose();
          (fz.mesh.material as THREE.Material).dispose();
        }
        this.fireZones.splice(i, 1);
      }
    }
  }

  private spawnFireZone(
    ownerId: string,
    pos: Vec3,
    radius: number,
    scene?: THREE.Scene
  ): void {
    const fz: FireHazardZone = {
      id: `fire_${++this.seq}`,
      ownerId,
      position: { ...pos },
      radius,
      damagePerSecond: 18,
      ttl: 3.5,
      tickTimer: 0.1,
    };
    if (scene) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.14, 16),
        new THREE.MeshBasicMaterial({
          color: '#f97316',
          transparent: true,
          opacity: 0.45,
        })
      );
      mesh.position.set(pos.x, Math.max(0.08, pos.y + 0.08), pos.z);
      scene.add(mesh);
      fz.mesh = mesh;
    }
    this.fireZones.push(fz);
  }

  public getActiveCount(): number {
    return this.projectiles.length;
  }

  public clear(scene?: THREE.Scene): void {
    for (const p of this.projectiles) {
      if (p.mesh && scene) scene.remove(p.mesh);
    }
    for (const f of this.fireZones) {
      if (f.mesh && scene) scene.remove(f.mesh);
    }
    this.projectiles = [];
    this.fireZones = [];
  }
}
