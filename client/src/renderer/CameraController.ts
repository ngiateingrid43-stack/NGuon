import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '@shared/constants/game';

/**
 * Contrôleur de caméra FPS fluide : visée (ADS), FOV dynamique en sprint,
 * amorti d'atterrissage, recul, inclinaison de glissade/strafe et head-bobbing.
 */
export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private baseFov = 78;
  private currentFov = 78;
  private currentEyeHeight: number = PHYSICS_CONSTANTS.PLAYER_EYE_HEIGHT;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private landingDip = 0;
  private wasGrounded = true;
  private currentRoll = 0;
  private bobTimer = 0;
  private reduceCameraShake = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 560);
    this.camera.rotation.order = 'YXZ';
  }

  public setBaseFov(fov: number): void {
    this.baseFov = fov;
  }

  public setReduceCameraShake(reduce: boolean): void {
    this.reduceCameraShake = reduce;
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  public addRecoil(vertical: number, horizontal: number): void {
    const scale = this.reduceCameraShake ? 0.35 : 1.0;
    this.recoilPitch += vertical * scale;
    this.recoilYaw += (Math.random() - 0.5) * 2 * horizontal * scale;
  }

  public update(params: {
    dt: number;
    playerPos: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    isCrouching: boolean;
    isSliding: boolean;
    isSprinting?: boolean;
    isAiming: boolean;
    horizontalSpeed: number;
    isGrounded: boolean;
    strafeInput?: number;
  }): void {
    const {
      dt,
      playerPos,
      yaw,
      pitch,
      isCrouching,
      isSliding,
      isSprinting = false,
      isAiming,
      horizontalSpeed,
      isGrounded,
      strafeInput = 0,
    } = params;

    // Amorti d'atterrissage quand on retouche le sol
    if (!this.wasGrounded && isGrounded && !this.reduceCameraShake) {
      this.landingDip = -0.11;
    }
    this.wasGrounded = isGrounded;
    if (dt > 0) {
      this.landingDip = THREE.MathUtils.lerp(this.landingDip, 0, Math.min(1, dt * 14));
    }

    // Lissage hauteur des yeux (debout vs accroupi / glissade)
    const targetEye =
      isCrouching || isSliding
        ? PHYSICS_CONSTANTS.CROUCH_EYE_HEIGHT
        : PHYSICS_CONSTANTS.PLAYER_EYE_HEIGHT;
    this.currentEyeHeight = THREE.MathUtils.lerp(
      this.currentEyeHeight,
      targetEye,
      Math.min(1, dt * 14)
    );

    // Head-bobbing léger en déplacement au sol
    let bobOffsetY = 0;
    let bobOffsetX = 0;
    if (!this.reduceCameraShake && isGrounded && horizontalSpeed > 0.8 && !isSliding) {
      this.bobTimer += dt * (horizontalSpeed > 7.5 ? 13 : 9);
      const amp = isAiming ? 0.014 : isSprinting ? 0.048 : 0.034;
      bobOffsetY = Math.sin(this.bobTimer) * amp;
      bobOffsetX = Math.cos(this.bobTimer * 0.5) * amp * 0.45;
    } else {
      this.bobTimer = 0;
    }

    // Récupération progressive du recul
    if (dt > 0) {
      this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, dt * 11));
      this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, Math.min(1, dt * 11));
    }

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    this.camera.position.set(
      playerPos.x + rightX * bobOffsetX,
      playerPos.y + this.currentEyeHeight + bobOffsetY + this.landingDip,
      playerPos.z + rightZ * bobOffsetX
    );

    this.camera.rotation.y = yaw + this.recoilYaw;
    this.camera.rotation.x = THREE.MathUtils.clamp(
      pitch + this.recoilPitch,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );

    const targetRoll = this.reduceCameraShake
      ? 0
      : isSliding
        ? -0.06
        : -strafeInput * 0.016;
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, Math.min(1, dt * 12));
    this.camera.rotation.z = this.currentRoll;

    // Transition FOV fluide : zoom en ADS, élargissement dynamique en sprint
    const targetFov = isAiming
      ? this.baseFov * 0.76
      : isSprinting && horizontalSpeed > 6.5
        ? Math.min(110, this.baseFov + 5.5)
        : this.baseFov;
    if (Math.abs(this.currentFov - targetFov) > 0.05) {
      this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, Math.min(1, dt * 12));
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
