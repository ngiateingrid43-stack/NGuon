import { getMapDefinition } from '../../../shared/maps/mapRegistry.js';
import {
  buildMapColliders,
  raycastWorldAndCombatants,
} from '../../../shared/physics/AabbCollision.js';
import {
  stepCombatantKinematics,
  type PlayerMoveInput,
} from '../../../shared/physics/MovementSimulation.js';
import type { AxisAlignedBox, RaycastHitResult } from '../../../shared/physics/types.js';
import type { Vec3 } from '../../../shared/types/common.js';
import type { CombatantState } from '../../../shared/types/entity.js';
import type { MapDefinition, MapId } from '../../../shared/types/map.js';

/**
 * Simulation physique autoritaire côté serveur utilisant la même géométrie AABB que le client.
 */
export class ServerPhysics {
  private map: MapDefinition;
  private colliders: AxisAlignedBox[];

  constructor(mapId: MapId = 'tombouctou') {
    this.map = getMapDefinition(mapId);
    this.colliders = buildMapColliders(this.map);
  }

  public getMap(): MapDefinition {
    return this.map;
  }

  public getColliders(): readonly AxisAlignedBox[] {
    return this.colliders;
  }

  public stepPlayer(
    player: CombatantState,
    input: PlayerMoveInput,
    dt: number
  ): void {
    const res = stepCombatantKinematics({
      position: player.position,
      velocity: player.velocity,
      isGrounded: player.isGrounded,
      isCrouching: player.isCrouching,
      isSprinting: player.isSprinting,
      input,
      dt,
      colliders: this.colliders,
    });
    player.position = res.position;
    player.velocity = res.velocity;
    player.isGrounded = res.isGrounded;
    player.isCrouching = res.isCrouching;
    player.isSprinting = res.isSprinting;
    player.yaw = input.yaw;
    player.pitch = input.pitch;
  }

  public raycastShot(params: {
    origin: Vec3;
    direction: Vec3;
    maxDistance: number;
    shooterId: string;
    combatants: readonly CombatantState[];
  }): RaycastHitResult {
    return raycastWorldAndCombatants({
      ...params,
      colliders: this.colliders,
    });
  }
}
