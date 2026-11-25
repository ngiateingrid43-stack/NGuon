import * as THREE from 'three';
import type { HitZone } from '@shared/types/common';
import type { MapDefinition } from '@shared/types/map';
import type { TimeOfDay } from '@shared/maps/mapRegistry';
import type { QualityPreset } from '@client/performance/PerformanceManager';
import { TextureGenerator } from './TextureGenerator';

interface TracerEffect {
  line: THREE.Line;
  ttl: number;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  ttl: number;
}

export interface PickupVisual {
  id: string;
  type: 'ammo' | 'health' | 'armor' | 'weapon_crate';
  mesh: THREE.Group;
  baseY: number;
  active: boolean;
}

/**
 * Gère la scène Three.js : lumières, ciel procédural, brouillard, géométrie de carte,
 * particules de poussière saharienne, eau animée et effets de tirs.
 */
export class SceneManager {
  public readonly scene: THREE.Scene;
  private readonly textureGenerator = new TextureGenerator();
  private mapGroup = new THREE.Group();
  private entitiesGroup = new THREE.Group();
  private effectsGroup = new THREE.Group();

  private sunLight: THREE.DirectionalLight | null = null;
  private sunBaseOffset = new THREE.Vector3(85, 120, 65);
  private hemiLight: THREE.HemisphereLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private skyDome: THREE.Mesh | null = null;

  private waterMeshes: THREE.Mesh[] = [];
  private foliageMeshes: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number }> = [];
  private dustPoints: THREE.Points | null = null;
  private dustCount = 0;
  private dustHalfExtent = 80;

  private tracers: TracerEffect[] = [];
  private impactParticles: ImpactParticle[] = [];
  private pickupVisuals: PickupVisual[] = [];
  private strongholdVisuals = new Map<
    string,
    { ring: THREE.Mesh; pillar: THREE.Mesh; mat: THREE.MeshBasicMaterial }
  >();
  private muzzleLight: THREE.PointLight;
  private muzzleLightTtl = 0;
  private safeZoneCylinder: THREE.Mesh | null = null;

  // Géométries partagées pour éviter la duplication GPU
  private readonly unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  private readonly bloodDropGeometry = new THREE.SphereGeometry(0.065, 6, 6);
  private readonly impactMaterial = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
  private readonly bloodSparkMaterial = new THREE.MeshBasicMaterial({ color: '#dc2626' });
  private readonly deepBloodMaterial = new THREE.MeshBasicMaterial({ color: '#7f1d1d' });
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({
    color: '#e2e8f0',
    transparent: true,
    opacity: 0.45,
  });

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.add(this.mapGroup);
    this.scene.add(this.entitiesGroup);
    this.scene.add(this.effectsGroup);

    this.muzzleLight = new THREE.PointLight('#ffedd5', 0, 9);
    this.scene.add(this.muzzleLight);
  }

  public getEntitiesGroup(): THREE.Group {
    return this.entitiesGroup;
  }

  public getMapGroup(): THREE.Group {
    return this.mapGroup;
  }

  public loadMap(
    map: MapDefinition,
    preset: QualityPreset,
    timeOfDay: TimeOfDay = 'day'
  ): void {
    this.clearMap();

    // 1. Brouillard atmosphérique
    this.scene.fog = new THREE.Fog(
      map.weather.fogColor,
      map.weather.fogNear * preset.fogScale,
      map.weather.fogFar * preset.fogScale
    );
    this.scene.background = new THREE.Color(map.lighting.skyHorizonColor);

    // 2. Dôme céleste dégradé
    this.createSkyDome(map.lighting.skyTopColor, map.lighting.skyHorizonColor);

    // 3. Éclairage directionnel + hémisphérique + ambiant
    this.ambientLight = new THREE.AmbientLight(
      map.lighting.ambientColor,
      map.lighting.ambientIntensity
    );
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(
      map.lighting.hemisphereSky,
      map.lighting.hemisphereGround,
      0.7
    );
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(map.lighting.sunColor, map.lighting.sunIntensity);
    this.sunBaseOffset.set(
      map.lighting.sunPosition.x,
      map.lighting.sunPosition.y,
      map.lighting.sunPosition.z
    );
    this.sunLight.position.copy(this.sunBaseOffset);
    this.sunLight.castShadow = preset.shadowsEnabled;
    this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 320;
    const d = Math.min(95, Math.max(55, (map.bounds.maxX - map.bounds.minX) * 0.4));
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00045;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.applyTimeOfDay(map, timeOfDay);

    // 4. Construction optimisée par InstancedMesh (réduit drastiquement les draw calls GPU)
    const staticGroups = new Map<string, typeof map.blocks>();
    for (const block of map.blocks) {
      if (block.material === 'water' || block.material === 'palm_leaf') {
        const material = this.textureGenerator.getMaterial(block.material);
        const mesh = new THREE.Mesh(this.unitBoxGeometry, material);
        mesh.position.set(block.position.x, block.position.y, block.position.z);
        mesh.scale.set(block.size.x, block.size.y, block.size.z);
        mesh.castShadow = preset.shadowsEnabled && Boolean(block.castShadow);
        mesh.receiveShadow = preset.shadowsEnabled && (block.receiveShadow ?? true);
        mesh.userData = { blockId: block.id, collidable: block.collidable };
        this.mapGroup.add(mesh);

        if (block.material === 'water') {
          this.waterMeshes.push(mesh);
        } else if (this.foliageMeshes.length < 220) {
          this.foliageMeshes.push({ mesh, baseX: block.position.x, baseZ: block.position.z });
        }
        continue;
      }

      const cast = preset.shadowsEnabled && Boolean(block.castShadow);
      const recv = preset.shadowsEnabled && (block.receiveShadow ?? true);
      const key = `${block.material}|${cast ? 1 : 0}|${recv ? 1 : 0}`;
      let arr = staticGroups.get(key);
      if (!arr) {
        arr = [];
        staticGroups.set(key, arr);
      }
      arr.push(block);
    }

    const dummy = new THREE.Object3D();
    for (const [key, list] of staticGroups.entries()) {
      const [matType, castFlag, recvFlag] = key.split('|');
      const material = this.textureGenerator.getMaterial(
        matType as import('@shared/types/map').VoxelMaterialType
      );
      const inst = new THREE.InstancedMesh(this.unitBoxGeometry, material, list.length);
      inst.castShadow = castFlag === '1';
      inst.receiveShadow = recvFlag === '1';
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        dummy.position.set(b.position.x, b.position.y, b.position.z);
        dummy.scale.set(b.size.x, b.size.y, b.size.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.mapGroup.add(inst);
    }

    // 5. Points de ravitaillement et coffres visuels
    for (const lp of map.lootPoints) {
      const group = new THREE.Group();
      const isChest = lp.type === 'weapon_crate';
      const color =
        lp.type === 'health'
          ? '#22c55e'
          : lp.type === 'armor'
            ? '#3b82f6'
            : isChest
              ? '#a855f7'
              : '#eab308';
      const crateMesh = new THREE.Mesh(
        new THREE.BoxGeometry(isChest ? 1.05 : 0.65, isChest ? 0.68 : 0.5, isChest ? 0.78 : 0.65),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: isChest ? 0.5 : 0.35,
          roughness: 0.35,
          metalness: isChest ? 0.65 : 0.4,
        })
      );
      crateMesh.castShadow = preset.shadowsEnabled;
      group.add(crateMesh);
      if (isChest) {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.14, 0.82),
          new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.8, roughness: 0.25 })
        );
        trim.position.y = 0.22;
        group.add(trim);
      }
      group.position.set(lp.position.x, lp.position.y + 0.35, lp.position.z);
      this.mapGroup.add(group);
      this.pickupVisuals.push({
        id: lp.id,
        type: lp.type,
        mesh: group,
        baseY: lp.position.y + 0.35,
        active: true,
      });
    }

    // 6. Particules de poussière saharienne
    this.createDustParticles(
      Math.round(map.weather.dustParticles * preset.dustMultiplier),
      map.bounds
    );
  }

  public getPickupVisuals(): PickupVisual[] {
    return this.pickupVisuals;
  }

  public setPickupActive(id: string, active: boolean): void {
    const p = this.pickupVisuals.find((item) => item.id === id);
    if (p) {
      p.active = active;
      p.mesh.visible = active;
    }
  }

  /**
   * Adapte dynamiquement le ciel, la position solaire et l'ambiance (Jour / Crépuscule / Nuit).
   */
  public applyTimeOfDay(map: MapDefinition, timeOfDay: TimeOfDay): void {
    if (!this.sunLight || !this.ambientLight || !this.hemiLight || !this.skyDome) return;
    const skyMat = this.skyDome.material as THREE.ShaderMaterial;

    if (timeOfDay === 'sunset') {
      this.sunLight.color.set('#fb923c');
      this.sunLight.intensity = 1.65;
      this.sunBaseOffset.set(-68, 22, -32);
      this.sunLight.position.copy(this.sunBaseOffset);
      this.ambientLight.color.set('#fdba74');
      this.ambientLight.intensity = 0.42;
      this.hemiLight.color.set('#f97316');
      this.hemiLight.groundColor.set('#431407');
      skyMat.uniforms.topColor.value.set('#312e81');
      skyMat.uniforms.bottomColor.value.set('#fb923c');
      skyMat.uniforms.sunColor.value.set('#fed7aa');
      skyMat.uniforms.sunDir.value.copy(this.sunBaseOffset).normalize();
      this.scene.background = new THREE.Color('#fb923c');
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set('#ea580c');
      }
    } else if (timeOfDay === 'night') {
      this.sunLight.color.set('#93c5fd');
      this.sunLight.intensity = 0.65;
      this.sunBaseOffset.set(28, 60, -40);
      this.sunLight.position.copy(this.sunBaseOffset);
      this.ambientLight.color.set('#64748b');
      this.ambientLight.intensity = 0.42;
      this.hemiLight.color.set('#1e3a8a');
      this.hemiLight.groundColor.set('#0f172a');
      skyMat.uniforms.topColor.value.set('#020617');
      skyMat.uniforms.bottomColor.value.set('#1e293b');
      skyMat.uniforms.sunColor.value.set('#bae6fd');
      skyMat.uniforms.sunDir.value.copy(this.sunBaseOffset).normalize();
      this.scene.background = new THREE.Color('#0f172a');
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set('#0f172a');
      }
    } else {
      this.sunLight.color.set(map.lighting.sunColor);
      this.sunLight.intensity = map.lighting.sunIntensity;
      this.sunBaseOffset.set(
        map.lighting.sunPosition.x,
        map.lighting.sunPosition.y,
        map.lighting.sunPosition.z
      );
      this.sunLight.position.copy(this.sunBaseOffset);
      this.ambientLight.color.set(map.lighting.ambientColor);
      this.ambientLight.intensity = map.lighting.ambientIntensity;
      this.hemiLight.color.set(map.lighting.hemisphereSky);
      this.hemiLight.groundColor.set(map.lighting.hemisphereGround);
      skyMat.uniforms.topColor.value.set(map.lighting.skyTopColor);
      skyMat.uniforms.bottomColor.value.set(map.lighting.skyHorizonColor);
      skyMat.uniforms.sunColor.value.set('#fef08a');
      skyMat.uniforms.sunDir.value.copy(this.sunBaseOffset).normalize();
      this.scene.background = new THREE.Color(map.lighting.skyHorizonColor);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set(map.weather.fogColor);
      }
    }
  }

  public updateSunShadowCenter(targetPos: { x: number; z: number }): void {
    if (!this.sunLight) return;
    const snapX = Math.round(targetPos.x / 8) * 8;
    const snapZ = Math.round(targetPos.z / 8) * 8;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.set(
      snapX + this.sunBaseOffset.x,
      this.sunBaseOffset.y,
      snapZ + this.sunBaseOffset.z
    );
    this.sunLight.target.updateMatrixWorld();
  }

  private createSkyDome(topHex: string, horizonHex: string): void {
    const geo = new THREE.SphereGeometry(480, 28, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(topHex) },
        bottomColor: { value: new THREE.Color(horizonHex) },
        sunColor: { value: new THREE.Color('#fef08a') },
        sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y;
          float t = clamp(pow(max(h, 0.0), 0.52), 0.0, 1.0);
          vec3 sky = mix(bottomColor, topColor, t);
          float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
          float halo = pow(sunDot, 12.0) * 0.32;
          float disc = smoothstep(0.9965, 0.9992, sunDot) * 0.95;
          sky += sunColor * (halo + disc);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyDome);
  }

  private createDustParticles(
    count: number,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  ): void {
    this.dustHalfExtent = Math.max(80, bounds.maxX);
    this.dustCount = Math.max(20, count);
    const positions = new Float32Array(this.dustCount * 3);
    for (let i = 0; i < this.dustCount; i++) {
      positions[i * 3] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      positions[i * 3 + 1] = 0.4 + Math.random() * 11;
      positions[i * 3 + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#f5deb3',
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(geo, mat);
    this.scene.add(this.dustPoints);
  }

  public spawnShotTracer(start: THREE.Vector3, end: THREE.Vector3, isEnemy = false): void {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: isEnemy ? '#fb7185' : '#fde047',
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.effectsGroup.add(line);
    this.tracers.push({ line, ttl: 0.085 });

    // Éclair de bouche + bouffée de fumée
    this.muzzleLight.position.copy(start);
    this.muzzleLight.intensity = 5.0;
    this.muzzleLightTtl = 0.055;

    for (let s = 0; s < 2; s++) {
      const smoke = new THREE.Mesh(this.bloodDropGeometry, this.smokeMaterial);
      smoke.position.copy(start);
      smoke.scale.setScalar(1.3);
      this.effectsGroup.add(smoke);
      this.impactParticles.push({
        mesh: smoke,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8),
        ttl: 0.28,
      });
    }
  }

  public spawnImpactBurst(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    isCharacterHit: boolean,
    hitZone: HitZone = 'body'
  ): void {
    const isCritical = hitZone === 'head' || hitZone === 'heart';
    const count = isCharacterHit ? (isCritical ? 16 : 11) : 6;

    for (let i = 0; i < count; i++) {
      const mat = isCharacterHit
        ? i % 2 === 0
          ? this.bloodSparkMaterial
          : this.deepBloodMaterial
        : this.impactMaterial;
      const geo = isCharacterHit ? this.bloodDropGeometry : this.particleGeometry;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(point);
      if (isCharacterHit && isCritical) {
        mesh.scale.setScalar(1.45);
      }
      const spread = isCharacterHit ? 4.8 : 3.5;
      const vel = new THREE.Vector3(
        normal.x * 2.4 + (Math.random() - 0.5) * spread,
        normal.y * 2.2 + Math.random() * (isCharacterHit ? 3.4 : 2.5),
        normal.z * 2.4 + (Math.random() - 0.5) * spread
      );
      this.effectsGroup.add(mesh);
      this.impactParticles.push({ mesh, velocity: vel, ttl: isCharacterHit ? 0.48 : 0.32 });
    }
  }

  public spawnExplosionRing(point: THREE.Vector3, radius: number): void {
    const ringGeo = new THREE.RingGeometry(0.4, Math.max(1.2, radius * 0.75), 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, point.y + 0.12, point.z);
    this.effectsGroup.add(ring);
    this.impactParticles.push({
      mesh: ring,
      velocity: new THREE.Vector3(0, 0.8, 0),
      ttl: 0.36,
    });
  }

  public applyQualityPreset(preset: QualityPreset): void {
    if (this.sunLight) {
      this.sunLight.castShadow = preset.shadowsEnabled;
    }
    this.mapGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.receiveShadow = preset.shadowsEnabled;
      }
    });
  }

  public update(dt: number, elapsedTime: number): void {
    // Animation eau de l'oasis + brise légère dans les feuillages
    const waterMat = this.textureGenerator.getMaterial('water');
    if (waterMat.map) {
      waterMat.map.offset.x = (elapsedTime * 0.06) % 1;
      waterMat.map.offset.y = (elapsedTime * 0.04) % 1;
    }

    for (let i = 0; i < this.foliageMeshes.length; i++) {
      const f = this.foliageMeshes[i];
      f.mesh.position.x = f.baseX + Math.sin(elapsedTime * 1.45 + f.baseZ * 0.15) * 0.06;
    }

    // Flottement des caisses de loot
    for (const p of this.pickupVisuals) {
      if (!p.active) continue;
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.position.y = p.baseY + Math.sin(elapsedTime * 2.5 + p.mesh.position.x) * 0.1;
    }

    // Dérive des particules de poussière (adaptée à la taille de la carte)
    if (this.dustPoints) {
      const bound = this.dustHalfExtent;
      const attr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.dustCount; i++) {
        let x = attr.getX(i) + dt * 1.15;
        let z = attr.getZ(i) + dt * 0.45;
        if (x > bound) x = -bound;
        if (z > bound) z = -bound;
        attr.setX(i, x);
        attr.setZ(i, z);
      }
      attr.needsUpdate = true;
    }

    // Extinction de l'éclair de tir
    if (this.muzzleLightTtl > 0) {
      this.muzzleLightTtl -= dt;
      if (this.muzzleLightTtl <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }

    // Nettoyage des traceurs de tir
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.ttl -= dt;
      if (tr.ttl <= 0) {
        this.effectsGroup.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Mise à jour des particules d'impact
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const p = this.impactParticles[i];
      p.ttl -= dt;
      if (p.ttl <= 0) {
        this.effectsGroup.remove(p.mesh);
        this.impactParticles.splice(i, 1);
      } else {
        p.velocity.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.scale.setScalar(Math.max(0.1, p.ttl / 0.32));
      }
    }
  }

  public setSafeZoneVisual(radius: number | null): void {
    if (radius === null) {
      if (this.safeZoneCylinder) {
        this.safeZoneCylinder.visible = false;
      }
      return;
    }
    if (!this.safeZoneCylinder) {
      const geo = new THREE.CylinderGeometry(1, 1, 24, 48, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.safeZoneCylinder = new THREE.Mesh(geo, mat);
      this.safeZoneCylinder.position.y = 11;
      this.scene.add(this.safeZoneCylinder);
    }
    this.safeZoneCylinder.visible = true;
    this.safeZoneCylinder.scale.set(radius, 1, radius);
  }

  public setStrongholdMarkers(
    strongholds: ReadonlyArray<{
      id: string;
      position: { x: number; y: number; z: number };
      captureRadius: number;
      liberated: boolean;
    }>
  ): void {
    this.clearStrongholdMarkers();
    for (const sh of strongholds) {
      const mat = new THREE.MeshBasicMaterial({
        color: sh.liberated ? '#22c55e' : '#f59e0b',
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringGeo = new THREE.RingGeometry(sh.captureRadius - 0.35, sh.captureRadius, 36);
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sh.position.x, sh.position.y + 0.12, sh.position.z);

      const pillarGeo = new THREE.CylinderGeometry(0.85, 1.35, 68, 16, 1, true);
      const pillar = new THREE.Mesh(pillarGeo, mat);
      pillar.position.set(sh.position.x, sh.position.y + 34, sh.position.z);

      this.effectsGroup.add(ring);
      this.effectsGroup.add(pillar);
      this.strongholdVisuals.set(sh.id, { ring, pillar, mat });
    }
  }

  public updateStrongholdMarkers(
    strongholds: ReadonlyArray<{ id: string; liberated: boolean; progress: number }>
  ): void {
    for (const sh of strongholds) {
      const vis = this.strongholdVisuals.get(sh.id);
      if (!vis) continue;
      if (sh.liberated) {
        vis.mat.color.set('#22c55e');
        vis.mat.opacity = 0.28;
      } else if (sh.progress > 0.01) {
        vis.mat.color.set('#38bdf8');
        vis.mat.opacity = 0.55;
      } else {
        vis.mat.color.set('#f59e0b');
        vis.mat.opacity = 0.42;
      }
    }
  }

  public clearStrongholdMarkers(): void {
    for (const vis of this.strongholdVisuals.values()) {
      this.effectsGroup.remove(vis.ring);
      this.effectsGroup.remove(vis.pillar);
      vis.ring.geometry.dispose();
      vis.pillar.geometry.dispose();
      vis.mat.dispose();
    }
    this.strongholdVisuals.clear();
  }

  public clearMap(): void {
    this.clearStrongholdMarkers();
    this.mapGroup.clear();
    this.waterMeshes = [];
    this.foliageMeshes = [];
    this.pickupVisuals = [];

    if (this.sunLight) {
      this.scene.remove(this.sunLight.target);
      this.scene.remove(this.sunLight);
      this.sunLight = null;
    }
    if (this.hemiLight) {
      this.scene.remove(this.hemiLight);
      this.hemiLight = null;
    }
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.skyDome) {
      this.scene.remove(this.skyDome);
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
      this.skyDome = null;
    }
    if (this.dustPoints) {
      this.scene.remove(this.dustPoints);
      this.dustPoints.geometry.dispose();
      (this.dustPoints.material as THREE.Material).dispose();
      this.dustPoints = null;
    }
  }

  public dispose(): void {
    this.clearMap();
    this.entitiesGroup.clear();
    this.effectsGroup.clear();
    this.unitBoxGeometry.dispose();
    this.particleGeometry.dispose();
    this.bloodDropGeometry.dispose();
    this.impactMaterial.dispose();
    this.bloodSparkMaterial.dispose();
    this.deepBloodMaterial.dispose();
    this.smokeMaterial.dispose();
    this.textureGenerator.dispose();
  }
}
