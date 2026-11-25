import * as THREE from 'three';
import { HEROES_CONFIG, getHeroDefinition } from '@shared/heroes/heroesConfig';
import type { CombatantState } from '@shared/types/entity';
import type { HeroDefinition, HeroId, HeroRuntimeState } from '@shared/types/hero';
import type { Vec3 } from '@shared/types/common';

export interface BladeTrap {
  id: string;
  ownerId: string;
  position: Vec3;
  ttl: number;
  mesh?: THREE.Mesh;
}

export interface AbilityActivationResult {
  activated: boolean;
  speedBoostActive: boolean;
  reconActive: boolean;
  shieldActive: boolean;
  shockwaveHits: CombatantState[];
}

/**
 * Gère les définitions, passifs et pouvoirs actifs des six héros.
 */
export class HeroManager {
  private runtimeStates = new Map<string, HeroRuntimeState>();
  private bladeTraps: BladeTrap[] = [];
  private trapSeq = 0;

  public getHero(heroId: HeroId): HeroDefinition {
    return getHeroDefinition(heroId);
  }

  public getAllHeroes(): HeroDefinition[] {
    return Object.values(HEROES_CONFIG);
  }

  public getPlayableHeroesV01(): HeroDefinition[] {
    return Object.values(HEROES_CONFIG).filter((h) => h.playableInV01);
  }

  public initCombatant(combatantId: string, heroId: HeroId): HeroRuntimeState {
    const state: HeroRuntimeState = {
      heroId,
      abilityCooldownRemaining: 0,
      abilityActiveRemaining: 0,
    };
    this.runtimeStates.set(combatantId, state);
    return state;
  }

  public getState(combatantId: string): HeroRuntimeState | undefined {
    return this.runtimeStates.get(combatantId);
  }

  public getSpeedMultiplier(combatant: CombatantState): number {
    const def = getHeroDefinition(combatant.heroId);
    const st = this.runtimeStates.get(combatant.id);
    let mult = 1.0;
    if (combatant.heroId === 'shaka') {
      mult += def.stats.passiveBonus; // +10% vitesse passive
    }
    if (combatant.heroId === 'sundiata' && st && st.abilityActiveRemaining > 0) {
      mult += 0.25; // Cri de ralliement (+25%)
    }
    return mult;
  }

  public getReloadMultiplier(combatant: CombatantState): number {
    if (combatant.heroId === 'ogun') {
      return 1.15;
    }
    return 1.0;
  }

  public getPassiveDamageResistance(combatant: CombatantState): number {
    const def = getHeroDefinition(combatant.heroId);
    let res = def.stats.damageResistance;
    if (combatant.heroId === 'amina' && combatant.isCrouching) {
      res += def.stats.passiveBonus;
    }
    return Math.min(0.4, res);
  }

  public activateAbility(params: {
    caster: CombatantState;
    allCombatants: CombatantState[];
    scene?: THREE.Scene;
    onTrapDamage?: (ownerId: string, target: CombatantState, damage: number) => void;
  }): AbilityActivationResult {
    const { caster, allCombatants, scene } = params;
    let st = this.runtimeStates.get(caster.id);
    if (!st) {
      st = this.initCombatant(caster.id, caster.heroId);
    }

    if (!caster.isAlive || st.abilityCooldownRemaining > 0) {
      return {
        activated: false,
        speedBoostActive: false,
        reconActive: false,
        shieldActive: false,
        shockwaveHits: [],
      };
    }

    const def = getHeroDefinition(caster.heroId);
    st.abilityCooldownRemaining = def.stats.abilityCooldown;
    const shockwaveHits: CombatantState[] = [];

    switch (caster.heroId) {
      case 'sundiata':
        st.abilityActiveRemaining = 5.0;
        break;
      case 'amina':
        st.abilityActiveRemaining = 5.0;
        caster.armor = Math.min(caster.maxArmor + 45, caster.armor + 45);
        break;
      case 'shaka': {
        st.abilityActiveRemaining = 1.2;
        const forwardX = -Math.sin(caster.yaw);
        const forwardZ = -Math.cos(caster.yaw);
        caster.velocity.x += forwardX * 14;
        caster.velocity.z += forwardZ * 14;
        for (const other of allCombatants) {
          if (!other.isAlive || other.id === caster.id) continue;
          const d = Math.hypot(
            other.position.x - caster.position.x,
            other.position.z - caster.position.z
          );
          if (d <= 5.5) {
            shockwaveHits.push(other);
          }
        }
        break;
      }
      case 'nzinga':
        st.abilityActiveRemaining = 6.0;
        break;
      case 'makeda':
        st.abilityActiveRemaining = 4.0;
        caster.health = Math.min(caster.maxHealth, caster.health + 40);
        break;
      case 'ogun': {
        st.abilityActiveRemaining = 1.0;
        const forwardX = -Math.sin(caster.yaw);
        const forwardZ = -Math.cos(caster.yaw);
        const trapPos = {
          x: caster.position.x + forwardX * 1.8,
          y: caster.position.y,
          z: caster.position.z + forwardZ * 1.8,
        };
        const trap: BladeTrap = {
          id: `trap_${++this.trapSeq}`,
          ownerId: caster.id,
          position: trapPos,
          ttl: 18.0,
        };
        if (scene) {
          const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.95, 0.95, 0.12, 8),
            new THREE.MeshStandardMaterial({
              color: '#ea580c',
              emissive: '#9a3412',
              emissiveIntensity: 0.5,
              metalness: 0.7,
            })
          );
          mesh.position.set(trapPos.x, trapPos.y + 0.06, trapPos.z);
          scene.add(mesh);
          trap.mesh = mesh;
        }
        this.bladeTraps.push(trap);
        break;
      }
    }

    return {
      activated: true,
      speedBoostActive: caster.heroId === 'sundiata',
      reconActive: caster.heroId === 'nzinga',
      shieldActive: caster.heroId === 'amina',
      shockwaveHits,
    };
  }

  public update(params: {
    dt: number;
    combatants: CombatantState[];
    scene?: THREE.Scene;
    onTrapTriggered?: (ownerId: string, target: CombatantState, damage: number) => void;
  }): void {
    const { dt, combatants, scene, onTrapTriggered } = params;

    for (const c of combatants) {
      const st = this.runtimeStates.get(c.id);
      if (!st) continue;

      if (st.abilityCooldownRemaining > 0) {
        st.abilityCooldownRemaining = Math.max(0, st.abilityCooldownRemaining - dt);
      }
      if (st.abilityActiveRemaining > 0) {
        st.abilityActiveRemaining = Math.max(0, st.abilityActiveRemaining - dt);
        if (c.heroId === 'makeda' && c.isAlive) {
          c.health = Math.min(c.maxHealth, c.health + 5 * dt);
        }
      }

      // Passif Sundiata : régénération continue +2 PV/s
      if (c.heroId === 'sundiata' && c.isAlive && c.health < c.maxHealth) {
        c.health = Math.min(c.maxHealth, c.health + 2.0 * dt);
      }
    }

    // Pièges d'Ogun
    for (let i = this.bladeTraps.length - 1; i >= 0; i--) {
      const trap = this.bladeTraps[i];
      trap.ttl -= dt;
      let triggered = false;

      for (const c of combatants) {
        if (!c.isAlive || c.id === trap.ownerId) continue;
        const d = Math.hypot(c.position.x - trap.position.x, c.position.z - trap.position.z);
        if (d <= 1.9 && Math.abs(c.position.y - trap.position.y) < 1.5) {
          c.velocity.x *= 0.25;
          c.velocity.z *= 0.25;
          onTrapTriggered?.(trap.ownerId, c, 40);
          triggered = true;
          break;
        }
      }

      if (triggered || trap.ttl <= 0) {
        if (trap.mesh && scene) {
          scene.remove(trap.mesh);
          trap.mesh.geometry.dispose();
          (trap.mesh.material as THREE.Material).dispose();
        }
        this.bladeTraps.splice(i, 1);
      }
    }
  }

  public clear(scene?: THREE.Scene): void {
    for (const trap of this.bladeTraps) {
      if (trap.mesh && scene) scene.remove(trap.mesh);
    }
    this.bladeTraps = [];
    this.runtimeStates.clear();
  }
}
