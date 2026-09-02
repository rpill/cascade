import Phaser from 'phaser';

import { SolitaireGame } from '../model/SolitaireGame.ts';
import { createSawayamaDeal } from '../model/deal.ts';
import type { CardSource, MoveTarget } from '../model/types.ts';
import { BoardView } from '../view/BoardView.ts';
import { notifyPlatformReady } from '../../platform/yandex.ts';
import { createNextDealSeed } from './dealSeed.ts';

export class GameScene extends Phaser.Scene {
  private seed = 0;
  private gameState!: SolitaireGame;
  private board!: BoardView;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.input.dragDistanceThreshold = 7;

    this.seed = this.generateSeed();

    this.startDeal();

    this.input.keyboard?.on('keydown-R', () => this.restartDeal());
    void notifyPlatformReady();
  }

  private startDeal(): void {
    this.gameState = new SolitaireGame(createSawayamaDeal(this.seed));
    this.board = new BoardView(this, this.gameState, {
      draw: () => this.gameState.draw(),
      move: (source, target) => this.move(source, target),
      autoFoundation: (source) => this.gameState.moveToFoundation(source),
      autoFoundationStep: () => this.gameState.autoMoveToFoundation(),
      restart: () => this.restartDeal(),
      newGame: () => this.startNewDeal(),
    });

    this.board.playInitialDeal();
  }

  private restartDeal(): void {
    this.board.destroy();
    this.startDeal();
  }

  private startNewDeal(): void {
    this.seed = createNextDealSeed(this.seed, this.generateSeed());
    this.restartDeal();
  }

  private generateSeed(): number {
    return (
      Date.now()
      ^ Math.floor(Math.random() * 0xffff_ffff)
    ) >>> 0;
  }

  private move(source: CardSource, target: MoveTarget): boolean {
    return this.gameState.move(source, target);
  }
}
