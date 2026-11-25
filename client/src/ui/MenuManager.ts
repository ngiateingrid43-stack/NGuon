import type { BotDifficulty, GameMode } from '@shared/types/common';
import type { MatchSummary } from '@shared/types/entity';
import type { HeroId } from '@shared/types/hero';
import type { MapId } from '@shared/types/map';
import type { TimeOfDay } from '@shared/maps/mapRegistry';
import type { WeaponId } from '@shared/types/weapon';
import { HEROES_CONFIG } from '@shared/heroes/heroesConfig';
import { WEAPONS_CONFIG } from '@shared/weapons/weaponsConfig';
import { OPEN_WORLD_ADVENTURE, STORY_CHAPTERS, getStoryChapter } from '@shared/story/storyCampaign';
import {
  getHeroPortraitSvg,
  getMapBannerSvg,
  getWeaponIllustrationSvg,
} from '@client/ui/ArtworkGallery';
import type {
  NetChatMessage,
  PublicRoomListing,
  RoomStateInfo,
} from '@shared/protocols/network';
import type { PlayerProgressSave, UserSettings } from '@shared/validation/schemas';
import { FREE_SHOP_SKINS, getPlayerRankTitle } from '@client/storage/SaveManager';
import type { LocalizationManager } from '@client/localization/LocalizationManager';

export interface MenuActions {
  onStartMatch: (params: {
    mode: GameMode;
    mapId: MapId;
    timeOfDay: TimeOfDay;
    botCount: number;
    difficulty: BotDifficulty;
    heroId: HeroId;
    weaponId: WeaponId;
    storyChapterId?: string;
    storyTeamMode?: boolean;
    storyAllyCount?: number;
  }) => void;
  onPreviewEnvironment?: (mapId: MapId, timeOfDay: TimeOfDay) => void;
  onOpenMultiplayer: () => void;
  onRefreshRooms: () => Promise<PublicRoomListing[]>;
  onCreateRoom: (params: {
    playerName: string;
    roomName: string;
    mapId?: MapId;
    heroId: HeroId;
    weaponId: WeaponId;
    preferLocalHost?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onJoinRoom: (params: {
    code: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateP2PInvite?: () => Promise<string>;
  onAcceptP2PAnswer?: (answerToken: string) => Promise<void>;
  onJoinViaP2POffer?: (params: {
    offerToken: string;
    playerName: string;
    heroId: HeroId;
    weaponId: WeaponId;
  }) => Promise<string>;
  onSetP2PHostConfig?: (opts: { mapId?: MapId; botFillCount?: number }) => void;
  isHostingP2P?: () => boolean;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onKickPlayer: (targetPlayerId: string) => void;
  onStartMultiMatch: () => void;
  onSendChat: (text: string, channel?: 'lobby' | 'quick') => void;
  onResumeMatch: () => void;
  onRestartMatch: () => void;
  onReturnToMenu: () => void;
  onSaveSettings: (settings: UserSettings) => void;
  onSelectSkin?: (skinId: string) => PlayerProgressSave;
}

/**
 * Gère les écrans Menu principal (layout FPS asymétrique sur scène 3D vivante),
 * Navigateur multijoueur, Salon d'attente, Pause, Options/Accessibilité et Fin de partie.
 */
export class MenuManager {
  private root: HTMLElement;
  private mainMenuEl!: HTMLElement;
  private multiBrowserEl!: HTMLElement;
  private roomLobbyEl!: HTMLElement;
  private pauseMenuEl!: HTMLElement;
  private endScreenEl!: HTMLElement;
  private settingsModalEl!: HTMLElement;
  private infoModalEl!: HTMLElement;
  private armoryModalEl!: HTMLElement;
  private currentSettings: UserSettings;
  private latestSave: PlayerProgressSave | null = null;
  private localReady = false;
  private chatMessages: NetChatMessage[] = [];

  private selectedMode: GameMode = 'deathmatch';
  private selectedStoryChapterId: string = OPEN_WORLD_ADVENTURE.id;
  private storyTeamMode = true;
  private storyAllyCount = 4;
  private storyEnemyCount = 12;
  private activeLobbyTab: 'play' | 'story' | 'loadout' = 'play';
  private selectedHero: HeroId = 'sundiata';
  private selectedWeapon: WeaponId = 'imperial_carbine';
  private selectedMap: MapId = 'africa_open_world';
  private selectedTime: TimeOfDay = 'day';
  private selectedDiff: BotDifficulty = 'intermediate';
  private selectedBots = 5;
  private deferredInstallPrompt: (Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }) | null = null;

  constructor(
    container: HTMLElement,
    private l10n: LocalizationManager,
    initialSettings: UserSettings,
    private actions: MenuActions
  ) {
    this.currentSettings = { ...initialSettings };
    this.root = document.createElement('div');
    this.root.id = 'menu-root';
    this.root.className = 'menu-root';
    this.root.innerHTML = this.buildMarkup();
    container.appendChild(this.root);

    this.mainMenuEl = this.root.querySelector('#screen-main-menu')!;
    this.multiBrowserEl = this.root.querySelector('#screen-multi-browser')!;
    this.roomLobbyEl = this.root.querySelector('#screen-room-lobby')!;
    this.pauseMenuEl = this.root.querySelector('#screen-pause-menu')!;
    this.endScreenEl = this.root.querySelector('#screen-end-match')!;
    this.settingsModalEl = this.root.querySelector('#modal-settings')!;
    this.infoModalEl = this.root.querySelector('#modal-info')!;
    this.armoryModalEl = this.root.querySelector('#modal-armory')!;

    this.bindEvents();
    this.refreshTexts();
  }

  private buildMarkup(): string {
    const heroTiles = Object.values(HEROES_CONFIG)
      .map(
        (h) => `
        <button type="button" class="hero-tile illustrated ${h.id === this.selectedHero ? 'active' : ''}" data-hero-id="${h.id}">
          <div class="hero-tile-art">${getHeroPortraitSvg(h.id)}</div>
          <div class="hero-tile-info">
            <span class="hero-tile-name">${h.name}</span>
            <span class="hero-tile-sub">${h.title}</span>
          </div>
          <span class="hero-tile-bar" style="background:${h.palette.primary}"></span>
        </button>
      `
      )
      .join('');

    const weaponTiles = Object.values(WEAPONS_CONFIG)
      .map(
        (w) => `
        <button type="button" class="weapon-tile illustrated ${w.id === this.selectedWeapon ? 'active' : ''}" data-weapon-id="${w.id}">
          <div class="wt-art">${getWeaponIllustrationSvg(w.id)}</div>
          <div class="wt-meta">
            <span class="wt-cat">${w.category.replace('_', ' ').toUpperCase()}</span>
            <span class="wt-name">${w.nameFr}</span>
          </div>
        </button>
      `
      )
      .join('');

    const mapCards: Array<{ id: MapId; title: string; badge: string }> = [
      { id: 'africa_open_world', title: 'AFRIQUE · MONDE OUVERT', badge: '520m · SANS MURS' },
      { id: 'tombouctou', title: 'TOMBOUCTOU', badge: 'SAHEL' },
      { id: 'great_zimbabwe', title: 'GRAND ZIMBABWE', badge: 'SAVANE' },
      { id: 'alexandria', title: 'ALEXANDRIE', badge: 'PHARE & PORT' },
      { id: 'kongo_forest', title: 'FORÊT KONGO', badge: 'FLEUVE & PONTS' },
      { id: 'giza_pyramids', title: 'PYRAMIDES GIZEH', badge: 'NIL' },
      { id: 'victoria_falls', title: 'CHUTES VICTORIA', badge: 'ZAMBÈZE' },
    ];
    const mapCardsHtml = mapCards
      .map(
        (m) => `
        <button type="button" class="map-art-card ${m.id === this.selectedMap ? 'active' : ''} ${m.id === 'africa_open_world' ? 'featured' : ''}" data-map="${m.id}">
          <div class="map-art-thumb">${getMapBannerSvg(m.id)}</div>
          <div class="map-art-meta">
            <span class="map-art-badge">${m.badge}</span>
            <span class="map-art-title">${m.title}</span>
          </div>
        </button>
      `
      )
      .join('');

    return `
      <!-- MENU PRINCIPAL MODERNE & ÉPURÉ (SCÈNE 3D EN ARRIÈRE-PLAN) -->
      <section class="game-shell" id="screen-main-menu">
        <div class="shell-backdrop-gradient"></div>

        <!-- BARRE SUPÉRIEURE -->
        <header class="shell-topbar">
          <div class="shell-brand">
            <div class="brand-crest">
              <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true">
                <polygon points="18,2 34,18 18,34 2,18" fill="none" stroke="#eab308" stroke-width="2.5"/>
                <polygon points="18,8 28,18 18,28 8,18" fill="#eab308" opacity="0.85"/>
                <circle cx="18" cy="18" r="3" fill="#140c06"/>
              </svg>
            </div>
            <div>
              <div class="shell-title" id="mm-title">HÉRITAGE</div>
              <div class="shell-sub" id="mm-subtitle">RISE OF AFRICA</div>
            </div>
            <span class="shell-version" id="mm-version">v2.3</span>
          </div>

          <nav class="lobby-nav-tabs" id="mm-nav-tabs">
            <button type="button" class="lobby-nav-tab active" data-tab="play">JOUER</button>
            <button type="button" class="lobby-nav-tab" data-tab="story">CAMPAGNE MONDE OUVERT</button>
            <button type="button" class="lobby-nav-tab" data-tab="loadout">HÉROS & ARSENAL</button>
            <button type="button" class="lobby-nav-tab" id="btn-nav-multi">MULTIJOUEUR</button>
          </nav>

          <div class="shell-top-actions">
            <div class="career-badge" id="mm-career-strip">NIV. 1 • 0 XP</div>
            <button class="nav-link-btn install-btn" id="btn-install-pwa">INSTALLER APP</button>
            <button class="nav-link-btn accent" id="btn-open-armory">ARMURERIE</button>
            <button class="nav-link-btn" id="btn-open-controls">COMMANDES</button>
            <button class="nav-link-btn" id="btn-open-credits">CRÉDITS</button>
            <button class="nav-link-btn accent" id="btn-open-settings">OPTIONS</button>
          </div>
        </header>

        <!-- ZONE PRINCIPALE GAUCHE -->
        <aside class="shell-left-rail">
          <!-- ONGLET 1 : JOUER (MODES & 7 CARTES ILLUSTRÉES) -->
          <div class="lobby-tab-pane" id="tab-play">
            <div class="rail-section">
              <div class="rail-heading">MODE DE COMBAT</div>
              <div class="mode-tabs mode-tabs-5" id="mm-mode-tabs">
                <button type="button" class="mode-tab active" data-mode="deathmatch">MÊLÉE</button>
                <button type="button" class="mode-tab" data-mode="team_deathmatch">ÉQUIPE</button>
                <button type="button" class="mode-tab" data-mode="battle_royale">SURVIE BR</button>
                <button type="button" class="mode-tab" data-mode="story">HISTOIRE</button>
                <button type="button" class="mode-tab" data-mode="training">ENTRAÎN.</button>
              </div>
            </div>

            <div class="rail-section">
              <div class="rail-heading">THÉÂTRE D'OPÉRATIONS (MONDE OUVERT & 6 CITADELLES)</div>
              <div class="map-art-grid" id="mm-map-tabs">${mapCardsHtml}</div>
              <div class="seg-row" id="mm-time-tabs" style="margin-top:8px;">
                <button type="button" class="seg-btn active" data-time="day">JOUR</button>
                <button type="button" class="seg-btn" data-time="sunset">CRÉPUSCULE</button>
                <button type="button" class="seg-btn" data-time="night">NUIT</button>
              </div>
              <div class="match-params-row">
                <label class="mini-field">
                  <span id="mm-label-diff">Difficulté IA</span>
                  <select id="mm-select-difficulty">
                    <option value="beginner">Débutant</option>
                    <option value="intermediate" selected>Intermédiaire</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
                <label class="mini-field">
                  <span id="mm-label-bots">Soldats adverses</span>
                  <select id="mm-select-bots">
                    <option value="3">3 Soldats</option>
                    <option value="5" selected>5 Soldats</option>
                    <option value="7">7 Soldats</option>
                    <option value="9">9 Soldats</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <!-- ONGLET 2 : CAMPAGNE HISTOIRE (MONDE OUVERT CONTINU + CHAPITRES) -->
          <div class="lobby-tab-pane hidden" id="tab-story">
            <div class="rail-section" id="mm-story-section">
              <div class="rail-heading">RÉSISTANCE AFRICAINE · AVENTURE CONTINUE</div>
              <div class="story-chapter-list" id="mm-story-list"></div>
              <div class="story-briefing-box" id="mm-story-briefing"></div>
              <div class="story-rules-bar">
                <label class="story-team-check">
                  <input type="checkbox" id="mm-story-team-toggle" checked />
                  <span>Escouade des Héros Africains vs Garnisons Coloniales</span>
                </label>
                <div class="match-params-row">
                  <label class="mini-field">
                    <span>Alliés</span>
                    <select id="mm-story-allies">
                      <option value="0">0 (Solo)</option>
                      <option value="2">2 Héros</option>
                      <option value="3">3 Héros</option>
                      <option value="4" selected>4 Héros</option>
                    </select>
                  </label>
                  <label class="mini-field">
                    <span>Garnisons</span>
                    <select id="mm-story-enemies">
                      <option value="5">5 Soldats</option>
                      <option value="8">8 Soldats</option>
                      <option value="12" selected>12 Soldats</option>
                      <option value="15">15 Soldats</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- ONGLET 3 : HÉROS & ARSENAL (6 CHAMPIONS & 18 ARMES) -->
          <div class="lobby-tab-pane hidden" id="tab-loadout">
            <div class="rail-section">
              <div class="rail-heading">6 CHAMPIONS AFRICAINS</div>
              <div class="hero-grid" id="mm-hero-grid">${heroTiles}</div>
              <div class="hero-detail-strip" id="mm-hero-preview"></div>
            </div>

            <div class="rail-section">
              <div class="rail-heading" id="mm-label-weapon">ARSENAL PRINCIPAL (18 ARMES)</div>
              <div class="weapon-grid weapon-grid-scroll" id="mm-weapon-grid">${weaponTiles}</div>
              <div class="weapon-stats-bar" id="mm-weapon-stats"></div>
            </div>
          </div>
        </aside>

        <!-- DOCK DE LANCEMENT EN BAS À DROITE -->
        <footer class="shell-launch-dock">
          <div class="launch-meta">
            <span id="mm-map-tag">CARTE : TOMBOUCTOU</span>
            <span id="mm-loadout-tag">SOUNDIATA • CARABINE DU MANDÉ</span>
            <span id="mm-hero-tag">ASSISTANCE VISÉE ACTIVE</span>
          </div>
          <div class="launch-buttons">
            <button class="btn-game-secondary" id="btn-open-multi">MULTIJOUEUR</button>
            <button class="btn-game-deploy" id="btn-play-solo">DÉPLOYER</button>
          </div>
        </footer>
      </section>

      <!-- NAVIGATEUR MULTIJOUEUR -->
      <section class="overlay-screen hidden" id="screen-multi-browser">
        <div class="menu-panel modal-wide">
          <div class="multi-header">
            <h2 id="mb-title">SALONS MULTIJOUEURS</h2>
            <span class="net-pill" id="mb-conn-status">Connexion...</span>
          </div>
          <div class="multi-error hidden" id="mb-error"></div>

          <div class="match-setup-grid">
            <label class="field-box">
              <span id="mb-player-label">Pseudonyme</span>
              <input id="mb-player-name" type="text" maxlength="20" value="Voyageur" />
            </label>
            <label class="field-box">
              <span id="mb-room-label">Nom du salon</span>
              <input id="mb-room-name" type="text" maxlength="30" value="Arène de Tombouctou" />
            </label>
            <label class="field-box">
              <span id="mb-code-label">Code du salon</span>
              <input id="mb-room-code" type="text" maxlength="8" placeholder="EX: AB12CD" />
            </label>
          </div>

          <div class="btn-row" style="margin-bottom: 10px;">
            <button class="btn btn-primary" id="btn-create-room">Créer un salon (Devenir Hôte)</button>
            <button class="btn btn-secondary" id="btn-create-local-host">Héberger en P2P / LAN</button>
            <button class="btn btn-secondary" id="btn-join-code">Rejoindre par code</button>
          </div>

          <div class="p2p-direct-box">
            <div class="p2p-box-title">Connexion Directe entre 2 PC (Sans serveur central)</div>
            <div class="p2p-row">
              <input id="mb-p2p-offer" type="text" placeholder="Coller un code d’invitation HRA-OFFER:... reçu d’un hôte" />
              <button class="btn btn-secondary btn-sm" id="btn-join-p2p-offer">Générer Réponse</button>
            </div>
            <div class="p2p-row hidden" id="mb-p2p-ans-row">
              <input id="mb-p2p-answer-out" type="text" readonly />
              <button class="btn btn-primary btn-sm" id="btn-copy-p2p-answer">Copier réponse</button>
            </div>
          </div>

          <div class="rooms-list-header">
            <span>Salons publics & locaux (LAN)</span>
            <button class="btn btn-ghost btn-sm" id="btn-refresh-rooms">Actualiser</button>
          </div>
          <div class="rooms-list" id="mb-rooms-list"></div>

          <button class="btn btn-ghost" id="btn-mb-back" style="margin-top: 12px;">Retour</button>
        </div>
      </section>

      <!-- SALON D'ATTENTE MULTIJOUEUR -->
      <section class="overlay-screen hidden" id="screen-room-lobby">
        <div class="menu-panel modal-wide">
          <div class="multi-header">
            <div>
              <h2 id="rl-title" style="margin:0;">SALON D’ATTENTE</h2>
              <div class="rl-sub" id="rl-room-name">Arène de Tombouctou</div>
            </div>
            <div class="room-code-badge" id="rl-room-code">Code : ------</div>
          </div>
          <div class="multi-error hidden" id="rl-error"></div>

          <div class="p2p-host-controls hidden" id="rl-host-controls">
            <label class="mini-field">
              <span>Carte du salon</span>
              <select id="rl-host-map">
                <option value="tombouctou">Tombouctou</option>
                <option value="great_zimbabwe">Grand Zimbabwe</option>
                <option value="alexandria">Alexandrie</option>
                <option value="kongo_forest">Forêt du Kongo</option>
                <option value="giza_pyramids">Pyramides de Gizeh</option>
                <option value="victoria_falls">Chutes Victoria</option>
                <option value="africa_open_world">Afrique · Monde Ouvert</option>
              </select>
            </label>
            <label class="mini-field">
              <span>Bots IA (remplissage)</span>
              <select id="rl-host-bots">
                <option value="0">0 Bot (PvP pur)</option>
                <option value="3" selected>3 Bots</option>
                <option value="5">5 Bots</option>
                <option value="7">7 Bots</option>
              </select>
            </label>
          </div>

          <div class="p2p-direct-box hidden" id="rl-p2p-invite-box">
            <div class="p2p-box-title">Votre appareil est le Serveur Hôte — Inviter des joueurs distants (P2P)</div>
            <div class="p2p-row">
              <button class="btn btn-secondary btn-sm" id="btn-gen-p2p-invite">Générer Code d’Invitation</button>
              <input id="rl-p2p-invite-out" type="text" readonly placeholder="Cliquez sur Générer puis envoyez ce code à votre ami..." />
              <button class="btn btn-ghost btn-sm" id="btn-copy-p2p-invite">Copier</button>
            </div>
            <div class="p2p-row">
              <input id="rl-p2p-answer-in" type="text" placeholder="Coller la réponse HRA-ANS:... renvoyée par votre ami" />
              <button class="btn btn-primary btn-sm" id="btn-accept-p2p-answer">Connecter Joueur</button>
            </div>
          </div>

          <div class="lobby-grid">
            <div class="lobby-members-box">
              <div id="rl-members-list"></div>
            </div>
            <div class="lobby-chat-box">
              <div class="chat-messages" id="rl-chat-messages"></div>
              <div class="quick-chat-row">
                <button class="btn btn-ghost btn-xs" id="qc-ready">Prêt !</button>
                <button class="btn btn-ghost btn-xs" id="qc-nice">Bien joué !</button>
                <button class="btn btn-ghost btn-xs" id="qc-defend">Marché !</button>
              </div>
              <div class="chat-input-row">
                <input id="rl-chat-input" type="text" maxlength="160" placeholder="Message..." />
                <button class="btn btn-secondary btn-sm" id="btn-send-chat">Envoyer</button>
              </div>
            </div>
          </div>

          <div class="btn-row" style="margin-top: 14px;">
            <button class="btn btn-secondary" id="btn-toggle-ready">Prêt</button>
            <button class="btn btn-primary hidden" id="btn-start-multi">Lancer la partie</button>
          </div>
          <button class="btn btn-ghost" id="btn-leave-room" style="margin-top: 10px;">Quitter le salon</button>
        </div>
      </section>

      <!-- MENU PAUSE -->
      <section class="overlay-screen hidden" id="screen-pause-menu">
        <div class="menu-panel compact">
          <h2 id="pm-title">PAUSE</h2>
          <div class="menu-buttons">
            <button class="btn btn-primary" id="btn-resume">Reprendre la partie</button>
            <button class="btn btn-secondary" id="btn-pause-settings">Options</button>
            <button class="btn btn-secondary" id="btn-restart">Recommencer</button>
            <button class="btn btn-ghost" id="btn-return-menu">Retour au menu</button>
          </div>
        </div>
      </section>

      <!-- FIN DE PARTIE -->
      <section class="overlay-screen hidden" id="screen-end-match">
        <div class="menu-panel">
          <h2 class="end-banner" id="em-result-title">VICTOIRE !</h2>
          <p class="end-subtitle" id="em-summary-label">Résumé de la partie</p>
          <div class="end-stats-grid" id="em-stats-grid"></div>
          <div class="end-leaderboard">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th id="em-col-name">Combattant</th>
                  <th id="em-col-kills">Élim.</th>
                  <th id="em-col-deaths">Morts</th>
                  <th id="em-col-dmg">Dégâts</th>
                </tr>
              </thead>
              <tbody id="em-leaderboard-body"></tbody>
            </table>
          </div>
          <div class="menu-buttons">
            <button class="btn btn-primary" id="btn-play-again">Rejouer</button>
            <button class="btn btn-ghost" id="btn-end-menu">Retour au menu</button>
          </div>
        </div>
      </section>

      <!-- MODAL OPTIONS & ACCESSIBILITÉ -->
      <section class="overlay-screen hidden" id="modal-settings">
        <div class="menu-panel modal-wide">
          <h2 id="st-title">Options & Accessibilité</h2>
          <div class="settings-grid">
            <label class="setting-item">
              <span id="st-lang-label">Langue</span>
              <select id="st-lang">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label class="setting-item">
              <span id="st-gfx-label">Profil graphique</span>
              <select id="st-gfx">
                <option value="low">Faible / Low</option>
                <option value="medium">Moyen / Medium</option>
                <option value="high">Élevé / High</option>
                <option value="ultra">Ultra</option>
                <option value="auto">Auto</option>
              </select>
            </label>
            <label class="setting-item">
              <span id="st-sens-label">Sensibilité souris (<b id="st-sens-val">1.0</b>)</span>
              <input id="st-sens" type="range" min="0.2" max="2.5" step="0.05" />
            </label>
            <label class="setting-item">
              <span id="st-fov-label">FOV (<b id="st-fov-val">78</b>°)</span>
              <input id="st-fov" type="range" min="65" max="105" step="1" />
            </label>
            <label class="setting-item">
              <span id="st-vol-label">Volume général (<b id="st-vol-val">75%</b>)</span>
              <input id="st-vol" type="range" min="0" max="1" step="0.05" />
            </label>
            <label class="setting-item">
              <span id="st-sfx-label">Effets sonores (<b id="st-sfx-val">85%</b>)</span>
              <input id="st-sfx" type="range" min="0" max="1" step="0.05" />
            </label>
            <label class="setting-check">
              <input id="st-aimassist" type="checkbox" />
              <span id="st-aimassist-label">Assistance à la visée (Aim Assist)</span>
            </label>
            <label class="setting-check">
              <input id="st-mute" type="checkbox" />
              <span id="st-mute-label">Mode silencieux</span>
            </label>
            <label class="setting-check">
              <input id="st-diag" type="checkbox" />
              <span id="st-diag-label">Afficher FPS / Diagnostics</span>
            </label>
            <label class="setting-check">
              <input id="st-contrast" type="checkbox" />
              <span id="st-contrast-label">Contraste élevé</span>
            </label>
            <label class="setting-check">
              <input id="st-largetext" type="checkbox" />
              <span id="st-largetext-label">Texte agrandi</span>
            </label>
            <label class="setting-check">
              <input id="st-shake" type="checkbox" />
              <span id="st-shake-label">Réduire tremblements caméra</span>
            </label>
          </div>
          <div class="menu-buttons">
            <button class="btn btn-primary" id="btn-save-settings">Enregistrer et fermer</button>
          </div>
        </div>
      </section>

      <!-- MODAL INFO (COMMANDES / CRÉDITS) -->
      <section class="overlay-screen hidden" id="modal-info">
        <div class="menu-panel compact">
          <h2 id="info-modal-title">Commandes</h2>
          <p class="info-modal-body" id="info-modal-body"></p>
          <button class="btn btn-primary" id="btn-close-info">OK</button>
        </div>
      </section>

      <!-- MODAL ARMURERIE & BOUTIQUE GRATUITE (v0.6) -->
      <section class="overlay-screen hidden" id="modal-armory">
        <div class="menu-panel modal-wide">
          <div class="multi-header">
            <h2 style="margin:0;">ARMURERIE & CARRIÈRE</h2>
            <span class="career-badge" id="arm-cauris-badge">150 CAURIS</span>
          </div>
          <p class="end-subtitle" id="arm-rank-line">Rang : Éclaireur du Sahel • 100 % gratuit (débloqué en jouant)</p>
          <div class="rooms-list" id="arm-skins-list"></div>
          <button class="btn btn-primary" id="btn-close-armory" style="margin-top:12px;">Fermer</button>
        </div>
      </section>
    `;
  }

  private switchLobbyTab(tab: 'play' | 'story' | 'loadout'): void {
    this.activeLobbyTab = tab;
    this.root.querySelectorAll('#mm-nav-tabs .lobby-nav-tab[data-tab]').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab);
    });
    this.root.querySelector('#tab-play')?.classList.toggle('hidden', tab !== 'play');
    this.root.querySelector('#tab-story')?.classList.toggle('hidden', tab !== 'story');
    this.root.querySelector('#tab-loadout')?.classList.toggle('hidden', tab !== 'loadout');

    if (tab === 'story') {
      this.selectedMode = 'story';
      this.root.querySelectorAll('#mm-mode-tabs .mode-tab').forEach((b) =>
        b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'story')
      );
      this.renderStoryCampaign();
      const mapToPreview =
        this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id
          ? OPEN_WORLD_ADVENTURE.mapId
          : getStoryChapter(this.selectedStoryChapterId).mapId;
      this.actions.onPreviewEnvironment?.(mapToPreview, this.selectedTime);
    }
    this.updateLoadoutBanner();
  }

  private updateLoadoutBanner(): void {
    const mapLabels: Record<MapId, string> = {
      africa_open_world: 'CARTE : AFRIQUE · MONDE OUVERT',
      tombouctou: 'CARTE : TOMBOUCTOU',
      great_zimbabwe: 'CARTE : GRAND ZIMBABWE',
      alexandria: 'CARTE : ALEXANDRIE',
      kongo_forest: 'CARTE : FORÊT KONGO',
      giza_pyramids: 'CARTE : PYRAMIDES GIZEH',
      victoria_falls: 'CARTE : CHUTES VICTORIA',
    };
    const activeMap =
      this.selectedMode === 'story'
        ? this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id
          ? OPEN_WORLD_ADVENTURE.mapId
          : getStoryChapter(this.selectedStoryChapterId).mapId
        : this.selectedMap;
    const mapTag = this.root.querySelector('#mm-map-tag') as HTMLElement | null;
    if (mapTag) mapTag.textContent = mapLabels[activeMap];

    const hero = HEROES_CONFIG[this.selectedHero];
    const w = WEAPONS_CONFIG[this.selectedWeapon];
    const loadoutTag = this.root.querySelector('#mm-loadout-tag') as HTMLElement | null;
    if (loadoutTag && hero && w) {
      loadoutTag.textContent = `${hero.name.toUpperCase()} • ${w.nameFr.toUpperCase()}`;
    }
  }

  private bindEvents(): void {
    // Onglets principaux du lobby (JOUER / HISTOIRE / HÉROS & ARSENAL / MULTIJOUEUR)
    this.root.querySelectorAll('#mm-nav-tabs .lobby-nav-tab[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'play' | 'story' | 'loadout';
        this.switchLobbyTab(tab);
      });
    });

    this.root.querySelector('#btn-nav-multi')?.addEventListener('click', () => {
      this.actions.onOpenMultiplayer();
      this.showMultiBrowser();
      void this.refreshPublicRooms();
    });

    // Tabs Mode
    this.root.querySelectorAll('#mm-mode-tabs .mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedMode = (btn as HTMLElement).dataset.mode as GameMode;
        this.root.querySelectorAll('#mm-mode-tabs .mode-tab').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        if (this.selectedMode === 'story') {
          this.switchLobbyTab('story');
        } else if (this.selectedMode === 'team_deathmatch') {
          this.selectedBots = 9;
          (this.root.querySelector('#mm-select-bots') as HTMLSelectElement).value = '9';
        }
        this.updateLoadoutBanner();
      });
    });

    // Règles d'escouade en Mode Histoire
    const teamToggle = this.root.querySelector('#mm-story-team-toggle') as HTMLInputElement | null;
    const alliesSelect = this.root.querySelector('#mm-story-allies') as HTMLSelectElement | null;
    const enemiesSelect = this.root.querySelector('#mm-story-enemies') as HTMLSelectElement | null;
    teamToggle?.addEventListener('change', () => {
      this.storyTeamMode = teamToggle.checked;
      if (alliesSelect) alliesSelect.disabled = !this.storyTeamMode;
    });
    alliesSelect?.addEventListener('change', () => {
      this.storyAllyCount = Number(alliesSelect.value);
    });
    enemiesSelect?.addEventListener('change', () => {
      this.storyEnemyCount = Number(enemiesSelect.value);
    });

    // Tiles Héros
    this.root.querySelectorAll('#mm-hero-grid .hero-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedHero = (btn as HTMLElement).dataset.heroId as HeroId;
        this.root.querySelectorAll('#mm-hero-grid .hero-tile').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.updateHeroPreview();
        this.updateLoadoutBanner();
      });
    });

    // Tiles Armes
    this.root.querySelectorAll('#mm-weapon-grid .weapon-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedWeapon = (btn as HTMLElement).dataset.weaponId as WeaponId;
        this.root.querySelectorAll('#mm-weapon-grid .weapon-tile').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.updateWeaponPreview();
        this.updateLoadoutBanner();
      });
    });

    // Carte & Moment de la journée (Cartes illustrées)
    this.root.querySelectorAll('#mm-map-tabs .map-art-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedMap = (btn as HTMLElement).dataset.map as MapId;
        this.root.querySelectorAll('#mm-map-tabs .map-art-card').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.actions.onPreviewEnvironment?.(this.selectedMap, this.selectedTime);
        this.updateLoadoutBanner();
      });
    });

    // Installation PWA (PC / Mobile)
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
      };
    });
    this.root.querySelector('#btn-install-pwa')?.addEventListener('click', async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        await this.deferredInstallPrompt.userChoice;
        this.deferredInstallPrompt = null;
      } else {
        (this.root.querySelector('#info-modal-title') as HTMLElement).textContent =
          'Installer Héritage : Rise of Africa';
        (this.root.querySelector('#info-modal-body') as HTMLElement).textContent =
          'Sur PC (Chrome/Edge) : cliquez sur l’icône d’installation dans la barre d’adresse ou utilisez le lanceur double-clic inclus dans le pack PC. Sur Mobile (Android/iOS) : ouvrez le menu du navigateur et choisissez « Ajouter à l’écran d’accueil / Installer l’application ».';
        this.infoModalEl.classList.remove('hidden');
      }
    });

    this.root.querySelectorAll('#mm-time-tabs .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedTime = (btn as HTMLElement).dataset.time as TimeOfDay;
        this.root.querySelectorAll('#mm-time-tabs .seg-btn').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.actions.onPreviewEnvironment?.(this.selectedMap, this.selectedTime);
      });
    });

    this.updateHeroPreview();
    this.updateWeaponPreview();
    this.renderStoryCampaign();
    this.updateLoadoutBanner();

    this.root.querySelector('#btn-play-solo')!.addEventListener('click', () => {
      this.selectedDiff = (this.root.querySelector('#mm-select-difficulty') as HTMLSelectElement)
        .value as BotDifficulty;
      this.selectedBots = Number(
        (this.root.querySelector('#mm-select-bots') as HTMLSelectElement).value
      );
      if (this.selectedMode === 'story' || this.activeLobbyTab === 'story') {
        if (this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id) {
          this.actions.onStartMatch({
            mode: 'story',
            mapId: OPEN_WORLD_ADVENTURE.mapId,
            timeOfDay: this.selectedTime,
            botCount: this.storyEnemyCount,
            difficulty: 'intermediate',
            heroId: this.selectedHero,
            weaponId: this.selectedWeapon,
            storyChapterId: OPEN_WORLD_ADVENTURE.id,
            storyTeamMode: this.storyTeamMode,
            storyAllyCount: this.storyTeamMode ? this.storyAllyCount : 0,
          });
          return;
        }
        const ch = getStoryChapter(this.selectedStoryChapterId);
        this.actions.onStartMatch({
          mode: 'story',
          mapId: ch.mapId,
          timeOfDay: this.selectedTime,
          botCount: this.storyEnemyCount,
          difficulty: ch.enemyDifficulty,
          heroId: this.selectedHero,
          weaponId: this.selectedWeapon,
          storyChapterId: ch.id,
          storyTeamMode: this.storyTeamMode,
          storyAllyCount: this.storyTeamMode ? this.storyAllyCount : 0,
        });
        return;
      }
      this.actions.onStartMatch({
        mode: this.selectedMode,
        mapId: this.selectedMap,
        timeOfDay: this.selectedTime,
        botCount: this.selectedBots,
        difficulty: this.selectedDiff,
        heroId: this.selectedHero,
        weaponId: this.selectedWeapon,
      });
    });

    this.root.querySelector('#btn-open-multi')!.addEventListener('click', () => {
      this.actions.onOpenMultiplayer();
      this.showMultiBrowser();
      void this.refreshPublicRooms();
    });

    this.root.querySelector('#btn-mb-back')!.addEventListener('click', () => {
      this.multiBrowserEl.classList.add('hidden');
      this.mainMenuEl.classList.remove('hidden');
    });

    this.root.querySelector('#btn-refresh-rooms')!.addEventListener('click', () => {
      void this.refreshPublicRooms();
    });

    this.root.querySelector('#btn-create-room')!.addEventListener('click', async () => {
      const playerName = (this.root.querySelector('#mb-player-name') as HTMLInputElement).value.trim() || 'Voyageur';
      const roomName = (this.root.querySelector('#mb-room-name') as HTMLInputElement).value.trim() || 'Tombouctou';
      const res = await this.actions.onCreateRoom({
        playerName,
        roomName,
        mapId: this.selectedMap,
        heroId: this.selectedHero,
        weaponId: this.selectedWeapon,
      });
      if (!res.ok) {
        this.showMultiError(res.error ?? 'Erreur création salon.');
      }
    });

    this.root.querySelector('#btn-create-local-host')?.addEventListener('click', async () => {
      const playerName = (this.root.querySelector('#mb-player-name') as HTMLInputElement).value.trim() || 'Voyageur';
      const roomName = (this.root.querySelector('#mb-room-name') as HTMLInputElement).value.trim() || 'Arène Hôte';
      const res = await this.actions.onCreateRoom({
        playerName,
        roomName,
        mapId: this.selectedMap,
        heroId: this.selectedHero,
        weaponId: this.selectedWeapon,
        preferLocalHost: true,
      });
      if (!res.ok) {
        this.showMultiError(res.error ?? 'Erreur hôte local.');
      }
    });

    this.root.querySelector('#btn-join-p2p-offer')?.addEventListener('click', async () => {
      const offerInput = (this.root.querySelector('#mb-p2p-offer') as HTMLInputElement).value.trim();
      const playerName = (this.root.querySelector('#mb-player-name') as HTMLInputElement).value.trim() || 'Voyageur';
      if (!offerInput || !this.actions.onJoinViaP2POffer) return;
      try {
        const answer = await this.actions.onJoinViaP2POffer({
          offerToken: offerInput,
          playerName,
          heroId: this.selectedHero,
          weaponId: this.selectedWeapon,
        });
        const ansOut = this.root.querySelector('#mb-p2p-answer-out') as HTMLInputElement;
        ansOut.value = answer;
        this.root.querySelector('#mb-p2p-ans-row')?.classList.remove('hidden');
      } catch (err) {
        this.showMultiError(err instanceof Error ? err.message : 'Code P2P invalide.');
      }
    });

    this.root.querySelector('#btn-copy-p2p-answer')?.addEventListener('click', async () => {
      const val = (this.root.querySelector('#mb-p2p-answer-out') as HTMLInputElement).value;
      if (val) await navigator.clipboard?.writeText(val).catch(() => {});
    });

    this.root.querySelector('#rl-host-map')?.addEventListener('change', (e) => {
      const mapId = (e.target as HTMLSelectElement).value as MapId;
      this.actions.onSetP2PHostConfig?.({ mapId });
    });

    this.root.querySelector('#rl-host-bots')?.addEventListener('change', (e) => {
      const botFillCount = Number((e.target as HTMLSelectElement).value);
      this.actions.onSetP2PHostConfig?.({ botFillCount });
    });

    this.root.querySelector('#btn-gen-p2p-invite')?.addEventListener('click', async () => {
      if (!this.actions.onCreateP2PInvite) return;
      const out = this.root.querySelector('#rl-p2p-invite-out') as HTMLInputElement;
      out.value = 'Génération du code...';
      try {
        out.value = await this.actions.onCreateP2PInvite();
      } catch (err) {
        this.showRoomError(err instanceof Error ? err.message : 'Erreur invitation P2P.');
      }
    });

    this.root.querySelector('#btn-copy-p2p-invite')?.addEventListener('click', async () => {
      const val = (this.root.querySelector('#rl-p2p-invite-out') as HTMLInputElement).value;
      if (val && val.startsWith('HRA-OFFER:')) {
        await navigator.clipboard?.writeText(val).catch(() => {});
      }
    });

    this.root.querySelector('#btn-accept-p2p-answer')?.addEventListener('click', async () => {
      const inp = this.root.querySelector('#rl-p2p-answer-in') as HTMLInputElement;
      const token = inp.value.trim();
      if (!token || !this.actions.onAcceptP2PAnswer) return;
      try {
        await this.actions.onAcceptP2PAnswer(token);
        inp.value = '';
      } catch (err) {
        this.showRoomError(err instanceof Error ? err.message : 'Réponse P2P invalide.');
      }
    });

    this.root.querySelector('#btn-join-code')!.addEventListener('click', async () => {
      const playerName = (this.root.querySelector('#mb-player-name') as HTMLInputElement).value.trim() || 'Voyageur';
      const code = (this.root.querySelector('#mb-room-code') as HTMLInputElement).value.trim().toUpperCase();
      const res = await this.actions.onJoinRoom({
        code,
        playerName,
        heroId: this.selectedHero,
        weaponId: this.selectedWeapon,
      });
      if (!res.ok) {
        this.showMultiError(res.error ?? 'Impossible de rejoindre.');
      }
    });

    this.root.querySelector('#btn-leave-room')!.addEventListener('click', () => {
      this.actions.onLeaveRoom();
      this.roomLobbyEl.classList.add('hidden');
      this.multiBrowserEl.classList.remove('hidden');
      void this.refreshPublicRooms();
    });

    this.root.querySelector('#btn-toggle-ready')!.addEventListener('click', () => {
      this.localReady = !this.localReady;
      this.actions.onToggleReady(this.localReady);
    });

    this.root.querySelector('#btn-start-multi')!.addEventListener('click', () => {
      this.actions.onStartMultiMatch();
    });

    const sendChatAction = () => {
      const inp = this.root.querySelector('#rl-chat-input') as HTMLInputElement;
      const text = inp.value.trim();
      if (!text) return;
      this.actions.onSendChat(text, 'lobby');
      inp.value = '';
    };
    this.root.querySelector('#btn-send-chat')!.addEventListener('click', sendChatAction);
    this.root.querySelector('#rl-chat-input')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') sendChatAction();
    });
    this.root.querySelector('#qc-ready')!.addEventListener('click', () => {
      this.actions.onSendChat(this.l10n.t('quickReady'), 'quick');
    });
    this.root.querySelector('#qc-nice')!.addEventListener('click', () => {
      this.actions.onSendChat(this.l10n.t('quickNice'), 'quick');
    });
    this.root.querySelector('#qc-defend')!.addEventListener('click', () => {
      this.actions.onSendChat(this.l10n.t('quickDefend'), 'quick');
    });

    this.root.querySelector('#btn-open-settings')!.addEventListener('click', () => {
      this.openSettingsModal();
    });
    this.root.querySelector('#btn-pause-settings')!.addEventListener('click', () => {
      this.openSettingsModal();
    });

    this.root.querySelector('#btn-open-controls')!.addEventListener('click', () => {
      (this.root.querySelector('#info-modal-title') as HTMLElement).textContent =
        this.l10n.t('controls');
      (this.root.querySelector('#info-modal-body') as HTMLElement).textContent =
        this.l10n.t('controlsList');
      this.infoModalEl.classList.remove('hidden');
    });

    this.root.querySelector('#btn-open-credits')!.addEventListener('click', () => {
      (this.root.querySelector('#info-modal-title') as HTMLElement).textContent =
        this.l10n.t('credits');
      (this.root.querySelector('#info-modal-body') as HTMLElement).textContent =
        this.l10n.t('creditsText');
      this.infoModalEl.classList.remove('hidden');
    });

    this.root.querySelector('#btn-close-info')!.addEventListener('click', () => {
      this.infoModalEl.classList.add('hidden');
    });

    this.root.querySelector('#btn-open-armory')!.addEventListener('click', () => {
      this.renderArmory();
      this.armoryModalEl.classList.remove('hidden');
    });
    this.root.querySelector('#btn-close-armory')!.addEventListener('click', () => {
      this.armoryModalEl.classList.add('hidden');
    });

    this.root.querySelector('#btn-resume')!.addEventListener('click', () => {
      this.actions.onResumeMatch();
    });
    this.root.querySelector('#btn-restart')!.addEventListener('click', () => {
      this.actions.onRestartMatch();
    });
    this.root.querySelector('#btn-return-menu')!.addEventListener('click', () => {
      this.actions.onReturnToMenu();
    });
    this.root.querySelector('#btn-play-again')!.addEventListener('click', () => {
      this.actions.onRestartMatch();
    });
    this.root.querySelector('#btn-end-menu')!.addEventListener('click', () => {
      this.actions.onReturnToMenu();
    });

    const sensInput = this.root.querySelector('#st-sens') as HTMLInputElement;
    const fovInput = this.root.querySelector('#st-fov') as HTMLInputElement;
    const volInput = this.root.querySelector('#st-vol') as HTMLInputElement;
    const sfxInput = this.root.querySelector('#st-sfx') as HTMLInputElement;

    sensInput.addEventListener('input', () => {
      (this.root.querySelector('#st-sens-val') as HTMLElement).textContent = Number(
        sensInput.value
      ).toFixed(2);
    });
    fovInput.addEventListener('input', () => {
      (this.root.querySelector('#st-fov-val') as HTMLElement).textContent = fovInput.value;
    });
    volInput.addEventListener('input', () => {
      (this.root.querySelector('#st-vol-val') as HTMLElement).textContent =
        `${Math.round(Number(volInput.value) * 100)}%`;
    });
    sfxInput.addEventListener('input', () => {
      (this.root.querySelector('#st-sfx-val') as HTMLElement).textContent =
        `${Math.round(Number(sfxInput.value) * 100)}%`;
    });

    this.root.querySelector('#btn-save-settings')!.addEventListener('click', () => {
      const updated: UserSettings = {
        ...this.currentSettings,
        language: (this.root.querySelector('#st-lang') as HTMLSelectElement).value as 'fr' | 'en',
        graphicsProfile: (this.root.querySelector('#st-gfx') as HTMLSelectElement)
          .value as UserSettings['graphicsProfile'],
        mouseSensitivity: Number(sensInput.value),
        fov: Number(fovInput.value),
        masterVolume: Number(volInput.value),
        sfxVolume: Number(sfxInput.value),
        aimAssist: (this.root.querySelector('#st-aimassist') as HTMLInputElement).checked,
        muted: (this.root.querySelector('#st-mute') as HTMLInputElement).checked,
        showDiagnostics: (this.root.querySelector('#st-diag') as HTMLInputElement).checked,
        highContrast: (this.root.querySelector('#st-contrast') as HTMLInputElement).checked,
        largeText: (this.root.querySelector('#st-largetext') as HTMLInputElement).checked,
        reduceCameraShake: (this.root.querySelector('#st-shake') as HTMLInputElement).checked,
      };
      this.currentSettings = updated;
      this.settingsModalEl.classList.add('hidden');
      this.actions.onSaveSettings(updated);
      this.refreshTexts();
    });
  }

  private openSettingsModal(): void {
    (this.root.querySelector('#st-lang') as HTMLSelectElement).value =
      this.currentSettings.language;
    (this.root.querySelector('#st-gfx') as HTMLSelectElement).value =
      this.currentSettings.graphicsProfile;
    (this.root.querySelector('#st-sens') as HTMLInputElement).value = String(
      this.currentSettings.mouseSensitivity
    );
    (this.root.querySelector('#st-sens-val') as HTMLElement).textContent =
      this.currentSettings.mouseSensitivity.toFixed(2);
    (this.root.querySelector('#st-fov') as HTMLInputElement).value = String(
      this.currentSettings.fov
    );
    (this.root.querySelector('#st-fov-val') as HTMLElement).textContent = String(
      this.currentSettings.fov
    );
    (this.root.querySelector('#st-vol') as HTMLInputElement).value = String(
      this.currentSettings.masterVolume
    );
    (this.root.querySelector('#st-vol-val') as HTMLElement).textContent =
      `${Math.round(this.currentSettings.masterVolume * 100)}%`;
    (this.root.querySelector('#st-sfx') as HTMLInputElement).value = String(
      this.currentSettings.sfxVolume
    );
    (this.root.querySelector('#st-sfx-val') as HTMLElement).textContent =
      `${Math.round(this.currentSettings.sfxVolume * 100)}%`;
    (this.root.querySelector('#st-aimassist') as HTMLInputElement).checked =
      this.currentSettings.aimAssist;
    (this.root.querySelector('#st-mute') as HTMLInputElement).checked =
      this.currentSettings.muted;
    (this.root.querySelector('#st-diag') as HTMLInputElement).checked =
      this.currentSettings.showDiagnostics;
    (this.root.querySelector('#st-contrast') as HTMLInputElement).checked =
      this.currentSettings.highContrast;
    (this.root.querySelector('#st-largetext') as HTMLInputElement).checked =
      this.currentSettings.largeText;
    (this.root.querySelector('#st-shake') as HTMLInputElement).checked =
      this.currentSettings.reduceCameraShake;

    this.settingsModalEl.classList.remove('hidden');
  }

  public refreshTexts(): void {
    (this.root.querySelector('#mm-title') as HTMLElement).textContent = this.l10n.t('gameTitle');
    (this.root.querySelector('#mm-subtitle') as HTMLElement).textContent =
      this.l10n.t('gameSubtitle');
    (this.root.querySelector('#mm-version') as HTMLElement).textContent = 'v2.4';
    (this.root.querySelector('#btn-open-settings') as HTMLElement).textContent =
      this.l10n.t('settings').toUpperCase();
    (this.root.querySelector('#btn-open-controls') as HTMLElement).textContent =
      this.l10n.t('controls').toUpperCase();
    (this.root.querySelector('#btn-open-credits') as HTMLElement).textContent =
      this.l10n.t('credits').toUpperCase();
    (this.root.querySelector('#pm-title') as HTMLElement).textContent = this.l10n.t('paused');
    (this.root.querySelector('#btn-resume') as HTMLElement).textContent = this.l10n.t('resume');
    (this.root.querySelector('#btn-restart') as HTMLElement).textContent = this.l10n.t('restart');
    (this.root.querySelector('#btn-return-menu') as HTMLElement).textContent =
      this.l10n.t('returnMenu');
    (this.root.querySelector('#st-title') as HTMLElement).textContent = this.l10n.t('settings');
    (this.root.querySelector('#st-lang-label') as HTMLElement).textContent =
      this.l10n.t('language');
    (this.root.querySelector('#st-gfx-label') as HTMLElement).textContent =
      this.l10n.t('graphics');
    (this.root.querySelector('#st-mute-label') as HTMLElement).textContent = this.l10n.t('mute');
    (this.root.querySelector('#st-diag-label') as HTMLElement).textContent =
      this.l10n.t('diagnostics');
    (this.root.querySelector('#st-contrast-label') as HTMLElement).textContent =
      this.l10n.t('highContrast');
    (this.root.querySelector('#st-largetext-label') as HTMLElement).textContent =
      this.l10n.t('largeText');
    (this.root.querySelector('#st-shake-label') as HTMLElement).textContent =
      this.l10n.t('reduceShake');
    (this.root.querySelector('#btn-save-settings') as HTMLElement).textContent =
      this.l10n.t('saveClose');
    (this.root.querySelector('#mm-hero-tag') as HTMLElement).textContent =
      this.currentSettings.aimAssist ? 'AIDE À LA VISÉE : ACTIVE' : 'AIDE À LA VISÉE : OFF';
  }

  public updateCareerBanner(save: PlayerProgressSave): void {
    this.latestSave = save;
    const el = this.root.querySelector('#mm-career-strip') as HTMLElement;
    const rank = getPlayerRankTitle(save.level);
    el.textContent = `NIV. ${save.level} (${rank}) • ${save.cauris} Cauris • ${save.wins}V/${save.matchesPlayed}M`;
    if (this.selectedMode === 'story') {
      this.renderStoryCampaign();
    }
  }

  private renderStoryCampaign(): void {
    const list = this.root.querySelector('#mm-story-list') as HTMLElement;
    const briefing = this.root.querySelector('#mm-story-briefing') as HTMLElement;
    if (!list || !briefing) return;

    const lang = this.l10n.getLanguage();
    const completed = this.latestSave?.completedChapters ?? [];
    const owDone = completed.includes(OPEN_WORLD_ADVENTURE.id);
    const owActive = this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id;

    const openWorldCard = `
      <button type="button" class="story-chapter-btn featured-ow ${owActive ? 'active' : ''}" data-chapter-id="${OPEN_WORLD_ADVENTURE.id}">
        <span class="sc-era">MONDE OUVERT CONTINU • 520×520m • SANS MURS</span>
        <span class="sc-title">${lang === 'fr' ? OPEN_WORLD_ADVENTURE.titleFr : OPEN_WORLD_ADVENTURE.titleEn} ${owDone ? '✓' : ''}</span>
      </button>
    `;

    const chaptersHtml = STORY_CHAPTERS.map((ch) => {
      const done = completed.includes(ch.id);
      const active = ch.id === this.selectedStoryChapterId;
      const title = lang === 'fr' ? ch.titleFr : ch.titleEn;
      return `
        <button type="button" class="story-chapter-btn ${active ? 'active' : ''}" data-chapter-id="${ch.id}">
          <span class="sc-era">${ch.eraLabel}</span>
          <span class="sc-title">${title} ${done ? '✓' : ''}</span>
        </button>
      `;
    }).join('');

    list.innerHTML = openWorldCard + chaptersHtml;

    list.querySelectorAll('.story-chapter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedStoryChapterId = (btn as HTMLElement).dataset.chapterId!;
        if (this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id) {
          this.storyAllyCount = 4;
          this.storyEnemyCount = 12;
          this.actions.onPreviewEnvironment?.(OPEN_WORLD_ADVENTURE.mapId, this.selectedTime);
          this.updateLoadoutBanner();
          this.renderStoryCampaign();
          return;
        }
        const ch = getStoryChapter(this.selectedStoryChapterId);
        this.selectedHero = ch.heroId;
        this.selectedWeapon = ch.recommendedWeaponId;
        this.storyAllyCount = ch.allyCount;
        this.storyEnemyCount = ch.enemyCount;

        // Synchroniser les tuiles Héros/Armes & sélecteurs
        this.root.querySelectorAll('#mm-hero-grid .hero-tile').forEach((b) =>
          b.classList.toggle('active', (b as HTMLElement).dataset.heroId === ch.heroId)
        );
        this.root.querySelectorAll('#mm-weapon-grid .weapon-tile').forEach((b) =>
          b.classList.toggle('active', (b as HTMLElement).dataset.weaponId === ch.recommendedWeaponId)
        );
        this.updateHeroPreview();
        this.updateWeaponPreview();
        this.updateLoadoutBanner();

        const alliesEl = this.root.querySelector('#mm-story-allies') as HTMLSelectElement | null;
        const enemiesEl = this.root.querySelector('#mm-story-enemies') as HTMLSelectElement | null;
        if (alliesEl && Array.from(alliesEl.options).some((o) => Number(o.value) === ch.allyCount)) {
          alliesEl.value = String(ch.allyCount);
        }
        if (enemiesEl && Array.from(enemiesEl.options).some((o) => Number(o.value) === ch.enemyCount)) {
          enemiesEl.value = String(ch.enemyCount);
        }

        this.actions.onPreviewEnvironment?.(ch.mapId, this.selectedTime);
        this.renderStoryCampaign();
      });
    });

    if (this.selectedStoryChapterId === OPEN_WORLD_ADVENTURE.id) {
      const hero = HEROES_CONFIG[this.selectedHero];
      briefing.innerHTML = `
        <div class="sb-region">Continent Africain Unifié · +450 Cauris</div>
        <div class="sb-summary">${lang === 'fr' ? OPEN_WORLD_ADVENTURE.subtitleFr : OPEN_WORLD_ADVENTURE.subtitleEn}</div>
        <div class="sb-meta">Votre Héros : <strong>${hero.name}</strong> + Escouade Africaine · 6 Bastions Coloniaux à libérer</div>
        <div class="sb-objective">Explorez Sahel, Nil, Kongo, Savane & Chutes Victoria sans aucune barrière.</div>
      `;
      return;
    }

    const activeCh = getStoryChapter(this.selectedStoryChapterId);
    const hero = HEROES_CONFIG[activeCh.heroId];
    const weapon = WEAPONS_CONFIG[activeCh.recommendedWeaponId];
    briefing.innerHTML = `
      <div class="sb-region">${lang === 'fr' ? activeCh.regionFr : activeCh.regionEn} • +${activeCh.rewardCauris} Cauris</div>
      <div class="sb-summary">${lang === 'fr' ? activeCh.historySummaryFr : activeCh.historySummaryEn}</div>
      <div class="sb-meta">Héros : <strong>${hero.name}</strong> • Arme : <strong>${lang === 'fr' ? weapon.nameFr : weapon.nameEn}</strong></div>
      <div class="sb-objective">${lang === 'fr' ? activeCh.objectiveFr : activeCh.objectiveEn}</div>
    `;
  }

  private renderArmory(): void {
    const save = this.latestSave;
    if (!save) return;
    (this.root.querySelector('#arm-cauris-badge') as HTMLElement).textContent = `${save.cauris} CAURIS`;
    (this.root.querySelector('#arm-rank-line') as HTMLElement).textContent =
      `Rang : ${getPlayerRankTitle(save.level)} • ${save.xp} XP • 100 % gratuit (débloqué en jouant)`;

    const list = this.root.querySelector('#arm-skins-list') as HTMLElement;
    list.innerHTML = FREE_SHOP_SKINS.map((skin) => {
      const unlocked = save.unlockedSkins.includes(skin.id);
      const equipped = save.equippedSkin === skin.id;
      const btnText = equipped ? 'ÉQUIPÉ' : unlocked ? 'ÉQUIPER' : `DÉBLOQUER (${skin.costCauris})`;
      const disabled = equipped || (!unlocked && save.cauris < skin.costCauris);
      return `
        <div class="room-row">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="hero-swatch" style="background:${skin.accentColor};width:18px;height:18px;"></span>
            <div>
              <strong>${skin.nameFr}</strong>
              <span class="room-meta">${unlocked ? 'Débloqué' : `${skin.costCauris} Cauris`}</span>
            </div>
          </div>
          <button class="btn ${equipped ? 'btn-primary' : 'btn-secondary'} btn-sm" data-skin-id="${skin.id}" ${disabled ? 'disabled' : ''}>${btnText}</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-skin-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = (btn as HTMLElement).dataset.skinId;
        if (!skinId || !this.actions.onSelectSkin) return;
        this.latestSave = this.actions.onSelectSkin(skinId);
        this.updateCareerBanner(this.latestSave);
        this.renderArmory();
      });
    });
  }

  private updateHeroPreview(): void {
    const hero = HEROES_CONFIG[this.selectedHero];
    const box = this.root.querySelector('#mm-hero-preview') as HTMLElement;
    if (!box || !hero) return;
    const lang = this.l10n.getLanguage();
    box.innerHTML = `
      <div class="hd-line"><span class="hd-tag">PASSIF</span> ${lang === 'fr' ? hero.passiveNameFr : hero.passiveNameEn} — ${lang === 'fr' ? hero.passiveDescFr : hero.passiveDescEn}</div>
      <div class="hd-line"><span class="hd-tag q">ACTIF <kbd class="hud-kbd">Q</kbd></span> ${lang === 'fr' ? hero.activeNameFr : hero.activeNameEn} — ${lang === 'fr' ? hero.activeDescFr : hero.activeDescEn}</div>
    `;
  }

  private updateWeaponPreview(): void {
    const w = WEAPONS_CONFIG[this.selectedWeapon];
    const box = this.root.querySelector('#mm-weapon-stats') as HTMLElement;
    if (!box || !w) return;
    const dmgPct = Math.min(100, Math.round((w.stats.damage / 110) * 100));
    const rofPct = Math.min(100, Math.round((w.stats.fireRate / 4.5) * 100));
    const rngPct = Math.min(100, Math.round((w.stats.range / 95) * 100));
    box.innerHTML = `
      <div class="wstat"><span>DÉGÂTS</span><div class="wbar"><i style="width:${dmgPct}%"></i></div><b>${w.stats.damage}</b></div>
      <div class="wstat"><span>CADENCE</span><div class="wbar"><i style="width:${rofPct}%"></i></div><b>${w.stats.fireRate}/s</b></div>
      <div class="wstat"><span>PORTÉE</span><div class="wbar"><i style="width:${rngPct}%"></i></div><b>${w.stats.range}m</b></div>
    `;
  }

  public showMainMenu(save: PlayerProgressSave): void {
    this.updateCareerBanner(save);
    this.mainMenuEl.classList.remove('hidden');
    this.multiBrowserEl.classList.add('hidden');
    this.roomLobbyEl.classList.add('hidden');
    this.pauseMenuEl.classList.add('hidden');
    this.endScreenEl.classList.add('hidden');
  }

  public showMultiBrowser(): void {
    this.mainMenuEl.classList.add('hidden');
    this.multiBrowserEl.classList.remove('hidden');
    this.roomLobbyEl.classList.add('hidden');
    this.root.querySelector('#mb-error')!.classList.add('hidden');
  }

  public showMultiError(msg: string): void {
    const errEl = this.root.querySelector('#mb-error') as HTMLElement;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  public showRoomError(msg: string): void {
    const errEl = this.root.querySelector('#rl-error') as HTMLElement;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  public updateNetworkStatus(
    status: 'disconnected' | 'connecting' | 'connected' | 'p2p_host' | 'p2p_client',
    pingMs: number
  ): void {
    const el = this.root.querySelector('#mb-conn-status') as HTMLElement;
    if (!el) return;
    el.textContent =
      status === 'connected'
        ? `${this.l10n.t('connOnline')} (${pingMs} ms)`
        : status === 'p2p_host'
          ? 'HÔTE SERVEUR P2P ACTIF'
          : status === 'p2p_client'
            ? `CONNECTÉ À HÔTE P2P (${pingMs} ms)`
            : status === 'connecting'
              ? this.l10n.t('connConnecting')
              : 'MODE HÔTE P2P PRÊT (SANS SERVEUR)';
    el.dataset.state = status === 'p2p_host' || status === 'p2p_client' ? 'connected' : status;
  }

  public async refreshPublicRooms(): Promise<void> {
    const rooms = await this.actions.onRefreshRooms();
    const container = this.root.querySelector('#mb-rooms-list') as HTMLElement;
    if (rooms.length === 0) {
      container.innerHTML = `<div class="rooms-empty">${this.l10n.t('noPublicRooms')}</div>`;
      return;
    }
    container.innerHTML = rooms
      .map(
        (r) => `
        <div class="room-row">
          <div>
            <strong>${this.escapeHtml(r.name)}</strong>
            <span class="room-meta"><span class="code-pill">${r.code}</span> • ${r.playerCount}/${r.maxPlayers} • ${r.status}</span>
          </div>
          <button class="btn btn-secondary btn-sm" data-join-code="${r.code}">Rejoindre</button>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('[data-join-code]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = (btn as HTMLElement).dataset.joinCode ?? '';
        const playerName =
          (this.root.querySelector('#mb-player-name') as HTMLInputElement).value.trim() || 'Voyageur';
        const res = await this.actions.onJoinRoom({
          code,
          playerName,
          heroId: this.selectedHero,
          weaponId: this.selectedWeapon,
        });
        if (!res.ok) this.showMultiError(res.error ?? 'Erreur');
      });
    });
  }

  public updateRoomLobby(room: RoomStateInfo, localPlayerId: string | null): void {
    this.mainMenuEl.classList.add('hidden');
    this.multiBrowserEl.classList.add('hidden');
    this.roomLobbyEl.classList.remove('hidden');
    this.root.querySelector('#rl-error')!.classList.add('hidden');

    (this.root.querySelector('#rl-room-name') as HTMLElement).textContent = room.name;
    (this.root.querySelector('#rl-room-code') as HTMLElement).textContent =
      `${this.l10n.t('roomCodeBadge')} ${room.code}`;

    const isHost = room.hostId === localPlayerId;
    const isP2PHost = Boolean(this.actions.isHostingP2P?.() && isHost);
    const startBtn = this.root.querySelector('#btn-start-multi') as HTMLButtonElement;
    startBtn.classList.toggle('hidden', !isHost);
    startBtn.disabled = !isP2PHost && room.members.length < 2;
    startBtn.textContent = isP2PHost
      ? 'Lancer la partie (Serveur Hôte)'
      : this.l10n.t('startMatchBtn');

    this.root.querySelector('#rl-host-controls')?.classList.toggle('hidden', !isP2PHost);
    this.root.querySelector('#rl-p2p-invite-box')?.classList.toggle('hidden', !isP2PHost);
    const hostMapSel = this.root.querySelector('#rl-host-map') as HTMLSelectElement | null;
    if (hostMapSel && isP2PHost) hostMapSel.value = room.mapId;

    const me = room.members.find((m) => m.playerId === localPlayerId);
    this.localReady = Boolean(me?.isReady);
    (this.root.querySelector('#btn-toggle-ready') as HTMLElement).textContent = this.localReady
      ? this.l10n.t('unreadyBtn')
      : this.l10n.t('readyBtn');

    const listEl = this.root.querySelector('#rl-members-list') as HTMLElement;
    listEl.innerHTML = room.members
      .map(
        (m) => `
        <div class="member-row">
          <div>
            <strong>${this.escapeHtml(m.name)}</strong>
            ${m.isHost ? '<span class="tag-host">HOST</span>' : ''}
          </div>
          <div class="member-actions">
            <span class="tag-ready ${m.isReady ? 'yes' : ''}">${m.isReady ? 'PRÊT' : '...'}</span>
            ${
              isHost && !m.isHost
                ? `<button class="btn btn-ghost btn-xs" data-kick-id="${m.playerId}">${this.l10n.t('kickBtn')}</button>`
                : ''
            }
          </div>
        </div>
      `
      )
      .join('');

    listEl.querySelectorAll('[data-kick-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = (btn as HTMLElement).dataset.kickId;
        if (targetId) this.actions.onKickPlayer(targetId);
      });
    });
  }

  public appendChatMessage(msg: NetChatMessage): void {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 40) this.chatMessages.shift();
    const box = this.root.querySelector('#rl-chat-messages') as HTMLElement;
    box.innerHTML = this.chatMessages
      .map(
        (m) => `
        <div class="chat-line ${m.channel === 'quick' ? 'quick' : ''}">
          <strong>${this.escapeHtml(m.senderName)}:</strong> ${this.escapeHtml(m.text)}
        </div>
      `
      )
      .join('');
    box.scrollTop = box.scrollHeight;
  }

  public clearChat(): void {
    this.chatMessages = [];
    const box = this.root.querySelector('#rl-chat-messages') as HTMLElement;
    if (box) box.innerHTML = '';
  }

  public showPauseMenu(): void {
    this.mainMenuEl.classList.add('hidden');
    this.multiBrowserEl.classList.add('hidden');
    this.roomLobbyEl.classList.add('hidden');
    this.pauseMenuEl.classList.remove('hidden');
    this.endScreenEl.classList.add('hidden');
  }

  public showEndScreen(summary: MatchSummary): void {
    this.mainMenuEl.classList.add('hidden');
    this.pauseMenuEl.classList.add('hidden');
    this.endScreenEl.classList.remove('hidden');

    const titleEl = this.root.querySelector('#em-result-title') as HTMLElement;
    titleEl.textContent = summary.victory ? this.l10n.t('victory') : this.l10n.t('defeat');
    titleEl.className = `end-banner ${summary.victory ? 'victory' : 'defeat'}`;

    (this.root.querySelector('#em-summary-label') as HTMLElement).textContent =
      this.l10n.t('matchSummary');

    const acc =
      summary.playerStats.shotsFired > 0
        ? Math.round((summary.playerStats.shotsHit / summary.playerStats.shotsFired) * 100)
        : 0;

    (this.root.querySelector('#em-stats-grid') as HTMLElement).innerHTML = `
      <div class="stat-pill"><span>${this.l10n.t('kills')}</span><strong>${summary.playerStats.kills}</strong></div>
      <div class="stat-pill"><span>${this.l10n.t('deaths')}</span><strong>${summary.playerStats.deaths}</strong></div>
      <div class="stat-pill"><span>${this.l10n.t('headshots')}</span><strong>${summary.playerStats.headshots}</strong></div>
      <div class="stat-pill"><span>${this.l10n.t('accuracy')}</span><strong>${acc}%</strong></div>
      <div class="stat-pill"><span>${this.l10n.t('damage')}</span><strong>${summary.playerStats.damageDealt}</strong></div>
    `;

    (this.root.querySelector('#em-leaderboard-body') as HTMLElement).innerHTML = summary.leaderboard
      .map(
        (row, idx) => `
        <tr class="${row.isBot ? '' : 'sb-self'}">
          <td>${idx + 1}</td>
          <td>${row.name}</td>
          <td>${row.kills}</td>
          <td>${row.deaths}</td>
          <td>${row.damageDealt}</td>
        </tr>
      `
      )
      .join('');

    (this.root.querySelector('#btn-play-again') as HTMLElement).textContent =
      this.l10n.t('playAgain');
    (this.root.querySelector('#btn-end-menu') as HTMLElement).textContent =
      this.l10n.t('returnMenu');
  }

  public hideAll(): void {
    this.mainMenuEl.classList.add('hidden');
    this.multiBrowserEl.classList.add('hidden');
    this.roomLobbyEl.classList.add('hidden');
    this.pauseMenuEl.classList.add('hidden');
    this.endScreenEl.classList.add('hidden');
    this.settingsModalEl.classList.add('hidden');
    this.infoModalEl.classList.add('hidden');
    this.armoryModalEl.classList.add('hidden');
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
