import type { GameMode, HitZone, KillFeedEntry } from '@shared/types/common';
import type { CombatantState } from '@shared/types/entity';
import type { HeroRuntimeState } from '@shared/types/hero';
import type { PlayerInventory } from '@shared/types/inventory';
import type { MapDefinition } from '@shared/types/map';
import type { PerformanceMetrics } from '@client/performance/PerformanceManager';
import type { LocalizationManager } from '@client/localization/LocalizationManager';
import type { StoryHudState } from '@client/story/StoryManager';
import { getHeroDefinition } from '@shared/heroes/heroesConfig';
import { getWeaponIllustrationSvg } from '@client/ui/ArtworkGallery';
import {
  CONSUMABLES_CONFIG,
  RARITY_LABELS_EN,
  RARITY_LABELS_FR,
  getWeaponDefinition,
} from '@shared/weapons/weaponsConfig';
import { RARITY_COLORS } from '@shared/constants/game';

/**
 * Gère l'affichage du HUD en partie : santé, armure, munitions, réticule dynamique,
 * hitmarker, mini-carte 2D, kill feed, tableau des scores et diagnostics.
 */
export class HUDManager {
  private root: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D | null;
  private hitmarkerTimer = 0;
  private hitmarkerHeadshot = false;
  private damageFlashTimer = 0;
  private toastTimer = 0;
  private killBannerTimer = 0;
  private dirHitTimer = 0;
  private dirHitAngleDeg = 0;
  private floatingDamages: Array<{ el: HTMLElement; ttl: number }> = [];

  // Éléments DOM cachés pour éviter des requêtes répétées
  private elHealthVal!: HTMLElement;
  private elHealthBar!: HTMLElement;
  private elArmorVal!: HTMLElement;
  private elArmorBar!: HTMLElement;
  private elShieldRow!: HTMLElement;
  private elShieldVal!: HTMLElement;
  private elShieldBar!: HTMLElement;
  private elAmmoMag!: HTMLElement;
  private elAmmoRes!: HTMLElement;
  private elWeaponName!: HTMLElement;
  private elWeaponRarity!: HTMLElement;
  private elInventorySlots!: HTMLElement;
  private elAbilityBox!: HTMLElement;
  private elInteractPrompt!: HTMLElement;
  private elReloadBar!: HTMLElement;
  private elTimer!: HTMLElement;
  private elScoreSummary!: HTMLElement;
  private elKillFeed!: HTMLElement;
  private elCrosshair!: HTMLElement;
  private elTargetTag!: HTMLElement;
  private elZoneWarning!: HTMLElement;
  private elHitmarker!: HTMLElement;
  private elDamageFlash!: HTMLElement;
  private elRespawnBanner!: HTMLElement;
  private elRespawnTimer!: HTMLElement;
  private elLockPrompt!: HTMLElement;
  private elScoreboard!: HTMLElement;
  private elScoreboardBody!: HTMLElement;
  private elDiag!: HTMLElement;
  private elToast!: HTMLElement;
  private elStoryBox!: HTMLElement;
  private elDamageNumbers!: HTMLElement;
  private elDamageDir!: HTMLElement;

  constructor(container: HTMLElement, private l10n: LocalizationManager) {
    this.root = document.createElement('div');
    this.root.id = 'hud-root';
    this.root.className = 'hud-root hidden';
    this.root.innerHTML = this.buildMarkup();
    container.appendChild(this.root);

    this.minimapCanvas = this.root.querySelector('#hud-minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.cacheRefs();
  }

  private buildMarkup(): string {
    return `
      <div class="hud-damage-flash" id="hud-damage-flash"></div>
      <div class="hud-damage-numbers" id="hud-damage-numbers"></div>

      <div class="hud-top-left">
        <div class="minimap-frame">
          <canvas id="hud-minimap-canvas" width="144" height="144"></canvas>
          <div class="minimap-label" id="hud-minimap-label">TOMBOUCTOU</div>
        </div>
        <div class="hud-diagnostics" id="hud-diagnostics">FPS: 60</div>
        <div class="hud-story-box hidden" id="hud-story-box"></div>
      </div>

      <div class="hud-top-center">
        <div class="match-timer-box">
          <span id="hud-timer">05:00</span>
          <span class="match-score-pill" id="hud-score-summary">0 / 15</span>
        </div>
        <div class="hud-compass" id="hud-compass">
          <span class="compass-dir" id="hud-compass-heading">N · 0°</span>
          <span class="compass-target hidden" id="hud-compass-target">◆ Bastion</span>
        </div>
        <div class="hud-kill-banner hidden" id="hud-kill-banner"></div>
        <div class="hud-zone-warning hidden" id="hud-zone-warning">HORS ZONE DE SÉCURITÉ !</div>
      </div>

      <div class="hud-top-right">
        <div class="kill-feed" id="hud-kill-feed"></div>
      </div>

      <div class="hud-center">
        <div class="hud-damage-dir hidden" id="hud-damage-dir">
          <div class="hud-damage-arrow">▲</div>
        </div>
        <div class="crosshair" id="hud-crosshair">
          <span class="ch-arm ch-top"></span>
          <span class="ch-arm ch-bottom"></span>
          <span class="ch-arm ch-left"></span>
          <span class="ch-arm ch-right"></span>
          <span class="ch-dot"></span>
        </div>
        <div class="hud-target-tag hidden" id="hud-target-tag"></div>
        <div class="hitmarker hidden" id="hud-hitmarker"></div>
        <div class="reload-indicator hidden" id="hud-reload-bar">RECHARGEMENT...</div>
        <div class="hud-interact-prompt hidden" id="hud-interact-prompt"></div>
        <div class="hud-toast hidden" id="hud-toast"></div>
      </div>

      <div class="hud-lock-prompt hidden" id="hud-lock-prompt"></div>

      <div class="hud-respawn-banner hidden" id="hud-respawn-banner">
        <div class="respawn-title" id="hud-respawn-label">RÉAPPARITION DANS</div>
        <div class="respawn-count" id="hud-respawn-timer">3.0s</div>
      </div>

      <div class="hud-bottom-left">
        <div class="ability-card" id="hud-ability-box"></div>
        <div class="vitals-card">
          <div class="vital-row hidden" id="hud-shield-row">
            <span class="vital-label">BOUCLIER</span>
            <div class="vital-bar-bg"><div class="vital-bar shield-bar" id="hud-shield-bar"></div></div>
            <span class="vital-num" id="hud-shield-val">0</span>
          </div>
          <div class="vital-row">
            <span class="vital-label" id="hud-armor-label">ARMURE</span>
            <div class="vital-bar-bg"><div class="vital-bar armor-bar" id="hud-armor-bar"></div></div>
            <span class="vital-num" id="hud-armor-val">50</span>
          </div>
          <div class="vital-row">
            <span class="vital-label" id="hud-health-label">SANTÉ</span>
            <div class="vital-bar-bg"><div class="vital-bar health-bar" id="hud-health-bar"></div></div>
            <span class="vital-num" id="hud-health-val">100</span>
          </div>
        </div>
      </div>

      <div class="hud-bottom-right">
        <div class="weapon-card">
          <div class="weapon-header">
            <div class="hud-weapon-art" id="hud-weapon-art"></div>
            <div class="weapon-header-meta">
              <span class="weapon-rarity-badge" id="hud-weapon-rarity">◆ RARE</span>
              <span class="weapon-name" id="hud-weapon-name">Silex de Gao</span>
            </div>
          </div>
          <div class="ammo-readout">
            <span class="ammo-mag" id="hud-ammo-mag">12</span>
            <span class="ammo-sep">/</span>
            <span class="ammo-res" id="hud-ammo-res">72</span>
          </div>
          <div class="inventory-slots" id="hud-inventory-slots"></div>
        </div>
      </div>

      <div class="scoreboard-overlay hidden" id="hud-scoreboard">
        <div class="scoreboard-card">
          <h3 id="hud-sb-title">Tableau des scores</h3>
          <table>
            <thead>
              <tr>
                <th id="hud-sb-col-player">Combattant</th>
                <th id="hud-sb-col-kills">Élim.</th>
                <th id="hud-sb-col-deaths">Morts</th>
                <th id="hud-sb-col-damage">Dégâts</th>
              </tr>
            </thead>
            <tbody id="hud-scoreboard-body"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  private cacheRefs(): void {
    this.elHealthVal = this.root.querySelector('#hud-health-val')!;
    this.elHealthBar = this.root.querySelector('#hud-health-bar')!;
    this.elArmorVal = this.root.querySelector('#hud-armor-val')!;
    this.elArmorBar = this.root.querySelector('#hud-armor-bar')!;
    this.elShieldRow = this.root.querySelector('#hud-shield-row')!;
    this.elShieldVal = this.root.querySelector('#hud-shield-val')!;
    this.elShieldBar = this.root.querySelector('#hud-shield-bar')!;
    this.elAmmoMag = this.root.querySelector('#hud-ammo-mag')!;
    this.elAmmoRes = this.root.querySelector('#hud-ammo-res')!;
    this.elWeaponName = this.root.querySelector('#hud-weapon-name')!;
    this.elWeaponRarity = this.root.querySelector('#hud-weapon-rarity')!;
    this.elInventorySlots = this.root.querySelector('#hud-inventory-slots')!;
    this.elAbilityBox = this.root.querySelector('#hud-ability-box')!;
    this.elInteractPrompt = this.root.querySelector('#hud-interact-prompt')!;
    this.elReloadBar = this.root.querySelector('#hud-reload-bar')!;
    this.elTimer = this.root.querySelector('#hud-timer')!;
    this.elScoreSummary = this.root.querySelector('#hud-score-summary')!;
    this.elKillFeed = this.root.querySelector('#hud-kill-feed')!;
    this.elCrosshair = this.root.querySelector('#hud-crosshair')!;
    this.elTargetTag = this.root.querySelector('#hud-target-tag')!;
    this.elZoneWarning = this.root.querySelector('#hud-zone-warning')!;
    this.elHitmarker = this.root.querySelector('#hud-hitmarker')!;
    this.elDamageFlash = this.root.querySelector('#hud-damage-flash')!;
    this.elRespawnBanner = this.root.querySelector('#hud-respawn-banner')!;
    this.elRespawnTimer = this.root.querySelector('#hud-respawn-timer')!;
    this.elLockPrompt = this.root.querySelector('#hud-lock-prompt')!;
    this.elScoreboard = this.root.querySelector('#hud-scoreboard')!;
    this.elScoreboardBody = this.root.querySelector('#hud-scoreboard-body')!;
    this.elDiag = this.root.querySelector('#hud-diagnostics')!;
    this.elToast = this.root.querySelector('#hud-toast')!;
    this.elStoryBox = this.root.querySelector('#hud-story-box')!;
    this.elDamageNumbers = this.root.querySelector('#hud-damage-numbers')!;
    this.elDamageDir = this.root.querySelector('#hud-damage-dir')!;
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  public triggerHitmarker(isHeadshot: boolean): void {
    this.hitmarkerTimer = 0.16;
    this.hitmarkerHeadshot = isHeadshot;
  }

  public triggerDamageFlash(): void {
    this.damageFlashTimer = 0.28;
  }

  public triggerDirectionalDamage(relativeAngleRad: number): void {
    this.dirHitTimer = 1.25;
    this.dirHitAngleDeg = (relativeAngleRad * 180) / Math.PI;
    this.elDamageDir.style.transform = `translate(-50%, -50%) rotate(${this.dirHitAngleDeg}deg)`;
    this.elDamageDir.classList.remove('hidden');
  }

  public spawnFloatingDamage(
    damage: number,
    hitZone: HitZone = 'body',
    screenX = window.innerWidth / 2,
    screenY = window.innerHeight / 2
  ): void {
    if (damage <= 0) return;
    const el = document.createElement('div');
    const tag =
      hitZone === 'head'
        ? ' TÊTE!'
        : hitZone === 'heart'
          ? ' CŒUR!'
          : '';
    el.className = `dmg-float dmg-${hitZone}`;
    el.textContent = `-${Math.round(damage)}${tag}`;
    const jitterX = (Math.random() - 0.5) * 32;
    const jitterY = (Math.random() - 0.5) * 18;
    el.style.left = `${Math.round(screenX + jitterX)}px`;
    el.style.top = `${Math.round(screenY - 18 + jitterY)}px`;
    this.elDamageNumbers.appendChild(el);
    this.floatingDamages.push({ el, ttl: 0.85 });
  }

  public showToast(text: string): void {
    this.elToast.textContent = text;
    this.elToast.classList.remove('hidden');
    this.toastTimer = 2.0;
  }

  public triggerKillStreak(streak: number, victimName: string, isHeadshot: boolean): void {
    const el = this.root.querySelector('#hud-kill-banner') as HTMLElement | null;
    if (!el) return;
    const label =
      streak >= 5
        ? 'RÉSISTANCE IMPARABLE !'
        : streak === 4
          ? 'QUADRUPLE ÉLIMINATION !'
          : streak === 3
            ? 'TRIPLÉ !'
            : streak === 2
              ? 'DOUBLÉ !'
              : 'ÉLIMINATION !';
    el.innerHTML = `<span class="kb-title">${label}</span> <span class="kb-sub">${this.escapeHtml(victimName)}${isHeadshot ? ' · TIR CRITIQUE ⌖' : ''}</span>`;
    el.classList.remove('hidden');
    this.killBannerTimer = 2.2;
  }

  public updateKillFeed(entries: readonly KillFeedEntry[]): void {
    const recent = entries.slice(-5).reverse();
    this.elKillFeed.innerHTML = recent
      .map(
        (e) => `
        <div class="kf-entry">
          <span class="kf-killer">${this.escapeHtml(e.killerName)}</span>
          <span class="kf-weapon">${this.escapeHtml(e.weaponName)}${e.isHeadshot ? ' ⌖' : ''}</span>
          <span class="kf-victim">${this.escapeHtml(e.victimName)}</span>
        </div>
      `
      )
      .join('');
  }

  public update(params: {
    dt: number;
    player: CombatantState;
    bots: CombatantState[];
    map: MapDefinition | null;
    timeRemaining: number;
    killLimit: number;
    isAiming: boolean;
    pointerLocked: boolean;
    showScoreboard: boolean;
    showDiagnostics: boolean;
    metrics: PerformanceMetrics;
    inventory?: PlayerInventory | null;
    heroState?: HeroRuntimeState;
    interactionPrompt?: string | null;
    targetHover?: 'none' | 'enemy' | 'ally';
    hoveredTargetName?: string | null;
    gameMode?: GameMode;
    battleRoyaleZone?: { radius: number; outsideZone: boolean; aliveCount: number } | null;
    storyHud?: StoryHudState | null;
    network?: {
      isMultiplayer: boolean;
      status: 'disconnected' | 'connecting' | 'connected';
      pingMs: number;
    };
  }): void {
    const {
      dt,
      player,
      bots,
      map,
      timeRemaining,
      killLimit,
      isAiming,
      pointerLocked,
      showScoreboard,
      showDiagnostics,
      metrics,
      inventory,
      heroState,
      interactionPrompt,
      targetHover = 'none',
      hoveredTargetName = null,
      gameMode = 'deathmatch',
      battleRoyaleZone = null,
      storyHud = null,
      network,
    } = params;

    // Localisation des libellés dynamiques
    (this.root.querySelector('#hud-health-label') as HTMLElement).textContent = this.l10n.t('health');
    (this.root.querySelector('#hud-armor-label') as HTMLElement).textContent = this.l10n.t('armor');
    (this.root.querySelector('#hud-respawn-label') as HTMLElement).textContent =
      this.l10n.t('respawning');
    this.elLockPrompt.textContent = this.l10n.t('clickToLock');

    // Santé, Armure & Bouclier
    const hpPct = Math.max(0, (player.health / player.maxHealth) * 100);
    const armPct = Math.max(0, (player.armor / player.maxArmor) * 100);
    this.elHealthVal.textContent = `${Math.ceil(player.health)}`;
    this.elHealthBar.style.width = `${hpPct}%`;
    this.elArmorVal.textContent = `${Math.ceil(player.armor)}`;
    this.elArmorBar.style.width = `${armPct}%`;

    const shield = inventory?.shieldSlot;
    this.elShieldRow.classList.toggle('hidden', !shield || shield.currentShield <= 0);
    if (shield && shield.currentShield > 0) {
      this.elShieldVal.textContent = `${Math.ceil(shield.currentShield)}`;
      this.elShieldBar.style.width = `${(shield.currentShield / shield.maxShield) * 100}%`;
    }

    // Pouvoir actif du héros
    const heroDef = getHeroDefinition(player.heroId);
    const lang = this.l10n.getLanguage();
    const powerName = lang === 'fr' ? heroDef.activeNameFr : heroDef.activeNameEn;
    if (heroState && heroState.abilityActiveRemaining > 0) {
      this.elAbilityBox.innerHTML = `<kbd class="hud-kbd">Q</kbd> <strong>${powerName}</strong> <span class="ab-active">ACTIF (${heroState.abilityActiveRemaining.toFixed(1)}s)</span>`;
    } else if (heroState && heroState.abilityCooldownRemaining > 0) {
      this.elAbilityBox.innerHTML = `<kbd class="hud-kbd">Q</kbd> <strong>${powerName}</strong> <span class="ab-cd">${heroState.abilityCooldownRemaining.toFixed(1)}s</span>`;
    } else {
      this.elAbilityBox.innerHTML = `<kbd class="hud-kbd">Q</kbd> <strong>${powerName}</strong> <span class="ab-ready">PRÊT</span>`;
    }

    // Interaction contextuelle
    this.elInteractPrompt.classList.toggle('hidden', !interactionPrompt);
    if (interactionPrompt) {
      this.elInteractPrompt.textContent = interactionPrompt;
    }

    // Arme & Munitions & Rareté & Illustration
    const wDef = getWeaponDefinition(player.activeWeapon.weaponId);
    const activeSlot = inventory?.weaponSlots[inventory.activeWeaponIndex];
    const rarity = activeSlot?.rarity ?? wDef.rarity;
    const rarityLabels = lang === 'fr' ? RARITY_LABELS_FR : RARITY_LABELS_EN;
    this.elWeaponName.textContent = lang === 'fr' ? wDef.nameFr : wDef.nameEn;
    this.elWeaponRarity.textContent = rarityLabels[rarity];
    this.elWeaponRarity.style.color = RARITY_COLORS[rarity];
    const artBox = this.root.querySelector('#hud-weapon-art') as HTMLElement | null;
    if (artBox && artBox.dataset.wid !== player.activeWeapon.weaponId) {
      artBox.dataset.wid = player.activeWeapon.weaponId;
      artBox.innerHTML = getWeaponIllustrationSvg(player.activeWeapon.weaponId);
    }

    if (wDef.category === 'melee') {
      this.elAmmoMag.textContent = '∞';
      this.elAmmoRes.textContent = 'MÊLÉE';
      this.elAmmoMag.classList.remove('low-ammo');
    } else {
      this.elAmmoMag.textContent = `${player.activeWeapon.ammoInMag}`;
      this.elAmmoRes.textContent = `${player.activeWeapon.reserveAmmo}`;
      this.elAmmoMag.classList.toggle(
        'low-ammo',
        player.activeWeapon.ammoInMag <= Math.max(1, Math.floor(wDef.stats.magazineSize * 0.25))
      );
    }
    this.elReloadBar.classList.toggle('hidden', !player.activeWeapon.isReloading);
    if (player.activeWeapon.isReloading) {
      const pct = Math.min(
        100,
        Math.max(
          0,
          Math.round((1 - player.activeWeapon.reloadTimer / Math.max(0.1, wDef.stats.reloadTime)) * 100)
        )
      );
      this.elReloadBar.style.setProperty('--reload-pct', `${pct}%`);
      this.elReloadBar.textContent = `${this.l10n.t('reloading')} ${pct}%`;
    }

    // Inventaire visuel (3 armes + objet G) avec keycaps élégants
    if (inventory) {
      const s1 = inventory.weaponSlots[0];
      const s2 = inventory.weaponSlots[1];
      const s3 = inventory.weaponSlots[2];
      const item = inventory.itemSlot;
      const itemName = item
        ? lang === 'fr'
          ? CONSUMABLES_CONFIG[item.itemId].nameFr
          : CONSUMABLES_CONFIG[item.itemId].nameEn
        : '—';
      const pill = (slotIdx: 0 | 1 | 2, slot: typeof s1) =>
        `<span class="inv-pill ${inventory.activeWeaponIndex === slotIdx ? 'active' : ''}" style="border-color:${slot ? RARITY_COLORS[slot.rarity] : 'rgba(255,255,255,0.16)'}"><kbd class="hud-kbd">${slotIdx + 1}</kbd> ${slot ? (lang === 'fr' ? getWeaponDefinition(slot.weaponId).nameFr : getWeaponDefinition(slot.weaponId).nameEn) : 'Vide'}</span>`;
      this.elInventorySlots.innerHTML = `
        ${pill(0, s1)}
        ${pill(1, s2)}
        ${pill(2, s3)}
        <span class="inv-pill"><kbd class="hud-kbd">G</kbd> ${itemName} ${item ? `×${item.quantity}` : ''}</span>
      `;
    } else {
      this.elInventorySlots.innerHTML = `<span class="inv-pill"><kbd class="hud-kbd">1-3</kbd> Armes</span><span class="inv-pill"><kbd class="hud-kbd">R</kbd> Recharger</span>`;
    }

    // Timer & Score selon le mode de jeu
    const mins = Math.floor(Math.max(0, timeRemaining) / 60);
    const secs = Math.floor(Math.max(0, timeRemaining) % 60);
    this.elTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (gameMode === 'team_deathmatch' || gameMode === 'story') {
      const all = [player, ...bots];
      const alphaKills = all.filter((c) => c.team === 'alpha').reduce((s, c) => s + c.stats.kills, 0);
      const betaKills = all.filter((c) => c.team === 'beta').reduce((s, c) => s + c.stats.kills, 0);
      this.elScoreSummary.textContent =
        gameMode === 'story'
          ? `ALLIÉS ${alphaKills} : ${betaKills} ENNEMIS`
          : `ALPHA ${alphaKills} : ${betaKills} BETA / ${killLimit}`;
    } else if (gameMode === 'battle_royale' && battleRoyaleZone) {
      this.elScoreSummary.textContent = `SURVIVANTS : ${battleRoyaleZone.aliveCount} • ZONE ${Math.round(battleRoyaleZone.radius)}m`;
    } else if (gameMode === 'training') {
      this.elScoreSummary.textContent = `ENTRAÎNEMENT • ${player.stats.kills} CIBLES`;
    } else {
      const topBotKills = bots.reduce((max, b) => Math.max(max, b.stats.kills), 0);
      this.elScoreSummary.textContent = `${player.stats.kills} vs ${topBotKills} / ${killLimit}`;
    }

    this.elZoneWarning.classList.toggle(
      'hidden',
      !battleRoyaleZone?.outsideZone || !player.isAlive
    );

    // Réticule dynamique : change de couleur quand on vise un ennemi (rouge) ou un allié (vert)
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const gap = isAiming ? 4 : Math.min(18, 7 + speed * 1.1);
    this.elCrosshair.style.setProperty('--ch-gap', `${gap}px`);
    this.elCrosshair.classList.toggle('hidden', !player.isAlive);
    this.elCrosshair.classList.toggle('target-enemy', targetHover === 'enemy');
    this.elCrosshair.classList.toggle('target-ally', targetHover === 'ally');
    this.elTargetTag.classList.toggle('hidden', targetHover === 'none' || !hoveredTargetName || !player.isAlive);
    if (hoveredTargetName && targetHover !== 'none') {
      this.elTargetTag.textContent = hoveredTargetName;
      this.elTargetTag.classList.toggle('ally', targetHover === 'ally');
    }

    // Hitmarker
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      this.elHitmarker.classList.remove('hidden');
      this.elHitmarker.classList.toggle('headshot', this.hitmarkerHeadshot);
    } else {
      this.elHitmarker.classList.add('hidden');
    }

    // Flash dégâts + vignette santé faible
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      this.elDamageFlash.style.opacity = `${Math.min(0.75, this.damageFlashTimer * 2.4)}`;
    } else if (player.isAlive && player.health <= 30) {
      this.elDamageFlash.style.opacity = `${0.2 + Math.abs(Math.sin(performance.now() * 0.006)) * 0.25}`;
    } else {
      this.elDamageFlash.style.opacity = '0';
    }

    // Orientation directionnelle d'où vient le tir ennemi
    if (this.dirHitTimer > 0) {
      this.dirHitTimer -= dt;
      this.elDamageDir.style.opacity = `${Math.min(1, this.dirHitTimer * 1.4)}`;
      if (this.dirHitTimer <= 0) {
        this.elDamageDir.classList.add('hidden');
      }
    }

    // Animation des points de dégâts flottants
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const item = this.floatingDamages[i];
      item.ttl -= dt;
      if (item.ttl <= 0) {
        item.el.remove();
        this.floatingDamages.splice(i, 1);
      } else {
        item.el.style.opacity = `${Math.min(1, item.ttl * 1.8)}`;
        item.el.style.transform = `translate(-50%, ${Math.round(-(0.85 - item.ttl) * 52)}px)`;
      }
    }

    // Toast ramassage & bannière kill-streak
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.elToast.classList.add('hidden');
      }
    }
    if (this.killBannerTimer > 0) {
      this.killBannerTimer -= dt;
      if (this.killBannerTimer <= 0) {
        this.root.querySelector('#hud-kill-banner')?.classList.add('hidden');
      }
    }

    // Réapparition & verrouillage souris
    this.elRespawnBanner.classList.toggle('hidden', player.isAlive);
    if (!player.isAlive) {
      this.elRespawnTimer.textContent = `${Math.max(0, player.respawnTimer).toFixed(1)}s`;
    }
    this.elLockPrompt.classList.toggle('hidden', pointerLocked || !player.isAlive);

    // Diagnostics & Réseau
    const showDiagOrNet = showDiagnostics || Boolean(network?.isMultiplayer);
    this.elDiag.classList.toggle('hidden', !showDiagOrNet);
    if (showDiagOrNet) {
      const perfPart = showDiagnostics
        ? `${metrics.fps} FPS | ${metrics.frameTimeMs} ms | Draws: ${metrics.drawCalls}`
        : '';
      const netPart = network?.isMultiplayer
        ? ` | ${network.status === 'connected' ? `Ping: ${network.pingMs} ms` : network.status}`
        : '';
      this.elDiag.textContent = `${perfPart}${netPart}`.replace(/^ \| /, '');
    }

    // Tableau des scores (Tab)
    this.elScoreboard.classList.toggle('hidden', !showScoreboard);
    if (showScoreboard) {
      this.renderScoreboard(player, bots);
    }

    // Mini-carte 2D + objectifs Histoire
    this.elStoryBox.classList.toggle('hidden', !storyHud);
    if (storyHud) {
      const nearestLine = storyHud.nearestTargetName
        ? `<div class="story-nearest">Cap : <strong>${this.escapeHtml(storyHud.nearestTargetName)}</strong> · ${storyHud.nearestTargetDist}m</div>`
        : '';
      const listHtml = storyHud.strongholds
        .map((sh) => {
          const name = lang === 'fr' ? sh.nameFr : sh.nameEn;
          const icon = sh.liberated ? '✓' : sh.progress > 0.01 ? `${Math.round(sh.progress * 100)}%` : '◆';
          return `<div class="story-sh-item ${sh.liberated ? 'done' : ''}"><span>${icon}</span> ${this.escapeHtml(name)}</div>`;
        })
        .join('');
      this.elStoryBox.innerHTML = `
        <div class="story-box-era">${this.escapeHtml(storyHud.eraLabel)}</div>
        <div class="story-box-title">${this.escapeHtml(storyHud.chapterTitle)} (${storyHud.liberatedCount}/${storyHud.totalCount})</div>
        ${nearestLine}
        ${listHtml}
      `;
    }

    if (map) {
      const mmLabel = this.root.querySelector('#hud-minimap-label') as HTMLElement;
      if (mmLabel) {
        mmLabel.textContent = (lang === 'fr' ? map.nameFr : map.nameEn).toUpperCase();
      }
      this.renderMinimap(map, player, bots, battleRoyaleZone?.radius ?? null, storyHud);
    }

    // Boussole directionnelle AAA + Cap vers le prochain bastion
    const headingEl = this.root.querySelector('#hud-compass-heading') as HTMLElement | null;
    const targetEl = this.root.querySelector('#hud-compass-target') as HTMLElement | null;
    if (headingEl) {
      let deg = Math.round((((-player.yaw * 180) / Math.PI) % 360 + 360) % 360);
      if (deg === 360) deg = 0;
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
      const cardinal = dirs[Math.round(deg / 45) % 8];
      headingEl.textContent = `${cardinal} · ${deg}°`;
    }
    if (targetEl) {
      if (storyHud?.nearestTargetPos && storyHud.nearestTargetName) {
        const dx = storyHud.nearestTargetPos.x - player.position.x;
        const dz = storyHud.nearestTargetPos.z - player.position.z;
        const targetBear = Math.atan2(dx, -dz);
        const playerBear = -player.yaw;
        let diff = ((targetBear - playerBear + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;
        const arrow = Math.abs(diff) < 0.25 ? '▲' : diff > 0 ? '▶' : '◀';
        targetEl.textContent = `${arrow} ${storyHud.nearestTargetName} (${storyHud.nearestTargetDist}m)`;
        targetEl.classList.remove('hidden');
      } else {
        targetEl.classList.add('hidden');
      }
    }
  }

  private renderScoreboard(player: CombatantState, bots: CombatantState[]): void {
    (this.root.querySelector('#hud-sb-title') as HTMLElement).textContent =
      this.l10n.t('scoreboard');
    (this.root.querySelector('#hud-sb-col-player') as HTMLElement).textContent =
      this.l10n.t('playerCol');
    (this.root.querySelector('#hud-sb-col-kills') as HTMLElement).textContent =
      this.l10n.t('killsCol');
    (this.root.querySelector('#hud-sb-col-deaths') as HTMLElement).textContent =
      this.l10n.t('deathsCol');
    (this.root.querySelector('#hud-sb-col-damage') as HTMLElement).textContent =
      this.l10n.t('damageCol');

    const all = [player, ...bots].sort((a, b) => b.stats.kills - a.stats.kills || b.stats.damageDealt - a.stats.damageDealt);
    this.elScoreboardBody.innerHTML = all
      .map((c) => {
        const teamPill =
          c.team === 'alpha'
            ? `<span class="sb-pill ally">ALLIÉ</span>`
            : c.team === 'beta'
              ? `<span class="sb-pill enemy">GARNISON</span>`
              : '';
        return `
        <tr class="${c.isBot ? '' : 'sb-self'}">
          <td>${teamPill}${this.escapeHtml(c.name)}</td>
          <td>${c.stats.kills}</td>
          <td>${c.stats.deaths}</td>
          <td>${c.stats.damageDealt}</td>
        </tr>
      `;
      })
      .join('');
  }

  private renderMinimap(
    map: MapDefinition,
    player: CombatantState,
    bots: CombatantState[],
    safeZoneRadius: number | null = null,
    storyHud: StoryHudState | null = null
  ): void {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const size = this.minimapCanvas.width;
    const half = size / 2;
    const mapSpan = Math.max(86, map.bounds.maxX - map.bounds.minX + 6);
    const scale = size / mapSpan;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(0, 0, size, size);

    // Blocs principaux de la carte
    for (const block of map.blocks) {
      if (block.id === 'ground_main' || block.id.includes('_floor_') || block.size.y < 0.3) continue;
      ctx.fillStyle =
        block.material === 'water'
          ? '#0284c7'
          : block.material === 'grass_oasis'
            ? '#3f6212'
            : '#8c5a34';
      const x = half + (block.position.x - block.size.x / 2) * scale;
      const y = half + (block.position.z - block.size.z / 2) * scale;
      ctx.fillRect(x, y, Math.max(2, block.size.x * scale), Math.max(2, block.size.z * scale));
    }

    // Bastions Mode Histoire
    if (storyHud) {
      for (const sh of storyHud.strongholds) {
        const sx = half + sh.position.x * scale;
        const sy = half + sh.position.z * scale;
        ctx.fillStyle = sh.liberated ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 5, sy);
        ctx.lineTo(sx, sy + 5);
        ctx.lineTo(sx - 5, sy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Bots vivants (vert pour alliés, rouge pour ennemis)
    for (const bot of bots) {
      if (!bot.isAlive) continue;
      const bx = half + bot.position.x * scale;
      const by = half + bot.position.z * scale;
      const isAlly = Boolean(player.team && bot.team === player.team);
      ctx.fillStyle = isAlly ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zone rétrécissante Battle Royale
    if (safeZoneRadius !== null) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(half, half, Math.max(4, safeZoneRadius * scale), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Joueur + cône de direction
    const px = half + player.position.x * scale;
    const py = half + player.position.z * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 4);
    ctx.lineTo(-4.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (ch) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[ch] ?? ch;
    });
  }
}
