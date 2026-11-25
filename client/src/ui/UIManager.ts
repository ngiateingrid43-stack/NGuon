import type { EventBus } from '@client/core/EventBus';
import type { LocalizationManager } from '@client/localization/LocalizationManager';
import type { PlayerProgressSave, UserSettings } from '@shared/validation/schemas';
import { HUDManager } from './HUDManager';
import { MenuManager, type MenuActions } from './MenuManager';
import type { KillFeedEntry } from '@shared/types/common';

/**
 * Orchestre le HUD et les menus tout en réagissant aux événements de combat.
 */
export class UIManager {
  public readonly hud: HUDManager;
  public readonly menu: MenuManager;
  private killFeed: KillFeedEntry[] = [];

  constructor(
    container: HTMLElement,
    eventBus: EventBus,
    private l10n: LocalizationManager,
    initialSettings: UserSettings,
    actions: MenuActions
  ) {
    this.hud = new HUDManager(container, l10n);
    this.menu = new MenuManager(container, l10n, initialSettings, actions);

    eventBus.on('combat:hitmarker', ({ isHeadshot }) => {
      this.hud.triggerHitmarker(isHeadshot);
    });

    eventBus.on('combat:damage', (ev) => {
      if (ev.targetId === 'player') {
        this.hud.triggerDamageFlash();
      }
    });

    eventBus.on('combat:killFeed', (entry) => {
      this.killFeed.push(entry);
      if (this.killFeed.length > 20) {
        this.killFeed.shift();
      }
      this.hud.updateKillFeed(this.killFeed);
    });

    eventBus.on('pickup:collected', ({ type }) => {
      const msg =
        type === 'health'
          ? this.l10n.t('pickupHealth')
          : type === 'armor'
            ? this.l10n.t('pickupArmor')
            : this.l10n.t('pickupAmmo');
      this.hud.showToast(msg);
    });
  }

  public clearKillFeed(): void {
    this.killFeed = [];
    this.hud.updateKillFeed([]);
  }

  public syncSave(save: PlayerProgressSave): void {
    this.menu.updateCareerBanner(save);
  }
}
