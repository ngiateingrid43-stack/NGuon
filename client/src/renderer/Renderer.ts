import * as THREE from 'three';
import type { QualityPreset } from '@client/performance/PerformanceManager';

/**
 * Encapsule le WebGLRenderer Three.js, la gestion des ombres et du redimensionnement.
 */
export class Renderer {
  public readonly webgl: THREE.WebGLRenderer;

  constructor(container: HTMLElement, initialPreset: QualityPreset) {
    this.webgl = this.createWebGLRenderer(initialPreset);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08;
    this.webgl.shadowMap.enabled = initialPreset.shadowsEnabled;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyPreset(initialPreset);
    this.resize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.webgl.domElement);
  }

  private createWebGLRenderer(initialPreset: QualityPreset): THREE.WebGLRenderer {
    const attempts: THREE.WebGLRendererParameters[] = [
      { antialias: initialPreset.antialias, powerPreference: 'high-performance' },
      { antialias: false, powerPreference: 'default' },
      { antialias: false, failIfMajorPerformanceCaveat: false },
    ];
    let lastErr: unknown;
    for (const opts of attempts) {
      try {
        return new THREE.WebGLRenderer(opts);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('WebGL est désactivé ou indisponible sur cet appareil.');
  }

  public applyPreset(preset: QualityPreset): void {
    const dpr = Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap);
    this.webgl.setPixelRatio(dpr);
    this.webgl.shadowMap.enabled = preset.shadowsEnabled;
  }

  public resize(width: number, height: number): void {
    this.webgl.setSize(Math.max(1, width), Math.max(1, height), false);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webgl.render(scene, camera);
  }

  public getDomElement(): HTMLCanvasElement {
    return this.webgl.domElement;
  }

  public getStats() {
    return this.webgl.info;
  }

  public dispose(): void {
    this.webgl.dispose();
    if (this.webgl.domElement.parentElement) {
      this.webgl.domElement.parentElement.removeChild(this.webgl.domElement);
    }
  }
}
