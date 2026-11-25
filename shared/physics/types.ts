import type { HitZone, Vec3 } from '../types/common.js';

export interface AxisAlignedBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isRamp: boolean;
}

export interface RaycastHitResult {
  hit: boolean;
  distance: number;
  point: Vec3;
  normal: Vec3;
  hitType: 'world' | 'combatant' | 'none';
  combatantId?: string;
  isHeadshot?: boolean;
  hitZone?: HitZone;
}
