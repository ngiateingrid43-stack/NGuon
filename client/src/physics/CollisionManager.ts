import type { Vec3 } from '@shared/types/common';
import type { CombatantState } from '@shared/types/entity';
import {
  hasClearLineOfSight,
  raycastWorldAndCombatants,
} from '@shared/physics/AabbCollision';
import type { AxisAlignedBox, RaycastHitResult } from '@shared/physics/types';

export type { RaycastHitResult };

/**
 * Gestionnaire de raycasting client déléguant aux fonctions partagées client/serveur.
 */
export class CollisionManager {
  public raycastShot(params: {
    origin: Vec3;
    direction: Vec3;
    maxDistance: number;
    shooterId: string;
    colliders: readonly AxisAlignedBox[];
    combatants: readonly CombatantState[];
  }): RaycastHitResult {
    return raycastWorldAndCombatants(params);
  }

  public hasLineOfSight(
    from: Vec3,
    to: Vec3,
    colliders: readonly AxisAlignedBox[]
  ): boolean {
    return hasClearLineOfSight(from, to, colliders);
  }
}
