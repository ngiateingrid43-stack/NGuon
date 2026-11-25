import { describe, it, expect } from 'vitest';
import { HeroManager } from '@client/heroes/HeroManager';
import { buildDetailedWeaponModel } from '@client/weapons/WeaponModelBuilder';
import { createInitialWeaponState, WEAPONS_CONFIG } from '@shared/weapons/weaponsConfig';
import type { CombatantState } from '@shared/types/entity';
import type { HeroId } from '@shared/types/hero';
import type { WeaponId } from '@shared/types/weapon';

function makeHeroActor(id: string, heroId: HeroId, x = 0, z = 0): CombatantState {
  return {
    id,
    name: id,
    isBot: false,
    heroId,
    position: { x, y: 0, z },
    yaw: 0,
    pitch: 0,
    velocity: { x: 0, y: 0, z: 0 },
    health: 60,
    maxHealth: 100,
    armor: 20,
    maxArmor: 50,
    isAlive: true,
    respawnTimer: 0,
    isGrounded: true,
    isSprinting: false,
    isCrouching: false,
    isSliding: false,
    activeWeapon: createInitialWeaponState('flintlock_musket'),
    stats: {
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
    },
  };
}

describe('HeroManager — Les 6 Héros & Pouvoirs (v0.3)', () => {
  it('expose les 6 héros complets et jouables avec teints profonds et modèles d’armes 3D détaillés', () => {
    const hm = new HeroManager();
    const heroes = hm.getAllHeroes();
    expect(heroes).toHaveLength(6);
    expect(heroes.every((h) => h.playableInV01)).toBe(true);
    // Vérifier que les teints de peau restent sombres et riches (luminance faible)
    for (const h of heroes) {
      const r = parseInt(h.palette.skin.slice(1, 3), 16);
      expect(r).toBeLessThan(80);
    }
    // Vérifier que chacune des 9 armes construit un modèle multi-pièces
    for (const wid of Object.keys(WEAPONS_CONFIG) as WeaponId[]) {
      const model = buildDetailedWeaponModel(wid, 'legendary', false);
      expect(model.children[0].children.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('Sundiata : vitesse active +25%, régénération passive et respect du cooldown', () => {
    const hm = new HeroManager();
    const sundiata = makeHeroActor('p1', 'sundiata');
    hm.initCombatant('p1', 'sundiata');

    expect(hm.getSpeedMultiplier(sundiata)).toBe(1.0);
    const res1 = hm.activateAbility({ caster: sundiata, allCombatants: [sundiata] });
    expect(res1.activated).toBe(true);
    expect(hm.getSpeedMultiplier(sundiata)).toBeCloseTo(1.25);

    // Cooldown empêche une double activation immédiate
    const res2 = hm.activateAbility({ caster: sundiata, allCombatants: [sundiata] });
    expect(res2.activated).toBe(false);

    // Régénération passive (+2 PV/s)
    const beforeHp = sundiata.health;
    hm.update({ dt: 1.0, combatants: [sundiata] });
    expect(sundiata.health).toBeCloseTo(beforeHp + 2.0);
  });

  it('Shaka, Amina, Makeda et Ogun appliquent leurs pouvoirs actifs et passifs', () => {
    const hm = new HeroManager();
    const shaka = makeHeroActor('shaka_1', 'shaka', 0, 0);
    const enemy = makeHeroActor('enemy', 'nzinga', 0, 3);
    const amina = makeHeroActor('amina_1', 'amina');
    amina.isCrouching = true;
    const makeda = makeHeroActor('makeda_1', 'makeda');
    const ogun = makeHeroActor('ogun_1', 'ogun');

    hm.initCombatant('shaka_1', 'shaka');
    hm.initCombatant('amina_1', 'amina');
    hm.initCombatant('makeda_1', 'makeda');
    hm.initCombatant('ogun_1', 'ogun');

    // Shaka : vitesse passive + onde de choc sur ennemi à 3m
    expect(hm.getSpeedMultiplier(shaka)).toBeGreaterThan(1.05);
    const shakaAct = hm.activateAbility({ caster: shaka, allCombatants: [shaka, enemy] });
    expect(shakaAct.shockwaveHits).toHaveLength(1);

    // Amina : résistance accroupie + bouclier actif
    expect(hm.getPassiveDamageResistance(amina)).toBeGreaterThan(0.15);
    hm.activateAbility({ caster: amina, allCombatants: [amina] });
    expect(amina.armor).toBe(65);

    // Makeda : soin actif +40 PV
    hm.activateAbility({ caster: makeda, allCombatants: [makeda] });
    expect(makeda.health).toBe(100);

    // Ogun : rechargement amélioré + piège de lames qui blesse un intrus proche
    expect(hm.getReloadMultiplier(ogun)).toBeGreaterThan(1.1);
    hm.activateAbility({ caster: ogun, allCombatants: [ogun, enemy] });
    enemy.position = { x: 0, y: 0, z: -1.8 }; // Sur le piège devant Ogun (yaw=0 -> -Z)
    let trapDmg = 0;
    hm.update({
      dt: 0.1,
      combatants: [ogun, enemy],
      onTrapTriggered: (_owner, _target, dmg) => {
        trapDmg = dmg;
      },
    });
    expect(trapDmg).toBe(40);
  });
});
