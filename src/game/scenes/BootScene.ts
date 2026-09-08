import Phaser from 'phaser';

import { SUITS, type Suit } from '../model/types.ts';
import { getTheme } from '../../theme/ThemeRegistry.ts';
import { resolveThemeId } from '../../theme/ThemeSelection.ts';
import type { ThemeAssetRef } from '../../theme/ThemeDefinition.ts';

const SUIT_FILE: Record<Suit, string> = {
  clubs: 'club',
  diamonds: 'diamond',
  hearts: 'heart',
  spades: 'spade',
};

const CARD_ASSET_ROOT = './assets/cards';

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
    const theme = getTheme(resolveThemeId(window.location.search));

    this.loadThemeAsset(theme.boardSurface);
    this.loadThemeAsset(theme.cardBack);

    if (theme.slots !== undefined) {
      this.loadThemeAsset(theme.slots.tableauEmpty);
      this.loadThemeAsset(theme.slots.stockFreeCell);
      SUITS.forEach((suit) => this.loadThemeAsset(theme.slots?.foundations[suit]));
    }

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
  }

  create(): void {
    this.scene.start('GameScene');
  }

  private loadThemeAsset(asset: ThemeAssetRef | undefined): void {
    if (asset !== undefined) {
      this.load.image(asset.key, asset.url);
    }
  }
}
