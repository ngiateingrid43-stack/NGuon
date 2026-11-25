import type { KillFeedEntry, MatchPhase } from '@shared/types/common';
import type { CombatantState, MatchConfig } from '@shared/types/entity';
import { GAMEPLAY_CONSTANTS } from '@shared/constants/game';

/**
 * État central de la partie en cours.
 */
export class GameState {
  public phase: MatchPhase = 'menu';
  public timeRemaining: number = GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION;
  public elapsedTime = 0;
  public config: MatchConfig = {
    mode: 'deathmatch',
    mapId: 'tombouctou',
    botCount: GAMEPLAY_CONSTANTS.DEFAULT_BOT_COUNT,
    botDifficulty: 'intermediate',
    durationSeconds: GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION,
    killLimit: GAMEPLAY_CONSTANTS.DEFAULT_KILL_LIMIT,
    playerHeroId: 'sundiata',
    playerWeaponId: 'flintlock_musket',
  };

  public player: CombatantState | null = null;
  public bots: CombatantState[] = [];
  public killFeed: KillFeedEntry[] = [];

  public resetForMatch(config: MatchConfig): void {
    this.config = { ...config };
    this.timeRemaining = config.durationSeconds;
    this.elapsedTime = 0;
    this.killFeed = [];
    this.bots = [];
    this.player = null;
  }

  public getAllCombatants(): CombatantState[] {
    return this.player ? [this.player, ...this.bots] : [...this.bots];
  }

  public findCombatant(id: string): CombatantState | undefined {
    if (this.player && this.player.id === id) return this.player;
    return this.bots.find((b) => b.id === id);
  }
}
