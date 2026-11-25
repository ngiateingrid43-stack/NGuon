import { GAMEPLAY_CONSTANTS } from '@shared/constants/game';
import { TOMBOUCTOU_MAP } from '@shared/maps/tombouctou';
import { AFRICA_OPEN_WORLD_MAP } from '@shared/maps/africa_open_world';
import { getMapDefinition, type TimeOfDay } from '@shared/maps/mapRegistry';
import { HEROES_CONFIG } from '@shared/heroes/heroesConfig';
import { OPEN_WORLD_ADVENTURE } from '@shared/story/storyCampaign';
import { createInitialWeaponState, getWeaponDefinition } from '@shared/weapons/weaponsConfig';
import { stepCombatantKinematics } from '@shared/physics/MovementSimulation';
import type { NetMatchSnapshot } from '@shared/protocols/network';
import type { BotDifficulty } from '@shared/types/common';
import type { CombatantState, MatchConfig, MatchSummary } from '@shared/types/entity';
import type { HeroId } from '@shared/types/hero';
import type { MapId } from '@shared/types/map';
import type { WeaponId } from '@shared/types/weapon';
import type { UserSettings } from '@shared/validation/schemas';
import * as THREE from 'three';

import { EventBus } from '@client/core/EventBus';
import { GameState } from '@client/core/GameState';
import { Renderer } from '@client/renderer/Renderer';
import { SceneManager } from '@client/renderer/SceneManager';
import { CameraController } from '@client/renderer/CameraController';
import { PhysicsManager } from '@client/physics/PhysicsManager';
import { CollisionManager } from '@client/physics/CollisionManager';
import { PlayerController } from '@client/entities/PlayerController';
import { BotController } from '@client/entities/BotController';
import { WeaponManager } from '@client/weapons/WeaponManager';
import { CombatManager } from '@client/combat/CombatManager';
import { HeroManager } from '@client/heroes/HeroManager';
import { InventoryManager } from '@client/weapons/InventoryManager';
import { ProjectileManager } from '@client/weapons/ProjectileManager';
import { LootManager } from '@client/loot/LootManager';
import type { PlayerInventory } from '@shared/types/inventory';
import { MapLoader } from '@client/maps/MapLoader';
import { VoxelCharacterRig } from '@client/animation/VoxelCharacterRig';
import { InputManager } from '@client/input/InputManager';
import { AudioManager } from '@client/audio/AudioManager';
import { NetworkManager } from '@client/network/NetworkManager';
import { PerformanceManager } from '@client/performance/PerformanceManager';
import { AccessibilityManager } from '@client/accessibility/AccessibilityManager';
import { LocalizationManager } from '@client/localization/LocalizationManager';
import { SaveManager } from '@client/storage/SaveManager';
import { UIManager } from '@client/ui/UIManager';
import { TouchControlsManager } from '@client/ui/TouchControlsManager';
import { StoryManager } from '@client/story/StoryManager';

const BOT_NAMES = [
  'Kankou',
  'Mansa-Allié',
  'Zazzau-02',
  'Ngola-Allié',
  'Aksoum-Éclaireur',
  'Oyo-Gardien',
  'Gao-Tireur',
];

const ENEMY_SOLDIER_NAMES = [
  'Soldat Blanc',
  'Garde Colonial',
  'Fusilier Impérial',
  'Sentinelle Blanche',
  'Officier Garnison',
  'Grenadier Royal',
  'Tireur d’Élite',
  'Capitaine Blanc',
  'Sergent Régulier',
  'Éclaireur Impérial',
  'Voltigeur Colonial',
  'Sapeur de Fort',
  'Artilleur Impérial',
  'Dragon de Garnison',
  'Commandant de Bastion',
  'Hussard Impérial',
];

const BOT_HEROES: HeroId[] = ['amina', 'shaka', 'nzinga', 'makeda', 'ogun', 'sundiata'];
const BOT_WEAPONS: WeaponId[] = [
  'flintlock_musket',
  'repeating_rifle',
  'war_bow',
  'crossbow',
  'hand_cannon',
  'double_barrel_shotgun',
  'royal_long_rifle',
  'dueling_pistol',
  'imperial_carbine',
  'siege_gatling',
  'incendiary_mortar',
  'throwing_axes',
  'war_staff',
  'spear',
  'imperial_sabre',
];

/**
 * Moteur principal de HÉRITAGE – RISE OF AFRICA (Version 0.1).
 * Orchestre la boucle 60 FPS, la simulation physique, le rendu Three.js,
 * les bots IA, les armes et l'interface utilisateur.
 */
export class GameEngine {
  private readonly eventBus = new EventBus();
  private readonly gameState = new GameState();
  private readonly l10n = new LocalizationManager();
  private readonly saveManager = new SaveManager();
  private readonly a11yManager = new AccessibilityManager();
  private readonly perfManager = new PerformanceManager();
  private readonly audioManager = new AudioManager();
  private readonly heroManager = new HeroManager();
  private readonly inventoryManager = new InventoryManager();
  private readonly projectileManager = new ProjectileManager();
  private readonly lootManager = new LootManager();
  private readonly collisionManager = new CollisionManager();
  private readonly physicsManager = new PhysicsManager();
  private readonly combatManager: CombatManager;
  private readonly weaponManager = new WeaponManager();
  private readonly playerController = new PlayerController();
  private readonly botController = new BotController();
  private readonly mapLoader = new MapLoader();
  private readonly inputManager = new InputManager();

  private readonly sceneManager: SceneManager;
  private readonly renderer: Renderer;
  private readonly cameraController: CameraController;
  private readonly uiManager: UIManager;
  private readonly touchControls: TouchControlsManager;
  private readonly networkManager: NetworkManager;
  private readonly storyManager = new StoryManager();

  private botRigs = new Map<string, VoxelCharacterRig>();
  private playerInventory: PlayerInventory | null = null;
  private playerKillStreak = 0;
  private safeZoneRadius = 74;
  private stormDamageAccum = 0;
  private isMultiplayerMatch = false;
  private localMultiShootCooldown = 0;
  private localMultiSlots: [WeaponId, WeaponId] = ['flintlock_musket', 'repeating_rifle'];
  private localMultiSlotIdx = 0;
  private settings: UserSettings;
  private animFrameId = 0;
  private lastTimestamp = 0;
  private menuOrbitAngle = 0;
  private isDisposed = false;

  constructor(private container: HTMLElement) {
    this.settings = this.saveManager.loadSettings();
    this.l10n.setLanguage(this.settings.language);
    this.a11yManager.apply(this.settings);
    this.perfManager.setProfile(this.settings.graphicsProfile);
    this.audioManager.applySettings(this.settings);

    this.combatManager = new CombatManager(this.eventBus);
    this.sceneManager = new SceneManager();
    this.renderer = new Renderer(container, this.perfManager.getPreset());
    this.cameraController = new CameraController(
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight)
    );
    this.cameraController.setBaseFov(this.settings.fov);
    this.cameraController.setReduceCameraShake(this.settings.reduceCameraShake);

    // Ajouter la caméra à la scène pour que le viewmodel d'arme soit rendu
    this.sceneManager.scene.add(this.cameraController.camera);
    const viewmodelLight = new THREE.PointLight(0xfff1dc, 1.45, 4.5, 1.2);
    viewmodelLight.position.set(0.35, 0.35, 0.2);
    this.cameraController.camera.add(viewmodelLight);
    this.weaponManager.attachToCamera(this.cameraController.camera);

    this.inputManager.setSensitivity(this.settings.mouseSensitivity);
    this.inputManager.setInvertY(this.settings.invertY);
    this.inputManager.bind(this.renderer.getDomElement(), () => {
      if (this.gameState.phase === 'playing') {
        this.pauseMatch();
      }
    });

    // Clic sur le canvas en cours de partie -> verrouiller souris + débloquer audio
    this.renderer.getDomElement().addEventListener('click', () => {
      this.audioManager.unlock();
      if (this.gameState.phase === 'playing' && !this.inputManager.isPointerLocked()) {
        this.inputManager.requestPointerLock();
      }
    });

    this.networkManager = new NetworkManager({
      onStatusChange: (status, pingMs) => {
        this.uiManager.menu.updateNetworkStatus(status, pingMs);
      },
      onRoomUpdated: (room) => {
        if (this.gameState.phase === 'menu') {
          this.uiManager.menu.updateRoomLobby(room, this.networkManager.getLocalPlayerId());
        }
      },
      onRoomKicked: (reason) => {
        this.isMultiplayerMatch = false;
        this.returnToMenu();
        this.uiManager.menu.showMultiBrowser();
        this.uiManager.menu.showMultiError(reason);
      },
      onRoomError: (message) => {
        this.uiManager.menu.showRoomError(message);
      },
      onChatMessage: (msg) => {
        this.uiManager.menu.appendChatMessage(msg);
      },
      onMatchStarted: (payload) => {
        this.beginMultiplayerMatch(payload);
      },
      onSnapshot: (snapshot) => {
        this.handleServerSnapshot(snapshot);
      },
      onShotTracer: (ev) => {
        this.sceneManager.spawnShotTracer(
          new THREE.Vector3(ev.origin.x, ev.origin.y, ev.origin.z),
          new THREE.Vector3(ev.hitPoint.x, ev.hitPoint.y, ev.hitPoint.z),
          ev.shooterId !== this.networkManager.getLocalPlayerId()
        );
        if (ev.hitWorldOrPlayer) {
          this.sceneManager.spawnImpactBurst(
            new THREE.Vector3(ev.hitPoint.x, ev.hitPoint.y, ev.hitPoint.z),
            new THREE.Vector3(ev.normal.x, ev.normal.y, ev.normal.z),
            ev.isCharacterHit
          );
        }
        if (ev.shooterId !== this.networkManager.getLocalPlayerId()) {
          this.botRigs.get(ev.shooterId)?.triggerShoot();
          const p = this.gameState.player;
          const dist = p
            ? Math.hypot(p.position.x - ev.origin.x, p.position.z - ev.origin.z)
            : 25;
          this.audioManager.playGunshot(false, dist);
        }
      },
      onDamage: (ev) => {
        const myId = this.networkManager.getLocalPlayerId();
        if (ev.attackerId === myId) {
          this.audioManager.playHitmarker(ev.isHeadshot);
          this.uiManager.hud.triggerHitmarker(ev.isHeadshot);
        }
        if (ev.targetId === myId) {
          this.uiManager.hud.triggerDamageFlash();
        } else {
          this.botRigs.get(ev.targetId)?.triggerHit();
        }
      },
      onKillFeed: (entry) => {
        this.gameState.killFeed.push(entry);
        this.eventBus.emit('combat:killFeed', entry);
      },
      onMatchEnded: (summary) => {
        this.handleMultiplayerMatchEnded(summary);
      },
    });

    this.uiManager = new UIManager(
      container,
      this.eventBus,
      this.l10n,
      this.settings,
      {
        onStartMatch: ({
          mode,
          mapId,
          timeOfDay,
          botCount,
          difficulty,
          heroId,
          weaponId,
          storyChapterId,
          storyTeamMode,
          storyAllyCount,
        }) =>
          this.startMatch({
            mode,
            mapId,
            timeOfDay,
            botCount: mode === 'team_deathmatch' ? Math.max(3, botCount) : botCount,
            botDifficulty: difficulty,
            durationSeconds:
              mode === 'battle_royale'
                ? 240
                : mode === 'story'
                  ? storyChapterId === 'africa_resistance_open_world' || mapId === 'africa_open_world'
                    ? 1200
                    : 480
                  : mode === 'training'
                    ? 600
                    : GAMEPLAY_CONSTANTS.DEFAULT_MATCH_DURATION,
            killLimit:
              mode === 'team_deathmatch'
                ? 25
                : mode === 'training' || mode === 'story'
                  ? 999
                  : GAMEPLAY_CONSTANTS.DEFAULT_KILL_LIMIT,
            playerHeroId: heroId,
            playerWeaponId: weaponId,
            storyChapterId,
            storyTeamMode,
            storyAllyCount,
          }),
        onPreviewEnvironment: (mapId: MapId, timeOfDay: TimeOfDay) => {
          if (this.gameState.phase === 'menu') {
            this.mapLoader.load(
              getMapDefinition(mapId),
              this.sceneManager,
              this.physicsManager,
              this.perfManager.getPreset(),
              timeOfDay
            );
          }
        },
        onOpenMultiplayer: () => {
          this.networkManager.connect();
        },
        onRefreshRooms: () => this.networkManager.listRooms(),
        onCreateRoom: async ({ playerName, roomName, mapId, heroId, weaponId, preferLocalHost }) => {
          this.uiManager.menu.clearChat();
          return this.networkManager.createRoom({
            playerName,
            roomName,
            mapId,
            heroId,
            weaponId,
            preferLocalHost,
          });
        },
        onJoinRoom: async ({ code, playerName, heroId, weaponId }) => {
          this.uiManager.menu.clearChat();
          return this.networkManager.joinRoom({ code, playerName, heroId, weaponId });
        },
        onCreateP2PInvite: () => this.networkManager.createWebRtcInvite(),
        onAcceptP2PAnswer: (token) => this.networkManager.acceptWebRtcAnswer(token),
        onJoinViaP2POffer: ({ offerToken, playerName, heroId, weaponId }) => {
          this.uiManager.menu.clearChat();
          return this.networkManager.joinViaWebRtcOffer({
            offerToken,
            playerName,
            heroId,
            weaponId,
          });
        },
        onSetP2PHostConfig: (opts) => this.networkManager.setP2PHostConfig(opts),
        isHostingP2P: () => this.networkManager.isHostingP2P(),
        onLeaveRoom: () => {
          this.networkManager.leaveRoom();
        },
        onToggleReady: (ready) => {
          this.networkManager.setReady(ready);
        },
        onKickPlayer: (targetId) => {
          this.networkManager.kickPlayer(targetId);
        },
        onStartMultiMatch: () => {
          this.networkManager.startMatch();
        },
        onSendChat: (text, channel) => {
          this.networkManager.sendChat(text, channel);
        },
        onResumeMatch: () => this.resumeMatch(),
        onRestartMatch: () => {
          if (this.isMultiplayerMatch) {
            this.returnToMenu();
          } else {
            this.startMatch(this.gameState.config);
          }
        },
        onReturnToMenu: () => this.returnToMenu(),
        onSaveSettings: (newSettings) => this.applySettings(newSettings),
        onSelectSkin: (skinId) => this.saveManager.unlockOrEquipSkin(skinId).save,
      }
    );
    this.touchControls = new TouchControlsManager(container, this.inputManager, () =>
      this.pauseMatch()
    );
    if ((window as unknown as { __HERITAGE_MOBILE_EDITION__?: boolean }).__HERITAGE_MOBILE_EDITION__) {
      this.touchControls.setForceEnabled(true);
    }

    this.eventBus.on('pickup:collected', () => {
      this.audioManager.playPickup();
    });

    this.eventBus.on('combat:damage', (ev) => {
      const rig = this.botRigs.get(ev.targetId);
      rig?.triggerHit();

      // Points de dégâts flottants à l'écran lorsque le joueur touche un ennemi
      if (ev.attackerId === 'player' && ev.targetId !== 'player') {
        const proj = new THREE.Vector3(ev.hitPoint.x, ev.hitPoint.y, ev.hitPoint.z).project(
          this.cameraController.camera
        );
        const w = window.innerWidth;
        const h = window.innerHeight;
        const sx = proj.z < 1 ? (proj.x * 0.5 + 0.5) * w : w / 2;
        const sy = proj.z < 1 ? (-proj.y * 0.5 + 0.5) * h : h / 2;
        this.uiManager.hud.spawnFloatingDamage(ev.finalDamage, ev.hitZone ?? 'body', sx, sy);
        if (ev.hitZone === 'head' || ev.hitZone === 'heart') {
          this.audioManager.playHitmarker(true);
          this.uiManager.hud.triggerHitmarker(true);
        }
      }

      // Orientation directionnelle d'où vient le tir ennemi sur le joueur
      if (ev.targetId === 'player' && ev.attackerId !== 'player') {
        const player = this.gameState.player;
        const attacker = this.gameState.findCombatant(ev.attackerId);
        if (player) {
          const dx = attacker ? attacker.position.x - player.position.x : -ev.sourceDirection.x;
          const dz = attacker ? attacker.position.z - player.position.z : -ev.sourceDirection.z;
          const forwardX = -Math.sin(player.yaw);
          const forwardZ = -Math.cos(player.yaw);
          const rightX = Math.cos(player.yaw);
          const rightZ = -Math.sin(player.yaw);
          const forwardDot = dx * forwardX + dz * forwardZ;
          const rightDot = dx * rightX + dz * rightZ;
          const angle = Math.atan2(rightDot, forwardDot);
          this.uiManager.hud.triggerDirectionalDamage(angle);
        }
      }

      if (ev.isElimination && ev.attackerId === 'player' && ev.targetId !== 'player') {
        this.playerKillStreak += 1;
        const victim = this.gameState.findCombatant(ev.targetId);
        this.uiManager.hud.triggerKillStreak(
          this.playerKillStreak,
          victim?.name ?? 'Ennemi',
          Boolean(ev.isHeadshot)
        );
      }
      if (ev.isElimination && ev.targetId === 'player') {
        this.playerKillStreak = 0;
      }

      if (ev.isElimination && !this.isMultiplayerMatch) {
        const victim = this.gameState.findCombatant(ev.targetId);
        if (victim && victim.isBot) {
          this.lootManager.spawnDrop(
            {
              kind: 'item',
              rarity: 'rare',
              itemId: Math.random() < 0.5 ? 'frag_grenade' : 'incendiary_potion',
              amount: 1,
              position: { ...victim.position },
            },
            this.sceneManager.scene
          );
        }
      }
    });

    window.addEventListener('resize', this.handleResize);

    // Afficher d'abord le menu principal pour éviter tout écran figé si le rendu 3D tarde
    this.uiManager.menu.showMainMenu(this.saveManager.loadProgress());

    // Charger le Monde Ouvert Africain pour un arrière-plan 3D panoramique dès le menu
    try {
      this.mapLoader.load(
        AFRICA_OPEN_WORLD_MAP,
        this.sceneManager,
        this.physicsManager,
        this.perfManager.getPreset()
      );
    } catch (err) {
      console.warn('Chargement de la scène de fond ignoré :', err);
    }
  }

  public start(): void {
    this.lastTimestamp = performance.now();
    const loop = (now: number) => {
      if (this.isDisposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;
      this.tick(dt);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private applySettings(newSettings: UserSettings): void {
    this.settings = this.saveManager.saveSettings(newSettings);
    this.l10n.setLanguage(this.settings.language);
    this.a11yManager.apply(this.settings);
    this.perfManager.setProfile(this.settings.graphicsProfile);
    this.audioManager.applySettings(this.settings);
    this.inputManager.setSensitivity(this.settings.mouseSensitivity);
    this.inputManager.setInvertY(this.settings.invertY);
    this.cameraController.setBaseFov(this.settings.fov);
    this.cameraController.setReduceCameraShake(this.settings.reduceCameraShake);

    const preset = this.perfManager.getPreset();
    this.renderer.applyPreset(preset);
    this.sceneManager.applyQualityPreset(preset);
    this.uiManager.menu.refreshTexts();
  }

  public startMatch(config: MatchConfig): void {
    this.isMultiplayerMatch = false;
    this.playerKillStreak = 0;
    this.audioManager.unlock();
    this.clearBotRigs();
    this.botController.clear();
    this.projectileManager.clear(this.sceneManager.scene);
    this.lootManager.clear(this.sceneManager.scene);
    this.heroManager.clear(this.sceneManager.scene);
    this.uiManager.clearKillFeed();
    this.gameState.resetForMatch(config);

    // Recharger la carte sélectionnée (Tombouctou ou Grand Zimbabwe) et l'ambiance
    const activeMap = getMapDefinition(config.mapId);
    this.mapLoader.load(
      activeMap,
      this.sceneManager,
      this.physicsManager,
      this.perfManager.getPreset(),
      config.timeOfDay ?? 'day'
    );

    const hero = this.heroManager.getHero(config.playerHeroId);
    const playerSpawn = activeMap.spawnPoints[0];

    const secondaryWeapon: WeaponId =
      config.playerWeaponId === 'dueling_pistol' ? 'imperial_carbine' : 'dueling_pistol';
    const meleeWeapon: WeaponId =
      config.playerWeaponId === 'imperial_sabre' ? 'war_staff' : 'imperial_sabre';
    this.playerController.setWeaponLoadout(config.playerWeaponId, secondaryWeapon);
    this.playerInventory = this.inventoryManager.createInitialInventory(
      config.playerWeaponId,
      secondaryWeapon,
      meleeWeapon
    );
    const activeSlot = this.inventoryManager.getActiveWeaponSlot(this.playerInventory)!;

    this.heroManager.initCombatant('player', config.playerHeroId);
    this.safeZoneRadius = 74;
    this.stormDamageAccum = 0;
    this.sceneManager.setSafeZoneVisual(config.mode === 'battle_royale' ? this.safeZoneRadius : null);

    let storyAllyCount = 0;
    const isOpenWorldStory =
      config.mode === 'story' &&
      (config.storyChapterId === 'africa_resistance_open_world' ||
        config.mapId === 'africa_open_world');

    if (isOpenWorldStory) {
      this.storyManager.startOpenWorldAdventure();
      this.sceneManager.setStrongholdMarkers(this.storyManager.getStrongholds());
      this.uiManager.hud.showToast(
        this.l10n.getLanguage() === 'fr'
          ? OPEN_WORLD_ADVENTURE.subtitleFr
          : OPEN_WORLD_ADVENTURE.subtitleEn
      );
      if (config.storyTeamMode !== false) {
        storyAllyCount = config.storyAllyCount ?? 4;
      }
    } else if (config.mode === 'story' && config.storyChapterId) {
      const ch = this.storyManager.startChapter(config.storyChapterId);
      this.sceneManager.setStrongholdMarkers(this.storyManager.getStrongholds());
      this.uiManager.hud.showToast(
        this.l10n.getLanguage() === 'fr' ? ch.objectiveFr : ch.objectiveEn
      );
      if (config.storyTeamMode !== false) {
        storyAllyCount = config.storyAllyCount ?? ch.allyCount;
      }
    } else {
      this.storyManager.reset();
      this.sceneManager.clearStrongholdMarkers();
    }

    const isTeamMode = config.mode === 'team_deathmatch' || (config.mode === 'story' && storyAllyCount > 0);

    this.gameState.player = {
      id: 'player',
      name: this.saveManager.loadProgress().playerName,
      isBot: false,
      team: isTeamMode ? 'alpha' : undefined,
      heroId: config.playerHeroId,
      position: { ...playerSpawn.position },
      yaw: playerSpawn.yaw,
      pitch: 0,
      velocity: { x: 0, y: 0, z: 0 },
      health: hero.stats.maxHealth,
      maxHealth: hero.stats.maxHealth,
      armor: hero.stats.maxArmor,
      maxArmor: hero.stats.maxArmor,
      isAlive: true,
      respawnTimer: 0,
      isGrounded: true,
      isSprinting: false,
      isCrouching: false,
      isSliding: false,
      activeWeapon: activeSlot.state,
      stats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        headshots: 0,
        shotsFired: 0,
        shotsHit: 0,
      },
    };

    // Création des bots IA : Alliés (héros africains) + Ennemis (soldats blancs)
    const enemyBotCount = isOpenWorldStory ? Math.max(config.botCount, 12) : config.botCount;
    const totalBots =
      config.mode === 'story' ? storyAllyCount + enemyBotCount : config.botCount;
    let enemyCounter = 0;
    let allyCounter = 0;
    for (let i = 0; i < totalBots; i++) {
      let sp = activeMap.spawnPoints[(i + 1) % activeMap.spawnPoints.length];
      const botHeroId = BOT_HEROES[i % BOT_HEROES.length];
      const botHero = HEROES_CONFIG[botHeroId];
      const botWeapon: WeaponId = BOT_WEAPONS[i % BOT_WEAPONS.length];
      const botId = `bot_${i + 1}`;
      const botTeam =
        config.mode === 'story'
          ? isTeamMode
            ? i < storyAllyCount
              ? 'alpha'
              : 'beta'
            : 'beta'
          : isTeamMode
            ? i % 2 === 1
              ? 'alpha'
              : 'beta'
            : undefined;
      const isEnemySoldier = botTeam !== 'alpha';

      // En Monde Ouvert, placer 2 éclaireurs en avant-garde + répartir les garnisons dans les bastions
      if (isOpenWorldStory && isEnemySoldier) {
        const eIdx = enemyCounter;
        if (eIdx === 0) {
          sp = { id: `ow_vanguard_0`, position: { x: -7, y: 1.5, z: -24 }, yaw: 0 };
        } else if (eIdx === 1) {
          sp = { id: `ow_vanguard_1`, position: { x: 8, y: 1.5, z: -30 }, yaw: 0 };
        } else {
          const shIdx = (eIdx - 2) % OPEN_WORLD_ADVENTURE.strongholds.length;
          const shPos = OPEN_WORLD_ADVENTURE.strongholds[shIdx].position;
          const angle = (eIdx * 2.1) % (Math.PI * 2);
          sp = {
            id: `ow_enemy_${i}`,
            position: {
              x: shPos.x + Math.cos(angle) * 5.5,
              y: shPos.y + 0.5,
              z: shPos.z + Math.sin(angle) * 5.5,
            },
            yaw: angle + Math.PI,
          };
        }
      } else if (isOpenWorldStory && !isEnemySoldier) {
        sp = {
          id: `ow_ally_${i}`,
          position: {
            x: playerSpawn.position.x + (allyCounter % 2 === 0 ? -3.5 - allyCounter : 3.5 + allyCounter),
            y: playerSpawn.position.y,
            z: playerSpawn.position.z - 2 - allyCounter * 1.4,
          },
          yaw: playerSpawn.yaw,
        };
      }

      const botDisplayName = isEnemySoldier
        ? `${ENEMY_SOLDIER_NAMES[enemyCounter % ENEMY_SOLDIER_NAMES.length]}${
            enemyCounter >= ENEMY_SOLDIER_NAMES.length
              ? ` #${Math.floor(enemyCounter / ENEMY_SOLDIER_NAMES.length) + 1}`
              : ''
          }`
        : `${botHero.name} · ${BOT_NAMES[allyCounter % BOT_NAMES.length]}`;

      if (isEnemySoldier) enemyCounter++;
      else allyCounter++;

      const botState: CombatantState = {
        id: botId,
        name: botDisplayName,
        isBot: true,
        botDifficulty: config.botDifficulty,
        team: botTeam,
        heroId: botHeroId,
        position: { ...sp.position },
        yaw: sp.yaw,
        pitch: 0,
        velocity: { x: 0, y: 0, z: 0 },
        health: botHero.stats.maxHealth,
        maxHealth: botHero.stats.maxHealth,
        armor: botHero.stats.maxArmor,
        maxArmor: botHero.stats.maxArmor,
        isAlive: true,
        respawnTimer: 0,
        isGrounded: true,
        isSprinting: false,
        isCrouching: false,
        isSliding: false,
        activeWeapon: createInitialWeaponState(botWeapon),
        stats: {
          kills: 0,
          deaths: 0,
          assists: 0,
          damageDealt: 0,
          headshots: 0,
          shotsFired: 0,
          shotsHit: 0,
        },
      };
      this.gameState.bots.push(botState);

      const rig = new VoxelCharacterRig(
        botHero,
        this.perfManager.getPreset().shadowsEnabled,
        botWeapon,
        isEnemySoldier
      );
      this.sceneManager.getEntitiesGroup().add(rig.root);
      this.botRigs.set(botId, rig);
    }

    this.gameState.phase = 'playing';
    this.uiManager.menu.hideAll();
    this.uiManager.hud.setVisible(true);
    this.touchControls.setMatchActive(true);
    this.inputManager.requestPointerLock();
    this.eventBus.emit('match:started', {
      mapId: config.mapId,
      botCount: config.botCount,
    });
  }

  public pauseMatch(): void {
    if (this.gameState.phase !== 'playing') return;
    this.gameState.phase = 'paused';
    this.inputManager.exitPointerLock();
    this.inputManager.resetKeys();
    this.touchControls.setMatchActive(false);
    this.uiManager.menu.showPauseMenu();
  }

  public resumeMatch(): void {
    if (this.gameState.phase !== 'paused') return;
    this.gameState.phase = 'playing';
    this.uiManager.menu.hideAll();
    this.touchControls.setMatchActive(true);
    this.inputManager.requestPointerLock();
  }

  public returnToMenu(): void {
    if (this.isMultiplayerMatch) {
      this.networkManager.leaveRoom();
      this.isMultiplayerMatch = false;
    }
    this.gameState.phase = 'menu';
    this.inputManager.exitPointerLock();
    this.inputManager.resetKeys();
    this.clearBotRigs();
    this.touchControls.setMatchActive(false);
    this.uiManager.hud.setVisible(false);
    this.uiManager.menu.showMainMenu(this.saveManager.loadProgress());
  }

  private tick(dt: number): void {
    this.perfManager.recordFrame(dt);
    this.gameState.elapsedTime += dt;

    if (this.gameState.phase === 'menu' || this.gameState.phase === 'ended') {
      // Survol cinématique panoramique du monde africain en arrière-plan du menu
      this.menuOrbitAngle += dt * 0.085;
      const radius = 56;
      const camX = Math.cos(this.menuOrbitAngle) * radius;
      const camZ = Math.sin(this.menuOrbitAngle) * radius;
      this.cameraController.camera.position.set(camX, 22, camZ);
      this.cameraController.camera.lookAt(0, 3.5, 0);
      this.sceneManager.updateSunShadowCenter({ x: 0, z: 0 });
      this.weaponManager.updateViewModel({
        dt,
        weaponState: createInitialWeaponState('flintlock_musket'),
        isAiming: false,
        moveSpeed: 0,
        isAlive: false,
      });
      this.sceneManager.update(dt, this.gameState.elapsedTime);
      this.renderer.render(this.sceneManager.scene, this.cameraController.camera);
      return;
    }

    if (this.gameState.phase === 'paused') {
      this.renderer.render(this.sceneManager.scene, this.cameraController.camera);
      return;
    }

    // Phase 'playing'
    const player = this.gameState.player;
    if (!player) return;

    if (this.isMultiplayerMatch) {
      this.tickMultiplayer(dt, player);
      return;
    }

    this.gameState.timeRemaining = Math.max(0, this.gameState.timeRemaining - dt);
    const allCombatants = this.gameState.getAllCombatants();
    const input = this.inputManager.consumeSnapshot();

    // 1. Respawns (désactivés en Battle Royale, accélérés en Entraînement)
    if (this.gameState.config.mode !== 'battle_royale') {
      this.handleRespawns(dt, allCombatants);
    }

    // Mode Entraînement : munitions de réserve infinies
    if (this.gameState.config.mode === 'training') {
      player.activeWeapon.reserveAmmo = Math.max(player.activeWeapon.reserveAmmo, 99);
    }

    // 2. Contrôleur Joueur (inventaire, pouvoirs, projectiles, loot, aide à la visée, couleur cible)
    if (!this.playerInventory) {
      this.playerInventory = this.inventoryManager.createInitialInventory(
        player.activeWeapon.weaponId
      );
    }

    const { isAiming, interactionPrompt, targetHover, hoveredTargetName } =
      this.playerController.update({
        dt,
        player,
        inventory: this.playerInventory,
        inventoryManager: this.inventoryManager,
        heroManager: this.heroManager,
        projectileManager: this.projectileManager,
        lootManager: this.lootManager,
        mapLoader: this.mapLoader,
        input,
        allCombatants,
        physics: this.physicsManager,
        weaponManager: this.weaponManager,
        collisionManager: this.collisionManager,
        combatManager: this.combatManager,
        sceneManager: this.sceneManager,
        cameraController: this.cameraController,
        audioManager: this.audioManager,
        eventBus: this.eventBus,
        aimAssistEnabled: this.settings.aimAssist,
        getTargetShieldAbsorb: (target, dmg) => {
          if (target.id === 'player' && this.playerInventory) {
            return this.inventoryManager.applyShieldAbsorption(this.playerInventory, dmg);
          }
          return dmg;
        },
      });

    // Mise à jour des pouvoirs passifs/actifs & pièges d'Ogun
    this.heroManager.update({
      dt,
      combatants: allCombatants,
      scene: this.sceneManager.scene,
      onTrapTriggered: (ownerId, target, damage) => {
        const owner = this.gameState.findCombatant(ownerId) ?? player;
        this.combatManager.applyDirectDamage({
          attacker: owner,
          target,
          sourceLabel: 'Piège de lames',
          damage,
          hitPoint: target.position,
          sourceDirection: { x: 0, y: 1, z: 0 },
          resistance: this.heroManager.getPassiveDamageResistance(target),
        });
      },
    });

    // Mise à jour des projectiles physiques & explosions
    this.projectileManager.update({
      dt,
      colliders: this.physicsManager.getColliders(),
      combatants: allCombatants,
      scene: this.sceneManager.scene,
      onImpact: (impact) => {
        const owner = this.gameState.findCombatant(impact.ownerId) ?? player;
        if (impact.explosionRadius > 0) {
          const expDist = Math.hypot(
            player.position.x - impact.hitPoint.x,
            player.position.z - impact.hitPoint.z
          );
          const expPan = this.audioManager.computeStereoPan(
            player.position,
            player.yaw,
            impact.hitPoint
          );
          this.audioManager.playExplosion(expDist, expPan);
          this.sceneManager.spawnExplosionRing(
            new THREE.Vector3(impact.hitPoint.x, impact.hitPoint.y, impact.hitPoint.z),
            impact.explosionRadius
          );
          this.sceneManager.spawnImpactBurst(
            new THREE.Vector3(impact.hitPoint.x, impact.hitPoint.y, impact.hitPoint.z),
            new THREE.Vector3(0, 1, 0),
            false
          );
          for (const target of allCombatants) {
            if (!target.isAlive) continue;
            const d = Math.hypot(
              target.position.x - impact.hitPoint.x,
              target.position.z - impact.hitPoint.z
            );
            if (d <= impact.explosionRadius && Math.abs(target.position.y - impact.hitPoint.y) < 3) {
              const falloff = 1 - (d / impact.explosionRadius) * 0.55;
              this.combatManager.applyDirectDamage({
                attacker: owner,
                target,
                sourceLabel: impact.isIncendiary ? 'Potion incendiaire' : 'Explosion',
                damage: Math.round(impact.damage * falloff),
                hitPoint: impact.hitPoint,
                sourceDirection: { x: 0, y: 1, z: 0 },
                resistance: this.heroManager.getPassiveDamageResistance(target),
                absorbShield:
                  target.id === 'player' && this.playerInventory
                    ? (dmg) => this.inventoryManager.applyShieldAbsorption(this.playerInventory!, dmg)
                    : undefined,
              });
              if (owner.id === 'player' && target.id !== 'player') {
                this.audioManager.playHitmarker(false);
                this.uiManager.hud.triggerHitmarker(false);
              }
            }
          }
        } else if (impact.directTargetId) {
          const target = this.gameState.findCombatant(impact.directTargetId);
          if (target && impact.weaponId) {
            this.combatManager.applyDamage({
              attacker: owner,
              target,
              weaponId: impact.weaponId,
              isHeadshot: Boolean(impact.isHeadshot),
              hitPoint: impact.hitPoint,
              sourceDirection: { x: 0, y: 0, z: -1 },
              resistance: this.heroManager.getPassiveDamageResistance(target),
            });
            if (owner.id === 'player') {
              this.audioManager.playHitmarker(Boolean(impact.isHeadshot));
              this.uiManager.hud.triggerHitmarker(Boolean(impact.isHeadshot));
            }
          }
        }
      },
      onFireBurn: (ownerId, target, damage) => {
        const owner = this.gameState.findCombatant(ownerId) ?? player;
        this.combatManager.applyDirectDamage({
          attacker: owner,
          target,
          sourceLabel: 'Feu grégeois',
          damage,
          hitPoint: target.position,
          sourceDirection: { x: 0, y: 1, z: 0 },
        });
      },
    });

    // 3. Mise à jour des Bots IA + squelettes voxel
    const currentMap = this.mapLoader.getActiveMap() ?? TOMBOUCTOU_MAP;
    for (const bot of this.gameState.bots) {
      this.botController.updateBot({
        dt,
        bot,
        allCombatants,
        map: currentMap,
        physics: this.physicsManager,
        collisionManager: this.collisionManager,
        weaponManager: this.weaponManager,
        combatManager: this.combatManager,
        sceneManager: this.sceneManager,
        audioManager: this.audioManager,
        eventBus: this.eventBus,
        onBotFired: (id) => this.botRigs.get(id)?.triggerShoot(),
        onBotReload: (id, dur) => this.botRigs.get(id)?.triggerReload(dur),
      });

      const rig = this.botRigs.get(bot.id);
      if (rig) {
        const speed = Math.hypot(bot.velocity.x, bot.velocity.z);
        rig.update({
          dt,
          position: bot.position,
          yaw: bot.yaw,
          speed,
          isAlive: bot.isAlive,
          isGrounded: bot.isGrounded,
          isCrouching: bot.isCrouching,
          weaponId: bot.activeWeapon.weaponId,
        });
      }
    }

    // 4. Ravitaillements (loot points), drops au sol, zone BR & Monde physique
    let battleRoyaleZone: { radius: number; outsideZone: boolean; aliveCount: number } | null = null;
    if (this.gameState.config.mode === 'battle_royale') {
      this.safeZoneRadius = Math.max(8, this.safeZoneRadius - dt * 0.48);
      this.sceneManager.setSafeZoneVisual(this.safeZoneRadius);
      this.stormDamageAccum += dt;
      if (this.stormDamageAccum >= 1.0) {
        this.stormDamageAccum -= 1.0;
        for (const c of allCombatants) {
          if (!c.isAlive) continue;
          const distCenter = Math.hypot(c.position.x, c.position.z);
          if (distCenter > this.safeZoneRadius) {
            this.combatManager.applyDirectDamage({
              attacker: c,
              target: c,
              sourceLabel: 'Tempête de sable',
              damage: 5,
              hitPoint: c.position,
              sourceDirection: { x: 0, y: 1, z: 0 },
            });
          }
        }
      }
      const pDist = Math.hypot(player.position.x, player.position.z);
      const aliveCount = allCombatants.filter((c) => c.isAlive).length;
      battleRoyaleZone = {
        radius: this.safeZoneRadius,
        outsideZone: pDist > this.safeZoneRadius,
        aliveCount,
      };
    } else {
      this.sceneManager.setSafeZoneVisual(null);
    }

    let storyPrompt: string | null = null;
    if (this.gameState.config.mode === 'story' && player.isAlive) {
      const storyRes = this.storyManager.update(dt, player.position, input.interactHold);
      storyPrompt = storyRes.promptText;
      this.sceneManager.updateStrongholdMarkers(this.storyManager.getStrongholds());
      if (storyRes.enteredRegionLore) {
        this.uiManager.hud.showToast(storyRes.enteredRegionLore);
      }
      if (storyRes.newlyLiberated) {
        const shName =
          this.l10n.getLanguage() === 'fr'
            ? storyRes.newlyLiberated.nameFr
            : storyRes.newlyLiberated.nameEn;
        this.uiManager.hud.showToast(`BASTION LIBÉRÉ : ${shName} ! (+35 Santé)`);
        player.health = Math.min(player.maxHealth, player.health + 35);
        this.audioManager.playLiberationFanfare();
      }
    }
    const storyHud =
      this.gameState.config.mode === 'story'
        ? this.storyManager.getHudState(this.l10n.getLanguage(), player.position)
        : null;

    this.mapLoader.updatePickups(dt, allCombatants, this.sceneManager, this.eventBus);
    this.lootManager.update(this.gameState.elapsedTime, dt);
    this.physicsManager.step(dt);
    this.sceneManager.updateSunShadowCenter(player.position);
    this.sceneManager.update(dt, this.gameState.elapsedTime);

    // 5. Rendu 3D & HUD
    this.renderer.render(this.sceneManager.scene, this.cameraController.camera);
    this.uiManager.hud.update({
      dt,
      player,
      bots: this.gameState.bots,
      map: this.mapLoader.getActiveMap(),
      timeRemaining: this.gameState.timeRemaining,
      killLimit: this.gameState.config.killLimit,
      isAiming,
      pointerLocked: this.inputManager.isPointerLocked(),
      showScoreboard: input.scoreboard,
      showDiagnostics: this.settings.showDiagnostics,
      metrics: this.perfManager.getMetrics(this.renderer.getStats()),
      inventory: this.playerInventory,
      heroState: this.heroManager.getState(player.id),
      interactionPrompt: storyPrompt ?? interactionPrompt,
      targetHover,
      hoveredTargetName,
      gameMode: this.gameState.config.mode,
      battleRoyaleZone,
      storyHud,
    });

    // 6. Vérifier conditions de victoire / fin de partie
    this.checkMatchEnd(player);
  }

  private handleRespawns(dt: number, allCombatants: CombatantState[]): void {
    const isTraining = this.gameState.config.mode === 'training';
    for (const c of allCombatants) {
      if (c.isAlive) continue;
      c.respawnTimer -= dt * (isTraining ? 2.0 : 1.0);
      if (c.respawnTimer <= 0) {
        const sp = this.mapLoader.pickBestSpawnPoint(allCombatants);
        c.position = { ...sp.position };
        c.velocity = { x: 0, y: 0, z: 0 };
        c.yaw = sp.yaw;
        c.pitch = 0;
        c.health = c.maxHealth;
        c.armor = c.maxArmor;
        c.isAlive = true;
        c.activeWeapon = createInitialWeaponState(c.activeWeapon.weaponId);
      }
    }
  }

  private checkMatchEnd(player: CombatantState): void {
    const mode = this.gameState.config.mode;
    const killLimit = this.gameState.config.killLimit;
    const all = this.gameState.getAllCombatants();
    const timeUp = this.gameState.timeRemaining <= 0;

    let matchOver = false;
    let victory = false;
    let reason: MatchSummary['reason'] = 'time_up';

    if (mode === 'battle_royale') {
      const alive = all.filter((c) => c.isAlive);
      if (!player.isAlive) {
        matchOver = true;
        victory = false;
        reason = 'kill_limit';
      } else if (alive.length <= 1) {
        matchOver = true;
        victory = true;
        reason = 'kill_limit';
      } else if (timeUp) {
        matchOver = true;
        victory = alive.some((c) => c.id === player.id);
      }
    } else if (mode === 'story') {
      const ch = this.storyManager.getActiveChapter();
      const shAllDone =
        this.storyManager.getStrongholds().length > 0 &&
        this.storyManager.getStrongholds().every((s) => s.liberated);
      if (shAllDone) {
        matchOver = true;
        victory = true;
        reason = 'kill_limit';
        if (ch) {
          this.saveManager.completeStoryChapter(ch.id, ch.rewardCauris);
        } else if (this.storyManager.isOpenWorldActive()) {
          this.saveManager.completeStoryChapter(OPEN_WORLD_ADVENTURE.id, 450);
        }
      } else if (timeUp) {
        matchOver = true;
        victory = false;
        reason = 'time_up';
      }
    } else if (mode === 'team_deathmatch') {
      const alphaKills = all.filter((c) => c.team === 'alpha').reduce((s, c) => s + c.stats.kills, 0);
      const betaKills = all.filter((c) => c.team === 'beta').reduce((s, c) => s + c.stats.kills, 0);
      if (alphaKills >= killLimit || betaKills >= killLimit || timeUp) {
        matchOver = true;
        victory = alphaKills >= betaKills;
        reason = alphaKills >= killLimit || betaKills >= killLimit ? 'kill_limit' : 'time_up';
      }
    } else {
      const limitReached = all.some((c) => c.stats.kills >= killLimit);
      if (limitReached || timeUp) {
        matchOver = true;
        const sortedTmp = [...all].sort((a, b) => b.stats.kills - a.stats.kills);
        victory = sortedTmp[0]?.id === player.id;
        reason = limitReached ? 'kill_limit' : 'time_up';
      }
    }

    if (!matchOver) return;

    const sorted = [...all].sort((a, b) => b.stats.kills - a.stats.kills);

    const summary: MatchSummary = {
      victory,
      reason,
      durationPlayed: this.gameState.config.durationSeconds - this.gameState.timeRemaining,
      playerStats: { ...player.stats },
      leaderboard: sorted.map((c) => ({
        id: c.id,
        name: c.name,
        isBot: c.isBot,
        heroId: c.heroId,
        kills: c.stats.kills,
        deaths: c.stats.deaths,
        damageDealt: c.stats.damageDealt,
      })),
      killFeed: [...this.gameState.killFeed],
    };

    const updatedSave = this.saveManager.recordMatchResult({
      mapId: this.gameState.config.mapId,
      kills: player.stats.kills,
      deaths: player.stats.deaths,
      headshots: player.stats.headshots,
      victory,
      difficulty: this.gameState.config.botDifficulty as BotDifficulty,
    });

    this.gameState.phase = 'ended';
    this.inputManager.exitPointerLock();
    this.inputManager.resetKeys();
    this.audioManager.playMatchEnd(victory);
    this.uiManager.hud.setVisible(false);
    this.uiManager.syncSave(updatedSave);
    this.uiManager.menu.showEndScreen(summary);
    this.eventBus.emit('match:ended', summary);
  }

  private beginMultiplayerMatch(payload: {
    roomId: string;
    mapId: string;
    killLimit: number;
    durationSeconds: number;
    snapshot: NetMatchSnapshot;
  }): void {
    this.isMultiplayerMatch = true;
    this.audioManager.unlock();
    this.clearBotRigs();
    this.uiManager.clearKillFeed();

    const multiMapId = (payload.mapId as MapId) || 'tombouctou';
    const multiMap = getMapDefinition(multiMapId);
    this.gameState.resetForMatch({
      mode: 'deathmatch',
      mapId: multiMapId,
      botCount: 0,
      botDifficulty: 'intermediate',
      durationSeconds: payload.durationSeconds,
      killLimit: payload.killLimit,
      playerHeroId: 'sundiata',
      playerWeaponId: 'flintlock_musket',
    });

    this.mapLoader.load(
      multiMap,
      this.sceneManager,
      this.physicsManager,
      this.perfManager.getPreset()
    );

    const myId = this.networkManager.getLocalPlayerId();
    const mySnap =
      payload.snapshot.players.find((p) => p.id === myId) ?? payload.snapshot.players[0];

    this.localMultiSlots = [
      mySnap.activeWeapon.weaponId,
      mySnap.activeWeapon.weaponId === 'repeating_rifle'
        ? 'flintlock_musket'
        : 'repeating_rifle',
    ];
    this.localMultiSlotIdx = 0;
    this.localMultiShootCooldown = 0;

    this.gameState.player = {
      id: mySnap.id,
      name: mySnap.name,
      isBot: false,
      heroId: mySnap.heroId,
      position: { ...mySnap.position },
      yaw: mySnap.yaw,
      pitch: mySnap.pitch,
      velocity: { ...mySnap.velocity },
      health: mySnap.health,
      maxHealth: mySnap.maxHealth,
      armor: mySnap.armor,
      maxArmor: mySnap.maxArmor,
      isAlive: mySnap.isAlive,
      respawnTimer: mySnap.respawnTimer,
      isGrounded: mySnap.isGrounded,
      isSprinting: mySnap.isSprinting,
      isCrouching: mySnap.isCrouching,
      isSliding: mySnap.isSliding,
      activeWeapon: { ...mySnap.activeWeapon },
      stats: { ...mySnap.stats },
    };

    this.syncRemoteRigs(payload.snapshot);
    this.gameState.phase = 'playing';
    this.uiManager.menu.hideAll();
    this.uiManager.hud.setVisible(true);
    this.inputManager.requestPointerLock();
  }

  private handleServerSnapshot(snapshot: NetMatchSnapshot): void {
    if (!this.isMultiplayerMatch || !this.gameState.player) return;

    this.gameState.timeRemaining = snapshot.timeRemaining;
    const myId = this.networkManager.getLocalPlayerId();
    const serverMe = snapshot.players.find((p) => p.id === myId);

    if (serverMe) {
      const p = this.gameState.player;
      p.health = serverMe.health;
      p.armor = serverMe.armor;
      p.isAlive = serverMe.isAlive;
      p.respawnTimer = serverMe.respawnTimer;
      p.activeWeapon = { ...serverMe.activeWeapon };
      p.stats = { ...serverMe.stats };

      const reconciled = this.networkManager.reconcileLocalPlayer(
        serverMe,
        this.physicsManager.getColliders()
      );
      p.position = reconciled.position;
      p.velocity = reconciled.velocity;
      p.isGrounded = reconciled.isGrounded;
      p.isCrouching = reconciled.isCrouching;
      p.isSprinting = reconciled.isSprinting;
      this.physicsManager.syncPlayerBody(p.position);
    }

    this.syncRemoteRigs(snapshot);
  }

  private syncRemoteRigs(snapshot: NetMatchSnapshot): void {
    const myId = this.networkManager.getLocalPlayerId();
    const activeIds = new Set<string>();

    this.gameState.bots = snapshot.players
      .filter((p) => p.id !== myId)
      .map((p) => {
        activeIds.add(p.id);
        if (!this.botRigs.has(p.id)) {
          const rig = new VoxelCharacterRig(
            HEROES_CONFIG[p.heroId],
            this.perfManager.getPreset().shadowsEnabled,
            p.activeWeapon.weaponId
          );
          this.sceneManager.getEntitiesGroup().add(rig.root);
          this.botRigs.set(p.id, rig);
        }
        return {
          id: p.id,
          name: p.name,
          isBot: false,
          heroId: p.heroId,
          position: { ...p.position },
          yaw: p.yaw,
          pitch: p.pitch,
          velocity: { ...p.velocity },
          health: p.health,
          maxHealth: p.maxHealth,
          armor: p.armor,
          maxArmor: p.maxArmor,
          isAlive: p.isAlive,
          respawnTimer: p.respawnTimer,
          isGrounded: p.isGrounded,
          isSprinting: p.isSprinting,
          isCrouching: p.isCrouching,
          isSliding: p.isSliding,
          activeWeapon: { ...p.activeWeapon },
          stats: { ...p.stats },
        };
      });

    for (const [id, rig] of this.botRigs.entries()) {
      if (!activeIds.has(id)) {
        this.sceneManager.getEntitiesGroup().remove(rig.root);
        rig.dispose();
        this.botRigs.delete(id);
      }
    }
  }

  private tickMultiplayer(dt: number, player: CombatantState): void {
    const input = this.inputManager.consumeSnapshot();

    if (player.isAlive) {
      player.yaw -= input.lookDeltaX;
      player.pitch = THREE.MathUtils.clamp(
        player.pitch - input.lookDeltaY,
        -Math.PI / 2 + 0.06,
        Math.PI / 2 - 0.06
      );

      if (input.switchSlot1 && this.localMultiSlotIdx !== 0) {
        this.localMultiSlotIdx = 0;
        this.networkManager.sendSwitchWeapon(this.localMultiSlots[0]);
      } else if (input.switchSlot2 && this.localMultiSlotIdx !== 1) {
        this.localMultiSlotIdx = 1;
        this.networkManager.sendSwitchWeapon(this.localMultiSlots[1]);
      }

      if (input.reload) {
        this.networkManager.sendReload();
        this.audioManager.playReload();
      }

      const isAiming = input.aim && !player.activeWeapon.isReloading;
      const moveInput = {
        moveForward: input.moveForward,
        moveRight: input.moveRight,
        jump: input.jump,
        sprint: input.sprint,
        crouch: input.crouch,
        yaw: player.yaw,
        pitch: player.pitch,
        isAiming,
      };

      // Prédiction locale immédiate + envoi séquencé au serveur
      const predicted = stepCombatantKinematics({
        position: player.position,
        velocity: player.velocity,
        isGrounded: player.isGrounded,
        isCrouching: player.isCrouching,
        isSprinting: player.isSprinting,
        input: moveInput,
        dt,
        colliders: this.physicsManager.getColliders(),
      });
      player.position = predicted.position;
      player.velocity = predicted.velocity;
      player.isGrounded = predicted.isGrounded;
      player.isCrouching = predicted.isCrouching;
      player.isSprinting = predicted.isSprinting;
      this.physicsManager.syncPlayerBody(player.position);

      this.networkManager.sendInput(moveInput, dt);

      const horizSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      this.cameraController.update({
        dt,
        playerPos: player.position,
        yaw: player.yaw,
        pitch: player.pitch,
        isCrouching: player.isCrouching,
        isSliding: player.isSliding,
        isAiming,
        horizontalSpeed: horizSpeed,
        isGrounded: player.isGrounded,
      });

      if (this.localMultiShootCooldown > 0) {
        this.localMultiShootCooldown = Math.max(0, this.localMultiShootCooldown - dt);
      }

      if (
        input.fire &&
        !player.activeWeapon.isReloading &&
        player.activeWeapon.ammoInMag > 0 &&
        this.localMultiShootCooldown <= 0
      ) {
        const wDef = getWeaponDefinition(player.activeWeapon.weaponId);
        this.localMultiShootCooldown = 1 / wDef.stats.fireRate;
        const cam = this.cameraController.camera;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        this.networkManager.sendShoot(
          { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          { x: forward.x, y: forward.y, z: forward.z },
          isAiming
        );
        this.cameraController.addRecoil(wDef.stats.recoilVertical, wDef.stats.recoilHorizontal);
        this.audioManager.playGunshot(true);
      }

      this.weaponManager.updateViewModel({
        dt,
        weaponState: player.activeWeapon,
        isAiming,
        moveSpeed: horizSpeed,
        isAlive: true,
      });
    } else {
      this.weaponManager.updateViewModel({
        dt,
        weaponState: player.activeWeapon,
        isAiming: false,
        moveSpeed: 0,
        isAlive: false,
      });
    }

    // Interpolation fluide des joueurs distants
    const interpolated = this.networkManager.getInterpolatedRemotePlayers();
    for (const remote of interpolated) {
      const rig = this.botRigs.get(remote.snapshot.id);
      if (rig) {
        rig.update({
          dt,
          position: remote.position,
          yaw: remote.yaw,
          speed: remote.speed,
          isAlive: remote.snapshot.isAlive,
          isGrounded: remote.snapshot.isGrounded,
          isCrouching: remote.snapshot.isCrouching,
          weaponId: remote.snapshot.activeWeapon.weaponId,
        });
      }
    }

    this.physicsManager.step(dt);
    this.sceneManager.update(dt, this.gameState.elapsedTime);
    this.renderer.render(this.sceneManager.scene, this.cameraController.camera);

    this.uiManager.hud.update({
      dt,
      player,
      bots: this.gameState.bots,
      map: this.mapLoader.getActiveMap(),
      timeRemaining: this.gameState.timeRemaining,
      killLimit: this.gameState.config.killLimit,
      isAiming: input.aim,
      pointerLocked: this.inputManager.isPointerLocked(),
      showScoreboard: input.scoreboard,
      showDiagnostics: this.settings.showDiagnostics,
      metrics: this.perfManager.getMetrics(this.renderer.getStats()),
      network: {
        isMultiplayer: true,
        status:
          this.networkManager.getStatus() === 'p2p_host' ||
          this.networkManager.getStatus() === 'p2p_client'
            ? 'connected'
            : (this.networkManager.getStatus() as 'disconnected' | 'connecting' | 'connected'),
        pingMs: this.networkManager.getPingMs(),
      },
    });
  }

  private handleMultiplayerMatchEnded(summary: MatchSummary): void {
    const myId = this.networkManager.getLocalPlayerId();
    const myStats = this.gameState.player?.stats ?? summary.playerStats;
    const victory = summary.leaderboard[0]?.id === myId;
    const localSummary: MatchSummary = {
      ...summary,
      victory,
      playerStats: { ...myStats },
    };

    const updatedSave = this.saveManager.recordMatchResult({
      mapId: this.gameState.config.mapId,
      kills: myStats.kills,
      deaths: myStats.deaths,
      headshots: myStats.headshots,
      victory,
      difficulty: 'intermediate',
    });

    this.isMultiplayerMatch = false;
    this.gameState.phase = 'ended';
    this.inputManager.exitPointerLock();
    this.inputManager.resetKeys();
    this.audioManager.playMatchEnd(victory);
    this.uiManager.hud.setVisible(false);
    this.uiManager.syncSave(updatedSave);
    this.uiManager.menu.showEndScreen(localSummary);
  }

  private clearBotRigs(): void {
    for (const rig of this.botRigs.values()) {
      this.sceneManager.getEntitiesGroup().remove(rig.root);
      rig.dispose();
    }
    this.botRigs.clear();
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.resize(w, h);
    this.cameraController.resize(w, h);
  };

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    this.networkManager.disconnect();
    this.inputManager.dispose();
    this.touchControls.dispose();
    this.clearBotRigs();
    this.sceneManager.dispose();
    this.renderer.dispose();
  }
}
