import * as THREE from 'three';
import type { VoxelMaterialType } from '@shared/types/map';

/**
 * Générateur de textures voxel procédurales haute netteté via CanvasTexture.
 * Aucun asset payant requis : chaque matériau possède des détails de grain,
 * de relief simulé et des motifs inspirés de l'architecture sahélienne.
 */
export class TextureGenerator {
  private materialCache = new Map<VoxelMaterialType, THREE.MeshStandardMaterial>();
  private textureCache: THREE.Texture[] = [];

  public getMaterial(type: VoxelMaterialType): THREE.MeshStandardMaterial {
    const existing = this.materialCache.get(type);
    if (existing) return existing;

    const mat = this.createMaterial(type);
    this.materialCache.set(type, mat);
    return mat;
  }

  private createCanvasTexture(
    size: number,
    drawFn: (ctx: CanvasRenderingContext2D, size: number) => void,
    repeat = 1
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textureCache.push(texture);
    return texture;
  }

  private drawVoxelNoise(
    ctx: CanvasRenderingContext2D,
    size: number,
    baseHex: string,
    variation: number,
    grid = 16
  ): void {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    const cell = size / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        // Bruit déterministe léger pour un rendu voxel propre
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const frac = hash - Math.floor(hash);
        const delta = Math.round((frac - 0.5) * variation);
        ctx.fillStyle = delta >= 0 ? `rgba(255,255,255,${delta / 255})` : `rgba(0,0,0,${-delta / 255})`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  private createBumpTexture(
    size: number,
    drawFn: (ctx: CanvasRenderingContext2D, size: number) => void,
    repeat = 1
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) drawFn(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    this.textureCache.push(texture);
    return texture;
  }

  private createMaterial(type: VoxelMaterialType): THREE.MeshStandardMaterial {
    switch (type) {
      case 'sand': {
        const tex = this.createCanvasTexture(
          256,
          (ctx, s) => {
            this.drawVoxelNoise(ctx, s, '#d9a45b', 28, 32);
            ctx.fillStyle = 'rgba(180, 120, 48, 0.28)';
            for (let y = 0; y < s; y += 32) {
              ctx.fillRect(0, y, s, 7);
            }
          },
          18
        );
        const bump = this.createBumpTexture(
          128,
          (ctx, s) => {
            this.drawVoxelNoise(ctx, s, '#808080', 40, 16);
            ctx.fillStyle = 'rgba(210,210,210,0.28)';
            for (let y = 0; y < s; y += 24) ctx.fillRect(0, y, s, 5);
          },
          16
        );
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.035,
          roughness: 0.94,
          metalness: 0.02,
        });
      }

      case 'adobe': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#c88a55', 28, 16);
          ctx.strokeStyle = 'rgba(110, 62, 30, 0.28)';
          ctx.lineWidth = 4;
          for (let y = 0; y < s; y += 64) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(s, y);
            ctx.stroke();
            const offset = (y / 64) % 2 === 0 ? 0 : 64;
            for (let x = offset; x < s; x += 128) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + 64);
              ctx.stroke();
            }
          }
        });
        const bump = this.createBumpTexture(128, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#9a9a9a', 32, 16);
          ctx.strokeStyle = '#303030';
          ctx.lineWidth = 3;
          for (let y = 0; y < s; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(s, y);
            ctx.stroke();
          }
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.055,
          roughness: 0.9,
          metalness: 0.02,
        });
      }

      case 'adobe_dark': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#9c6239', 30, 16);
          ctx.fillStyle = 'rgba(65, 36, 18, 0.22)';
          for (let y = 16; y < s; y += 48) {
            ctx.fillRect(0, y, s, 8);
          }
        });
        const bump = this.createBumpTexture(128, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#858585', 36, 16);
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.045,
          roughness: 0.92,
          metalness: 0.03,
        });
      }

      case 'sandstone': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#d8b482', 22, 16);
          ctx.strokeStyle = 'rgba(120, 86, 48, 0.35)';
          ctx.lineWidth = 3;
          ctx.strokeRect(8, 8, s - 16, s - 16);
        });
        const bump = this.createBumpTexture(128, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#888888', 28, 16);
          ctx.strokeStyle = '#383838';
          ctx.lineWidth = 3;
          ctx.strokeRect(4, 4, s - 8, s - 8);
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.045,
          roughness: 0.85,
          metalness: 0.05,
        });
      }

      case 'carved_stone': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#9f8e76', 24, 16);
          ctx.strokeStyle = 'rgba(64, 52, 38, 0.55)';
          ctx.lineWidth = 6;
          ctx.strokeRect(16, 16, s - 32, s - 32);
          ctx.beginPath();
          ctx.moveTo(s / 2, 24);
          ctx.lineTo(s - 24, s / 2);
          ctx.lineTo(s / 2, s - 24);
          ctx.lineTo(24, s / 2);
          ctx.closePath();
          ctx.stroke();
        });
        const bump = this.createBumpTexture(128, (ctx, s) => {
          ctx.fillStyle = '#a0a0a0';
          ctx.fillRect(0, 0, s, s);
          ctx.strokeStyle = '#2a2a2a';
          ctx.lineWidth = 4;
          ctx.strokeRect(8, 8, s - 16, s - 16);
          ctx.beginPath();
          ctx.moveTo(s / 2, 12);
          ctx.lineTo(s - 12, s / 2);
          ctx.lineTo(s / 2, s - 12);
          ctx.lineTo(12, s / 2);
          ctx.closePath();
          ctx.stroke();
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.065,
          roughness: 0.78,
          metalness: 0.08,
        });
      }

      case 'wood': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#6d4528', 22, 16);
          ctx.fillStyle = 'rgba(42, 22, 10, 0.32)';
          for (let x = 0; x < s; x += 32) {
            ctx.fillRect(x, 0, 5, s);
          }
        });
        const bump = this.createBumpTexture(128, (ctx, s) => {
          ctx.fillStyle = '#909090';
          ctx.fillRect(0, 0, s, s);
          ctx.fillStyle = '#303030';
          for (let x = 0; x < s; x += 16) ctx.fillRect(x, 0, 3, s);
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: bump,
          bumpScale: 0.04,
          roughness: 0.82,
          metalness: 0.04,
        });
      }

      case 'gold_trim': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#e5b93b', 20, 16);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 6;
          ctx.strokeRect(10, 10, s - 20, s - 20);
        });
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.78 });
      }

      case 'market_cloth_red':
        return this.createClothMaterial('#b91c1c', '#f59e0b');

      case 'market_cloth_blue':
        return this.createClothMaterial('#1d4ed8', '#fef3c7');

      case 'market_cloth_gold':
        return this.createClothMaterial('#d97706', '#78350f');

      case 'water': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#0ea5e9', 24, 16);
          ctx.fillStyle = 'rgba(224, 242, 254, 0.35)';
          for (let y = 16; y < s; y += 48) {
            ctx.fillRect(16, y, 72, 10);
            ctx.fillRect(136, y + 20, 80, 10);
          }
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.14,
          metalness: 0.25,
          transparent: true,
          opacity: 0.86,
        });
      }

      case 'grass_oasis': {
        const tex = this.createCanvasTexture(
          256,
          (ctx, s) => {
            this.drawVoxelNoise(ctx, s, '#3f681c', 36, 24);
            ctx.fillStyle = 'rgba(101, 130, 38, 0.28)';
            for (let y = 10; y < s; y += 44) {
              ctx.fillRect((y * 3) % s, y, 22, 6);
            }
          },
          16
        );
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.01 });
      }

      case 'palm_trunk': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#784826', 25, 16);
          ctx.fillStyle = 'rgba(40, 20, 10, 0.38)';
          for (let y = 0; y < s; y += 32) {
            ctx.fillRect(0, y, s, 8);
          }
        });
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.02 });
      }

      case 'palm_leaf': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#235920', 36, 16);
          ctx.fillStyle = 'rgba(74, 124, 42, 0.3)';
          for (let i = 0; i < s; i += 32) {
            ctx.fillRect(0, i, s, 6);
          }
        });
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.01 });
      }

      case 'terracotta': {
        const tex = this.createCanvasTexture(256, (ctx, s) => {
          this.drawVoxelNoise(ctx, s, '#b85032', 24, 16);
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, s * 0.3);
          ctx.lineTo(s, s * 0.3);
          ctx.moveTo(0, s * 0.7);
          ctx.lineTo(s, s * 0.7);
          ctx.stroke();
        });
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.76, metalness: 0.06 });
      }
    }
  }

  private createClothMaterial(baseColor: string, stripeColor: string): THREE.MeshStandardMaterial {
    const tex = this.createCanvasTexture(256, (ctx, s) => {
      this.drawVoxelNoise(ctx, s, baseColor, 18, 16);
      ctx.fillStyle = stripeColor;
      for (let x = 0; x < s; x += 64) {
        ctx.fillRect(x, 0, 14, s);
      }
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.02 });
  }

  public dispose(): void {
    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    for (const tex of this.textureCache) {
      tex.dispose();
    }
    this.materialCache.clear();
    this.textureCache = [];
  }
}
