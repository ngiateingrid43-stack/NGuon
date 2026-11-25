import * as THREE from 'three';
import type { HeroDefinition } from '@shared/types/hero';
import type { WeaponId } from '@shared/types/weapon';
import { buildDetailedWeaponModel } from '@client/weapons/WeaponModelBuilder';

export type CharacterAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'shoot' | 'reload' | 'hit' | 'dead';

/**
 * Squelette hiérarchique voxel enrichi pour représenter les 6 héros africains et les bots :
 * - Teints de peau authentiques et mats (non délavés par la lumière du désert)
 * - Visage expressif (yeux, sourcils, nez, coiffure/tresses, peintures de guerre)
 * - Coiffes, plastrons, épaulières et pagnes tissés (motifs bogolan/kente)
 * - Modèle 3D détaillé de l'arme réellement équipée dans la main droite
 */
export class VoxelCharacterRig {
  public readonly root = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly weaponHolder = new THREE.Group();

  private currentWeaponId: WeaponId | null = null;
  private animTime = 0;
  private shootFlashTimer = 0;
  private hitFlashTimer = 0;
  private reloadTimer = 0;
  private materials: THREE.MeshStandardMaterial[] = [];
  private textures: THREE.Texture[] = [];

  constructor(
    private readonly hero: HeroDefinition,
    private readonly castShadow = true,
    initialWeaponId: WeaponId = 'flintlock_musket',
    private readonly isEnemySoldier = false
  ) {
    // Peau mate profonde pour les héros africains ; soldats adverses en uniforme blanc
    const skinMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#e8c4a4' : hero.palette.skin,
      roughness: 0.9,
      metalness: 0.0,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#4a3525' : '#120b07',
      roughness: 0.95,
      metalness: 0.02,
    });
    const clothTex = isEnemySoldier
      ? this.createWovenClothTexture('#f1f5f9', '#cbd5e1', '#1e293b')
      : this.createWovenClothTexture(hero.palette.cloth, hero.palette.primary, hero.palette.accent);
    const clothMat = new THREE.MeshStandardMaterial({
      map: clothTex,
      roughness: 0.82,
      metalness: 0.04,
    });
    const primaryMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#e2e8f0' : hero.palette.primary,
      roughness: 0.38,
      metalness: isEnemySoldier ? 0.25 : 0.65,
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#334155' : hero.palette.secondary,
      roughness: 0.78,
      metalness: 0.08,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#d97706' : hero.palette.accent,
      roughness: 0.4,
      metalness: 0.45,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: isEnemySoldier ? '#1e293b' : '#241409',
      roughness: 0.85,
      metalness: 0.1,
    });
    this.materials.push(skinMat, hairMat, clothMat, primaryMat, secondaryMat, accentMat, bootMat);

    // 1. Jambes + bottes + genouillères (pivots à la hanche y = 0.74)
    const buildLeg = (legGroup: THREE.Group, xOffset: number) => {
      legGroup.position.set(xOffset, 0.74, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.25), secondaryMat);
      thigh.position.y = -0.21;
      thigh.castShadow = castShadow;

      const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.28), primaryMat);
      kneeGuard.position.set(0, -0.4, 0.01);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.34, 0.28), bootMat);
      boot.position.set(0, -0.57, 0.02);
      boot.castShadow = castShadow;

      legGroup.add(thigh, kneeGuard, boot);
    };
    buildLeg(this.leftLeg, -0.15);
    buildLeg(this.rightLeg, 0.15);

    // 2. Torse + plastron + pagne tissé + médaillon + cape courte
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.34), clothMat);
    torsoMesh.position.y = 1.09;
    torsoMesh.castShadow = castShadow;

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.38), primaryMat);
    chestPlate.position.set(0, 1.18, 0.01);
    chestPlate.castShadow = castShadow;

    const chestMedallion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.41), accentMat);
    chestMedallion.position.set(0, 1.2, 0.015);

    const sashMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.38), primaryMat);
    sashMesh.position.y = 0.79;
    sashMesh.castShadow = castShadow;

    const frontTasset = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.06), clothMat);
    frontTasset.position.set(0, 0.62, 0.18);

    const backCape = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.56, 0.06), secondaryMat);
    backCape.position.set(0, 1.04, -0.2);
    backCape.rotation.x = 0.08;
    backCape.castShadow = castShadow;

    this.bodyGroup.add(
      torsoMesh,
      chestPlate,
      chestMedallion,
      sashMesh,
      frontTasset,
      backCape,
      this.leftLeg,
      this.rightLeg
    );

    // 3. Tête, traits du visage, coiffure/tresses et couronne culturelle
    this.headGroup.position.set(0, 1.46, 0);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), skinMat);
    neck.position.y = 0.03;

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
    headMesh.position.y = 0.22;
    headMesh.castShadow = castShadow;

    // Cheveux / tresses arrière & latérales sombres
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.32, 0.16), hairMat);
    hairBack.position.set(0, 0.24, -0.14);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), hairMat);
    hairTop.position.set(0, 0.39, 0);

    // Yeux, sourcils, nez et marques guerrières (face avant = +Z local)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.3 });
    this.materials.push(eyeWhiteMat, pupilMat);

    const makeEye = (x: number) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.024, 0.025), hairMat);
      brow.position.set(x, 0.275, 0.195);
      const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.036, 0.018), eyeWhiteMat);
      sclera.position.set(x, 0.24, 0.192);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.022), pupilMat);
      pupil.position.set(x, 0.24, 0.195);
      this.headGroup.add(brow, sclera, pupil);
    };
    makeEye(-0.085);
    makeEye(0.085);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.04), skinMat);
    nose.position.set(0, 0.2, 0.2);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.02), hairMat);
    mouth.position.set(0, 0.125, 0.194);

    // Marques rituelles / royales sur les joues (uniquement pour les héros africains)
    if (!this.isEnemySoldier) {
      const cheekMarkL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.018), accentMat);
      cheekMarkL.position.set(-0.12, 0.18, 0.193);
      const cheekMarkR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.018), accentMat);
      cheekMarkR.position.set(0.12, 0.18, 0.193);
      this.headGroup.add(cheekMarkL, cheekMarkR);
    }

    this.headGroup.add(neck, headMesh, hairBack, hairTop, nose, mouth);
    if (this.isEnemySoldier) {
      this.buildEnemySoldierHelmet(primaryMat, secondaryMat, accentMat);
    } else {
      this.buildHeroHeadgear(primaryMat, secondaryMat, accentMat, hairMat);
    }

    // 4. Bras + épaulières + brassards + arme 3D détaillée
    const buildArm = (armGroup: THREE.Group, xOffset: number) => {
      armGroup.position.set(xOffset, 1.35, 0);
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.28), primaryMat);
      pauldron.position.y = -0.02;
      pauldron.castShadow = castShadow;

      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.56, 0.2), skinMat);
      upperArm.position.y = -0.3;
      upperArm.castShadow = castShadow;

      const bracer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), accentMat);
      bracer.position.y = -0.44;

      armGroup.add(pauldron, upperArm, bracer);
    };
    buildArm(this.leftArm, -0.42);
    buildArm(this.rightArm, 0.42);

    this.rightArm.add(this.weaponHolder);
    this.setWeapon(initialWeaponId);

    this.bodyGroup.add(this.headGroup, this.leftArm, this.rightArm);
    this.root.add(this.bodyGroup);
  }

  private buildEnemySoldierHelmet(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    accentMat: THREE.Material
  ): void {
    // Casque colonial / képi blanc d'officier adverse
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.045, 0.5), primaryMat);
    brim.position.set(0, 0.39, 0.02);
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), primaryMat);
    dome.position.set(0, 0.47, 0);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.4), secondaryMat);
    band.position.set(0, 0.42, 0);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), accentMat);
    badge.position.set(0, 0.47, 0.2);
    this.headGroup.add(brim, dome, band, badge);
  }

  private buildHeroHeadgear(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    accentMat: THREE.Material,
    hairMat: THREE.Material
  ): void {
    const headband = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), primaryMat);
    headband.position.y = 0.37;
    headband.castShadow = this.castShadow;
    this.headGroup.add(headband);

    switch (this.hero.accessoryType) {
      case 'crown': {
        // Couronne royale du Mandé à trois pointes dorées
        for (const x of [-0.13, 0, 0.13]) {
          const spike = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), accentMat);
          spike.position.set(x, 0.47, 0.16);
          this.headGroup.add(spike);
        }
        break;
      }
      case 'crest': {
        // Cimier de guerre de Zazzau + protège-joues
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.44), primaryMat);
        ridge.position.set(0, 0.47, -0.02);
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.12), secondaryMat);
        sideL.position.set(-0.2, 0.22, 0.06);
        const sideR = sideL.clone();
        sideR.position.x = 0.2;
        this.headGroup.add(ridge, sideL, sideR);
        break;
      }
      case 'plume': {
        // Plumes zouloues dressées
        const feather1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), accentMat);
        feather1.position.set(-0.04, 0.54, 0.06);
        feather1.rotation.z = 0.16;
        const feather2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.1), primaryMat);
        feather2.position.set(0.05, 0.52, 0.04);
        feather2.rotation.z = -0.18;
        this.headGroup.add(feather1, feather2);
        break;
      }
      case 'diadem': {
        // Diadème royal du Ndongo + tresses latérales
        const gem = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), accentMat);
        gem.position.set(0, 0.42, 0.21);
        const braidL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.09), hairMat);
        braidL.position.set(-0.21, 0.16, -0.04);
        const braidR = braidL.clone();
        braidR.position.x = 0.21;
        this.headGroup.add(gem, braidL, braidR);
        break;
      }
      case 'solar_halo': {
        // Halo solaire d'Aksoum
        const halo = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.04), accentMat);
        halo.position.set(0, 0.38, -0.18);
        const haloInner = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.05), secondaryMat);
        haloInner.position.set(0, 0.38, -0.175);
        this.headGroup.add(halo, haloInner);
        break;
      }
      case 'forge_mask': {
        // Demi-masque de forge d'Ogun avec visière ardente
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), secondaryMat);
        visor.position.set(0, 0.15, 0.19);
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.11), primaryMat);
        vent.position.set(0, 0.15, 0.195);
        this.headGroup.add(visor, vent);
        break;
      }
    }
  }

  private createWovenClothTexture(base: string, stripe1: string, stripe2: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 64, 64);
      // Motifs géométriques inspirés des tissus kente / bogolan
      ctx.fillStyle = stripe1;
      ctx.fillRect(0, 8, 64, 6);
      ctx.fillRect(0, 48, 64, 6);
      ctx.fillStyle = stripe2;
      for (let x = 0; x < 64; x += 16) {
        ctx.fillRect(x + 4, 22, 8, 8);
        ctx.fillRect(x, 34, 6, 6);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    return tex;
  }

  public setWeapon(weaponId: WeaponId): void {
    if (this.currentWeaponId === weaponId) return;
    this.currentWeaponId = weaponId;
    this.weaponHolder.clear();
    const model = buildDetailedWeaponModel(weaponId, 'common', true);
    this.weaponHolder.add(model);
  }

  public triggerShoot(): void {
    this.shootFlashTimer = 0.18;
  }

  public triggerHit(): void {
    this.hitFlashTimer = 0.18;
  }

  public triggerReload(duration: number): void {
    this.reloadTimer = duration;
  }

  public update(params: {
    dt: number;
    position: { x: number; y: number; z: number };
    yaw: number;
    speed: number;
    isAlive: boolean;
    isGrounded: boolean;
    isCrouching: boolean;
    weaponId?: WeaponId;
  }): void {
    const { dt, position, yaw, speed, isAlive, isGrounded, isCrouching, weaponId } = params;
    this.animTime += dt;

    if (weaponId) {
      this.setWeapon(weaponId);
    }

    this.root.position.set(position.x, position.y, position.z);
    this.root.rotation.y = yaw + Math.PI;

    if (!isAlive) {
      this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, -Math.PI / 2, dt * 10);
      this.bodyGroup.position.y = THREE.MathUtils.lerp(this.bodyGroup.position.y, 0.25, dt * 10);
      return;
    }

    this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, 0, dt * 12);
    this.bodyGroup.position.y = THREE.MathUtils.lerp(
      this.bodyGroup.position.y,
      isCrouching ? -0.35 : 0,
      dt * 12
    );

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      for (const m of this.materials) {
        m.emissive.setHex(0x991b1b);
        m.emissiveIntensity = 0.65;
      }
    } else {
      for (const m of this.materials) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }

    if (!isGrounded) {
      this.leftLeg.rotation.x = 0.45;
      this.rightLeg.rotation.x = -0.35;
      this.leftArm.rotation.x = -0.4;
    } else if (speed > 0.4) {
      const freq = speed > 7 ? 12 : 8;
      const amp = speed > 7 ? 0.72 : 0.48;
      this.leftLeg.rotation.x = Math.sin(this.animTime * freq) * amp;
      this.rightLeg.rotation.x = -Math.sin(this.animTime * freq) * amp;
      this.leftArm.rotation.x = -Math.sin(this.animTime * freq) * amp * 0.7;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 10);
      this.leftArm.rotation.x = Math.sin(this.animTime * 2.2) * 0.05;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      this.rightArm.rotation.x = -0.6 + Math.sin(this.animTime * 14) * 0.25;
    } else if (this.shootFlashTimer > 0) {
      this.shootFlashTimer -= dt;
      this.rightArm.rotation.x = -1.65;
    } else {
      this.rightArm.rotation.x = -1.35 + Math.sin(this.animTime * 2) * 0.03;
    }
  }

  public dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}
