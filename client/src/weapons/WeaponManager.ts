import * as THREE from 'three';
import type { Rarity } from '@shared/types/common';
import type { CombatantState } from '@shared/types/entity';
import type { WeaponId, WeaponRuntimeState } from '@shared/types/weapon';
import { createInitialWeaponState, getWeaponDefinition } from '@shared/weapons/weaponsConfig';
import type { CollisionManager } from '@client/physics/CollisionManager';
import type { AxisAlignedBox } from '@client/physics/PhysicsManager';
import type { CombatManager } from '@client/combat/CombatManager';
import type { SceneManager } from '@client/renderer/SceneManager';
import type { EventBus } from '@client/core/EventBus';
import type { ProjectileManager } from './ProjectileManager';
import { buildDetailedWeaponModel } from './WeaponModelBuilder';

export interface WeaponShotOutcome {
  fired: boolean;
  hitCombatantId?: string;
  isHeadshot?: boolean;
  isElimination?: boolean;
}

/**
 * Gère les armes : modèle 3D première personne (viewmodel), cadence de tir,
 * dispersion dynamique, rechargement, balistique hitscan et effets de tir.
 */
export class WeaponManager {
  private viewModelRoot = new THREE.Group();
  private weaponGroup = new THREE.Group();
  private currentViewWeaponId: WeaponId | null = null;
  private currentViewRarity: Rarity = 'common';
  private recoilOffsetZ = 0;
  private recoilPitch = 0;
  private reloadTilt = 0;
  private sprintCant = 0;
  private lookSwayX = 0;
  private lookSwayY = 0;
  private muzzleFlashTimer = 0;
  private muzzleFlashMesh: THREE.Group | null = null;
  private swayTime = 0;

  public attachToCamera(camera: THREE.Camera): void {
    camera.add(this.viewModelRoot);
  }

  public syncViewModel(weaponId: WeaponId, rarity: Rarity = 'common'): void {
    if (this.currentViewWeaponId === weaponId && this.currentViewRarity === rarity) return;
    this.currentViewWeaponId = weaponId;
    this.currentViewRarity = rarity;
    this.weaponGroup.clear();

    const detailed = buildDetailedWeaponModel(weaponId, rarity, false);
    this.weaponGroup.add(detailed);

    const def = getWeaponDefinition(weaponId);
    if (def.category !== 'melee') {
      const flashGroup = new THREE.Group();
      const flashMat = new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.92,
      });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), flashMat);
      const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.024), flashMat);
      const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.16, 0.024), flashMat);
      flashGroup.add(core, crossA, crossB);
      flashGroup.position.set(0, 0.03, -(def.visual.length * 0.56 + 0.14));
      flashGroup.visible = false;
      this.muzzleFlashMesh = flashGroup;
      this.weaponGroup.add(flashGroup);
    } else {
      this.muzzleFlashMesh = null;
    }

    this.viewModelRoot.clear();
    this.viewModelRoot.add(this.weaponGroup);
  }

  public updateViewModel(params: {
    dt: number;
    weaponState: WeaponRuntimeState;
    isAiming: boolean;
    isSprinting?: boolean;
    moveSpeed: number;
    isAlive: boolean;
    rarity?: Rarity;
    lookDeltaX?: number;
    lookDeltaY?: number;
  }): void {
    const {
      dt,
      weaponState,
      isAiming,
      isSprinting = false,
      moveSpeed,
      isAlive,
      rarity = 'common',
      lookDeltaX = 0,
      lookDeltaY = 0,
    } = params;
    this.viewModelRoot.visible = isAlive;
    if (!isAlive) return;

    this.syncViewModel(weaponState.weaponId, rarity);

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashMesh) {
        this.muzzleFlashMesh.visible = this.muzzleFlashTimer > 0;
        this.muzzleFlashMesh.rotation.z += dt * 42;
      }
    } else if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.visible = false;
    }

    this.recoilOffsetZ = THREE.MathUtils.lerp(this.recoilOffsetZ, 0, Math.min(1, dt * 15));
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, dt * 13));

    const targetReloadTilt = weaponState.isReloading ? -0.58 : 0;
    this.reloadTilt = THREE.MathUtils.lerp(this.reloadTilt, targetReloadTilt, Math.min(1, dt * 10));

    const targetSprintCant = isSprinting && !isAiming && !weaponState.isReloading && moveSpeed > 5 ? 1 : 0;
    this.sprintCant = THREE.MathUtils.lerp(this.sprintCant, targetSprintCant, Math.min(1, dt * 11));

    this.lookSwayX = THREE.MathUtils.lerp(
      this.lookSwayX,
      THREE.MathUtils.clamp(-lookDeltaX * 0.45, -0.045, 0.045),
      Math.min(1, dt * 14)
    );
    this.lookSwayY = THREE.MathUtils.lerp(
      this.lookSwayY,
      THREE.MathUtils.clamp(lookDeltaY * 0.45, -0.035, 0.035),
      Math.min(1, dt * 14)
    );

    this.swayTime += dt * (moveSpeed > 0.6 ? (isSprinting ? 12 : 9) : 2.2);
    const swayAmt = moveSpeed > 0.6 ? (isAiming ? 0.0025 : isSprinting ? 0.015 : 0.009) : 0.002;

    const targetX = (isAiming ? 0.0 : 0.25) - this.sprintCant * 0.06;
    const targetY = (isAiming ? -0.135 : -0.19) - this.sprintCant * 0.035;
    const targetZ = (isAiming ? -0.34 : -0.4) + this.sprintCant * 0.03;

    this.weaponGroup.position.x = THREE.MathUtils.lerp(
      this.weaponGroup.position.x,
      targetX + Math.cos(this.swayTime * 0.5) * swayAmt + this.lookSwayX,
      Math.min(1, dt * 16)
    );
    this.weaponGroup.position.y = THREE.MathUtils.lerp(
      this.weaponGroup.position.y,
      targetY +
        Math.sin(this.swayTime) * swayAmt +
        (weaponState.isReloading ? -0.06 : 0) +
        this.lookSwayY,
      Math.min(1, dt * 16)
    );
    this.weaponGroup.position.z = THREE.MathUtils.lerp(
      this.weaponGroup.position.z,
      targetZ + this.recoilOffsetZ,
      Math.min(1, dt * 18)
    );
    this.weaponGroup.rotation.x = this.recoilPitch + this.reloadTilt - this.sprintCant * 0.14;
    this.weaponGroup.rotation.y = this.sprintCant * 0.36 - this.lookSwayX * 0.5;
  }

  public tickWeaponTimers(state: WeaponRuntimeState, dt: number): boolean {
    if (state.fireCooldown > 0) {
      state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    }

    if (state.isReloading) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        const def = getWeaponDefinition(state.weaponId);
        const needed = def.stats.magazineSize - state.ammoInMag;
        const transfer = Math.min(needed, state.reserveAmmo);
        state.ammoInMag += transfer;
        state.reserveAmmo -= transfer;
        state.isReloading = false;
        state.reloadTimer = 0;
        return true; // Rechargement terminé
      }
    }
    return false;
  }

  public startReload(state: WeaponRuntimeState, speedMultiplier = 1.0): boolean {
    const def = getWeaponDefinition(state.weaponId);
    if (def.category === 'melee') return false;
    if (state.isReloading) return false;
    if (state.ammoInMag >= def.stats.magazineSize) return false;
    if (state.reserveAmmo <= 0) return false;

    state.isReloading = true;
    state.reloadTimer = def.stats.reloadTime / Math.max(0.5, speedMultiplier);
    return true;
  }

  public computeSpread(params: {
    weaponId: WeaponId;
    horizontalSpeed: number;
    isAiming: boolean;
    isCrouching: boolean;
  }): number {
    const def = getWeaponDefinition(params.weaponId);
    let spread = def.stats.baseSpread;
    if (params.horizontalSpeed > 0.8) {
      spread += def.stats.moveSpreadPenalty * Math.min(1, params.horizontalSpeed / 8);
    }
    if (params.isAiming) {
      spread *= def.stats.adsSpreadMultiplier;
    }
    if (params.isCrouching) {
      spread *= 0.72;
    }
    return spread;
  }

  public fireWeapon(params: {
    shooter: CombatantState;
    origin: { x: number; y: number; z: number };
    forwardDir: { x: number; y: number; z: number };
    isAiming: boolean;
    colliders: readonly AxisAlignedBox[];
    combatants: readonly CombatantState[];
    collisionManager: CollisionManager;
    combatManager: CombatManager;
    sceneManager?: SceneManager;
    projectileManager?: ProjectileManager;
    eventBus?: EventBus;
    muzzleWorldPos?: THREE.Vector3;
    damageMultiplier?: number;
    rarity?: Rarity;
    reloadSpeedMultiplier?: number;
    getTargetResistance?: (target: CombatantState) => number;
    getTargetShieldAbsorb?: (target: CombatantState, dmg: number) => number;
  }): WeaponShotOutcome {
    const {
      shooter,
      origin,
      forwardDir,
      isAiming,
      colliders,
      combatants,
      collisionManager,
      combatManager,
      sceneManager,
      projectileManager,
      eventBus,
      muzzleWorldPos,
      damageMultiplier = 1,
      rarity,
      reloadSpeedMultiplier = 1,
      getTargetResistance,
      getTargetShieldAbsorb,
    } = params;

    const state = shooter.activeWeapon;
    const def = getWeaponDefinition(state.weaponId);

    if (!shooter.isAlive || state.isReloading || state.fireCooldown > 0) {
      return { fired: false };
    }

    const isMelee = def.category === 'melee';
    if (!isMelee && state.ammoInMag <= 0) {
      this.startReload(state, reloadSpeedMultiplier);
      return { fired: false };
    }

    // Consommer une munition (sauf mêlée) et appliquer la cadence
    if (!isMelee) {
      state.ammoInMag -= 1;
    }
    state.fireCooldown = 1 / def.stats.fireRate;
    shooter.stats.shotsFired += 1;

    if (!shooter.isBot) {
      this.recoilOffsetZ = isMelee ? -0.14 : 0.085;
      this.recoilPitch = isMelee ? -0.32 : 0.075;
      if (!isMelee) {
        this.muzzleFlashTimer = 0.045;
      }
    }

    const horizSpeed = Math.hypot(shooter.velocity.x, shooter.velocity.z);
    const spread = this.computeSpread({
      weaponId: state.weaponId,
      horizontalSpeed: horizSpeed,
      isAiming,
      isCrouching: shooter.isCrouching,
    });

    // Cas arme à projectile physique (Arc, Arbalète, Fronde explosive)
    if (def.stats.projectileSpeed > 0 && projectileManager) {
      const dir = this.applySpread(forwardDir, spread);
      projectileManager.spawnWeaponProjectile({
        ownerId: shooter.id,
        weaponId: state.weaponId,
        origin,
        direction: dir,
        scene: sceneManager?.scene,
      });
      eventBus?.emit('weapon:fired', { weaponId: state.weaponId, isPlayer: !shooter.isBot });
      if (state.ammoInMag === 0 && state.reserveAmmo > 0) {
        this.startReload(state, reloadSpeedMultiplier);
      }
      return { fired: true };
    }

    let lastHitCombatantId: string | undefined;
    let anyHeadshot = false;
    let anyElimination = false;

    for (let i = 0; i < def.stats.pelletCount; i++) {
      const dir = this.applySpread(forwardDir, spread);
      const result = collisionManager.raycastShot({
        origin,
        direction: dir,
        maxDistance: def.stats.range,
        shooterId: shooter.id,
        colliders,
        combatants,
      });

      if (sceneManager && !isMelee) {
        const start =
          muzzleWorldPos ?? new THREE.Vector3(origin.x, origin.y - 0.08, origin.z);
        const end = new THREE.Vector3(result.point.x, result.point.y, result.point.z);
        sceneManager.spawnShotTracer(start, end, shooter.isBot);
        if (result.hit) {
          sceneManager.spawnImpactBurst(
            end,
            new THREE.Vector3(result.normal.x, result.normal.y, result.normal.z),
            result.hitType === 'combatant',
            result.hitZone
          );
        }
      }

      if (result.hitType === 'combatant' && result.combatantId) {
        const target = combatants.find((c) => c.id === result.combatantId);
        if (target && (!shooter.team || target.team !== shooter.team)) {
          const dmg = combatManager.applyDamage({
            attacker: shooter,
            target,
            weaponId: state.weaponId,
            rarity,
            isHeadshot: Boolean(result.isHeadshot),
            hitZone: result.hitZone,
            hitPoint: result.point,
            sourceDirection: dir,
            damageMultiplier,
            resistance: getTargetResistance ? getTargetResistance(target) : 0,
            absorbShield: getTargetShieldAbsorb
              ? (val) => getTargetShieldAbsorb(target, val)
              : undefined,
          });
          if (dmg) {
            lastHitCombatantId = target.id;
            if (dmg.isHeadshot) anyHeadshot = true;
            if (dmg.isElimination) anyElimination = true;
          }
        }
      }
    }

    eventBus?.emit('weapon:fired', { weaponId: state.weaponId, isPlayer: !shooter.isBot });
    if (!shooter.isBot && lastHitCombatantId) {
      eventBus?.emit('combat:hitmarker', {
        isHeadshot: anyHeadshot,
        isElimination: anyElimination,
      });
    }

    // Rechargement automatique si chargeur vide
    if (!isMelee && state.ammoInMag === 0 && state.reserveAmmo > 0) {
      this.startReload(state, reloadSpeedMultiplier);
    }

    return {
      fired: true,
      hitCombatantId: lastHitCombatantId,
      isHeadshot: anyHeadshot,
      isElimination: anyElimination,
    };
  }

  public switchWeapon(state: CombatantState, newWeaponId: WeaponId): void {
    state.activeWeapon = createInitialWeaponState(newWeaponId);
  }

  private applySpread(
    dir: { x: number; y: number; z: number },
    spreadRad: number
  ): { x: number; y: number; z: number } {
    if (spreadRad <= 0) return { ...dir };
    const rx = (Math.random() - 0.5) * 2 * spreadRad;
    const ry = (Math.random() - 0.5) * 2 * spreadRad;
    const rz = (Math.random() - 0.5) * 2 * spreadRad;
    const nx = dir.x + rx;
    const ny = dir.y + ry;
    const nz = dir.z + rz;
    const len = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / len, y: ny / len, z: nz / len };
  }
}
