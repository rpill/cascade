import Phaser from 'phaser';

import { SUITS, type Suit } from '../model/types.ts';

const SUIT_FILE: Record<Suit, string> = {
  clubs: 'club',
  diamonds: 'diamond',
  hearts: 'heart',
  spades: 'spade',
};

const CARD_ASSET_ROOT = './assets/cards';
const BOARD_SURFACE_ASSET = './assets/theme/fine-grained-wood.jpg';

const FACE_FILE: Partial<Record<number, string>> = {
  1: 'Ace',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('board-surface', BOARD_SURFACE_ASSET);

    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank += 1) {
        const fileRank = FACE_FILE[rank] ?? String(rank);
        const fileName = `${SUIT_FILE[suit]}${fileRank}.png`;

        this.load.image(
          `${suit}-${rank}`,
          `${CARD_ASSET_ROOT}/${fileName}`,
        );
      }
    });

    this.load.image(
      'card-back',
      `${CARD_ASSET_ROOT}/redBack.png`,
    );
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
