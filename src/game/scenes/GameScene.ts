import Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Deal } from '../model/types.ts';
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

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private mainMenu!: MainMenuView;
  private dailyCompleteView!: DailyCompleteView;

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
      select: (mode) => this.flow.selectMenuMode(mode),
      play: () => this.playSelectedMode(),
      cancel: () => this.closeMainMenu(),
    });
    this.dailyCompleteView = new DailyCompleteView(this, {
      retry: () => this.retryDaily(),
      menu: () => this.openMenuFromDailyComplete(),
    });
    this.mainMenu.show({
      canCancel: false,
      selectedMode: this.flow.selectedMode,
      daily: this.buildDailyMenuState(),
    });

    this.input.keyboard?.on('keydown-R', this.restartDeal, this);
    this.input.keyboard?.on('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.on('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.on('keydown-ESC', this.closeMainMenu, this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
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

  private startDeal(deal: Deal): void {
    this.resetDailyAttempt();
    this.dailyCompleteView.hide();
    this.history.clear();
    const gameState = new SolitaireGame(deal);
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
      undo: () => this.history.undo(gameState),
      restart: () => this.restartDeal(),
      newGame: () => this.startNewDeal(),
      mainMenu: () => this.openMainMenu(),
    }, metrics);

    this.board.playInitialDeal();
  }

  private onBoardSettled(gameState: SolitaireGame): void {
    const context = this.dailyContext;
    if (gameState.mode !== 'daily' || context === null) {
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
      return;
    }

    if (gameState.isWon) {
      this.dailyAttemptStarted = false;
      this.finishDailyAttempt();
    }
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

  private restartDeal(): void {
    if (this.flow.state !== 'playing') {
      return;
    }

    const deal = this.flow.restart();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private startNewDeal(): void {
    if (this.flow.state !== 'playing') {
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

    if (this.dailyAttemptStarted) {
      this.dailyTimer.pause(performance.now());
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
      this.resumeDailyTimerIfPlayable();
    }
  }

  private playSelectedMode(): void {
    if (this.flow.state === 'playing') {
      return;
    }

    const selectedMode = this.flow.selectedMode;
    if (selectedMode === 'daily' && this.dailyContext === null) {
      return;
    }

    const deal = selectedMode === 'daily'
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
    if (!this.dailyAttemptStarted) {
      return;
    }

    if (document.visibilityState === 'visible') {
      this.resumeDailyTimerIfPlayable();
    } else {
      this.dailyTimer.pause(performance.now());
    }
  };

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
    this.dailyTimer.reset();
    this.dailyCompleteView.destroy();
    this.mainMenu.destroy();
    this.board?.destroy();
  }
}
