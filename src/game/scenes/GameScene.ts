import Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { createRandomDealSeed, GameSession } from '../model/GameSession.ts';
import { VerifiedDealCatalog } from '../model/VerifiedDealCatalog.ts';
import { StandardDifficultyDirector, type StandardSelection } from '../model/StandardDifficultyDirector.ts';
import { shouldRecordStandardFailure } from '../model/StandardAttemptPolicy.ts';
import { VERIFIED_DEALS_REGISTRY_KEY } from './BootScene.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Deal, GameMode } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { DailyCompleteView } from '../view/DailyCompleteView.ts';
import { GameCompleteView } from '../view/GameCompleteView.ts';
import { GameControlsView } from '../view/GameControlsView.ts';
import {
  AppShellView,
  type ShellDestination,
} from '../view/AppShellView.ts';
import {
  PlayPageView,
  type DailyMenuState,
} from '../view/PlayPageView.ts';
import { RulesView } from '../view/RulesView.ts';
import {
  StatisticsPageView,
  type StatisticsPageLeaderboardState,
  type StatisticsPageState,
} from '../view/StatisticsPageView.ts';
import { calculateViewportLayout } from '../view/ViewportLayout.ts';
import { AttemptTimer } from '../../meta/AttemptTimer.ts';
import {
  getDailyId,
  getDailySeed,
  getIsoWeekDailyIds,
  getIsoWeekId,
} from '../../meta/DailyCalendar.ts';
import { getWeeklyProgress } from '../../meta/DailyProgress.ts';
import { MetaSession } from '../../meta/MetaSession.ts';
import { MetaJournal } from '../../meta/MetaJournal.ts';
import { applyMetaOperation, completeRewardedAttempt, hasCompletedAttempt, type MetaOperation, type CompletionEvent } from '../../meta/MetaOperations.ts';
import { getLevelProgress } from '../../meta/Progression.ts';
import type { RewardSummary } from '../../meta/Economy.ts';
import { THEME_CATALOG } from '../../theme/ThemeCatalog.ts';
import { ThemeCatalogView, type ThemeCatalogState } from '../view/ThemeCatalogView.ts';
import {
  type ModeCompletionResult,
  type OrdinaryGameMode,
} from '../../meta/GameStats.ts';
import {
  createDefaultMetaSave,
  DAILY_ALGORITHM_VERSION,
  type MetaSave,
} from '../../meta/MetaSave.ts';
import { ActiveGameRepository } from '../../persistence/ActiveGameRepository.ts';
import {
  activeGameSaveToDeal,
  createActiveGameSave,
  type ActiveGameSaveV1,
} from '../../persistence/ActiveGameSave.ts';
import {
  initializePlatform,
} from '../../platform/yandex.ts';
import type { PlatformServices } from '../../platform/services.ts';
import { deriveGameplayActivity } from '../../platform/GameplayActivity.ts';
import { LeaderboardService } from '../../leaderboards/LeaderboardService.ts';
import { getTheme } from '../../theme/ThemeRegistry.ts';
import { resolveOwnedThemeId } from '../../theme/ThemeSelection.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { loadTheme } from '../../theme/ThemeLoader.ts';
import { SettingsView } from '../view/SettingsView.ts';
import { preferences } from '../../settings/Preferences.ts';
import { AudioController } from '../../settings/AudioController.ts';
import { SfxController } from '../../settings/SfxController.ts';
import { getLanguage, subscribeLanguage } from '../../localization/Localization.ts';

interface DailyContext {
  readonly dailyId: string;
  readonly weekId: string;
  readonly weekDailyIds: readonly string[];
  readonly seed: bigint;
}

interface StartDealOptions {
  readonly restored?: ActiveGameSaveV1;
}

interface OrdinaryCompletionSnapshot {
  readonly mode: OrdinaryGameMode;
  readonly elapsedMs: number;
  readonly result: ModeCompletionResult;
  readonly reward: RewardSummary;
  readonly totalXpBefore: number;
  readonly event: CompletionEvent;
}

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private gameControls: GameControlsView | null = null;
  private gameState: SolitaireGame | null = null;
  private appShell!: AppShellView;
  private settingsView!: SettingsView;
  private audioController!: AudioController;
  private sfxController!: SfxController;
  private unsubscribeLanguage: (() => void) | null = null;
  private catalogView!: ThemeCatalogView;
  private catalogBusyId: string | undefined;
  private catalogMessage: string | undefined;
  private playPage!: PlayPageView;
  private rulesView!: RulesView;
  private rulesOpen = false;
  private shellDestination: ShellDestination = 'play';
  private rulesReturnDestination: Exclude<ShellDestination, 'rules'> = 'play';
  private statisticsPage!: StatisticsPageView;
  private statisticsOpen = false;
  private dailyCompleteView!: DailyCompleteView;
  private gameCompleteView!: GameCompleteView;
  private leaderboardMode: OrdinaryGameMode = 'winnable';
  private leaderboardAuthPending = false;
  private leaderboardRequestId = 0;
  private unsubscribeAccountSelection: (() => void) | null = null;
  private leaderboardViewState: StatisticsPageLeaderboardState = {
    status: 'unavailable',
    entries: [],
    authorized: false,
    playerEntry: null,
    authPending: false,
    authorizationAllowed: true,
  };

  private activeGameRepository!: ActiveGameRepository;
  private pendingActiveSave: ActiveGameSaveV1 | null = null;
  private pendingDailyRestore: ActiveGameSaveV1 | null = null;
  private metaSession!: MetaSession;
  private metaJournal!: MetaJournal;
  private metaScope = 'unbound';
  private profileScopeError = false;
  private attemptId = '';
  private lastDailyReward: RewardSummary | undefined;
  private lastDailyEvent: CompletionEvent | null = null;
  private lastDailyImprovedBest = false;
  private readonly attemptTimer = new AttemptTimer();
  private attemptStarted = false;
  private attemptFinalized = false;
  private lastOrdinaryCompletion: OrdinaryCompletionSnapshot | null = null;

  private platform: PlatformServices | null = null;
  private platformPaused = false;
  private windowFocused = true;
  private platformScenePaused = false;
  private gameplayMarkupActive = false;
  private unsubscribePlatformPause: (() => void) | null = null;
  private leaderboardService: LeaderboardService | null = null;
  private metaState: MetaSave = createDefaultMetaSave();
  private verifiedDealCatalog!: VerifiedDealCatalog;
  private standardDifficultyDirector!: StandardDifficultyDirector;
  private dailyContext: DailyContext | null = null;
  private activeTheme!: ThemeDefinition;
  private themeRequest = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.windowFocused = document.hasFocus();
    this.audioController = new AudioController(this.sound);
    this.sfxController = new SfxController(this.sound);
    this.game.canvas.parentElement?.addEventListener('click', this.handleButtonSfx);
    this.audioController.setSuspended(!this.windowFocused || document.visibilityState !== 'visible');
    this.activeTheme = getTheme(resolveOwnedThemeId(window.location.search, null, [], import.meta.env.DEV));
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
    this.applyViewportLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.verifiedDealCatalog = this.registry.get(VERIFIED_DEALS_REGISTRY_KEY) as VerifiedDealCatalog;
    if (!(this.verifiedDealCatalog instanceof VerifiedDealCatalog)) {
      throw new Error('Verified deal catalog is not registered.');
    }
    this.flow = new GameFlow(new GameSession({ catalog: this.verifiedDealCatalog }));
    this.standardDifficultyDirector = new StandardDifficultyDirector(
      this.verifiedDealCatalog,
      () => Number(createRandomDealSeed() & 0xffff_ffffn),
    );
    this.appShell = new AppShellView(this, {
      navigate: (destination) => this.navigateShell(destination),
      cancel: () => this.closeMainMenu(),
      settings: () => this.settingsView.show(),
    });
    this.settingsView = new SettingsView(this.game.canvas.parentElement!);
    this.catalogView = new ThemeCatalogView(this.appShell.contentHost, {
      buy: id => this.buyTheme(id), equip: id => { void this.equipOwnedTheme(id); },
      retry: () => { void this.retryMeta(); },
    });
    this.playPage = new PlayPageView(this.appShell.contentHost, {
      play: (mode) => this.playMenuMode(mode),
      leaderboard: () => this.openStatisticsPage(true),
    });
    this.rulesView = new RulesView(this.appShell.contentHost, {
      back: () => this.closeRules(),
    });
    this.statisticsPage = new StatisticsPageView(this.appShell.contentHost, {
      selectMode: (mode) => this.selectStatisticsMode(mode),
      authorize: () => { void this.authorizeLeaderboard(); },
    });
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
    this.activeGameRepository = new ActiveGameRepository();
    this.unsubscribeLanguage = subscribeLanguage(() => this.refreshLocalization());
    this.refreshLocalization();
    this.pendingActiveSave = this.activeGameRepository.load();
    if (this.pendingActiveSave?.mode === 'daily') {
      this.pendingDailyRestore = this.pendingActiveSave;
    }
    const restoredOrdinary = this.tryRestoreOrdinarySession();

    if (!restoredOrdinary) {
      this.showShellPlay(false);
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

    await this.loadMetaProfile();
    void this.metaSession.flush();

    this.leaderboardService = new LeaderboardService(this.platform);
    this.unsubscribeAccountSelection?.();
    this.unsubscribeAccountSelection = this.platform.auth.onAccountSelectionClosed(() => {
      window.location.reload();
    });
    this.refreshMenuMeta();
    if (this.leaderboardService.authorized) {
      void this.syncHistoricalLeaderboardBests();
    }

    const now = this.platform.trustedClock.nowMs();
    if (now !== null && this.metaSession.status === 'ready') {
      const dailyId = getDailyId(now);
      this.dailyContext = {
        dailyId,
        weekId: getIsoWeekId(now),
        weekDailyIds: getIsoWeekDailyIds(now),
        seed: getDailySeed(dailyId, this.verifiedDealCatalog),
      };
    }

    if (this.pendingDailyRestore !== null && this.dailyContext !== null) {
      this.tryRestoreDailySession(this.pendingDailyRestore);
    }

    this.refreshMenuMeta();
    this.platform.ready();
  }

  private buildDailyMenuState(): DailyMenuState {
    const context = this.currentDailyContext();

    if (context === null) {
      return {
        available: false,
        dailyId: null,
        completed: false,
        bestTimeMs: null,
        weekId: null,
        weekDailyIds: [],
        completedDailyIds: [],
      };
    }

    const record = this.metaState.daily.records[context.dailyId];
    const completedDailyIds = this.metaState.weekly.weekId === context.weekId
      ? this.metaState.weekly.completedDailyIds
      : [];

    return {
      available: true,
      dailyId: context.dailyId,
      completed: record?.completed ?? false,
      bestTimeMs: record?.bestTimeMs ?? null,
      weekId: context.weekId,
      weekDailyIds: context.weekDailyIds,
      completedDailyIds,
    };
  }

  private buildStatisticsPageState(): StatisticsPageState {
    const { winnable, original } = this.metaState.stats;

    return {
      mode: this.leaderboardMode,
      statistics: {
        winnable: {
          played: winnable.played,
          wins: winnable.wins,
          bestTimeMs: winnable.bestTimeMs ?? null,
        },
        original: {
          played: original.played,
          wins: original.wins,
          bestTimeMs: original.bestTimeMs ?? null,
        },
      },
      leaderboard: this.buildLeaderboardViewState(),
    };
  }

  private refreshMenuMeta(): void {
    this.appShell.setCoins(this.metaSession.status === 'ready' ? this.metaState.progression.coins : null);
    this.playPage.updateProgression({...getLevelProgress(this.metaState.progression.totalXp),ready:this.metaSession.status === 'ready'});
    this.catalogView.update(this.buildCatalogState());
    this.playPage.updateDailyState(this.buildDailyMenuState());
    this.playPage.updateLeaderboardsAvailable(
      this.leaderboardService?.available ?? false,
    );
    this.statisticsPage.update(this.buildStatisticsPageState());
  }

  private refreshLocalization(): void {
    document.documentElement.lang = getLanguage();
    this.appShell.refreshLocalization();
    this.playPage.refreshLocalization();
    this.catalogView.refreshLocalization();
    this.rulesView.refreshLocalization();
    this.statisticsPage.refreshLocalization();
    this.dailyCompleteView.refreshLocalization();
    this.gameCompleteView.refreshLocalization();
    this.gameControls?.refreshLocalization();
  }

  private refreshSessionState(): void {
    this.metaState = this.metaSession.state;
    if (this.lastOrdinaryCompletion) {
      const completion=this.lastOrdinaryCompletion;
      this.lastOrdinaryCompletion={...completion,result:{state:this.metaState,stats:{...this.metaState.stats[completion.mode]},
        improvedBest:this.metaSession.getImprovedBest(completion.event.attemptId) ?? completion.result.improvedBest}};
      if (this.flow.state==='playing' && this.gameState?.isWon) this.showOrdinaryCompletion();
    }
    if (this.lastDailyReward && this.flow.state==='playing' && this.gameState?.isWon) this.showDailyCompletion();
    this.refreshMenuMeta();
  }

  private async loadMetaProfile(): Promise<void> {
    if (!this.platform) return;
    this.profileScopeError=false;
    let scope: string;
    try { scope = await this.platform.playerStorage.scope?.() ?? 'browser-local'; }
    catch { this.profileScopeError=true; this.refreshMenuMeta(); return; }
    if (scope !== this.metaScope) {
      const previousJournal = this.metaJournal;
      const transfer = this.metaScope === 'unbound'
        ? previousJournal.pending.map(item=>item.operation) : [];
      const nextJournal=new MetaJournal(scope);
      const nextSession=new MetaSession(this.platform.playerStorage,nextJournal);
      for (const event of transfer) {
        if (!nextSession.dispatch(event)) {
          this.profileScopeError=true;
          this.refreshMenuMeta();
          return;
        }
      }
      this.metaSession.onChange = undefined;
      this.metaJournal = nextJournal;
      this.metaSession = nextSession;
      this.metaSession.onChange = () => this.refreshSessionState();
      if (this.metaScope === 'unbound') previousJournal.acknowledge(previousJournal.pending);
      else {
        // A restored board and its pending rewards belong to the previously selected profile.
        this.board?.destroy(); this.board=null;
        this.gameControls?.destroy(); this.gameControls=null;
        this.gameState=null;
        this.flow=new GameFlow(new GameSession({catalog:this.verifiedDealCatalog}));
        this.resetAttempt();
        this.activeGameRepository.clear();
        this.pendingActiveSave=null;
        this.pendingDailyRestore=null;
        this.gameCompleteView.hide(); this.dailyCompleteView.hide();
        this.showShellPlay(false);
      }
      this.metaScope = scope;
      try { localStorage.setItem('cascadeMetaScope',scope); } catch { /* journal exposes durability */ }
    }
    const loaded = await this.metaSession.load();
    this.refreshSessionState();
    if (loaded) {
      await this.setTheme(resolveOwnedThemeId(window.location.search,this.metaState.equipped.theme,this.metaState.collection.ownedThemes,import.meta.env.DEV));
      if (this.pendingDailyRestore) {
        this.dailyContext=this.currentDailyContext();
        if (this.dailyContext) this.tryRestoreDailySession(this.pendingDailyRestore);
      }
      void this.metaSession.flush();
    }
  }

  private async retryMeta(): Promise<void> {
    this.catalogMessage = undefined;
    if (this.metaSession.status === 'ready') await this.metaSession.flush();
    else await this.loadMetaProfile();
    const completion=this.lastOrdinaryCompletion;
    if (completion && !hasCompletedAttempt(this.metaState,completion.event.attemptId)) this.dispatchMeta(completion.event);
    if (this.lastDailyEvent && !hasCompletedAttempt(this.metaState,this.lastDailyEvent.attemptId)) this.dispatchMeta(this.lastDailyEvent);
    this.refreshSessionState();
  }

  private dispatchMeta(event: MetaOperation): boolean {
    const accepted = this.metaSession.dispatch(event);
    if (!accepted) this.catalogMessage = 'Не удалось сохранить прогресс. Освободите место и повторите.';
    this.refreshSessionState();
    if (accepted && this.metaSession.status === 'ready') void this.metaSession.flush();
    return accepted;
  }

  private buildCatalogState(): ThemeCatalogState {
    return {
      items:THEME_CATALOG.map(item=>({...item,owned:this.metaState.collection.ownedThemes.includes(item.id),equipped:this.metaState.equipped.theme===item.id})),
      coins:this.metaState.progression.coins,
      ready:this.metaSession.status==='ready' && !this.profileScopeError,loading:this.metaSession.status==='loading' && !this.profileScopeError,
      error:this.profileScopeError || this.metaSession.status==='error' ? 'Не удалось загрузить профиль. Повторите попытку.' : this.metaSession.saveError ? 'Прогресс ещё не сохранён. Повторите сохранение.' : undefined,
      busyId:this.catalogBusyId,
      message:this.catalogMessage ?? (!this.metaSession.durable ? 'Хранилище недоступно: прогресс сохранится только в этой вкладке.' : undefined),
    };
  }

  private buyTheme(id:string): void {
    if (this.metaSession.status!=='ready' || this.catalogBusyId) return;
    const next = applyMetaOperation(this.metaState,{kind:'purchase',themeId:id});
    if (next === this.metaState) return;
    this.catalogMessage = undefined;
    if (this.dispatchMeta({kind:'purchase',themeId:id})) this.catalogMessage='Тема добавлена в коллекцию';
    this.refreshMenuMeta();
  }

  private async equipOwnedTheme(id:string): Promise<void> {
    if (this.metaSession.status!=='ready' || !this.metaState.collection.ownedThemes.includes(id)) return;
    this.catalogBusyId=id;
    this.catalogMessage=undefined;
    this.refreshMenuMeta();
    const previous = this.metaState.equipped.theme;
    const applied = await this.setTheme(id);
    if (this.catalogBusyId!==id) return;
    if (applied) {
      if (!this.dispatchMeta({kind:'equip',themeId:id})) await this.setTheme(previous);
      else this.catalogMessage='Тема применена';
    } else this.catalogMessage='Не удалось загрузить тему. Попробуйте ещё раз.';
    this.catalogBusyId=undefined;
    this.refreshMenuMeta();
  }

  private currentDailyContext(): DailyContext|null {
    const now=this.platform?.trustedClock.nowMs() ?? null;
    if (now===null || this.metaSession.status!=='ready') return null;
    const dailyId=getDailyId(now);
    return {dailyId,weekId:getIsoWeekId(now),weekDailyIds:getIsoWeekDailyIds(now),seed:getDailySeed(dailyId,this.verifiedDealCatalog)};
  }

  private completionEvent(mode:GameMode,elapsedMs:number): CompletionEvent {
    const now=this.platform?.trustedClock.nowMs() ?? null;
    return {kind:'complete',mode,attemptId:this.attemptId,elapsedMs:Math.max(1,elapsedMs),
      trustedDay:now===null ? null : getDailyId(now),trustedWeek:now===null ? null : getIsoWeekId(now),
      ...(mode==='daily' && this.dailyContext ? {dailyId:this.dailyContext.dailyId,weekId:this.dailyContext.weekId} : {}),
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
    this.pendingActiveSave = null;
    this.startDeal(deal, { restored: save });

    if (save.uiState === 'menu-paused') {
      this.showShellPlay(this.flow.canCancelMenu);
    } else {
      this.appShell.hide();
    }

    return true;
  }

  private tryRestoreDailySession(save: ActiveGameSaveV1): boolean {
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

    const deal = this.flow.resume(activeGameSaveToDeal(save), save.uiState);
    this.pendingDailyRestore = null;
    this.pendingActiveSave = null;
    this.board?.destroy();
    this.startDeal(deal, { restored: save });

    if (save.uiState === 'menu-paused') {
      this.showShellPlay(this.flow.canCancelMenu);
    } else {
      this.appShell.hide();
    }

    return true;
  }

  /** Collection integration point: preload, then replace the full cosmetic bundle. */
  async setTheme(id: string): Promise<boolean> {
    if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return false;
    const request = ++this.themeRequest;
    const theme = getTheme(id);
    if (!await loadTheme(this, theme) || request !== this.themeRequest
      || this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) {
      return false;
    }
    this.activeTheme = theme;
    this.board?.setTheme(theme);
    this.gameControls?.setTheme(theme);
    return true;
  }

  private startDeal(deal: Deal, options: StartDealOptions = {}): void {
    const restored = options.restored;

    this.resetAttempt();
    this.attemptId = restored?.attemptId ?? `${this.metaJournal.stream}~${this.metaJournal.nextSequence}`;
    this.dailyCompleteView.hide();
    this.gameCompleteView.hide();
    this.history.clear();
    const gameState = new SolitaireGame(deal);
    this.gameState = gameState;
    const layout = calculateViewportLayout(this.scale.width, this.scale.height);
    this.board = new BoardView(this, gameState, {
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
    }, layout, this.activeTheme);

    this.gameControls?.destroy();
    this.gameControls = new GameControlsView(this, {
      undo: () => this.undoLastAction(),
      restart: () => this.restartDeal(),
      newDeal: () => this.startNewDeal(),
      home: () => this.openMainMenu(),
    }, this.activeTheme);
    this.gameControls.setMode(gameState.mode);
    this.gameControls.setDaily(gameState.mode === 'daily');

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

      this.dispatchMeta({kind:'begin',attemptId:this.attemptId,mode,
        ...(isDaily ? {dailyId:context!.dailyId,weekId:context!.weekId} : {})});
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
    ) {
      return;
    }

    const mode = gameState.mode;
    this.attemptFinalized = true;
    const elapsedMs = this.attemptTimer.finish(performance.now());
    this.reconcileGameplayActivity();
    const event=this.completionEvent(mode,elapsedMs);
    const beforeBest=this.metaState.stats[mode].bestTimeMs;
    const totalXpBefore=this.metaState.progression.totalXp;
    const result=completeRewardedAttempt(this.metaState,event);
    const recorded=this.dispatchMeta(event);
    const completion:ModeCompletionResult={state:this.metaState,stats:{...this.metaState.stats[mode]},improvedBest:beforeBest===undefined || elapsedMs<beforeBest};

    this.lastOrdinaryCompletion = {
      mode,
      elapsedMs,
      result: completion,
      reward:{...result.reward,pending:this.metaSession.status!=='ready' || !recorded},
      totalXpBefore,
      event,
    };
    this.showOrdinaryCompletion();
    if (recorded) this.activeGameRepository.clear();
    this.pendingActiveSave = null;

    const bestTimeMs = completion.stats.bestTimeMs;
    if (completion.improvedBest && bestTimeMs !== undefined) {
      void this.leaderboardService?.syncBest(mode, bestTimeMs);
    }
  }

  private showOrdinaryCompletion(): void {
    const completion = this.lastOrdinaryCompletion;
    if (completion === null) {
      return;
    }

    this.gameCompleteView.show({
      completionId: completion.event.attemptId,
      mode: completion.mode,
      elapsedMs: completion.elapsedMs,
      improvedBest: completion.result.improvedBest,
      totalXpBefore: completion.totalXpBefore,
      reward:{...(this.metaSession.getReward(completion.event.attemptId) ?? completion.reward),
        pending:this.metaSession.status!=='ready' || !hasCompletedAttempt(this.metaState,completion.event.attemptId)},
    });
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
    if (
      context === null
      || !this.attemptStarted
      || this.attemptFinalized
      || !this.attemptTimer.running
    ) {
      return;
    }

    this.attemptFinalized = true;
    const elapsedMs = this.attemptTimer.finish(performance.now());
    this.reconcileGameplayActivity();
    const previousBest=this.metaState.daily.records[context.dailyId]?.bestTimeMs;
    const event=this.completionEvent('daily',elapsedMs);
    this.lastDailyEvent=event;
    this.lastDailyImprovedBest=previousBest===undefined || elapsedMs<previousBest;
    const result=completeRewardedAttempt(this.metaState,event);
    const recorded=this.dispatchMeta(event);
    this.lastDailyReward={...result.reward,pending:!recorded};
    if (recorded) this.activeGameRepository.clear();
    this.pendingDailyRestore = null;
    this.refreshMenuMeta();

    if (this.flow.state === 'menu-paused') {
      this.flow.cancelMenu();
      this.appShell.hide();
    }

    this.showDailyCompletion();
  }

  private showDailyCompletion(): void {
    const event=this.lastDailyEvent;
    if (!event?.dailyId || !event.weekId || !this.lastDailyReward) return;
    this.dailyCompleteView.show({
      completionId:event.attemptId,
      elapsedMs:event.elapsedMs,
      bestTimeMs:this.metaState.daily.records[event.dailyId]?.bestTimeMs ?? event.elapsedMs,
      improvedBest:this.metaSession.getImprovedBest(event.attemptId) ?? this.lastDailyImprovedBest,
      weekCompleted:getWeeklyProgress(this.metaState,event.weekId).completed,
      reward:{...(this.metaSession.getReward(event.attemptId) ?? this.lastDailyReward),pending:!hasCompletedAttempt(this.metaState,event.attemptId)},
    });
  }

  private resetAttempt(): void {
    this.attemptStarted = false;
    this.attemptFinalized = false;
    this.attemptTimer.reset();
    this.lastOrdinaryCompletion = null;
    this.lastDailyReward = undefined;
    this.lastDailyEvent = null;
    if (this.flow !== undefined) {
      this.reconcileGameplayActivity();
    }
  }

  private restartDeal(): void {
    if (this.flow.state !== 'playing') {
      return;
    }

    const deal = this.flow.restart();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private startNewDeal(): void {
    const currentDeal = this.flow.currentDeal;
    if (
      this.flow.state !== 'playing'
      || currentDeal === null
      || currentDeal.mode === 'daily'
    ) {
      return;
    }

    let deal: Deal;
    if (currentDeal.mode === 'winnable') {
      this.recordStandardFailureIfReplacing('winnable', null);
      const selection = this.selectStandardDeal();
      this.dispatchMeta({kind:'standard-served',seed:selection.seed.toString(),tier:selection.tier});
      deal = this.flow.startNewInCurrentMode(selection.seed);
    } else {
      deal = this.flow.startNewInCurrentMode();
    }

    this.board?.destroy();
    this.startDeal(deal);
  }

  private openMainMenu(): void {
    if (!this.flow.openMainMenu()) {
      return;
    }

    this.reconcileGameplayActivity();
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }

    this.showShellPlay(this.flow.canCancelMenu);
  }

  private showShellPlay(canCancel: boolean): void {
    this.catalogView.hide();
    if (canCancel) {
      this.board?.setUiPaused(true);
    }

    this.playPage.setSelectedMode(this.flow.selectedMode);
    this.playPage.updateDailyState(this.buildDailyMenuState());
    this.playPage.updateLeaderboardsAvailable(
      this.leaderboardService?.available ?? false,
    );
    this.rulesView.hide();
    this.rulesOpen = false;
    this.closeStatisticsPage();
    this.shellDestination = 'play';
    this.playPage.show();
    this.appShell.show({ canCancel, destination: 'play' });
  }

  private navigateShell(destination: ShellDestination): void {
    this.catalogView.hide();
    if (destination==='collection' || destination==='shop') {
      this.rulesView.hide();
      this.rulesOpen=false;
      this.closeStatisticsPage();
      this.playPage.hide();
      this.shellDestination=destination;
      this.appShell.setDestination(destination);
      this.catalogView.show(destination,this.buildCatalogState());
      return;
    }
    if (destination === 'play') {
      this.rulesView.hide();
      this.rulesOpen = false;
      this.closeStatisticsPage();
      this.playPage.show();
      this.shellDestination = 'play';
      this.appShell.setDestination('play');
      return;
    }

    if (destination === 'statistics') {
      this.rulesView.hide();
      this.rulesOpen = false;
      this.openStatisticsPage(false);
      return;
    }

    if (destination === 'rules') {
      if (!this.rulesOpen) {
        this.rulesReturnDestination = this.shellDestination === 'rules' ? 'play' : this.shellDestination;
      }
      this.closeStatisticsPage();
      this.playPage.hide();
      this.rulesOpen = true;
      this.shellDestination = 'rules';
      this.rulesView.show();
      this.appShell.setDestination('rules');
    }
  }

  private closeRules(): void {
    if (!this.rulesOpen) {
      return;
    }

    const destination = this.rulesReturnDestination;
    this.rulesOpen = false;
    this.rulesView.hide();
    this.navigateShell(destination);
  }

  private openStatisticsPage(focusLeaderboard = false): void {
    this.playPage.hide();
    this.statisticsOpen = true;
    this.shellDestination = 'statistics';
    this.appShell.setDestination('statistics');

    const service = this.leaderboardService;
    if (service === null || !service.available) {
      this.leaderboardViewState = this.buildLeaderboardViewState({
        status: 'unavailable',
        entries: [],
        playerEntry: null,
        message: undefined,
      });
      this.statisticsPage.show(this.buildStatisticsPageState(), focusLeaderboard);
      return;
    }

    this.leaderboardViewState = this.buildLeaderboardViewState({
      status: 'loading',
      entries: [],
      playerEntry: null,
      message: undefined,
    });
    this.statisticsPage.show(this.buildStatisticsPageState(), focusLeaderboard);
    void this.loadLeaderboard(this.leaderboardMode);
  }

  private closeStatisticsPage(): void {
    if (!this.statisticsOpen) {
      return;
    }

    this.statisticsOpen = false;
    this.leaderboardAuthPending = false;
    this.leaderboardRequestId += 1;
    this.statisticsPage.hide();
  }

  private buildLeaderboardViewState(
    overrides: Partial<StatisticsPageLeaderboardState> = {},
  ): StatisticsPageLeaderboardState {
    return {
      ...this.leaderboardViewState,
      authorized: this.leaderboardService?.authorized ?? false,
      authPending: this.leaderboardAuthPending,
      authorizationAllowed: this.canAuthorizeLeaderboard(),
      ...overrides,
    };
  }

  private renderLeaderboardState(
    overrides: Partial<StatisticsPageLeaderboardState> = {},
  ): void {
    this.leaderboardViewState = this.buildLeaderboardViewState(overrides);
    this.statisticsPage.update(this.buildStatisticsPageState());
  }

  private selectStatisticsMode(mode: OrdinaryGameMode): void {
    if (!this.statisticsOpen || mode === this.leaderboardMode) {
      return;
    }

    this.leaderboardMode = mode;
    const service = this.leaderboardService;
    this.renderLeaderboardState({
      status: service !== null && service.available ? 'loading' : 'unavailable',
      entries: [],
      playerEntry: null,
      message: undefined,
    });

    if (service !== null && service.available) {
      void this.loadLeaderboard(mode);
    }
  }

  private async loadLeaderboard(mode: OrdinaryGameMode): Promise<void> {
    const service = this.leaderboardService;
    if (service === null || !service.available) {
      if (this.statisticsOpen && mode === this.leaderboardMode) {
        this.renderLeaderboardState({
          status: 'unavailable',
          entries: [],
          playerEntry: null,
        });
      }
      return;
    }

    const requestId = ++this.leaderboardRequestId;
    const result = await service.load(mode);
    if (
      requestId !== this.leaderboardRequestId
      || !this.statisticsOpen
      || mode !== this.leaderboardMode
    ) {
      return;
    }

    this.renderLeaderboardState({
      status: result.status,
      entries: result.entries,
      authorized: result.authorized,
      playerEntry: result.playerEntry,
      authPending: false,
      message: undefined,
    });
  }

  private canAuthorizeLeaderboard(): boolean {
    return this.metaSession.status==='ready' && !this.metaSession.saveError && this.metaJournal.pending.length===0
      && (this.gameState === null || this.gameState.isWon);
  }

  private async authorizeLeaderboard(): Promise<void> {
    const service = this.leaderboardService;
    if (
      service === null
      || this.leaderboardAuthPending
      || !this.canAuthorizeLeaderboard()
    ) {
      return;
    }

    this.leaderboardAuthPending = true;
    this.renderLeaderboardState({ authPending: true, message: undefined });

    const authorized = await service.requestAuthorization();
    this.leaderboardAuthPending = false;

    if (!this.statisticsOpen) {
      return;
    }

    if (!authorized) {
      this.renderLeaderboardState({
        authPending: false,
        message: 'Вход не выполнен',
      });
      return;
    }

    await this.syncHistoricalLeaderboardBests();
    if (this.statisticsOpen) {
      await this.loadLeaderboard(this.leaderboardMode);
    }

    if (this.shellDestination==='collection' || this.shellDestination==='shop') {
      this.navigateShell('play');
      return;
    }
  }

  private async syncHistoricalLeaderboardBests(): Promise<void> {
    const service = this.leaderboardService;
    if (service === null || !service.authorized) {
      return;
    }

    await Promise.all([
      service.syncBest('winnable', this.metaState.stats.winnable.bestTimeMs),
      service.syncBest('original', this.metaState.stats.original.bestTimeMs),
    ]);
  }

  private handleButtonSfx = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (button instanceof HTMLButtonElement && !button.disabled) {
      this.sfxController.play('button');
    }
  };

  private handleEscape = (): void => {
    if (this.settingsView.isOpen) {
      this.settingsView.hide();
      return;
    }
    if (this.rulesOpen) {
      this.closeRules();
      return;
    }

    if (this.statisticsOpen) {
      this.navigateShell('play');
      return;
    }

    this.closeMainMenu();
  };

  private closeMainMenu(): void {
    this.catalogView.hide();
    if (this.rulesOpen) {
      this.rulesOpen = false;
      this.rulesView.hide();
    }

    this.closeStatisticsPage();

    if (this.flow.state !== 'menu-paused') {
      return;
    }

    this.input.resetPointers();

    if (this.flow.cancelMenu()) {
      this.appShell.hide();
      this.reconcileGameplayActivity();
      if (this.gameState !== null) {
        this.checkpointActiveGame(this.gameState);
      }

      window.requestAnimationFrame(() => {
        this.input.resetPointers();
        this.board?.setUiPaused(false);
      });
    }
  }

  private selectStandardDeal(): StandardSelection {
    return this.standardDifficultyDirector.select({
      wins: this.metaState.stats.winnable.wins,
      failureStreak: this.metaState.standardDifficulty.failureStreak,
      lastServedTier: this.metaState.standardDifficulty.lastServedTier,
      recentSeeds: this.metaState.standardDifficulty.recentSeeds,
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
    if (mode === 'winnable') {
      this.recordStandardFailureIfReplacing('winnable', null);
      const selection = this.selectStandardDeal();
      this.dispatchMeta({kind:'standard-served',seed:selection.seed.toString(),tier:selection.tier});
      this.flow.selectMenuMode(mode);
      return this.flow.playSelectedMode(selection.seed);
    }

    const replacementSeed = mode === 'daily' ? this.dailyContext?.seed ?? null : null;
    this.recordStandardFailureIfReplacing(mode, replacementSeed);
    this.flow.selectMenuMode(mode);
    return mode === 'daily'
      ? this.flow.playSelectedMode(
          this.dailyContext?.seed ?? (() => { throw new Error('Daily seed is required.'); })(),
        )
      : this.flow.playSelectedMode();
  }

  private playMenuMode(mode: GameMode): void {
    if (this.flow.state === 'playing') {
      return;
    }
    if (mode==='daily') this.dailyContext=this.currentDailyContext();
    if (mode === 'daily' && this.dailyContext === null) {
      return;
    }

    this.closeStatisticsPage();
    const deal = this.startSelectedMode(mode);
    this.appShell.hide();
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
    if (this.flow.state !== 'playing') {
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

      this.reconcileGameplayActivity();
    });
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
    const width = this.scale.width;
    const height = this.scale.height;
    const camera = this.cameras.main;
    const layout = calculateViewportLayout(width, height);

    camera
      .setSize(width, height)
      .setZoom(1)
      .setScroll(0, 0)
      .setBackgroundColor('#393937');

    this.board?.relayout(layout);
  }

  private shutdown(): void {
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = null;
    this.settingsView.destroy();
    this.audioController.destroy();
    this.themeRequest += 1;
    this.setGameplayMarkupActive(false);
    this.unsubscribePlatformPause?.();
    this.unsubscribePlatformPause = null;

    if (this.platformScenePaused) {
      this.platformScenePaused = false;
    }

    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.keyboard?.off('keydown-R', this.restartDeal, this);
    this.input.keyboard?.off('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.off('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.off('keydown-ESC', this.handleEscape, this);
    this.game.canvas.parentElement?.removeEventListener('click', this.handleButtonSfx);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.unsubscribeAccountSelection?.();
    this.unsubscribeAccountSelection = null;
    this.statisticsOpen = false;
    this.leaderboardRequestId += 1;
    this.attemptTimer.reset();
    this.statisticsPage.destroy();
    this.metaSession.onChange=undefined;
    this.catalogView.destroy();
    this.gameCompleteView.destroy();
    this.dailyCompleteView.destroy();
    this.rulesView.destroy();
    this.playPage.destroy();
    this.appShell.destroy();
    this.gameControls?.destroy();
    this.gameControls = null;
    this.board?.destroy();
    this.gameState = null;
  }
}
