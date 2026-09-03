import Phaser from 'phaser';

import { GameFlow } from '../model/GameFlow.ts';
import { GameHistory } from '../model/GameHistory.ts';
import { SolitaireGame } from '../model/SolitaireGame.ts';
import type { Deal } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { MainMenuView } from '../view/MainMenuView.ts';
import { calculateLayoutMetrics } from '../view/LayoutMetrics.ts';
import { notifyPlatformReady } from '../../platform/yandex.ts';

export class GameScene extends Phaser.Scene {
  private flow!: GameFlow;
  private readonly history = new GameHistory();
  private board: BoardView | null = null;
  private mainMenu!: MainMenuView;

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
    this.mainMenu.show({
      canCancel: false,
      selectedMode: this.flow.selectedMode,
    });

    this.input.keyboard?.on('keydown-R', this.restartDeal, this);
    this.input.keyboard?.on('keydown-Z', this.undoLastAction, this);
    this.input.keyboard?.on('keydown-N', this.startNewDeal, this);
    this.input.keyboard?.on('keydown-ESC', this.closeMainMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    void notifyPlatformReady();
  }

  private startDeal(deal: Deal): void {
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
      autoFoundationStep: () => gameState.autoMoveToFoundation(),
      undo: () => this.history.undo(gameState),
      restart: () => this.restartDeal(),
      newGame: () => this.startNewDeal(),
      mainMenu: () => this.openMainMenu(),
    }, metrics);

    this.board.playInitialDeal();
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

    this.mainMenu.show({
      canCancel: this.flow.canCancelMenu,
      selectedMode: this.flow.selectedMode,
    });
  }

  private closeMainMenu(): void {
    if (this.flow.cancelMenu()) {
      this.mainMenu.hide();
    }
  }

  private playSelectedMode(): void {
    if (this.flow.state === 'playing') {
      return;
    }

    const deal = this.flow.playSelectedMode();
    this.mainMenu.hide();
    this.board?.destroy();
    this.startDeal(deal);
  }

  private undoLastAction(): void {
    if (this.flow.state !== 'playing') {
      return;
    }

    this.board?.requestUndo();
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
    this.mainMenu.destroy();
    this.board?.destroy();
  }
}
