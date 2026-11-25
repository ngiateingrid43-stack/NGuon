import type { GraphicsProfile } from '@shared/types/common';

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface QualityPreset {
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  dustMultiplier: number;
  antialias: boolean;
  fogScale: number;
}

const QUALITY_PRESETS: Record<Exclude<GraphicsProfile, 'auto'>, QualityPreset> = {
  low: {
    pixelRatioCap: 1.0,
    shadowsEnabled: false,
    shadowMapSize: 512,
    dustMultiplier: 0.25,
    antialias: false,
    fogScale: 0.75,
  },
  medium: {
    pixelRatioCap: 1.25,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    dustMultiplier: 0.55,
    antialias: true,
    fogScale: 0.9,
  },
  high: {
    pixelRatioCap: 1.75,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    dustMultiplier: 1.0,
    antialias: true,
    fogScale: 1.0,
  },
  ultra: {
    pixelRatioCap: 2.0,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    dustMultiplier: 1.35,
    antialias: true,
    fogScale: 1.15,
  },
};

/**
 * Mesure les performances temps réel et fournit les paramètres graphiques adaptés.
 */
export class PerformanceManager {
  private frameCount = 0;
  private accumTime = 0;
  private currentFps = 60;
  private currentFrameMs = 16.6;
  private activeProfile: GraphicsProfile = 'high';

  public setProfile(profile: GraphicsProfile): void {
    this.activeProfile = profile;
  }

  public getEffectiveProfile(): Exclude<GraphicsProfile, 'auto'> {
    if (this.activeProfile !== 'auto') {
      return this.activeProfile;
    }
    if (this.currentFps < 34) return 'low';
    if (this.currentFps < 50) return 'medium';
    return 'high';
  }

  public getPreset(profile?: GraphicsProfile): QualityPreset {
    const resolved = profile && profile !== 'auto' ? profile : this.getEffectiveProfile();
    return QUALITY_PRESETS[resolved];
  }

  public recordFrame(dtSeconds: number): void {
    this.frameCount += 1;
    this.accumTime += dtSeconds;
    this.currentFrameMs = this.currentFrameMs * 0.9 + dtSeconds * 1000 * 0.1;

    if (this.accumTime >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.accumTime);
      this.frameCount = 0;
      this.accumTime = 0;
    }
  }

  public getMetrics(rendererInfo?: {
    render: { calls: number; triangles: number };
    memory: { geometries: number; textures: number };
  }): PerformanceMetrics {
    return {
      fps: this.currentFps,
      frameTimeMs: Number(this.currentFrameMs.toFixed(1)),
      drawCalls: rendererInfo?.render.calls ?? 0,
      triangles: rendererInfo?.render.triangles ?? 0,
      geometries: rendererInfo?.memory.geometries ?? 0,
      textures: rendererInfo?.memory.textures ?? 0,
    };
  }
}
