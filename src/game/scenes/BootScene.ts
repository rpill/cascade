import Phaser from 'phaser';

import { SUITS, type Suit } from '../model/types.ts';

const SUIT_FILE: Record<Suit, string> = {
  clubs: 'club',
  diamonds: 'diamond',
  hearts: 'heart',
  spades: 'spade',
};

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
    this.load.image(
      'cascade-board-surface',
      '/assets/theme/fine-grained-wood.jpg',
    );

    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank += 1) {
        const fileRank = FACE_FILE[rank] ?? String(rank);
        const fileName = `${SUIT_FILE[suit]}${fileRank}.png`;

        this.load.image(
          `${suit}-${rank}`,
          `/assets/cards/${fileName}`,
        );
      }
    });

    this.load.image(
      'card-back',
      '/assets/cards/redBack.png',
    );
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
