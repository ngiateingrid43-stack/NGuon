import { PHYSICS_CONSTANTS } from '../constants/game.js';
import type { Vec3 } from '../types/common.js';
import type { AxisAlignedBox } from './types.js';

export interface PlayerMoveInput {
  moveForward: number;
  moveRight: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  yaw: number;
  pitch: number;
  isAiming: boolean;
}

/**
 * Résout un pas de mouvement AABB avec détection du sol et step-up sur les marches.
 * Utilisé de manière identique par la prédiction client et la simulation serveur.
 */
export function resolveEntityMovement(params: {
  position: Vec3;
  velocity: Vec3;
  radius: number;
  height: number;
  dt: number;
  colliders: readonly AxisAlignedBox[];
}): { position: Vec3; velocity: Vec3; isGrounded: boolean } {
  const { radius, height, dt, colliders } = params;
  const pos = { ...params.position };
  const vel = { ...params.velocity };

  pos.x += vel.x * dt;
  resolveHorizontalAxis(pos, vel, radius, height, 'x', colliders);

  pos.z += vel.z * dt;
  resolveHorizontalAxis(pos, vel, radius, height, 'z', colliders);

  pos.y += vel.y * dt;
  let isGrounded = false;

  for (const box of colliders) {
    if (
      pos.x + radius <= box.minX ||
      pos.x - radius >= box.maxX ||
      pos.z + radius <= box.minZ ||
      pos.z - radius >= box.maxZ
    ) {
      continue;
    }

    const footY = pos.y;
    const headY = pos.y + height;

    if (headY > box.minY && footY < box.maxY) {
      if (vel.y <= 0 && footY <= box.maxY && footY >= box.maxY - 0.65) {
        pos.y = box.maxY;
        vel.y = 0;
        isGrounded = true;
      } else if (vel.y > 0 && headY >= box.minY && headY <= box.minY + 0.5) {
        pos.y = box.minY - height;
        vel.y = 0;
      }
    }
  }

  if (!isGrounded && vel.y <= 0) {
    for (const box of colliders) {
      if (
        pos.x + radius > box.minX &&
        pos.x - radius < box.maxX &&
        pos.z + radius > box.minZ &&
        pos.z - radius < box.maxZ &&
        Math.abs(pos.y - box.maxY) <= 0.06
      ) {
        pos.y = box.maxY;
        vel.y = 0;
        isGrounded = true;
        break;
      }
    }
  }

  return { position: pos, velocity: vel, isGrounded };
}

function resolveHorizontalAxis(
  pos: Vec3,
  vel: Vec3,
  radius: number,
  height: number,
  axis: 'x' | 'z',
  colliders: readonly AxisAlignedBox[]
): void {
  const stepUpMax = 0.56;

  for (const box of colliders) {
    if (pos.y >= box.maxY - 0.01 || pos.y + height <= box.minY + 0.01) {
      continue;
    }

    const overlapX = pos.x + radius > box.minX && pos.x - radius < box.maxX;
    const overlapZ = pos.z + radius > box.minZ && pos.z - radius < box.maxZ;
    if (!overlapX || !overlapZ) continue;

    const stepDelta = box.maxY - pos.y;
    if (stepDelta > 0 && stepDelta <= stepUpMax) {
      if (canStandAt(pos.x, box.maxY, pos.z, radius, height, box.id, colliders)) {
        pos.y = box.maxY;
        continue;
      }
    }

    if (axis === 'x') {
      const boxCenterX = (box.minX + box.maxX) * 0.5;
      pos.x = pos.x < boxCenterX ? box.minX - radius : box.maxX + radius;
      vel.x = 0;
    } else {
      const boxCenterZ = (box.minZ + box.maxZ) * 0.5;
      pos.z = pos.z < boxCenterZ ? box.minZ - radius : box.maxZ + radius;
      vel.z = 0;
    }
  }
}

function canStandAt(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  ignoreId: string,
  colliders: readonly AxisAlignedBox[]
): boolean {
  for (const box of colliders) {
    if (box.id === ignoreId) continue;
    if (
      x + radius > box.minX &&
      x - radius < box.maxX &&
      z + radius > box.minZ &&
      z - radius < box.maxZ &&
      y + height > box.minY + 0.02 &&
      y < box.maxY - 0.02
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Applique une entrée de déplacement FPS (vitesse souhaitée, saut, gravité, collisions).
 */
export function stepCombatantKinematics(params: {
  position: Vec3;
  velocity: Vec3;
  isGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  input: PlayerMoveInput;
  dt: number;
  colliders: readonly AxisAlignedBox[];
}): {
  position: Vec3;
  velocity: Vec3;
  isGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
} {
  const { input, dt, colliders } = params;
  const vel = { ...params.velocity };
  let isGrounded = params.isGrounded;
  const isCrouching = input.crouch;
  const isSprinting = input.sprint && !isCrouching && !input.isAiming && input.moveForward > 0;

  const forwardX = -Math.sin(input.yaw);
  const forwardZ = -Math.cos(input.yaw);
  const rightX = Math.cos(input.yaw);
  const rightZ = -Math.sin(input.yaw);

  let wishX = forwardX * input.moveForward + rightX * input.moveRight;
  let wishZ = forwardZ * input.moveForward + rightZ * input.moveRight;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 0.001) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  const maxSpeed = isCrouching
    ? PHYSICS_CONSTANTS.CROUCH_SPEED
    : isSprinting
      ? PHYSICS_CONSTANTS.SPRINT_SPEED
      : PHYSICS_CONSTANTS.WALK_SPEED;

  const accel = isGrounded
    ? PHYSICS_CONSTANTS.GROUND_ACCELERATION
    : PHYSICS_CONSTANTS.AIR_ACCELERATION;

  if (wishLen > 0.01) {
    const targetVx = wishX * maxSpeed;
    const targetVz = wishZ * maxSpeed;
    const blend = Math.min(1, accel * dt * 0.25);
    vel.x = vel.x + (targetVx - vel.x) * blend;
    vel.z = vel.z + (targetVz - vel.z) * blend;
  } else if (isGrounded) {
    const friction = Math.exp(-PHYSICS_CONSTANTS.GROUND_FRICTION * dt);
    vel.x *= friction;
    vel.z *= friction;
  }

  if (input.jump && isGrounded) {
    vel.y = PHYSICS_CONSTANTS.JUMP_VELOCITY;
    isGrounded = false;
  }
  vel.y += PHYSICS_CONSTANTS.GRAVITY * dt;

  const activeHeight = isCrouching
    ? PHYSICS_CONSTANTS.CROUCH_HEIGHT
    : PHYSICS_CONSTANTS.PLAYER_HEIGHT;

  const moved = resolveEntityMovement({
    position: params.position,
    velocity: vel,
    radius: PHYSICS_CONSTANTS.PLAYER_RADIUS,
    height: activeHeight,
    dt,
    colliders,
  });

  return {
    position: moved.position,
    velocity: moved.velocity,
    isGrounded: moved.isGrounded,
    isCrouching,
    isSprinting,
  };
}
