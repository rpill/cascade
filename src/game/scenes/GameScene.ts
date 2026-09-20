import * as Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { createRandomDealSeed, GameSession } from '../model/GameSession.ts';
import { VerifiedDealCatalog } from '../model/VerifiedDealCatalog.ts';
import { pickStandardDeal, type StandardDealSelection } from '../model/StandardDealPicker.ts';
import { shouldRecordStandardFailure } from '../model/StandardAttemptPolicy.ts';
import {
  FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY,
  VERIFIED_DEALS_REGISTRY_KEY,
  getCardFaceAsset,
  getDeferredFirstRunCardBatches,
} from './BootScene.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Card, Deal, GameMode } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { DailyCompleteView } from '../view/DailyCompleteView.ts';
import { GameCompleteView } from '../view/GameCompleteView.ts';
import { calculateViewportLayout, scaleViewportLayout } from '../view/ViewportLayout.ts';
import { AttemptTimer } from '../../meta/AttemptTimer.ts';
import { getDailyId, getDailySeed, getIsoWeekDailyIds, getIsoWeekId } from '../../meta/DailyCalendar.ts';
import { getWeeklyProgress } from '../../meta/DailyProgress.ts';
import { MetaSession } from '../../meta/MetaSession.ts';
import { MetaJournal } from '../../meta/MetaJournal.ts';
import {
  clearProfileMergeTransfer,
  hasMergedProfileScope,
  mergeMetaProfiles,
  readProfileMergeTransfer,
  shouldPreserveActiveGameForProfileMerge,
  stageProfileMergeTransfer,
} from '../../meta/ProfileMerge.ts';
import { completeAttempt, hasCompletedAttempt, type MetaOperation, type CompletionEvent } from '../../meta/MetaOperations.ts';
import { type ModeCompletionResult, type OrdinaryGameMode } from '../../meta/GameStats.ts';
import { createDefaultMetaSave, DAILY_ALGORITHM_VERSION, type MetaSave, type StandardDifficulty } from '../../meta/MetaSave.ts';
import { ActiveGameRepository } from '../../persistence/ActiveGameRepository.ts';
import { activeGameSaveToDeal, createActiveGameSave, type ActiveGameSaveV2 } from '../../persistence/ActiveGameSave.ts';
import { initializePlatform } from '../../platform/index.ts';
import type { PlatformServices } from '../../platform/services.ts';
import { authorizationUsesProfileScopeTransfer } from '../../platform/AuthorizationPolicy.ts';
import { BackendClient } from '../../backend/BackendClient.ts';
import { resolveBackendUrl } from '../../backend/BackendConfig.ts';
import { CloudProfileService } from '../../backend/CloudProfileService.ts';
import { CloudSyncCoordinator } from '../../cloud/CloudSyncCoordinator.ts';
import { CLOUD_SNAPSHOT_VERSION, type CloudSnapshot } from '../../cloud/CloudSnapshot.ts';
import { CloudSyncStateStore } from '../../cloud/CloudSyncState.ts';
import { deriveGameplayActivity } from '../../platform/GameplayActivity.ts';
import { LeaderboardService } from '../../leaderboards/LeaderboardService.ts';
import { encodeMasteryLeaderboardScore, type GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';
import { createLeaderboardFixtureResult, createLocalLeaderboardPlayerEntry, leaderboardFixturesEnabled } from '../../leaderboards/LeaderboardFixtures.ts';
import { getDailyStreaks } from '../../meta/DailyStreak.ts';
import { preferences } from '../../settings/Preferences.ts';
import { AudioController } from '../../settings/AudioController.ts';
import { SFX_ASSETS, SfxController } from '../../settings/SfxController.ts';
import { getLanguage, subscribeLanguage, t } from '../../localization/Localization.ts';
import { analytics } from '../../analytics/AnalyticsService.ts';
import { productBridge } from '../../ui/bridge/CascadeProductBridge.ts';
import { NewDealConfirmOverlay } from '../../ui/game/NewDealConfirmOverlay.ts';
import { GameHud } from '../../ui/game/GameHud.ts';
import { buildGameHudViewModel } from '../../ui/game/GameHudViewModel.ts';
import { SceneBackdrop } from '../../ui/components/SceneBackdrop.ts';
import { UI_TOKENS } from '../../ui/style/UiTokens.ts';
import { buildVictoryMasteryState, type VictoryMasteryState } from '../view/VictoryMastery.ts';
import { GAME_APPEARANCE } from '../appearance/GameAppearance.ts';
import { StandardAdController } from '../../ads/StandardAdController.ts';

interface DailyContext {
  readonly dailyId: string;
  readonly weekId: string;
  readonly weekDailyIds: readonly string[];
  readonly seed: bigint;
}

interface StartDealOptions {
  readonly restored?: ActiveGameSaveV2;
}

interface OrdinaryCompletionSnapshot {
  readonly mode: OrdinaryGameMode;
  readonly elapsedMs: number;
  readonly moves: number;
  readonly result: ModeCompletionResult;
  readonly event: CompletionEvent;
  readonly mastery: VictoryMasteryState | null;
}

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private gameHud: GameHud | null = null;
  private backdrop: SceneBackdrop | null = null;
  private hudRefreshTimer: Phaser.Time.TimerEvent | null = null;
  private gameState: SolitaireGame | null = null;
  private newDealConfirmOverlay!: NewDealConfirmOverlay;
  private standardAdController: StandardAdController | null = null;
  private freshDealTransitionInFlight = false;
  private freshDealActivityBlocked = false;
  private audioController!: AudioController;
  private sfxController!: SfxController;
  private unsubscribeLanguage: (() => void) | null = null;
  private rulesOpen = false;
  private rulesOnboarding = false;
  private rulesBlockedBoardSettle = false;
  private pendingFirstRunHowToPlay = false;
  private dailyCompleteView!: DailyCompleteView;
  private gameCompleteView!: GameCompleteView;
  private leaderboardAuthPending = false;
  private unsubscribeAccountSelection: (() => void) | null = null;

  private activeGameRepository!: ActiveGameRepository;
  private pendingActiveSave: ActiveGameSaveV2 | null = null;
  private pendingDailyRestore: ActiveGameSaveV2 | null = null;
  private metaSession!: MetaSession;
  private metaJournal!: MetaJournal;
  private metaScope = 'unbound';
  private attemptId = '';
  private lastDailyEvent: CompletionEvent | null = null;
  private lastDailyImprovedBest = false;
  private readonly attemptTimer = new AttemptTimer();
  private attemptStarted = false;
  private attemptFinalized = false;
  private attemptRestored = false;
  private attemptAbandonTracked = false;
  private lastOrdinaryCompletion: OrdinaryCompletionSnapshot | null = null;
  private lastDailyMastery: VictoryMasteryState | null = null;

  private platform: PlatformServices | null = null;
  private platformPaused = false;
  private windowFocused = true;
  private platformScenePaused = false;
  private gameplayMarkupActive = false;
  private unsubscribePlatformPause: (() => void) | null = null;
  private readonly platformResumeWaiters = new Set<() => void>();
  private leaderboardService: LeaderboardService | null = null;
  private cloudSync: CloudSyncCoordinator | null = null;
  private metaState: MetaSave = createDefaultMetaSave();
  private verifiedDealCatalog!: VerifiedDealCatalog;
  private activeStandardSelection: StandardDealSelection | null = null;
  private dailyContext: DailyContext | null = null;
  private cardLoadChain: Promise<void> = Promise.resolve();

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.windowFocused = document.hasFocus();
    this.audioController = new AudioController(this.sound);
    this.sfxController = new SfxController(this.sound);
    this.audioController.setSuspended(!this.windowFocused || document.visibilityState !== 'visible');
    try { this.metaScope = localStorage.getItem('cascadeMetaScope') ?? 'unbound'; } catch { /* unavailable storage */ }
    this.metaJournal = new MetaJournal(this.metaScope);
    this.metaSession = new MetaSession({
      load: async () => {
        if (!this.platform) throw new Error('Platform loading');
        return this.platform.playerStorage.loadStrict?.() ?? this.platform.playerStorage.load();
      },
      save: async (data, flush) => {
        if (!this.platform) throw new Error('Platform loading');
        await (this.platform.playerStorage.saveStrict?.(data, flush) ?? this.platform.playerStorage.save(data, flush));
      },
    }, this.metaJournal);
    this.input.dragDistanceThreshold = 7;
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    this.backdrop = new SceneBackdrop(this, 'game', UI_TOKENS.color.table);
    this.backdrop.setAppearance(GAME_APPEARANCE);
    this.applyViewportLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.verifiedDealCatalog = this.registry.get(VERIFIED_DEALS_REGISTRY_KEY) as VerifiedDealCatalog;
    if (!(this.verifiedDealCatalog instanceof VerifiedDealCatalog)) {
      throw new Error('Verified deal catalog is not registered.');
    }
    this.flow = new GameFlow(new GameSession({ catalog: this.verifiedDealCatalog }));
    this.newDealConfirmOverlay = new NewDealConfirmOverlay(this);
    this.metaSession.onChange = () => this.refreshSessionState();
    this.dailyCompleteView = new DailyCompleteView(this, {
      retry: () => this.retryDaily(),
      menu: () => this.openMenuFromDailyComplete(),
      sound: (cue) => this.sfxController.play(cue),
    });
    this.gameCompleteView = new GameCompleteView(this, {
      newGame: () => this.startNewDeal(),
      menu: () => this.openMenuFromGameComplete(),
      sound: (cue) => this.sfxController.play(cue),
    });
    this.applyViewportLayout();
    this.activeGameRepository = new ActiveGameRepository();
    this.installProductBridge();
    this.hudRefreshTimer = this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshGameHud() });
    this.unsubscribeLanguage = subscribeLanguage(() => this.refreshLocalization());
    this.refreshLocalization();
    this.pendingActiveSave = this.activeGameRepository.load();
    if (this.pendingActiveSave?.mode === 'daily') {
      this.pendingDailyRestore = this.pendingActiveSave;
    }
    const firstRun = !preferences.howToPlaySeen;
    const restoredOrdinary = firstRun ? false : this.tryRestoreOrdinarySession();

    if (firstRun) {
      this.startFirstRunHowToPlay();
    } else if (!restoredOrdinary && this.pendingDailyRestore === null) {
      this.showProductHome(false);
    }
    this.refreshMenuMeta();

    this.input.keyboard?.on('keydown-R', this.restartDeal, this);
    this.input.keyboard?.on('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.on('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.on('keydown-ESC', this.handleEscape, this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('pagehide', this.handlePageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    void this.initializeMeta();
  }

  private async initializeMeta(): Promise<void> {
    this.platform = await initializePlatform();
    preferences.initializeLanguage(this.platform.language);
    this.bindPlatformLifecycle(this.platform);
    this.reconcileGameplayActivity();
    this.platform.ready();

    await this.loadMetaProfile();
    this.standardAdController = new StandardAdController(this.platform);
    void this.metaSession.flush();

    this.leaderboardService = new LeaderboardService(this.platform);
    this.configureCloudSync();
    void this.cloudSync?.sync('startup');
    this.unsubscribeAccountSelection?.();
    this.unsubscribeAccountSelection = this.platform.auth.onAccountSelectionClosed(() => {
      if (authorizationUsesProfileScopeTransfer(this.platform!)) {
        window.location.reload();
        return;
      }
      void this.cloudSync?.sync('authorization');
      void this.platform?.leaderboards.retryPending?.();
      this.refreshMenuMeta();
    });
    this.refreshMenuMeta();

    const now = this.dailyClockNowMs();
    if (now !== null && this.metaSession.status === 'ready') {
      const dailyId = getDailyId(now);
      this.dailyContext = {
        dailyId,
        weekId: getIsoWeekId(now),
        weekDailyIds: getIsoWeekDailyIds(now),
        seed: getDailySeed(dailyId, this.verifiedDealCatalog),
      };
    }

    if (this.leaderboardService.authorized) {
      void this.syncHistoricalLeaderboards();
    }

    if (this.pendingDailyRestore !== null && this.dailyContext !== null) {
      this.tryRestoreDailySession(this.pendingDailyRestore);
    }

    if (this.gameState === null && !this.scene.isActive('HomeScene')) {
      this.showProductHome(false);
    }

    this.refreshMenuMeta();
  }

  private configureCloudSync(): void {
    this.cloudSync?.dispose();
    this.cloudSync = null;
    window.removeEventListener('online', this.handleCloudOnline);
    const platform = this.platform;
    const identity = platform?.backendIdentity;
    const backendUrl = resolveBackendUrl();
    if (!platform || !identity || backendUrl === null) return;

    const profiles = new CloudProfileService(new BackendClient(backendUrl, identity));
    this.cloudSync = new CloudSyncCoordinator({
      identity,
      profiles,
      local: {
        readSnapshot: () => this.readCloudSnapshot(),
        applySnapshot: (snapshot) => this.applyCloudSnapshot(snapshot),
        todayId: () => getDailyId(this.dailyClockNowMs() ?? Date.now()),
      },
      stateStoreFactory: (provider, key) => new CloudSyncStateStore(provider, key),
    });
    window.addEventListener('online', this.handleCloudOnline);
  }

  private readCloudSnapshot(): CloudSnapshot {
    const activeGame = this.activeGameRepository.loadCheckpoint();
    return {
      schemaVersion: CLOUD_SNAPSHOT_VERSION,
      meta: structuredClone(this.metaState),
      ...(activeGame === null ? {} : { activeGame }),
    };
  }

  private async applyCloudSnapshot(snapshot: CloudSnapshot): Promise<boolean> {
    const saved = await this.metaSession.replaceAndFlush(snapshot.meta);
    if (!saved) return false;
    if (snapshot.activeGame === undefined) this.activeGameRepository.clear();
    else this.activeGameRepository.save(snapshot.activeGame.save, snapshot.activeGame.updatedAtMs);
    this.pendingActiveSave = snapshot.activeGame?.save ?? null;
    this.pendingDailyRestore = snapshot.activeGame?.save.mode === 'daily' ? snapshot.activeGame.save : null;
    this.refreshSessionState();
    return true;
  }

  private readonly handleCloudOnline = (): void => {
    void this.cloudSync?.sync('online');
    void this.platform?.leaderboards.retryPending?.();
  };

  private dailyClockNowMs(): number | null {
    const trusted = this.platform?.trustedClock.nowMs() ?? null;
    if (trusted !== null) return trusted;
    // Pikabu has no trusted clock in phase 1. Local time keeps guest Daily playable;
    // the backend still validates submitted Daily dates against server time.
    return this.platform?.backendIdentity ? Date.now() : null;
  }

  private refreshMenuMeta(): void {
    productBridge.notify();
    this.refreshGameHud();
  }

  private refreshLocalization(): void {
    document.documentElement.lang = getLanguage();
    document.title = t('Пасьянс Каскад');
    this.game.canvas.parentElement?.setAttribute('aria-label', t('Пасьянс Каскад'));
    this.newDealConfirmOverlay.refreshLocalization();
    this.dailyCompleteView.refreshLocalization();
    this.gameCompleteView.refreshLocalization();
    this.refreshGameHud();
    productBridge.notify();
  }

  private refreshSessionState(): void {
    this.metaState = this.metaSession.state;
    if (this.lastOrdinaryCompletion) {
      const completion=this.lastOrdinaryCompletion;
      this.lastOrdinaryCompletion={...completion,result:{state:this.metaState,stats:{...this.metaState.stats[completion.mode]},
        improvedBest:this.metaSession.getImprovedBest(completion.event.attemptId) ?? completion.result.improvedBest}};
      if (this.flow.state==='playing' && this.gameState?.isWon) this.showOrdinaryCompletion();
    }
    if (this.lastDailyEvent && this.flow.state==='playing' && this.gameState?.isWon) this.showDailyCompletion();
    this.refreshMenuMeta();
  }

  private async loadMetaProfile(): Promise<void> {
    if (!this.platform) return;
    let scope: string;
    try { scope = await this.platform.playerStorage.scope?.() ?? 'browser-local'; }
    catch { this.refreshMenuMeta(); return; }
    if (scope !== this.metaScope) {
      const previousJournal = this.metaJournal;
      const pendingProfileMerge = readProfileMergeTransfer();
      const preserveActiveGame = shouldPreserveActiveGameForProfileMerge(
        this.metaScope,
        this.platform.auth.isAuthorized(),
        pendingProfileMerge,
      );
      const transfer = this.metaScope === 'unbound'
        ? previousJournal.pending.map(item=>item.operation) : [];
      const nextJournal=new MetaJournal(scope);
      const nextSession=new MetaSession(this.platform.playerStorage,nextJournal);
      for (const event of transfer) {
        if (!nextSession.dispatch(event)) {
          this.refreshMenuMeta();
          return;
        }
      }
      this.metaSession.onChange = undefined;
      this.metaJournal = nextJournal;
      this.metaSession = nextSession;
      this.metaSession.onChange = () => this.refreshSessionState();
      if (this.metaScope === 'unbound') previousJournal.acknowledge(previousJournal.pending);
      else if (!preserveActiveGame) {
        // Account/profile changes must not leak a board from another profile.
        // The one exception is an explicit guest -> authorized merge, where the
        // current local board remains the board the player is actively continuing.
        this.board?.destroy(); this.board=null;
        this.gameHud?.destroy(); this.gameHud=null;
        this.gameState=null;
        this.flow=new GameFlow(new GameSession({catalog:this.verifiedDealCatalog}));
        this.resetAttempt();
        this.activeGameRepository.clear();
        this.pendingActiveSave=null;
        this.pendingDailyRestore=null;
        this.gameCompleteView.hide(); this.dailyCompleteView.hide();
        this.showProductHome(false);
      }
      this.metaScope = scope;
      try { localStorage.setItem('cascadeMetaScope',scope); } catch { /* journal exposes durability */ }
    }
    const loaded = await this.metaSession.load();
    if (loaded) {
      await this.applyPendingProfileMerge();
    }
    this.refreshSessionState();
    if (loaded) {
      if (this.pendingDailyRestore) {
        this.dailyContext=this.currentDailyContext();
        if (this.dailyContext) this.tryRestoreDailySession(this.pendingDailyRestore);
      }
      void this.metaSession.flush();
    }
  }

  private async applyPendingProfileMerge(): Promise<boolean> {
    if (!this.platform?.auth.isAuthorized()) return true;
    const transfer = readProfileMergeTransfer();
    if (transfer === null) return true;

    if (hasMergedProfileScope(this.metaSession.state, transfer.sourceScope)) {
      clearProfileMergeTransfer();
      return true;
    }

    const merged = mergeMetaProfiles(this.metaSession.state, transfer.state, transfer.sourceScope);
    const saved = await this.metaSession.replaceAndFlush(merged);
    if (saved) clearProfileMergeTransfer();
    return saved;
  }

  private dispatchMeta(event: MetaOperation): boolean {
    const accepted = this.metaSession.dispatch(event);
    this.refreshSessionState();
    if (accepted && this.metaSession.status === 'ready') void this.metaSession.flush();
    return accepted;
  }

  private dailyContextForId(dailyId: string): DailyContext|null {
    if (this.metaSession.status !== 'ready') return null;
    const parsed = Date.parse(`${dailyId}T00:00:00Z`);
    if (!Number.isFinite(parsed)) return null;
    const now = this.platform?.trustedClock.nowMs() ?? Date.now();
    const todayId = getDailyId(now);
    if (dailyId > todayId) return null;
    const ageDays = Math.floor((Date.parse(`${todayId}T00:00:00Z`) - parsed) / 86_400_000);
    if (ageDays < 0 || ageDays > 90) return null;
    try {
      return {
        dailyId,
        weekId:getIsoWeekId(parsed),
        weekDailyIds:getIsoWeekDailyIds(parsed),
        seed:getDailySeed(dailyId,this.verifiedDealCatalog),
      };
    } catch { return null; }
  }

  private currentDailyContext(): DailyContext|null {
    const now=this.dailyClockNowMs();
    if(now===null || this.metaSession.status!=='ready') return null;
    return this.dailyContextForId(getDailyId(now));
  }

  private completionEvent(mode:GameMode,elapsedMs:number): CompletionEvent {
    const now=this.dailyClockNowMs();
    return {kind:'complete',mode,attemptId:this.attemptId,elapsedMs:Math.max(1,elapsedMs),moves:Math.max(1,this.history.moveCount),
      trustedDay:now===null ? null : getDailyId(now),trustedWeek:now===null ? null : getIsoWeekId(now),
      ...(mode==='daily' && this.dailyContext ? {dailyId:this.dailyContext.dailyId,weekId:this.dailyContext.weekId} : {}),
      ...(mode==='winnable' && this.activeStandardSelection ? {
        standardSeed:this.activeStandardSelection.seed.toString(),
        standardPartition:this.activeStandardSelection.partition,
        standardDifficulty:this.activeStandardSelection.difficulty,
      } : {}),
    };
  }

  private tryRestoreOrdinarySession(): boolean {
    const save = this.pendingActiveSave;

    if (save === null) {
      return false;
    }

    if (save.mode === 'daily') {
      this.pendingActiveSave = null;
      return false;
    }

    const deal = this.flow.resume(activeGameSaveToDeal(save), save.uiState);
    this.activeStandardSelection = save.mode === 'winnable' && save.standard
      ? { seed: BigInt(save.seed), partition: save.standard.partition, difficulty: save.standard.difficulty, isReplayPoolFallback: false }
      : null;
    this.pendingActiveSave = null;
    this.startDeal(deal, { restored: save });

    if (save.uiState === 'menu-paused') {
      this.showProductHome(this.flow.canCancelMenu);
    }

    return true;
  }

  private tryRestoreDailySession(save: ActiveGameSaveV2): boolean {
    const context = this.dailyContext;

    if (context === null || save.mode !== 'daily') {
      return false;
    }

    const daily = save.daily;
    const identityMatches = daily !== undefined
      && daily.dailyId === context.dailyId
      && daily.algorithmVersion === DAILY_ALGORITHM_VERSION
      && BigInt(save.seed) === context.seed;

    if (!identityMatches) {
      this.activeGameRepository.clear();
      this.pendingDailyRestore = null;
      return false;
    }

    const deal = this.flow.resume(activeGameSaveToDeal(save), 'playing');
    this.pendingDailyRestore = null;
    this.pendingActiveSave = null;
    this.stopProductUiScenes();
    if (!this.platformPaused && this.scene.isPaused()) this.scene.resume();
    this.board?.destroy();
    this.startDeal(deal, { restored: save });
    this.board?.setUiPaused(false);

    return true;
  }

  private getRenderMetrics(): { width: number; height: number; renderScale: number } {
    const cssZoom = this.scale.zoom;
    const safeCssZoom = Number.isFinite(cssZoom) && cssZoom > 0 ? cssZoom : 1;
    return {
      width: this.scale.width * safeCssZoom,
      height: this.scale.height * safeCssZoom,
      renderScale: 1 / safeCssZoom,
    };
  }

  private startDeal(deal: Deal, options: StartDealOptions = {}): void {
    const restored = options.restored;

    this.resetAttempt();
    this.attemptRestored = restored !== undefined;
    this.rulesBlockedBoardSettle = false;
    this.attemptId = restored?.attemptId ?? `${this.metaJournal.stream}~${this.metaJournal.nextSequence}`;
    this.dailyCompleteView.hide();
    this.gameCompleteView.hide();
    this.history.clear();
    if (restored !== undefined) this.history.restoreMoveCount(restored.moveCount);
    const gameState = new SolitaireGame(deal);
    this.gameState = gameState;
    const viewport = this.getRenderMetrics();
    const layout = scaleViewportLayout(
      calculateViewportLayout(viewport.width, viewport.height),
      viewport.renderScale,
    );
    this.board = new BoardView(this, gameState, {
      ensureCardsReady: (cards) => this.ensureCardTextures(cards),
      draw: () => this.history.execute(
        gameState,
        () => gameState.draw(),
        (cards) => cards.length > 0,
      ),
      move: (source, target) => this.history.execute(
        gameState,
        () => gameState.move(source, target),
        Boolean,
      ),
      autoFoundation: (source) => this.history.execute(
        gameState,
        () => gameState.moveToFoundation(source),
        Boolean,
      ),
      autoFoundationStep: (excludedSuits) => gameState.autoMoveToFoundation(excludedSuits),
      settled: () => this.onBoardSettled(gameState),
      undo: () => this.history.undo(gameState),
      sound: (cue) => this.sfxController.play(cue),
    }, layout, GAME_APPEARANCE);

    this.gameHud?.destroy();
    this.gameHud = new GameHud(this, this.makeGameHudViewModel(), {
      home: () => this.openMainMenu(),
      newDeal: () => this.startNewDeal(),
      restart: () => this.restartDeal(),
      undo: () => this.undoLastAction(),
      hint: () => this.showHint(),
      sound: () => this.sfxController.play('button'),
    });
    this.gameHud.layout(layout);

    if (restored !== undefined) {
      this.attemptStarted = restored.attemptStarted;
      if (restored.attemptStarted) {
        const now = performance.now();
        this.attemptTimer.start(now, restored.elapsedMs);
      }

      this.reconcileGameplayActivity();
      this.board.showRestoredState();
      this.onBoardSettled(gameState);
      return;
    }

    this.pendingActiveSave = null;
    this.pendingDailyRestore = null;
    this.checkpointActiveGame(gameState);
    this.board.playInitialDeal();
  }

  private onBoardSettled(gameState: SolitaireGame): void {
    if (gameState !== this.gameState) return;
    this.refreshGameHud();
    if (this.pendingFirstRunHowToPlay) {
      this.pendingFirstRunHowToPlay = false;
      this.rulesBlockedBoardSettle = true;
      this.openProductHowToPlay(true);
      return;
    }
    if (this.rulesOpen) {
      this.rulesBlockedBoardSettle = true;
      return;
    }
    this.rulesBlockedBoardSettle = false;
    this.refreshGameHud();
    const mode = gameState.mode;
    const isDaily = mode === 'daily';
    const context = this.dailyContext;

    if (isDaily && context === null) {
      return;
    }

    if (!this.attemptStarted) {
      if (gameState.isWon) {
        return;
      }

      const now = performance.now();
      this.attemptTimer.start(now);
      this.attemptStarted = true;
      this.attemptFinalized = false;
      this.reconcileGameplayActivity();

      const trustedNow = this.dailyClockNowMs();
      const dailyRankingEligible = isDaily
        && trustedNow !== null
        && getDailyId(trustedNow) === context!.dailyId;
      this.dispatchMeta({kind:'begin',attemptId:this.attemptId,mode,
        ...(isDaily ? {dailyId:context!.dailyId,weekId:context!.weekId,dailyRankingEligible} : {})});
      analytics.event('game_start', { mode, restored: this.attemptRestored });
      if (isDaily) {
        analytics.event('daily_start', { daily_id: context!.dailyId, restored: this.attemptRestored });
      }
      this.checkpointActiveGame(gameState);
      return;
    }

    if (gameState.isWon) {
      if (this.attemptFinalized) {
        return;
      }

      if (isDaily) {
        this.finishDailyAttempt();
      } else {
        this.finishOrdinaryAttempt(gameState);
      }
      return;
    }

    this.checkpointActiveGame(gameState);
  }

  private finishOrdinaryAttempt(gameState: SolitaireGame): void {
    if (
      gameState.mode === 'daily'
      || !this.attemptStarted
      || this.attemptFinalized
      || !this.attemptTimer.running
    ) return;

    const mode = gameState.mode;
    this.attemptFinalized = true;
    const elapsedMs = this.attemptTimer.finish(performance.now());
    this.reconcileGameplayActivity();
    const event = this.completionEvent(mode, elapsedMs);
    const beforeBest = this.metaState.stats[mode].bestTimeMs;
    const metaBefore = this.metaState;
    const preview = completeAttempt(metaBefore, event);
    const mastery = buildVictoryMasteryState(metaBefore, preview.state, preview.rankAdvancedTo);
    const recorded = this.dispatchMeta(event);
    analytics.goal('game_win', { mode, duration_sec: this.analyticsDurationSec(elapsedMs) });
    const completion: ModeCompletionResult = {
      state: this.metaState,
      stats: { ...this.metaState.stats[mode] },
      improvedBest: beforeBest === undefined || elapsedMs < beforeBest,
    };

    this.lastOrdinaryCompletion = {
      mode,
      elapsedMs,
      moves: event.moves ?? this.history.moveCount,
      result: completion,
      event,
      mastery,
    };
    this.showOrdinaryCompletion();
    if (recorded) this.activeGameRepository.clear();
    this.pendingActiveSave = null;

    if (recorded && mode === 'winnable') {
      void this.leaderboardService?.syncStandardStreak(this.metaState.standardWinStreak.best);
      void this.leaderboardService?.syncMasteryScore(encodeMasteryLeaderboardScore(this.metaState), this.metaState);
    }
    if (recorded) {
      void this.cloudSync?.sync('game-complete');
      void this.platform?.leaderboards.retryPending?.();
    }
  }

  private showOrdinaryCompletion(): void {
    const completion = this.lastOrdinaryCompletion;
    if (completion === null) return;
    this.gameCompleteView.show({
      completionId: completion.event.attemptId,
      mode: completion.mode,
      elapsedMs: completion.elapsedMs,
      moves: completion.moves,
      improvedBest: completion.result.improvedBest,
      mastery: completion.mastery,
    });
  }

  private showHint(): void {
    if (this.rulesOpen) return;
    const dailyId = this.gameState?.mode === 'daily' ? this.dailyContext?.dailyId : undefined;
    if (dailyId !== undefined && this.metaState.daily.records[dailyId]?.hintUsed === true) {
      this.refreshGameHud();
      return;
    }
    const result = this.board?.playHint();
    if (result === 'played' && dailyId !== undefined) {
      this.dispatchMeta({ kind: 'daily-hint-used', dailyId });
      if (this.gameState !== null && !this.gameState.isWon) this.checkpointActiveGame(this.gameState);
    }
    if (result !== 'busy') this.refreshGameHud();
  }

  private checkpointActiveGame(gameState: SolitaireGame): void {
    if (gameState.isWon) {
      if (hasCompletedAttempt(this.metaState,this.attemptId)) this.activeGameRepository.clear();
      return;
    }

    const uiState = this.flow.state === 'menu-paused'
      ? 'menu-paused'
      : 'playing';

    if (gameState.mode === 'daily') {
      const context = this.dailyContext;
      if (context === null) {
        return;
      }

      const save = createActiveGameSave({
        attemptId:this.attemptId,
        mode: gameState.mode,
        seed: gameState.seed,
        snapshot: gameState.snapshot(),
        attemptStarted: this.attemptStarted,
        elapsedMs: this.getElapsedForCheckpoint(),
        moveCount: this.history.moveCount,
        daily: {
          dailyId: context.dailyId,
          algorithmVersion: DAILY_ALGORITHM_VERSION,
        },
        uiState,
      });
      this.activeGameRepository.save(save);
      return;
    }

    const save = createActiveGameSave({
      attemptId:this.attemptId,
      mode: gameState.mode,
      seed: gameState.seed,
      snapshot: gameState.snapshot(),
      attemptStarted: this.attemptStarted,
      elapsedMs: this.getElapsedForCheckpoint(),
      moveCount: this.history.moveCount,
      ...(gameState.mode === 'winnable' && this.activeStandardSelection ? {
        standard: {
          partition: this.activeStandardSelection.partition,
          difficulty: this.activeStandardSelection.difficulty,
        },
      } : {}),
      uiState,
    });

    this.activeGameRepository.save(save);
  }

  private getElapsedForCheckpoint(): number {
    if (!this.attemptStarted || !this.attemptTimer.running) {
      return 0;
    }

    return this.attemptTimer.elapsed(performance.now());
  }


  private finishDailyAttempt(): void {
    const context = this.dailyContext;
    if (context === null || !this.attemptStarted || this.attemptFinalized || !this.attemptTimer.running) return;

    this.attemptFinalized = true;
    const elapsedMs = this.attemptTimer.finish(performance.now());
    this.reconcileGameplayActivity();
    const previousBest = this.metaState.daily.records[context.dailyId]?.bestTimeMs;
    const metaBefore = this.metaState;
    const event = this.completionEvent('daily', elapsedMs);
    this.lastDailyEvent = event;
    this.lastDailyImprovedBest = previousBest === undefined || elapsedMs < previousBest;
    const preview = completeAttempt(metaBefore, event);
    this.lastDailyMastery = buildVictoryMasteryState(metaBefore, preview.state, preview.rankAdvancedTo);
    const recorded = this.dispatchMeta(event);
    const durationSec = this.analyticsDurationSec(elapsedMs);
    analytics.goal('game_win', { mode: 'daily', duration_sec: durationSec });
    analytics.goal('daily_complete', { daily_id: context.dailyId, duration_sec: durationSec });
    if (recorded) {
      this.activeGameRepository.clear();
      const dailyRecord = this.metaState.daily.records[context.dailyId];
      const rankingCompletion = event.trustedDay === context.dailyId && dailyRecord?.rankingAttemptId === event.attemptId;
      if (rankingCompletion) {
        void this.leaderboardService?.syncDailyBest(
          context.dailyId,
          dailyRecord?.bestMoves,
          dailyRecord?.bestMovesTimeMs,
          {
            completedOnTime: dailyRecord?.completedOnTime === true,
            attemptId: dailyRecord?.rankingAttemptId,
          },
        );
      }
      const dailyStreak = getDailyStreaks(this.metaState.daily.records, context.dailyId);
      void this.leaderboardService?.syncDailyStreak(dailyStreak.current, dailyStreak.best, context.dailyId);
      void this.leaderboardService?.syncMasteryScore(encodeMasteryLeaderboardScore(this.metaState), this.metaState);
      void this.cloudSync?.sync('game-complete');
      void this.platform?.leaderboards.retryPending?.();
    }
    this.pendingDailyRestore = null;
    this.refreshMenuMeta();
    if (this.flow.state === 'menu-paused') this.flow.cancelMenu();
    this.showDailyCompletion();
  }

  private showDailyCompletion(): void {
    const event = this.lastDailyEvent;
    if (!event?.dailyId || !event.weekId) return;
    this.dailyCompleteView.show({
      completionId: event.attemptId,
      elapsedMs: event.elapsedMs,
      moves: event.moves ?? this.history.moveCount,
      bestTimeMs: this.metaState.daily.records[event.dailyId]?.bestTimeMs ?? event.elapsedMs,
      improvedBest: this.metaSession.getImprovedBest(event.attemptId) ?? this.lastDailyImprovedBest,
      weekCompleted: getWeeklyProgress(this.metaState, event.weekId).completed,
      mastery: this.lastDailyMastery,
    });
  }

  private resetAttempt(): void {
    this.attemptStarted = false;
    this.attemptFinalized = false;
    this.attemptRestored = false;
    this.attemptAbandonTracked = false;
    this.attemptTimer.reset();
    this.lastOrdinaryCompletion = null;
    this.lastDailyMastery = null;
    this.lastDailyEvent = null;
    if (this.flow !== undefined) {
      this.reconcileGameplayActivity();
    }
  }

  private restartDeal(): void {
    void this.requestRestartDeal();
  }

  private async requestRestartDeal(): Promise<void> {
    if (this.rulesOpen || this.flow.state !== 'playing') return;
    if (this.isActiveRankedDailyAttempt()) {
      const confirmed = await this.newDealConfirmOverlay.confirm('daily-ranking-restart');
      if (!confirmed || this.flow.state !== 'playing') return;
    }
    const deal = this.flow.restart();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private isActiveRankedDailyAttempt(): boolean {
    const context = this.dailyContext;
    if (this.gameState?.mode !== 'daily' || context === null || !this.attemptStarted || this.attemptFinalized) return false;
    const record = this.metaState.daily.records[context.dailyId];
    return record?.rankingAttemptId === this.attemptId
      && record.bestMoves === undefined
      && record.bestMovesTimeMs === undefined;
  }

  private startNewDeal(): void {
    void this.requestFreshDeal(true);
  }

  private async requestFreshDeal(confirmAbandon: boolean): Promise<void> {
    if (this.rulesOpen || this.freshDealTransitionInFlight) return;
    const currentDeal = this.flow.currentDeal;
    if (
      this.flow.state !== 'playing'
      || currentDeal === null
      || currentDeal.mode === 'daily'
    ) {
      return;
    }

    this.freshDealActivityBlocked = true;
    this.reconcileGameplayActivity();

    try {
      if (confirmAbandon && !this.gameState?.isWon) {
        const confirmed = await this.newDealConfirmOverlay.confirm();
        if (!confirmed || this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (this.flow.currentDeal !== currentDeal || this.flow.state !== 'playing') return;
      }

      this.trackAttemptAbandon('new_deal');
      this.freshDealTransitionInFlight = true;
      try {
        if (currentDeal.mode === 'winnable') {
          await this.standardAdController?.beforeFreshStandardDeal();
          await this.waitForPlatformResumeAndViewport();
        }

        if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (this.flow.currentDeal !== currentDeal || this.flow.state !== 'playing') return;

        let deal: Deal;
        if (currentDeal.mode === 'winnable') {
          this.recordStandardFailureIfReplacing('winnable', null);
          const selection = this.selectStandardDeal();
          this.dispatchMeta({kind:'standard-served',seed:selection.seed.toString(),partition:selection.partition,difficulty:selection.difficulty});
          deal = this.flow.startNewInCurrentMode(selection.seed);
        } else {
          deal = this.flow.startNewInCurrentMode();
        }

        this.board?.destroy();
        this.startDeal(deal);
        analytics.event('new_deal', { mode: deal.mode, source: 'new_deal' });
      } finally {
        this.freshDealTransitionInFlight = false;
      }
    } finally {
      this.freshDealActivityBlocked = false;
      if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN) {
        this.reconcileGameplayActivity();
      }
    }
  }

  private installProductBridge(): void {
    productBridge.install({
      snapshot: () => ({
        state: this.metaState,
        activeMode: this.gameState !== null && !this.gameState.isWon && this.flow.state === 'menu-paused' ? this.gameState.mode : null,
        activeDifficulty: this.gameState?.mode === 'winnable' && !this.gameState.isWon ? this.activeStandardSelection?.difficulty ?? null : null,
        currentDailyId: this.currentDailyContext()?.dailyId ?? null,
        activeDailyId: this.gameState?.mode === 'daily' && !this.gameState.isWon && this.flow.state === 'menu-paused' ? this.dailyContext?.dailyId ?? null : null,
        leaderboardsEnabled: this.leaderboardService?.available ?? false,
      }),
      resumeGame: () => this.closeMainMenu(),
      startStandard: (difficulty) => this.startStandardFromProductHome(difficulty),
      setStandardDifficulty: (difficulty) => this.setStandardDifficulty(difficulty),
      startDaily: (dailyId) => this.startDailyFromProductUi(dailyId),
      leaderboardSnapshot: () => {
        const fixtures = leaderboardFixturesEnabled();
        return {
          available: fixtures || (this.leaderboardService?.available ?? false),
          authorized: fixtures || (this.leaderboardService?.authorized ?? false),
          authorizationAllowed: !fixtures && this.canAuthorizeLeaderboard(),
          authPending: this.leaderboardAuthPending,
        };
      },
      loadLeaderboard: (mode) => this.loadProductLeaderboard(mode),
      authorizeLeaderboard: () => this.authorizeProductLeaderboard(),
      settingsSnapshot: () => ({ soundEnabled: preferences.soundEnabled, language: preferences.language }),
      setSoundEnabled: (enabled) => preferences.setSoundEnabled(enabled),
      setLanguage: (language) => preferences.setLanguage(language),
      closeHowToPlay: (onboarding) => this.finishProductHowToPlay(onboarding),
    });
  }

  private showProductHome(canCancel: boolean): void {
    this.stopProductUiScenes();
    if (this.metaSession?.status === 'ready') {
      void this.cloudSync?.sync('home');
      void this.platform?.leaderboards.retryPending?.();
    }
    if (canCancel) this.board?.setUiPaused(true);
    if (!this.scene.isActive('HomeScene')) this.scene.launch('HomeScene');
    else this.scene.bringToTop('HomeScene');
    productBridge.notify();
  }

  private stopProductUiScenes(): void {
    for (const key of ['HomeScene','DailyScene','MasteryScene','LeaderboardsScene','SettingsScene','HowToPlayScene']) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) this.scene.stop(key);
    }
    if (this.rulesOpen) this.clearRulesOverlayState();
  }

  private startStandardFromProductHome(difficulty: StandardDifficulty): void {
    this.setStandardDifficulty(difficulty);
    if (!this.ensureProductMenuFlow()) return;

    const replacingStandard = this.flow.state === 'menu-paused' && this.flow.currentDeal?.mode === 'winnable';
    this.stopProductUiScenes();
    if (replacingStandard) {
      void this.startStandardFromPausedProductMenu();
      return;
    }
    this.startMenuMode('winnable');
  }

  private async startStandardFromPausedProductMenu(): Promise<void> {
    if (this.freshDealTransitionInFlight) return;
    const currentDeal = this.flow.currentDeal;
    if (this.flow.state !== 'menu-paused' || currentDeal?.mode !== 'winnable') return;

    this.freshDealTransitionInFlight = true;
    try {
      await this.standardAdController?.beforeFreshStandardDeal();
      await this.waitForPlatformResumeAndViewport();
      if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      if (this.flow.state !== 'menu-paused' || this.flow.currentDeal !== currentDeal) return;

      this.startMenuMode('winnable');
      analytics.event('new_deal', { mode: 'winnable', source: 'new_deal' });
    } finally {
      this.freshDealTransitionInFlight = false;
    }
  }

  private startDailyFromProductUi(dailyId?: string): void {
    const context = dailyId ? this.dailyContextForId(dailyId) : this.currentDailyContext();
    if (context === null || !this.ensureProductMenuFlow()) return;
    this.stopProductUiScenes();
    this.dailyContext = context;
    this.startMenuMode('daily');
  }

  private ensureProductMenuFlow(): boolean {
    if (this.flow.state === 'playing') {
      const productUiOpen = ['HomeScene', 'DailyScene'].some((key) => this.scene.isActive(key) || this.scene.isPaused(key));
      if (!productUiOpen || !this.flow.openMainMenu()) return false;
      this.reconcileGameplayActivity();
    }
    return this.flow.state === 'menu-paused' || this.flow.state === 'menu-required';
  }

  private async loadProductLeaderboard(mode: GlobalLeaderboardMode) {
    const dailyId = mode === 'daily' || mode === 'streak'
      ? this.currentDailyContext()?.dailyId
      : undefined;
    if (leaderboardFixturesEnabled()) {
      const playerEntry = createLocalLeaderboardPlayerEntry(mode, this.metaState, dailyId);
      return createLeaderboardFixtureResult(mode, dailyId, playerEntry);
    }
    const service = this.leaderboardService;
    if (service === null || !service.available) {
      return { status:'unavailable', authorized:service?.authorized ?? false, entries:[], playerEntry:null } as const;
    }
    if (mode === 'daily' && !dailyId) {
      return { status:'error', authorized:service.authorized, entries:[], playerEntry:null } as const;
    }
    return service.load(mode, dailyId);
  }

  private async authorizeProductLeaderboard(): Promise<boolean> {
    const service = this.leaderboardService;
    if (service === null || service.authorized || this.leaderboardAuthPending || !this.canAuthorizeLeaderboard()) {
      return service?.authorized ?? false;
    }
    this.leaderboardAuthPending = true;
    productBridge.notify();
    const wasAuthorized = service.authorized;
    const usesScopeTransfer = this.platform !== null && authorizationUsesProfileScopeTransfer(this.platform);
    if (!wasAuthorized && this.gameState !== null && !this.gameState.isWon) this.checkpointActiveGame(this.gameState);
    if (!wasAuthorized && usesScopeTransfer && !stageProfileMergeTransfer(this.metaScope, this.metaState)) {
      this.leaderboardAuthPending = false;
      productBridge.notify();
      return false;
    }
    const authorized = await service.requestAuthorization();
    if (!authorized) {
      if (!wasAuthorized && usesScopeTransfer) clearProfileMergeTransfer();
      this.leaderboardAuthPending = false;
      productBridge.notify();
      return false;
    }
    if (!wasAuthorized) {
      if (usesScopeTransfer) await this.loadMetaProfile();
      else await this.cloudSync?.sync('authorization');
      if (this.platform) this.standardAdController = new StandardAdController(this.platform);
    }
    await this.syncHistoricalLeaderboards();
    this.leaderboardAuthPending = false;
    productBridge.notify();
    return this.leaderboardService?.authorized ?? true;
  }

  private makeGameHudViewModel() {
    const mode = this.gameState?.mode ?? this.flow.currentDeal?.mode ?? 'winnable';
    const modeLabel = mode === 'daily' ? 'Daily' : mode === 'original' ? t('Классика') : undefined;
    const activeMs = this.attemptStarted && this.attemptTimer.running
      ? this.attemptTimer.elapsed(performance.now())
      : 0;
    const dailyId = mode === 'daily' ? this.dailyContext?.dailyId : undefined;
    const dailyRecord = dailyId === undefined ? undefined : this.metaState.daily.records[dailyId];
    const hintRemaining = dailyId === undefined
      ? undefined
      : dailyRecord?.hintUsed === true ? 0 : 1;
    const difficulty = this.activeStandardSelection?.difficulty ?? this.metaState.standard.selectedDifficulty;
    return buildGameHudViewModel({
      difficulty,
      modeLabel,
      moves: this.history.moveCount,
      activeMs,
      canUndo: this.history.canUndo,
      hintEligible: this.board?.hasMoveHints() ?? false,
      hintRemaining,
      newDealEnabled: mode !== 'daily',
      newDealVisible: mode !== 'daily',
    }, getLanguage());
  }

  private refreshGameHud(): void {
    if (this.gameHud === null || this.gameState === null) return;
    this.gameHud.setState(this.makeGameHudViewModel());
  }

  private openMainMenu(): void {
    if (this.rulesOpen) return;
    if (!this.flow.openMainMenu()) {
      return;
    }

    this.reconcileGameplayActivity();
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }

    this.showProductHome(this.flow.canCancelMenu);
  }

  private openProductHowToPlay(onboarding: boolean): void {
    if (this.rulesOpen) return;
    this.rulesOpen = true;
    this.rulesOnboarding = onboarding;
    if (onboarding) analytics.event('tutorial_start');
    this.board?.setUiPaused(true);
    this.reconcileGameplayActivity();
    if (this.scene.isActive('HowToPlayScene')) this.scene.stop('HowToPlayScene');
    this.scene.launch('HowToPlayScene', { onboarding, returnToGame: true });
  }

  private finishProductHowToPlay(onboarding: boolean): void {
    if (this.scene.isActive('HowToPlayScene')) this.scene.stop('HowToPlayScene');
    const wasOnboarding = this.rulesOnboarding || onboarding;
    this.clearRulesOverlayState();
    if (wasOnboarding) {
      preferences.markHowToPlaySeen();
      analytics.goal('tutorial_complete');
    }
  }

  private clearRulesOverlayState(): void {
    this.rulesOpen = false;
    this.rulesOnboarding = false;
    if (this.flow.state !== 'playing') {
      this.rulesBlockedBoardSettle = false;
      this.reconcileGameplayActivity();
      return;
    }
    this.board?.setUiPaused(false);
    this.reconcileGameplayActivity();
    if (this.rulesBlockedBoardSettle && this.gameState !== null) {
      this.rulesBlockedBoardSettle = false;
      this.onBoardSettled(this.gameState);
    }
  }

  private canAuthorizeLeaderboard(): boolean {
    return this.metaSession.status === 'ready' && !this.metaSession.saveError && !this.metaSession.saving
      && this.metaJournal.pending.length === 0;
  }

  private async syncHistoricalLeaderboards(): Promise<void> {
    const service = this.leaderboardService;
    if (service === null || !service.authorized) return;

    const tasks: Promise<unknown>[] = [];
    if (this.metaState.standardWinStreak.best > 0) {
      tasks.push(service.syncStandardStreak(this.metaState.standardWinStreak.best));
    }
    const dailyContext = this.currentDailyContext();
    if (dailyContext !== null) {
      const record = this.metaState.daily.records[dailyContext.dailyId];
      if (record?.bestMoves !== undefined && record.bestMovesTimeMs !== undefined) {
        tasks.push(service.syncDailyBest(dailyContext.dailyId, record.bestMoves, record.bestMovesTimeMs, {
          completedOnTime: record.completedOnTime === true,
          attemptId: record.rankingAttemptId,
        }));
      }
      const streak = getDailyStreaks(this.metaState.daily.records, dailyContext.dailyId);
      tasks.push(service.syncDailyStreak(streak.current, streak.best, dailyContext.dailyId));
    }
    tasks.push(service.syncMasteryScore(encodeMasteryLeaderboardScore(this.metaState), this.metaState));
    await Promise.all(tasks);
  }

  private handleEscape = (): void => {
    if (this.rulesOpen) {
      this.finishProductHowToPlay(false);
      return;
    }
    this.closeMainMenu();
  };

  private closeMainMenu(): void {
    this.stopProductUiScenes();
    if (this.flow.state !== 'menu-paused') return;

    this.input.resetPointers();
    if (this.flow.cancelMenu()) {
      this.reconcileGameplayActivity();
      if (this.gameState !== null) this.checkpointActiveGame(this.gameState);
      window.requestAnimationFrame(() => {
        this.input.resetPointers();
        this.board?.setUiPaused(false);
        this.refreshGameHud();
      });
    }
  }

  private selectStandardDeal(): StandardDealSelection {
    const selection = pickStandardDeal({
      catalog: this.verifiedDealCatalog,
      requestedDifficulty: this.metaState.standard.selectedDifficulty,
      onboardingWins: this.metaState.standard.onboardingWins,
      completedByPartition: this.metaState.standard.completed,
      recentSeeds: this.metaState.standard.recentSeeds,
      randomIndex: (candidateCount) => Number(createRandomDealSeed() % BigInt(candidateCount)),
    });
    this.activeStandardSelection = selection;
    return selection;
  }

  private setStandardDifficulty(difficulty: StandardDifficulty): void {
    this.dispatchMeta({ kind: 'set-standard-difficulty', difficulty });
  }

  private analyticsDurationSec(elapsedMs: number): number {
    return Math.max(0, Math.round(elapsedMs / 10) / 100);
  }

  private trackAttemptAbandon(source: 'new_deal' | 'mode_select'): void {
    if (
      !this.attemptStarted
      || this.attemptFinalized
      || this.attemptAbandonTracked
      || this.gameState === null
      || this.gameState.isWon
    ) {
      return;
    }

    this.attemptAbandonTracked = true;
    analytics.event('game_abandon', {
      mode: this.gameState.mode,
      source,
      duration_sec: this.analyticsDurationSec(this.attemptTimer.elapsed(performance.now())),
    });
  }

  private recordStandardFailureIfReplacing(
    replacementMode: GameMode,
    replacementSeed: bigint | null,
  ): void {
    if (!shouldRecordStandardFailure({
      currentMode: this.flow.currentDeal?.mode ?? null,
      currentSeed: this.flow.currentDeal?.seed ?? null,
      replacementMode,
      replacementSeed,
      attemptStarted: this.attemptStarted,
      attemptFinalized: this.attemptFinalized,
    })) {
      return;
    }

    this.dispatchMeta({kind:'standard-failed',attemptId:this.attemptId});
  }

  private startSelectedMode(mode: GameMode): Deal {
    this.trackAttemptAbandon('mode_select');
    if (mode === 'winnable') {
      this.recordStandardFailureIfReplacing('winnable', null);
      const selection = this.selectStandardDeal();
      this.dispatchMeta({kind:'standard-served',seed:selection.seed.toString(),partition:selection.partition,difficulty:selection.difficulty});
      this.flow.selectMenuMode(mode);
      return this.flow.playSelectedMode(selection.seed);
    }

    this.activeStandardSelection = null;
    const replacementSeed = mode === 'daily' ? this.dailyContext?.seed ?? null : null;
    this.recordStandardFailureIfReplacing(mode, replacementSeed);
    this.flow.selectMenuMode(mode);
    return mode === 'daily'
      ? this.flow.playSelectedMode(
          this.dailyContext?.seed ?? (() => { throw new Error('Daily seed is required.'); })(),
        )
      : this.flow.playSelectedMode();
  }

  private startFirstRunHowToPlay(): void {
    const preselected = this.registry.get(
      FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY,
    ) as StandardDealSelection | undefined;
    let deal: Deal;

    if (preselected !== undefined) {
      this.registry.remove(FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY);
      this.activeStandardSelection = preselected;
      this.dispatchMeta({
        kind: 'standard-served',
        seed: preselected.seed.toString(),
        partition: preselected.partition,
        difficulty: preselected.difficulty,
      });
      this.flow.selectMenuMode('winnable');
      deal = this.flow.playSelectedMode(preselected.seed);
    } else {
      deal = this.startSelectedMode('winnable');
    }

    this.dailyCompleteView.hide();
    this.gameCompleteView.hide();
    this.board?.destroy();
    this.pendingFirstRunHowToPlay = true;
    this.startDeal(deal);
    this.loadDeferredFirstRunAssets(deal);
  }

  private loadDeferredFirstRunAssets(deal: Deal): void {
    void this.warmDeferredFirstRunAssets(deal);
  }

  private async warmDeferredFirstRunAssets(deal: Deal): Promise<void> {
    for (const batch of getDeferredFirstRunCardBatches(deal)) {
      if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      await this.ensureCardTextures(batch);
    }

    await this.loadDeferredFirstRunSfx();
  }

  private ensureCardTextures(cards: readonly Card[]): Promise<boolean> {
    const requested = [...cards];
    const task = this.cardLoadChain.then(async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const missing = requested.filter(card => !this.textures.exists(card.id));
        if (missing.length === 0) return;
        await this.loadCardTextureBatch(missing);
      }
    });

    this.cardLoadChain = task.catch(() => undefined);
    return task.then(
      () => requested.every(card => this.textures.exists(card.id)),
      () => false,
    );
  }

  private loadCardTextureBatch(cards: readonly Card[]): Promise<void> {
    return new Promise(resolve => {
      const finish = () => {
        this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
        resolve();
      };
      const cancel = () => {
        this.load.off(Phaser.Loader.Events.COMPLETE, finish);
        resolve();
      };

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      this.load.once(Phaser.Loader.Events.COMPLETE, finish);
      cards.forEach(card => {
        if (this.textures.exists(card.id)) return;
        const asset = getCardFaceAsset(card);
        this.load.image(asset.key, asset.url);
      });
      if (!this.load.isLoading()) this.load.start();
    });
  }

  private loadDeferredFirstRunSfx(): Promise<void> {
    const missing: Array<{key:string;url:string}> = [];
    Object.entries(SFX_ASSETS).forEach(([cue, asset]) => {
      if (cue !== 'deal') {
        asset.keys.forEach((key, index) => {
          if (!this.cache.audio.exists(key)) missing.push({key,url:asset.urls[index]!});
        });
      }
    });
    if (missing.length === 0) return Promise.resolve();

    return new Promise(resolve => {
      const finish = () => {
        this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
        resolve();
      };
      const cancel = () => {
        this.load.off(Phaser.Loader.Events.COMPLETE, finish);
        resolve();
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      this.load.once(Phaser.Loader.Events.COMPLETE, finish);
      missing.forEach(asset => this.load.audio(asset.key, asset.url));
      if (!this.load.isLoading()) this.load.start();
    });
  }

  private startMenuMode(mode: GameMode): void {
    this.stopProductUiScenes();
    const deal = this.startSelectedMode(mode);
    this.reconcileGameplayActivity();
    if (!this.platformPaused && this.scene.isPaused()) this.scene.resume();
    this.dailyCompleteView.hide();
    this.gameCompleteView.hide();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private retryDaily(): void {
    this.dailyCompleteView.hide();
    this.restartDeal();
  }

  private openMenuFromDailyComplete(): void {
    this.dailyCompleteView.hide();
    this.openMainMenu();
  }

  private openMenuFromGameComplete(): void {
    this.gameCompleteView.hide();
    this.openMainMenu();
  }

  private undoLastAction(): void {
    if (this.rulesOpen || this.flow.state !== 'playing') {
      return;
    }

    this.board?.requestUndo();
  }

  private bindPlatformLifecycle(platform: PlatformServices): void {
    this.unsubscribePlatformPause?.();
    this.platformPaused = platform.platformPause.isPaused();

    this.unsubscribePlatformPause = platform.platformPause.subscribe((paused) => {
      this.platformPaused = paused;

      if (paused && this.gameState !== null) {
        this.pauseAttemptTimer();
        this.checkpointActiveGame(this.gameState);
      }

      if (!paused) {
        this.releasePlatformResumeWaiters();
      }

      this.reconcileGameplayActivity();
    });
  }

  private async waitForPlatformResumeAndViewport(): Promise<void> {
    if (this.platformPaused) {
      await new Promise<void>((resolve) => {
        this.platformResumeWaiters.add(resolve);
        // Avoid missing a resume that raced with waiter registration.
        if (!this.platformPaused) {
          this.platformResumeWaiters.delete(resolve);
          resolve();
        }
      });
    }

    if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;

    // Yandex can invoke the ad onClose callback before the iframe has finished
    // restoring its viewport. Waiting for the first post-resume frame gives the
    // ResizeObserver/Phaser scale manager a chance to settle before a new board
    // snapshots its layout metrics.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private releasePlatformResumeWaiters(): void {
    if (this.platformResumeWaiters.size === 0) return;
    const waiters = [...this.platformResumeWaiters];
    this.platformResumeWaiters.clear();
    waiters.forEach((resolve) => resolve());
  }

  private pauseAttemptTimer(): void {
    if (this.attemptStarted && !this.attemptFinalized) {
      this.attemptTimer.pause(performance.now());
    }
  }

  private setGameplayMarkupActive(active: boolean): void {
    const platform = this.platform;
    if (platform === null || this.gameplayMarkupActive === active) {
      return;
    }

    this.gameplayMarkupActive = active;

    if (active) {
      platform.gameplay.start();
    } else {
      platform.gameplay.stop();
    }
  }

  private reconcileGameplayActivity(): void {
    this.audioController.setSuspended(this.platformPaused || !this.windowFocused || document.visibilityState !== 'visible');
    const decision = deriveGameplayActivity({
      attemptStarted: this.attemptStarted,
      attemptFinalized: this.attemptFinalized,
      flowPlaying: this.flow?.state === 'playing',
      menuPaused: this.flow?.state === 'menu-paused',
      localInteractionBlocked: this.rulesOpen || this.freshDealActivityBlocked,
      documentVisible: document.visibilityState === 'visible',
      platformPaused: this.platformPaused,
    });

    if (decision.timerShouldRun) {
      this.attemptTimer.resume(performance.now());
    } else {
      this.pauseAttemptTimer();
    }

    if (decision.markupAction === 'start') {
      this.setGameplayMarkupActive(true);
    } else if (decision.markupAction === 'stop') {
      this.setGameplayMarkupActive(false);
    }

    if (decision.sceneShouldPause && !this.platformScenePaused) {
      this.platformScenePaused = true;
      this.scene.pause();
    } else if (!decision.sceneShouldPause && this.platformScenePaused) {
      this.platformScenePaused = false;
      this.scene.resume();
    }
  }

  private handleWindowBlur = (): void => {
    this.windowFocused = false;
    this.audioController.setSuspended(true);
  };

  private handleWindowFocus = (): void => {
    this.windowFocused = true;
    this.reconcileGameplayActivity();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') {
      this.pauseAttemptTimer();
      if (this.gameState !== null) {
        this.checkpointActiveGame(this.gameState);
      }
    }

    this.reconcileGameplayActivity();
  };

  private handlePageHide = (): void => {
    this.audioController.setSuspended(true);
    this.pauseAttemptTimer();
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  };

  private handleResize(): void {
    this.applyViewportLayout();
  }

  private applyViewportLayout(): void {
    const viewport = this.getRenderMetrics();
    const camera = this.cameras.main;
    const layout = scaleViewportLayout(
      calculateViewportLayout(viewport.width, viewport.height),
      viewport.renderScale,
    );

    camera
      .setSize(this.scale.width, this.scale.height)
      .setZoom(1)
      .setScroll(0, 0)
      .setBackgroundColor(UI_TOKENS.color.table);

    this.backdrop?.layout(this.scale.width, this.scale.height);
    this.board?.relayout(layout);
    this.gameHud?.layout(layout);
    this.newDealConfirmOverlay?.relayout();
    this.gameCompleteView?.layout(layout);
    this.dailyCompleteView?.layout(layout);
  }

  private shutdown(): void {
    productBridge.uninstall();
    this.stopProductUiScenes();
    this.releasePlatformResumeWaiters();
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = null;
    this.hudRefreshTimer?.remove(false);
    this.hudRefreshTimer = null;
    this.newDealConfirmOverlay.destroy();
    this.standardAdController = null;
    this.freshDealTransitionInFlight = false;
    this.freshDealActivityBlocked = false;
    this.audioController.destroy();
    this.setGameplayMarkupActive(false);
    this.unsubscribePlatformPause?.();
    this.unsubscribePlatformPause = null;

    if (this.platformScenePaused) this.platformScenePaused = false;

    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.keyboard?.off('keydown-R', this.restartDeal, this);
    this.input.keyboard?.off('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.off('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.off('keydown-ESC', this.handleEscape, this);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('online', this.handleCloudOnline);
    this.cloudSync?.dispose();
    this.cloudSync = null;
    this.unsubscribeAccountSelection?.();
    this.unsubscribeAccountSelection = null;
    this.attemptTimer.reset();
    this.metaSession.onChange = undefined;
    this.gameCompleteView.destroy();
    this.dailyCompleteView.destroy();
    this.gameHud?.destroy();
    this.gameHud = null;
    this.backdrop?.destroy();
    this.backdrop = null;
    this.board?.destroy();
    this.board = null;
    this.gameState = null;
  }

}
