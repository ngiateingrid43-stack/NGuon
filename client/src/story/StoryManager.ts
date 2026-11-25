import {
  OPEN_WORLD_ADVENTURE,
  StoryChapter,
  getStoryChapter,
} from '@shared/story/storyCampaign';
import { Vec3 } from '@shared/types/common';

export interface StrongholdRuntime {
  id: string;
  nameFr: string;
  nameEn: string;
  loreFr?: string;
  loreEn?: string;
  position: Vec3;
  captureRadius: number;
  progress: number; // 0..1
  liberated: boolean;
}

export interface StoryHudState {
  chapterTitle: string;
  eraLabel: string;
  strongholds: StrongholdRuntime[];
  liberatedCount: number;
  totalCount: number;
  activeCaptureName: string | null;
  activeCaptureProgress: number;
  nearestTargetName: string | null;
  nearestTargetDist: number;
  nearestTargetPos: Vec3 | null;
  completed: boolean;
}

/**
 * Gestionnaire de campagne Histoire : gère à la fois la grande aventure en Monde Ouvert
 * sur tout le continent africain (sans murs) et les missions historiques.
 */
export class StoryManager {
  private activeChapter: StoryChapter | null = null;
  private isOpenWorld = false;
  private strongholds: StrongholdRuntime[] = [];
  private completed = false;
  private announcedLoreIds = new Set<string>();

  public startOpenWorldAdventure(): void {
    this.isOpenWorld = true;
    this.activeChapter = null;
    this.completed = false;
    this.announcedLoreIds.clear();
    this.strongholds = OPEN_WORLD_ADVENTURE.strongholds.map((s) => ({
      id: s.id,
      nameFr: s.nameFr,
      nameEn: s.nameEn,
      loreFr: s.loreFr,
      loreEn: s.loreEn,
      position: { ...s.position },
      captureRadius: s.captureRadius,
      progress: 0,
      liberated: false,
    }));
  }

  public startChapter(chapterId: string): StoryChapter {
    this.isOpenWorld = false;
    const chapter = getStoryChapter(chapterId);
    this.activeChapter = chapter;
    this.completed = false;
    this.announcedLoreIds.clear();
    this.strongholds = chapter.strongholds.map((s) => ({
      ...s,
      position: { ...s.position },
      progress: 0,
      liberated: false,
    }));
    return chapter;
  }

  public reset(): void {
    this.activeChapter = null;
    this.isOpenWorld = false;
    this.strongholds = [];
    this.completed = false;
    this.announcedLoreIds.clear();
  }

  public getActiveChapter(): StoryChapter | null {
    return this.activeChapter;
  }

  public isOpenWorldActive(): boolean {
    return this.isOpenWorld;
  }

  public getStrongholds(): readonly StrongholdRuntime[] {
    return this.strongholds;
  }

  public update(dt: number, playerPos: Vec3, interactHeld: boolean): {
    newlyLiberated: StrongholdRuntime | null;
    enteredRegionLore: string | null;
    chapterCompleted: boolean;
    promptText: string | null;
  } {
    if ((!this.activeChapter && !this.isOpenWorld) || this.completed) {
      return {
        newlyLiberated: null,
        enteredRegionLore: null,
        chapterCompleted: false,
        promptText: null,
      };
    }

    let newlyLiberated: StrongholdRuntime | null = null;
    let enteredRegionLore: string | null = null;
    let promptText: string | null = null;

    for (const sh of this.strongholds) {
      if (sh.liberated) continue;
      const distXZ = Math.hypot(playerPos.x - sh.position.x, playerPos.z - sh.position.z);
      const distY = Math.abs(playerPos.y - sh.position.y);

      if (distXZ <= sh.captureRadius + 24 && sh.loreFr && !this.announcedLoreIds.has(sh.id)) {
        this.announcedLoreIds.add(sh.id);
        enteredRegionLore = sh.loreFr;
      }

      if (distXZ <= sh.captureRadius && distY <= 6.0) {
        const rate = interactHeld ? 0.55 : 0.25;
        sh.progress = Math.min(1, sh.progress + dt * rate);
        promptText = `Libération : ${sh.nameFr} (${Math.round(sh.progress * 100)}%) — Maintenez E pour accélérer`;

        if (sh.progress >= 1) {
          sh.liberated = true;
          newlyLiberated = sh;
          break;
        }
      } else if (sh.progress > 0 && sh.progress < 1) {
        sh.progress = Math.max(0, sh.progress - dt * 0.05);
      }
    }

    if (this.strongholds.length > 0 && this.strongholds.every((s) => s.liberated)) {
      this.completed = true;
    }

    return {
      newlyLiberated,
      enteredRegionLore,
      chapterCompleted: this.completed,
      promptText,
    };
  }

  public getHudState(language: 'fr' | 'en', playerPos?: Vec3): StoryHudState | null {
    if (!this.activeChapter && !this.isOpenWorld) return null;
    const liberating = this.strongholds.find((s) => !s.liberated && s.progress > 0.01) ?? null;
    const liberatedCount = this.strongholds.filter((s) => s.liberated).length;

    let nearestTargetName: string | null = null;
    let nearestTargetDist = Infinity;
    let nearestTargetPos: Vec3 | null = null;
    if (playerPos) {
      for (const sh of this.strongholds) {
        if (sh.liberated) continue;
        const d = Math.hypot(playerPos.x - sh.position.x, playerPos.z - sh.position.z);
        if (d < nearestTargetDist) {
          nearestTargetDist = d;
          nearestTargetName = language === 'fr' ? sh.nameFr : sh.nameEn;
          nearestTargetPos = { ...sh.position };
        }
      }
    }

    return {
      chapterTitle: this.isOpenWorld
        ? language === 'fr'
          ? OPEN_WORLD_ADVENTURE.titleFr
          : OPEN_WORLD_ADVENTURE.titleEn
        : language === 'fr'
          ? this.activeChapter!.titleFr
          : this.activeChapter!.titleEn,
      eraLabel: this.isOpenWorld ? 'MONDE OUVERT • AFRIQUE' : this.activeChapter!.eraLabel,
      strongholds: this.strongholds,
      liberatedCount,
      totalCount: this.strongholds.length,
      activeCaptureName: liberating
        ? language === 'fr'
          ? liberating.nameFr
          : liberating.nameEn
        : null,
      activeCaptureProgress: liberating?.progress ?? 0,
      nearestTargetName,
      nearestTargetDist: Number.isFinite(nearestTargetDist) ? Math.round(nearestTargetDist) : 0,
      nearestTargetPos,
      completed: this.completed,
    };
  }
}
