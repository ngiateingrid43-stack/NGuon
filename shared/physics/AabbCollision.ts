import type { Vec3 } from '../types/common.js';
import type { CombatantState } from '../types/entity.js';
import type { MapDefinition } from '../types/map.js';
import type { AxisAlignedBox, RaycastHitResult } from './types.js';

/**
 * Construit la liste des boîtes englobantes AABB à partir d'une MapDefinition.
 */
export function buildMapColliders(map: MapDefinition): AxisAlignedBox[] {
  const colliders: AxisAlignedBox[] = [];
  for (const block of map.blocks) {
    if (!block.collidable) continue;
    const hx = block.size.x / 2;
    const hy = block.size.y / 2;
    const hz = block.size.z / 2;
    colliders.push({
      id: block.id,
      minX: block.position.x - hx,
      maxX: block.position.x + hx,
      minY: block.position.y - hy,
      maxY: block.position.y + hy,
      minZ: block.position.z - hz,
      maxZ: block.position.z + hz,
      isRamp: Boolean(block.isRamp),
    });
  }
  return colliders;
}

export function intersectRaySphere(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
  maxDist: number
): number | null {
  const ocX = origin.x - center.x;
  const ocY = origin.y - center.y;
  const ocZ = origin.z - center.z;
  const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z;
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const t = -b - Math.sqrt(discriminant);
  if (t >= 0 && t <= maxDist) return t;
  return null;
}

export function intersectRayAabb(
  origin: Vec3,
  dir: Vec3,
  box: AxisAlignedBox,
  maxDist: number
): { distance: number; normal: Vec3 } | null {
  let tmin = 0;
  let tmax = maxDist;
  let hitNormal: Vec3 = { x: 0, y: 1, z: 0 };

  const axes = [
    { o: origin.x, d: dir.x, min: box.minX, max: box.maxX, nx: 1, ny: 0, nz: 0 },
    { o: origin.y, d: dir.y, min: box.minY, max: box.maxY, nx: 0, ny: 1, nz: 0 },
    { o: origin.z, d: dir.z, min: box.minZ, max: box.maxZ, nx: 0, ny: 0, nz: 1 },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.d) < 1e-8) {
      if (axis.o < axis.min || axis.o > axis.max) return null;
    } else {
      const invD = 1 / axis.d;
      let t1 = (axis.min - axis.o) * invD;
      let t2 = (axis.max - axis.o) * invD;
      let sign = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        sign = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNormal = { x: axis.nx * sign, y: axis.ny * sign, z: axis.nz * sign };
      }
      if (t2 < tmax) {
        tmax = t2;
      }
      if (tmin > tmax) return null;
    }
  }

  if (tmin < 0 || tmin > maxDist) return null;
  return { distance: tmin, normal: hitNormal };
}

/**
 * Raycast analytique partagé client/serveur pour les tirs hitscan et lignes de vue.
 */
export function raycastWorldAndCombatants(params: {
  origin: Vec3;
  direction: Vec3;
  maxDistance: number;
  shooterId: string;
  colliders: readonly AxisAlignedBox[];
  combatants: readonly CombatantState[];
}): RaycastHitResult {
  const { origin, direction, maxDistance, shooterId, colliders, combatants } = params;

  let closestDist = maxDistance;
  let bestResult: RaycastHitResult = {
    hit: false,
    distance: maxDistance,
    point: {
      x: origin.x + direction.x * maxDistance,
      y: origin.y + direction.y * maxDistance,
      z: origin.z + direction.z * maxDistance,
    },
    normal: { x: 0, y: 1, z: 0 },
    hitType: 'none',
  };

  for (const box of colliders) {
    const res = intersectRayAabb(origin, direction, box, closestDist);
    if (res && res.distance < closestDist) {
      closestDist = res.distance;
      bestResult = {
        hit: true,
        distance: res.distance,
        point: {
          x: origin.x + direction.x * res.distance,
          y: origin.y + direction.y * res.distance,
          z: origin.z + direction.z * res.distance,
        },
        normal: res.normal,
        hitType: 'world',
      };
    }
  }

  for (const target of combatants) {
    if (!target.isAlive || target.id === shooterId) continue;

    const scaleY = target.isCrouching || target.isSliding ? 0.68 : 1.0;

    const headCenter: Vec3 = {
      x: target.position.x,
      y: target.position.y + 1.56 * scaleY,
      z: target.position.z,
    };
    const headHit = intersectRaySphere(origin, direction, headCenter, 0.26, closestDist);
    if (headHit !== null && headHit < closestDist) {
      closestDist = headHit;
      bestResult = {
        hit: true,
        distance: headHit,
        point: {
          x: origin.x + direction.x * headHit,
          y: origin.y + direction.y * headHit,
          z: origin.z + direction.z * headHit,
        },
        normal: { x: -direction.x, y: -direction.y, z: -direction.z },
        hitType: 'combatant',
        combatantId: target.id,
        isHeadshot: true,
        hitZone: 'head',
      };
      continue;
    }

    const heartCenter: Vec3 = {
      x: target.position.x,
      y: target.position.y + 1.14 * scaleY,
      z: target.position.z,
    };
    const heartHit = intersectRaySphere(origin, direction, heartCenter, 0.22, closestDist);
    if (heartHit !== null && heartHit < closestDist) {
      closestDist = heartHit;
      bestResult = {
        hit: true,
        distance: heartHit,
        point: {
          x: origin.x + direction.x * heartHit,
          y: origin.y + direction.y * heartHit,
          z: origin.z + direction.z * heartHit,
        },
        normal: { x: -direction.x, y: -direction.y, z: -direction.z },
        hitType: 'combatant',
        combatantId: target.id,
        isHeadshot: false,
        hitZone: 'heart',
      };
      continue;
    }

    const bodyBox: AxisAlignedBox = {
      id: target.id,
      minX: target.position.x - 0.38,
      maxX: target.position.x + 0.38,
      minY: target.position.y,
      maxY: target.position.y + 1.42 * scaleY,
      minZ: target.position.z - 0.38,
      maxZ: target.position.z + 0.38,
      isRamp: false,
    };
    const bodyHit = intersectRayAabb(origin, direction, bodyBox, closestDist);
    if (bodyHit && bodyHit.distance < closestDist) {
      closestDist = bodyHit.distance;
      const hitY = origin.y + direction.y * bodyHit.distance;
      const isLimb = hitY < target.position.y + 0.65 * scaleY;
      bestResult = {
        hit: true,
        distance: bodyHit.distance,
        point: {
          x: origin.x + direction.x * bodyHit.distance,
          y: hitY,
          z: origin.z + direction.z * bodyHit.distance,
        },
        normal: bodyHit.normal,
        hitType: 'combatant',
        combatantId: target.id,
        isHeadshot: false,
        hitZone: isLimb ? 'limb' : 'body',
      };
    }
  }

  return bestResult;
}

export function hasClearLineOfSight(
  from: Vec3,
  to: Vec3,
  colliders: readonly AxisAlignedBox[]
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.001) return true;

  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  for (const box of colliders) {
    const hit = intersectRayAabb(from, dir, box, dist - 0.15);
    if (hit && hit.distance > 0.05) {
      return false;
    }
  }
  return true;
}
