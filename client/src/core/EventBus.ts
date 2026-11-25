import type { DamageEvent, KillFeedEntry, MatchPhase } from '@shared/types/common';
import type { MatchSummary } from '@shared/types/entity';

/**
 * Bus d'événements typé permettant de découpler la simulation, le rendu, l'audio et l'UI.
 */
export interface GameEventMap {
  'match:phaseChanged': { phase: MatchPhase };
  'match:started': { mapId: string; botCount: number };
  'match:ended': MatchSummary;
  'combat:damage': DamageEvent;
  'combat:killFeed': KillFeedEntry;
  'combat:hitmarker': { isHeadshot: boolean; isElimination: boolean };
  'combat:playerDamaged': { amount: number; sourceDirection: { x: number; y: number; z: number } };
  'weapon:fired': { weaponId: string; isPlayer: boolean };
  'weapon:reloaded': { weaponId: string };
  'pickup:collected': { type: 'ammo' | 'health' | 'armor' | 'weapon_crate'; value: number };
  'settings:updated': void;
  'ui:toast': { message: string; tone?: 'info' | 'success' | 'warning' };
}

type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<unknown>);
    }
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<GameEventMap[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
