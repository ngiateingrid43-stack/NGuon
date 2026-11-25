import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '@shared/constants/game';
import type { CombatantState } from '@shared/types/entity';
import type { PlayerInventory } from '@shared/types/inventory';
import type { InputSnapshot } from '@client/input/InputManager';
import type { PhysicsManager } from '@client/physics/PhysicsManager';
import type { WeaponManager } from '@client/weapons/WeaponManager';
import type { InventoryManager } from '@client/weapons/InventoryManager';
import type { ProjectileManager } from '@client/weapons/ProjectileManager';
import type { LootManager } from '@client/loot/LootManager';
import type { MapLoader } from '@client/maps/MapLoader';
import type { HeroManager } from '@client/heroes/HeroManager';
import type { CollisionManager } from '@client/physics/CollisionManager';
import type { CombatManager } from '@client/combat/CombatManager';
import type { SceneManager } from '@client/renderer/SceneManager';
import type { CameraController } from '@client/renderer/CameraController';
import type { AudioManager } from '@client/audio/AudioManager';
import type { EventBus } from '@client/core/EventBus';
import type { WeaponId } from '@shared/types/weapon';
import { getWeaponDefinition } from '@shared/weapons/weaponsConfig';

/**
 * Contrôleur du joueur local : déplacements FPS, inventaire (2 armes, objet, bouclier),
 * pouvoirs du héros (Q), lancer de grenades/potions (G), interaction loot/coffres (E).
 */
export class PlayerController {
  private slideTimer = 0;
  private slideCooldown = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private slideDir = { x: 0, z: 0 };
  private footstepTimer = 0;
  private slotWeapons: [WeaponId, WeaponId] = ['flintlock_musket', 'machete'];
  private activeSlot = 0;
  private readonly scratchVecA = new THREE.Vector3();
  private readonly scratchVecB = new THREE.Vector3();
  private readonly scratchVecC = new THREE.Vector3();

  public setWeaponLoadout(primary: WeaponId, secondary: WeaponId): void {
    this.slotWeapons = [primary, secondary];
    this.activeSlot = 0;
  }

  public getWeaponSlots(): [WeaponId, WeaponId] {
    return this.slotWeapons;
  }

  public getActiveSlot(): number {
    return this.activeSlot;
  }

  public update(params: {
    dt: number;
    player: CombatantState;
    inventory: PlayerInventory;
    inventoryManager: InventoryManager;
    heroManager: HeroManager;
    projectileManager: ProjectileManager;
    lootManager: LootManager;
    mapLoader: MapLoader;
    input: InputSnapshot;
    allCombatants: CombatantState[];
    physics: PhysicsManager;
    weaponManager: WeaponManager;
    collisionManager: CollisionManager;
    combatManager: CombatManager;
    sceneManager: SceneManager;
    cameraController: CameraController;
    audioManager: AudioManager;
    eventBus: EventBus;
    aimAssistEnabled?: boolean;
    getTargetShieldAbsorb?: (target: CombatantState, dmg: number) => number;
  }): {
    isAiming: boolean;
    interactionPrompt: string | null;
    targetHover: 'none' | 'enemy' | 'ally';
    hoveredTargetName: string | null;
  } {
    const {
      dt,
      player,
      inventory,
      inventoryManager,
      heroManager,
      projectileManager,
      lootManager,
      mapLoader,
      input,
      allCombatants,
      physics,
      weaponManager,
      collisionManager,
      combatManager,
      sceneManager,
      cameraController,
      audioManager,
      eventBus,
      aimAssistEnabled = true,
      getTargetShieldAbsorb,
    } = params;

    if (!player.isAlive) {
      return {
        isAiming: false,
        interactionPrompt: null,
        targetHover: 'none',
        hoveredTargetName: null,
      };
    }

    // 1. Rotation caméra (Yaw / Pitch) + ralentissement sur cible si aide à la visée active
    const camPos = cameraController.camera.position;
    const preForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraController.camera.quaternion).normalize();
    const preWeapon = getWeaponDefinition(player.activeWeapon.weaponId);
    const hoverPrecheck = collisionManager.raycastShot({
      origin: { x: camPos.x, y: camPos.y, z: camPos.z },
      direction: { x: preForward.x, y: preForward.y, z: preForward.z },
      maxDistance: Math.max(45, preWeapon.stats.range),
      shooterId: player.id,
      colliders: physics.getColliders(),
      combatants: allCombatants,
    });
    const hoveringEnemyPre =
      hoverPrecheck.hitType === 'combatant' &&
      hoverPrecheck.combatantId !== undefined &&
      allCombatants.some(
        (c) => c.id === hoverPrecheck.combatantId && (!player.team || c.team !== player.team)
      );

    const sensScale = aimAssistEnabled && hoveringEnemyPre ? 0.58 : 1.0;
    player.yaw -= input.lookDeltaX * sensScale;
    player.pitch = THREE.MathUtils.clamp(
      player.pitch - input.lookDeltaY * sensScale,
      -Math.PI / 2 + 0.06,
      Math.PI / 2 - 0.06
    );

    // 2. Changement d'arme via la molette ou touches 1 / 2 / 3
    if (input.wheelDelta !== 0) {
      const slot = inventoryManager.cycleWeaponSlot(inventory, input.wheelDelta > 0 ? 1 : -1);
      if (slot) {
        player.activeWeapon = slot.state;
        this.activeSlot = inventory.activeWeaponIndex;
        audioManager.playReload();
      }
    } else if (input.switchSlot1 && inventory.activeWeaponIndex !== 0 && inventory.weaponSlots[0]) {
      const slot = inventoryManager.switchWeaponSlot(inventory, 0);
      if (slot) {
        player.activeWeapon = slot.state;
        this.activeSlot = 0;
        audioManager.playReload();
      }
    } else if (input.switchSlot2 && inventory.activeWeaponIndex !== 1 && inventory.weaponSlots[1]) {
      const slot = inventoryManager.switchWeaponSlot(inventory, 1);
      if (slot) {
        player.activeWeapon = slot.state;
        this.activeSlot = 1;
        audioManager.playReload();
      }
    } else if (input.switchSlot3 && inventory.activeWeaponIndex !== 2 && inventory.weaponSlots[2]) {
      const slot = inventoryManager.switchWeaponSlot(inventory, 2);
      if (slot) {
        player.activeWeapon = slot.state;
        this.activeSlot = 2;
        audioManager.playReload();
      }
    }

    // Abandon d'arme (touche X)
    if (input.dropWeapon) {
      const dropped = inventoryManager.dropActiveWeapon(inventory);
      if (dropped) {
        const dropPos = {
          x: player.position.x - Math.sin(player.yaw) * 1.4,
          y: player.position.y,
          z: player.position.z - Math.cos(player.yaw) * 1.4,
        };
        lootManager.spawnDrop(
          {
            kind: 'weapon',
            rarity: dropped.rarity,
            weaponId: dropped.weaponId,
            amount: 1,
            position: dropPos,
          },
          sceneManager.scene
        );
        const nextActive = inventoryManager.getActiveWeaponSlot(inventory);
        if (nextActive) player.activeWeapon = nextActive.state;
      }
    }

    // 3. Rechargement manuel avec bonus passif d'Ogun
    const reloadMult = heroManager.getReloadMultiplier(player);
    if (input.reload) {
      if (weaponManager.startReload(player.activeWeapon, reloadMult)) {
        audioManager.playReload();
      }
    }
    const reloadCompleted = weaponManager.tickWeaponTimers(player.activeWeapon, dt);
    if (reloadCompleted) {
      eventBus.emit('weapon:reloaded', { weaponId: player.activeWeapon.weaponId });
    }

    // 4. Pouvoir actif du héros (touche Q)
    if (input.useAbility) {
      const res = heroManager.activateAbility({
        caster: player,
        allCombatants,
        scene: sceneManager.scene,
      });
      if (res.activated) {
        audioManager.playAbility();
        for (const victim of res.shockwaveHits) {
          combatManager.applyDirectDamage({
            attacker: player,
            target: victim,
            sourceLabel: 'Ruée du buffle',
            damage: 35,
            hitPoint: victim.position,
            sourceDirection: { x: 0, y: 1, z: 0 },
            resistance: heroManager.getPassiveDamageResistance(victim),
          });
        }
      }
    }

    // 5. Utilisation d'objet consommable (Grenade / Potion incendiaire : touche G)
    if (input.useItem) {
      const itemId = inventoryManager.consumeItem(inventory);
      if (itemId) {
        const cam = cameraController.camera;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        projectileManager.spawnThrowable({
          ownerId: player.id,
          itemId,
          origin: { x: cam.position.x, y: cam.position.y - 0.1, z: cam.position.z },
          direction: { x: forward.x, y: forward.y, z: forward.z },
          scene: sceneManager.scene,
        });
        audioManager.playReload();
      }
    }

    // 6. Interaction contextuelle coffres & loot au sol (touche E)
    const nearChest = mapLoader.findNearestChest(player.position);
    const nearDrop = lootManager.findNearestDrop(player.position);
    let interactionPrompt: string | null = null;
    if (nearChest) {
      interactionPrompt = 'Touche E · Ouvrir le coffre';
    } else if (nearDrop) {
      interactionPrompt = `Touche E · Ramasser : ${lootManager.describeDrop(nearDrop, 'fr')}`;
    }

    if (input.interact) {
      if (nearChest) {
        if (mapLoader.tryOpenChest(nearChest.id, sceneManager, lootManager)) {
          audioManager.playPickup();
        }
      } else if (nearDrop) {
        let taken = false;
        if (nearDrop.kind === 'weapon' && nearDrop.weaponId) {
          const res = inventoryManager.pickupWeapon(
            inventory,
            nearDrop.weaponId,
            nearDrop.rarity
          );
          if (res.pickedUp) {
            const active = inventoryManager.getActiveWeaponSlot(inventory);
            if (active) player.activeWeapon = active.state;
            if (res.replaced) {
              lootManager.spawnDrop(
                {
                  kind: 'weapon',
                  rarity: res.replaced.rarity,
                  weaponId: res.replaced.weaponId,
                  amount: 1,
                  position: { ...nearDrop.position },
                },
                sceneManager.scene
              );
            }
            taken = true;
          }
        } else if (nearDrop.kind === 'item' && nearDrop.itemId) {
          const res = inventoryManager.pickupConsumable(inventory, nearDrop.itemId, nearDrop.amount);
          taken = res.pickedUp;
        } else if (nearDrop.kind === 'shield' && nearDrop.shieldId) {
          const res = inventoryManager.equipShield(inventory, nearDrop.shieldId);
          taken = res.equipped;
        }

        if (taken) {
          lootManager.removeDrop(nearDrop.id, sceneManager.scene);
          audioManager.playPickup();
        }
      }
    }

    // 7. Mouvement horizontal + bonus vitesse héros + Sprint + Accroupissement + Glissade
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);

    const speedMult = heroManager.getSpeedMultiplier(player);
    const forwardX = -Math.sin(player.yaw);
    const forwardZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);

    let wishX = forwardX * input.moveForward + rightX * input.moveRight;
    let wishZ = forwardZ * input.moveForward + rightZ * input.moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const isMoving = wishLen > 0.01;
    const isAiming = input.aim && !player.activeWeapon.isReloading;

    if (
      input.crouch &&
      player.isSprinting &&
      player.isGrounded &&
      !player.isSliding &&
      this.slideCooldown <= 0 &&
      isMoving
    ) {
      player.isSliding = true;
      this.slideTimer = PHYSICS_CONSTANTS.SLIDE_DURATION;
      this.slideCooldown = PHYSICS_CONSTANTS.SLIDE_COOLDOWN;
      this.slideDir = { x: wishX, z: wishZ };
    }

    if (player.isSliding) {
      this.slideTimer -= dt;
      const slideFactor = Math.max(0.35, this.slideTimer / PHYSICS_CONSTANTS.SLIDE_DURATION);
      player.velocity.x =
        this.slideDir.x * PHYSICS_CONSTANTS.SLIDE_INITIAL_SPEED * speedMult * slideFactor;
      player.velocity.z =
        this.slideDir.z * PHYSICS_CONSTANTS.SLIDE_INITIAL_SPEED * speedMult * slideFactor;
      player.isCrouching = true;
      player.isSprinting = false;
      if (this.slideTimer <= 0 || !input.crouch) {
        player.isSliding = false;
      }
    } else {
      player.isCrouching = input.crouch;
      player.isSprinting = input.sprint && !player.isCrouching && !isAiming && input.moveForward > 0;

      const maxSpeed =
        (player.isCrouching
          ? PHYSICS_CONSTANTS.CROUCH_SPEED
          : player.isSprinting
            ? PHYSICS_CONSTANTS.SPRINT_SPEED
            : PHYSICS_CONSTANTS.WALK_SPEED) * speedMult;

      const accel = player.isGrounded
        ? PHYSICS_CONSTANTS.GROUND_ACCELERATION
        : PHYSICS_CONSTANTS.AIR_ACCELERATION;

      if (isMoving) {
        const targetVx = wishX * maxSpeed;
        const targetVz = wishZ * maxSpeed;
        player.velocity.x = THREE.MathUtils.lerp(
          player.velocity.x,
          targetVx,
          Math.min(1, accel * dt * 0.25)
        );
        player.velocity.z = THREE.MathUtils.lerp(
          player.velocity.z,
          targetVz,
          Math.min(1, accel * dt * 0.25)
        );
      } else if (player.isGrounded) {
        const friction = Math.exp(-PHYSICS_CONSTANTS.GROUND_FRICTION * dt);
        player.velocity.x *= friction;
        player.velocity.z *= friction;
      }
    }

    // 8. Saut fluide (Coyote time + Jump buffer), escalade des murs/rebords et gravité
    if (player.isGrounded) {
      this.coyoteTimer = 0.13;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (input.jump) {
      this.jumpBufferTimer = 0.12;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    const climbInfo = physics.findClimbableSurface(player.position, player.yaw);
    const isTryingClimb =
      (climbInfo.canClimb || climbInfo.isLedgeMantle) &&
      (input.jump || (!player.isGrounded && input.moveForward > 0.25));

    if (isTryingClimb && (input.jump || this.jumpBufferTimer > 0)) {
      player.velocity.y = climbInfo.isLedgeMantle ? 6.4 : 4.9;
      player.velocity.x += -Math.sin(player.yaw) * 1.9 * dt * 10;
      player.velocity.z += -Math.cos(player.yaw) * 1.9 * dt * 10;
      player.isGrounded = false;
      player.isSliding = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    } else {
      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        player.velocity.y = PHYSICS_CONSTANTS.JUMP_VELOCITY;
        player.isGrounded = false;
        player.isSliding = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
      player.velocity.y += PHYSICS_CONSTANTS.GRAVITY * dt;
    }

    if (!interactionPrompt && (climbInfo.canClimb || climbInfo.isLedgeMantle)) {
      interactionPrompt = 'Touche Espace · Escalader';
    }

    // 9. Résolution collisions & physique
    const activeHeight = player.isCrouching
      ? PHYSICS_CONSTANTS.CROUCH_HEIGHT
      : PHYSICS_CONSTANTS.PLAYER_HEIGHT;
    const moved = physics.moveEntity({
      position: player.position,
      velocity: player.velocity,
      radius: PHYSICS_CONSTANTS.PLAYER_RADIUS,
      height: activeHeight,
      dt,
    });
    player.position = moved.position;
    player.velocity = moved.velocity;
    player.isGrounded = moved.isGrounded;
    physics.syncPlayerBody(player.position);

    // 10. Bruits de pas
    const horizSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.isGrounded && horizSpeed > 1.2 && !player.isSliding) {
      this.footstepTimer -= dt * (player.isSprinting ? 1.45 : 1.0);
      if (this.footstepTimer <= 0) {
        audioManager.playFootstep();
        this.footstepTimer = 0.42;
      }
    }

    // 11. Caméra + magnétisme doux d'assistance à la visée
    cameraController.update({
      dt,
      playerPos: player.position,
      yaw: player.yaw,
      pitch: player.pitch,
      isCrouching: player.isCrouching,
      isSliding: player.isSliding,
      isSprinting: player.isSprinting,
      isAiming,
      horizontalSpeed: horizSpeed,
      isGrounded: player.isGrounded,
      strafeInput: input.moveRight,
    });

    let assistEnemy: CombatantState | null = null;
    if (aimAssistEnabled) {
      const cam = cameraController.camera;
      const forward = this.scratchVecA.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      const maxConeCos = Math.cos(THREE.MathUtils.degToRad(isAiming ? 8.5 : 6.0));
      let bestCos = maxConeCos;

      for (const c of allCombatants) {
        if (!c.isAlive || c.id === player.id) continue;
        if (player.team && c.team === player.team) continue;
        const dx = c.position.x - cam.position.x;
        const dy = c.position.y + 1.25 - cam.position.y;
        const dz = c.position.z - cam.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1.2 || dist > 48) continue;

        const dirX = dx / dist;
        const dirY = dy / dist;
        const dirZ = dz / dist;
        const dot = dirX * forward.x + dirY * forward.y + dirZ * forward.z;
        if (dot > bestCos) {
          const los = collisionManager.hasLineOfSight(
            { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            { x: c.position.x, y: c.position.y + 1.25, z: c.position.z },
            physics.getColliders()
          );
          if (los) {
            bestCos = dot;
            assistEnemy = c;
          }
        }
      }

      if (assistEnemy && (isAiming || input.fire || Math.abs(input.moveRight) > 0.1)) {
        const dx = assistEnemy.position.x - cam.position.x;
        const dy = assistEnemy.position.y + 1.28 - cam.position.y;
        const dz = assistEnemy.position.z - cam.position.z;
        const horiz = Math.hypot(dx, dz) || 0.001;
        const targetYaw = Math.atan2(-dx, -dz);
        const targetPitch = Math.atan2(dy, horiz);

        let yawDiff = targetYaw - player.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        const pitchDiff = targetPitch - player.pitch;

        const pullStrength = isAiming ? 7.5 : 4.2;
        const step = Math.min(1, dt * pullStrength);
        player.yaw += yawDiff * step * 0.45;
        player.pitch = THREE.MathUtils.clamp(
          player.pitch + pitchDiff * step * 0.4,
          -Math.PI / 2 + 0.06,
          Math.PI / 2 - 0.06
        );
        cameraController.update({
          dt: 0,
          playerPos: player.position,
          yaw: player.yaw,
          pitch: player.pitch,
          isCrouching: player.isCrouching,
          isSliding: player.isSliding,
          isSprinting: player.isSprinting,
          isAiming,
          horizontalSpeed: horizSpeed,
          isGrounded: player.isGrounded,
          strafeInput: input.moveRight,
        });
      }
    }

    // Détection précise sous le réticule pour changer la couleur de la cible
    const camNow = cameraController.camera;
    const lookForward = this.scratchVecA.set(0, 0, -1).applyQuaternion(camNow.quaternion).normalize();
    const wHover = getWeaponDefinition(player.activeWeapon.weaponId);
    const hoverHit = collisionManager.raycastShot({
      origin: { x: camNow.position.x, y: camNow.position.y, z: camNow.position.z },
      direction: { x: lookForward.x, y: lookForward.y, z: lookForward.z },
      maxDistance: Math.max(48, wHover.stats.range),
      shooterId: player.id,
      colliders: physics.getColliders(),
      combatants: allCombatants,
    });
    let targetHover: 'none' | 'enemy' | 'ally' = 'none';
    let hoveredTargetName: string | null = null;
    if (hoverHit.hitType === 'combatant' && hoverHit.combatantId) {
      const hovered = allCombatants.find((c) => c.id === hoverHit.combatantId);
      if (hovered) {
        hoveredTargetName = hovered.name;
        targetHover = player.team && hovered.team === player.team ? 'ally' : 'enemy';
      }
    }

    // 12. Tir / Attaque mêlée / Projectile (avec léger magnétisme de projectile si aimAssist actif)
    if (input.fire) {
      const cam = cameraController.camera;
      const forward = this.scratchVecA.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      if (aimAssistEnabled && assistEnemy) {
        const toTarget = this.scratchVecB
          .set(
            assistEnemy.position.x - cam.position.x,
            assistEnemy.position.y + 1.28 - cam.position.y,
            assistEnemy.position.z - cam.position.z
          )
          .normalize();
        if (forward.dot(toTarget) > Math.cos(THREE.MathUtils.degToRad(3.2))) {
          forward.lerp(toTarget, 0.45).normalize();
        }
      }
      const muzzlePos = this.scratchVecC.set(0.2, -0.15, -0.75).applyMatrix4(cam.matrixWorld);
      const activeSlot = inventoryManager.getActiveWeaponSlot(inventory);

      const outcome = weaponManager.fireWeapon({
        shooter: player,
        origin: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        forwardDir: { x: forward.x, y: forward.y, z: forward.z },
        isAiming,
        colliders: physics.getColliders(),
        combatants: allCombatants,
        collisionManager,
        combatManager,
        sceneManager,
        projectileManager,
        eventBus,
        muzzleWorldPos: muzzlePos,
        rarity: activeSlot?.rarity,
        reloadSpeedMultiplier: reloadMult,
        getTargetResistance: (t) => heroManager.getPassiveDamageResistance(t),
        getTargetShieldAbsorb: getTargetShieldAbsorb,
      });

      if (outcome.fired) {
        const wDef = getWeaponDefinition(player.activeWeapon.weaponId);
        cameraController.addRecoil(wDef.stats.recoilVertical, wDef.stats.recoilHorizontal);
        audioManager.playWeaponFire(player.activeWeapon.weaponId, true);
        if (outcome.hitCombatantId) {
          audioManager.playHitmarker(Boolean(outcome.isHeadshot));
        }
      }
    }

    const activeRarity = inventoryManager.getActiveWeaponSlot(inventory)?.rarity ?? 'common';
    weaponManager.updateViewModel({
      dt,
      weaponState: player.activeWeapon,
      isAiming,
      isSprinting: player.isSprinting,
      moveSpeed: horizSpeed,
      isAlive: player.isAlive,
      rarity: activeRarity,
      lookDeltaX: input.lookDeltaX,
      lookDeltaY: input.lookDeltaY,
    });

    return { isAiming, interactionPrompt, targetHover, hoveredTargetName };
  }
}
