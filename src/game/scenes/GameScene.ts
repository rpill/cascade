import Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Deal, GameMode } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { DailyCompleteView } from '../view/DailyCompleteView.ts';
import {
  MainMenuView,
  type DailyMenuState,
} from '../view/MainMenuView.ts';
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
import {
  createDefaultMetaSave,
  type MetaSaveV1,
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

interface DailyContext {
  readonly dailyId: string;
  readonly weekId: string;
  readonly weekDailyIds: readonly string[];
  readonly seed: bigint;
}

interface StartDealOptions {
  readonly restored?: ActiveGameSaveV1;
}

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private gameState: SolitaireGame | null = null;
  private mainMenu!: MainMenuView;
  private dailyCompleteView!: DailyCompleteView;

  private activeGameRepository!: ActiveGameRepository;
  private pendingActiveSave: ActiveGameSaveV1 | null = null;
  private pendingDailyRestore: ActiveGameSaveV1 | null = null;
  private readonly attemptTimer = new AttemptTimer();
  private attemptStarted = false;

  private platform: PlatformServices | null = null;
  private metaRepository: MetaRepository | null = null;
  private metaState: MetaSaveV1 = createDefaultMetaSave();
  private dailyContext: DailyContext | null = null;
  private readonly dailyTimer = new AttemptTimer();
  private dailyAttemptStarted = false;

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
      cancel: () => this.closeMainMenu(),
    });
    this.dailyCompleteView = new DailyCompleteView(this, {
      retry: () => this.retryDaily(),
      menu: () => this.openMenuFromDailyComplete(),
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
      });
    }

    this.input.keyboard?.on('keydown-R', this.restartDeal, this);
    this.input.keyboard?.on('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.on('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.on('keydown-ESC', this.closeMainMenu, this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    void this.initializeMeta();
  }

  private async initializeMeta(): Promise<void> {
    this.platform = await initializePlatform();
    this.metaRepository = new MetaRepository(this.platform.playerStorage);
    this.metaState = await this.metaRepository.load();

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

  private refreshMenuMeta(): void {
    this.mainMenu.updateDailyState(this.buildDailyMenuState());
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
      });
    } else {
      this.mainMenu.hide();
    }

    return true;
  }

  private startDeal(deal: Deal, options: StartDealOptions = {}): void {
    const restored = options.restored;

    this.resetDailyAttempt();
    this.resetOrdinaryAttempt();
    this.dailyCompleteView.hide();
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
      if (deal.mode === 'daily') {
        this.dailyAttemptStarted = restored.attemptStarted;
        if (restored.attemptStarted) {
          const now = performance.now();
          this.dailyTimer.start(now, restored.elapsedMs);
          if (
            restored.uiState === 'menu-paused'
            || document.visibilityState !== 'visible'
          ) {
            this.dailyTimer.pause(now);
          }
        }
      } else {
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
    if (gameState.mode !== 'daily') {
      this.onOrdinaryBoardSettled(gameState);
      return;
    }

    const context = this.dailyContext;
    if (context === null) {
      return;
    }

    if (!this.dailyAttemptStarted) {
      if (gameState.isWon) {
        return;
      }

      this.metaState = beginDailyAttempt(
        this.metaState,
        context.dailyId,
        context.weekId,
      );
      const now = performance.now();
      this.dailyTimer.start(now);
      this.dailyAttemptStarted = true;
      if (
        this.flow.state !== 'playing'
        || document.visibilityState !== 'visible'
      ) {
        this.dailyTimer.pause(now);
      }
      void this.metaRepository?.save(this.metaState);
      this.refreshMenuMeta();
      this.checkpointActiveGame(gameState);
      return;
    }

    if (gameState.isWon) {
      this.dailyAttemptStarted = false;
      this.finishDailyAttempt();
      return;
    }

    this.checkpointActiveGame(gameState);
  }

  private onOrdinaryBoardSettled(gameState: SolitaireGame): void {
    if (gameState.mode === 'daily') {
      return;
    }

    if (gameState.isWon) {
      this.activeGameRepository.clear();
      this.pendingActiveSave = null;
      this.resetOrdinaryAttempt();
      return;
    }

    if (!this.attemptStarted) {
      const now = performance.now();
      this.attemptTimer.start(now);
      this.attemptStarted = true;
      if (
        this.flow.state !== 'playing'
        || document.visibilityState !== 'visible'
      ) {
        this.attemptTimer.pause(now);
      }
    }

    this.checkpointActiveGame(gameState);
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
        attemptStarted: this.dailyAttemptStarted,
        elapsedMs: this.getDailyElapsedForCheckpoint(),
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

  private getDailyElapsedForCheckpoint(): number {
    if (!this.dailyAttemptStarted || !this.dailyTimer.running) {
      return 0;
    }

    return this.dailyTimer.elapsed(performance.now());
  }

  private finishDailyAttempt(): void {
    const context = this.dailyContext;
    if (context === null || !this.dailyTimer.running) {
      return;
    }

    const elapsedMs = this.dailyTimer.finish(performance.now());
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

  private resetDailyAttempt(): void {
    this.dailyAttemptStarted = false;
    this.dailyTimer.reset();
  }

  private resetOrdinaryAttempt(): void {
    this.attemptStarted = false;
    this.attemptTimer.reset();
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

    if (this.attemptStarted) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.dailyAttemptStarted) {
      this.dailyTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }

    this.mainMenu.show({
      canCancel: this.flow.canCancelMenu,
      selectedMode: this.flow.selectedMode,
      daily: this.buildDailyMenuState(),
    });
  }

  private closeMainMenu(): void {
    if (this.flow.cancelMenu()) {
      this.mainMenu.hide();
      this.resumeAttemptTimerIfPlayable();
      this.resumeDailyTimerIfPlayable();
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

    this.flow.selectMenuMode(mode);
    const deal = mode === 'daily'
      ? this.flow.playSelectedMode(this.dailyContext!.seed)
      : this.flow.playSelectedMode();
    this.mainMenu.hide();
    this.dailyCompleteView.hide();
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

  private undoLastAction(): void {
    if (this.flow.state !== 'playing') {
      return;
    }

    this.board?.requestUndo();
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.resumeAttemptTimerIfPlayable();
      this.resumeDailyTimerIfPlayable();
      return;
    }

    if (this.attemptStarted) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.dailyAttemptStarted) {
      this.dailyTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  };

  private handlePageHide = (): void => {
    if (this.attemptStarted) {
      this.attemptTimer.pause(performance.now());
    }
    if (this.dailyAttemptStarted) {
      this.dailyTimer.pause(performance.now());
    }
    if (this.gameState !== null) {
      this.checkpointActiveGame(this.gameState);
    }
  };

  private resumeAttemptTimerIfPlayable(): void {
    if (
      this.attemptStarted
      && this.flow.state === 'playing'
      && document.visibilityState === 'visible'
    ) {
      this.attemptTimer.resume(performance.now());
    }
  }

  private resumeDailyTimerIfPlayable(): void {
    if (
      this.dailyAttemptStarted
      && this.flow.state === 'playing'
      && document.visibilityState === 'visible'
    ) {
      this.dailyTimer.resume(performance.now());
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
    this.input.keyboard?.off('keydown-ESC', this.closeMainMenu, this);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.attemptTimer.reset();
    this.dailyTimer.reset();
    this.dailyCompleteView.destroy();
    this.mainMenu.destroy();
    this.board?.destroy();
    this.gameState = null;
  }
}
