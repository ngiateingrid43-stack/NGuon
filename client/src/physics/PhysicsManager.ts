import * as CANNON from 'cannon-es';
import type { MapBlock, MapDefinition } from '@shared/types/map';
import type { Vec3 } from '@shared/types/common';
import { PHYSICS_CONSTANTS } from '@shared/constants/game';
import { resolveEntityMovement } from '@shared/physics/MovementSimulation';
import type { AxisAlignedBox } from '@shared/physics/types';

export type { AxisAlignedBox };

/**
 * Gestionnaire physique utilisant cannon-es pour le monde et les corps statiques de la carte,
 * couplé à un solveur cinématique précis pour un ressenti FPS fluide sans rebond parasite.
 */
export class PhysicsManager {
  public readonly world: CANNON.World;
  private staticBodies: CANNON.Body[] = [];
  private colliders: AxisAlignedBox[] = [];
  private playerBody: CANNON.Body;
  private readonly defaultMaterial = new CANNON.Material('default');

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, PHYSICS_CONSTANTS.GRAVITY, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      { friction: 0.0, restitution: 0.0 }
    );

    // Corps physique représentatif du joueur dans cannon-es
    this.playerBody = new CANNON.Body({
      mass: 0, // Piloté cinématiquement avec résolution AABB précise
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(PHYSICS_CONSTANTS.PLAYER_RADIUS),
      material: this.defaultMaterial,
    });
    this.world.addBody(this.playerBody);
  }

  public loadMapColliders(map: MapDefinition): void {
    this.clearMapColliders();

    for (const block of map.blocks) {
      if (!block.collidable) continue;

      this.addStaticBlock(block);
    }
  }

  private addStaticBlock(block: MapBlock): void {
    const hx = block.size.x / 2;
    const hy = block.size.y / 2;
    const hz = block.size.z / 2;

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.defaultMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
      position: new CANNON.Vec3(block.position.x, block.position.y, block.position.z),
    });
    this.world.addBody(body);
    this.staticBodies.push(body);

    this.colliders.push({
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

  public getColliders(): readonly AxisAlignedBox[] {
    return this.colliders;
  }

  /**
   * Détecte si le joueur fait face à un mur ou rebord escaladable (parkour / escalade).
   */
  public findClimbableSurface(
    position: Vec3,
    yaw: number,
    radius = PHYSICS_CONSTANTS.PLAYER_RADIUS
  ): { canClimb: boolean; isLedgeMantle: boolean; targetTopY: number } {
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);
    const probeDist = radius + 0.52;
    const probeX = position.x + dirX * probeDist;
    const probeZ = position.z + dirZ * probeDist;

    let bestTopY = -Infinity;
    for (const box of this.colliders) {
      if (box.id.includes('floor') || box.id.includes('ground')) continue;
      if (box.maxY <= position.y + 0.58) continue;
      if (box.maxY > position.y + 16) continue;
      if (box.minY > position.y + 1.5) continue;

      const insideX = probeX >= box.minX - 0.12 && probeX <= box.maxX + 0.12;
      const insideZ = probeZ >= box.minZ - 0.12 && probeZ <= box.maxZ + 0.12;
      if (insideX && insideZ && box.maxY > bestTopY) {
        bestTopY = box.maxY;
      }
    }

    if (bestTopY === -Infinity) {
      return { canClimb: false, isLedgeMantle: false, targetTopY: 0 };
    }
    const deltaY = bestTopY - position.y;
    return {
      canClimb: deltaY > 1.85,
      isLedgeMantle: deltaY <= 1.85,
      targetTopY: bestTopY,
    };
  }

  public syncPlayerBody(position: Vec3): void {
    this.playerBody.position.set(position.x, position.y + PHYSICS_CONSTANTS.PLAYER_RADIUS, position.z);
  }

  public step(dt: number): void {
    this.world.step(PHYSICS_CONSTANTS.FIXED_TIMESTEP, dt, PHYSICS_CONSTANTS.MAX_SUBSTEPS);
  }

  /**
   * Déplace une capsule/boîte cylindrique (joueur ou bot) avec résolution des collisions AABB,
   * détection du sol et franchissement automatique des marches d'escalier (step-up <= 0.55m).
   */
  public moveEntity(params: {
    position: Vec3;
    velocity: Vec3;
    radius: number;
    height: number;
    dt: number;
  }): { position: Vec3; velocity: Vec3; isGrounded: boolean } {
    return resolveEntityMovement({
      ...params,
      colliders: this.colliders,
    });
  }

  public clearMapColliders(): void {
    for (const body of this.staticBodies) {
      this.world.removeBody(body);
    }
    this.staticBodies = [];
    this.colliders = [];
  }
}
