import Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Deal, GameMode } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { DailyCompleteView } from '../view/DailyCompleteView.ts';
import { GameCompleteView } from '../view/GameCompleteView.ts';
import {
  MainMenuView,
  type DailyMenuState,
} from '../view/MainMenuView.ts';
import {
  StatisticsView,
  type StatisticsViewState,
} from '../view/StatisticsView.ts';
import { calculateLayoutMetrics } from '../view/LayoutMetrics.ts';
import { AttemptTimer } from '../../meta/AttemptTimer.ts';
import {
  getDailyId,
  getDailySeed,
  getIsoWeekDailyIds,
  getIsoWeekId,
} from '../../meta/DailyCalendar.ts';
import {
  beginDailyAttempt,
  completeDailyAttempt,
  getWeeklyProgress,
} from '../../meta/DailyProgress.ts';
import { MetaRepository } from '../../meta/MetaRepository.ts';
import { MetaMutationQueue } from '../../meta/MetaMutationQueue.ts';
import {
  beginModeAttempt,
  completeModeAttempt,
  type ModeCompletionResult,
  type OrdinaryGameMode,
} from '../../meta/GameStats.ts';
import {
  createDefaultMetaSave,
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
import { LeaderboardService } from '../../leaderboards/LeaderboardService.ts';

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
}

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private gameState: SolitaireGame | null = null;
  private mainMenu!: MainMenuView;
  private statisticsView!: StatisticsView;
  private statisticsOpen = false;
  private dailyCompleteView!: DailyCompleteView;
  private gameCompleteView!: GameCompleteView;

  private activeGameRepository!: ActiveGameRepository;
  private pendingActiveSave: ActiveGameSaveV1 | null = null;
  private pendingDailyRestore: ActiveGameSaveV1 | null = null;
  private readonly metaMutations = new MetaMutationQueue();
  private readonly attemptTimer = new AttemptTimer();
  private attemptStarted = false;
  private attemptFinalized = false;
  private lastOrdinaryCompletion: OrdinaryCompletionSnapshot | null = null;

  private platform: PlatformServices | null = null;
  private leaderboardService: LeaderboardService | null = null;
  private metaRepository: MetaRepository | null = null;
  private metaState: MetaSave = createDefaultMetaSave();
  private dailyContext: DailyContext | null = null;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.input.dragDistanceThreshold = 7;
    this.applyViewportLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.flow = new GameFlow();
    this.mainMenu = new MainMenuView(this, {
      play: (mode) => this.playMenuMode(mode),
      statistics: () => this.openStatistics(),
      leaderboard: () => undefined,
      cancel: () => this.closeMainMenu(),
    });
    this.statisticsView = new StatisticsView(this, {
      close: () => this.closeStatistics(),
    });
    this.dailyCompleteView = new DailyCompleteView(this, {
      retry: () => this.retryDaily(),
      menu: () => this.openMenuFromDailyComplete(),
    });
    this.gameCompleteView = new GameCompleteView(this, {
      newGame: () => this.startNewDeal(),
      menu: () => this.openMenuFromGameComplete(),
    });

    this.activeGameRepository = new ActiveGameRepository();
    this.pendingActiveSave = this.activeGameRepository.load();
    if (this.pendingActiveSave?.mode === 'daily') {
      this.pendingDailyRestore = this.pendingActiveSave;
    }
    const restoredOrdinary = this.tryRestoreOrdinarySession();

    if (!restoredOrdinary) {
      this.mainMenu.show({
        canCancel: false,
        selectedMode: this.flow.selectedMode,
        daily: this.buildDailyMenuState(),
        leaderboardsAvailable: this.leaderboardService?.available ?? false,
      });
    }

    this.input.keyboard?.on('keydown-R', this.restartDeal, this);
    this.input.keyboard?.on('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.on('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.on('keydown-ESC', this.handleEscape, this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    void this.initializeMeta();
  }

  private async initializeMeta(): Promise<void> {
    this.platform = await initializePlatform();
    this.metaRepository = new MetaRepository(this.platform.playerStorage);
    const loaded = await this.metaRepository.load();
    this.metaState = this.metaMutations.settleLoadedState(loaded);
    if (this.lastOrdinaryCompletion !== null) {
      const completion = this.lastOrdinaryCompletion;
      const loadedBest = loaded.stats[completion.mode].bestTimeMs;
      this.lastOrdinaryCompletion = {
        ...completion,
        result: {
          state: this.metaState,
          stats: { ...this.metaState.stats[completion.mode] },
          improvedBest: completion.result.improvedBest
            && (loadedBest === undefined || completion.elapsedMs < loadedBest),
        },
      };
      if (this.flow.state === 'playing' && this.gameState?.isWon) {
        this.showOrdinaryCompletion();
      }
    }
    void this.metaRepository.save(this.metaState);

    const now = this.platform.trustedClock.nowMs();
    if (now !== null) {
      const dailyId = getDailyId(now);
      this.dailyContext = {
        dailyId,
        weekId: getIsoWeekId(now),
        weekDailyIds: getIsoWeekDailyIds(now),
        seed: getDailySeed(dailyId, this.metaState.daily.algorithmVersion),
      };
    }

    if (this.pendingDailyRestore !== null && this.dailyContext !== null) {
      this.tryRestoreDailySession(this.pendingDailyRestore);
    }

    this.refreshMenuMeta();
    this.platform.ready();
  }

  private buildDailyMenuState(): DailyMenuState {
    const context = this.dailyContext;

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

  private buildStatisticsViewState(): StatisticsViewState {
    const { winnable, original } = this.metaState.stats;

    return {
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
    };
  }

  private refreshMenuMeta(): void {
    this.mainMenu.updateDailyState(this.buildDailyMenuState());
    this.mainMenu.updateLeaderboardsAvailable(
      this.leaderboardService?.available ?? false,
    );
    this.statisticsView.update(this.buildStatisticsViewState());
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
      this.mainMenu.show({
        canCancel: this.flow.canCancelMenu,
        selectedMode: this.flow.selectedMode,
        daily: this.buildDailyMenuState(),
        leaderboardsAvailable: this.leaderboardService?.available ?? false,
      });
    } else {
      this.mainMenu.hide();
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
      && daily.algorithmVersion === this.metaState.daily.algorithmVersion
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
      this.mainMenu.show({
        canCancel: this.flow.canCancelMenu,
        selectedMode: this.flow.selectedMode,
        daily: this.buildDailyMenuState(),
        leaderboardsAvailable: this.leaderboardService?.available ?? false,
      });
    } else {
      this.mainMenu.hide();
    }

    return true;
  }

  private startDeal(deal: Deal, options: StartDealOptions = {}): void {
    const restored = options.restored;

    this.resetAttempt();
    this.dailyCompleteView.hide();
    this.gameCompleteView.hide();
    this.history.clear();
    const gameState = new SolitaireGame(deal);
    this.gameState = gameState;
    const metrics = calculateLayoutMetrics(this.scale.width, this.scale.height);
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
      autoFoundationStep: () => {
        const card = gameState.autoMoveToFoundation();
        if (card === null) {
          this.onBoardSettled(gameState);
        }
        return card;
      },
      settled: () => this.onBoardSettled(gameState),
      undo: () => this.history.undo(gameState),
      restart: () => this.restartDeal(),
      newGame: () => this.startNewDeal(),
      mainMenu: () => this.openMainMenu(),
    }, metrics);

    if (restored !== undefined) {
      this.attemptStarted = restored.attemptStarted;
      if (restored.attemptStarted) {
        const now = performance.now();
        this.attemptTimer.start(now, restored.elapsedMs);
        if (
          restored.uiState === 'menu-paused'
          || document.visibilityState !== 'visible'
        ) {
          this.attemptTimer.pause(now);
        }
      }

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
      if (
        this.flow.state !== 'playing'
        || document.visibilityState !== 'visible'
      ) {
        this.attemptTimer.pause(now);
      }

      if (isDaily) {
        this.metaState = beginDailyAttempt(
          this.metaState,
          context!.dailyId,
          context!.weekId,
        );
        this.refreshMenuMeta();
      } else {
        this.metaState = this.metaMutations.apply(
          this.metaState,
          (state) => beginModeAttempt(state, mode),
        );
        this.refreshMenuMeta();
      }

      void this.metaRepository?.save(this.metaState);
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
    const completion = completeModeAttempt(
      this.metaState,
      mode,
      elapsedMs,
    );
    this.metaState = this.metaMutations.apply(
      this.metaState,
      (state) => completeModeAttempt(state, mode, elapsedMs).state,
    );
    this.refreshMenuMeta();

    this.lastOrdinaryCompletion = {
      mode,
      elapsedMs,
      result: completion,
    };
    this.showOrdinaryCompletion();
    void this.metaRepository?.save(this.metaState, true);
    this.activeGameRepository.clear();
    this.pendingActiveSave = null;
  }

  private showOrdinaryCompletion(): void {
    const completion = this.lastOrdinaryCompletion;
    if (completion === null) {
      return;
    }

    this.gameCompleteView.show({
      mode: completion.mode,
      elapsedMs: completion.elapsedMs,
      bestTimeMs: completion.result.stats.bestTimeMs ?? completion.elapsedMs,
      improvedBest: completion.result.improvedBest,
      wins: completion.result.stats.wins,
      played: completion.result.stats.played,
    });
  }

  private checkpointActiveGame(gameState: SolitaireGame): void {
    if (gameState.isWon) {
      this.activeGameRepository.clear();
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
        mode: gameState.mode,
        seed: gameState.seed,
        snapshot: gameState.snapshot(),
        attemptStarted: this.attemptStarted,
        elapsedMs: this.getElapsedForCheckpoint(),
        daily: {
          dailyId: context.dailyId,
          algorithmVersion: this.metaState.daily.algorithmVersion,
        },
        uiState,
      });
      this.activeGameRepository.save(save);
      return;
    }

    const save = createActiveGameSave({
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
    const result = completeDailyAttempt(
      this.metaState,
      context.dailyId,
      context.weekId,
      elapsedMs,
    );
    this.metaState = result.state;
    void this.metaRepository?.save(this.metaState, true);
    this.activeGameRepository.clear();
    this.pendingDailyRestore = null;
    this.refreshMenuMeta();

    if (this.flow.state === 'menu-paused') {
      this.flow.cancelMenu();
      this.mainMenu.hide();
    }

    this.dailyCompleteView.show({
      elapsedMs,
      bestTimeMs: result.bestTimeMs,
      improvedBest: result.improvedBest,
      weekCompleted: getWeeklyProgress(this.metaState, context.weekId).completed,
    });
  }

  private resetAttempt(): void {
    this.attemptStarted = false;
    this.attemptFinalized = false;
    this.attemptTimer.reset();
    this.lastOrdinaryCompletion = null;
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
    if (
      this.flow.state !== 'playing'
      || this.flow.currentDeal?.mode === 'daily'
    ) {
      return;
    }

    const deal = this.flow.startNewInCurrentMode();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private openMainMenu(): void {
    if (!this.flow.openMainMenu()) {
      return;
    }

    if (this.attemptStarted && !this.attemptFinalized) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }

    this.mainMenu.show({
      canCancel: this.flow.canCancelMenu,
      selectedMode: this.flow.selectedMode,
      daily: this.buildDailyMenuState(),
      leaderboardsAvailable: this.leaderboardService?.available ?? false,
    });
  }

  private openStatistics(): void {
    this.statisticsOpen = true;
    this.statisticsView.show(this.buildStatisticsViewState());
  }

  private closeStatistics(): void {
    this.statisticsOpen = false;
    this.statisticsView.hide();
  }

  private handleEscape = (): void => {
    if (this.statisticsOpen) {
      this.closeStatistics();
      return;
    }

    this.closeMainMenu();
  };

  private closeMainMenu(): void {
    if (this.statisticsOpen) {
      this.closeStatistics();
      return;
    }

    if (this.flow.cancelMenu()) {
      this.mainMenu.hide();
      this.resumeAttemptTimerIfPlayable();
      if (this.gameState !== null) {
        this.checkpointActiveGame(this.gameState);
      }
    }
  }

  private playMenuMode(mode: GameMode): void {
    if (this.flow.state === 'playing') {
      return;
    }
    if (mode === 'daily' && this.dailyContext === null) {
      return;
    }

    this.closeStatistics();
    this.flow.selectMenuMode(mode);
    const deal = mode === 'daily'
      ? this.flow.playSelectedMode(this.dailyContext!.seed)
      : this.flow.playSelectedMode();
    this.mainMenu.hide();
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

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.resumeAttemptTimerIfPlayable();
      return;
    }

    if (this.attemptStarted && !this.attemptFinalized) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  };

  private handlePageHide = (): void => {
    if (this.attemptStarted && !this.attemptFinalized) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  };

  private resumeAttemptTimerIfPlayable(): void {
    if (
      this.attemptStarted
      && !this.attemptFinalized
      && this.flow.state === 'playing'
      && document.visibilityState === 'visible'
    ) {
      this.attemptTimer.resume(performance.now());
    }
  }

  private handleResize(): void {
    this.applyViewportLayout();
  }

  private applyViewportLayout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const camera = this.cameras.main;
    const metrics = calculateLayoutMetrics(width, height);

    camera
      .setSize(width, height)
      .setZoom(1)
      .setScroll(0, 0)
      .setBackgroundColor('#393937');

    this.board?.relayout(metrics);
  }

  private shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.keyboard?.off('keydown-R', this.restartDeal, this);
    this.input.keyboard?.off('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.off('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.off('keydown-ESC', this.handleEscape, this);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.attemptTimer.reset();
    this.gameCompleteView.destroy();
    this.dailyCompleteView.destroy();
    this.statisticsView.destroy();
    this.mainMenu.destroy();
    this.board?.destroy();
    this.gameState = null;
  }
}
