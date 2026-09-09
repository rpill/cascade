import Phaser from 'phaser';

import { SUITS, type Suit } from '../model/types.ts';
import { getTheme } from '../../theme/ThemeRegistry.ts';
import { resolveThemeId } from '../../theme/ThemeSelection.ts';
import type { ThemeAssetRef } from '../../theme/ThemeDefinition.ts';
import { getThemeAssets } from '../../theme/ThemeAssets.ts';
import { prepareCardBack } from '../../theme/CardBackTexture.ts';

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
    const theme = getTheme(resolveThemeId(import.meta.env.DEV ? window.location.search : ''));

    getThemeAssets(theme).forEach(asset => this.loadThemeAsset(asset));

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
    prepareCardBack(this, getTheme(resolveThemeId(import.meta.env.DEV ? window.location.search : '')));
    this.scene.start('GameScene');
  }

  private loadThemeAsset(asset: ThemeAssetRef): void {
    this.load.image(asset.key, asset.url);
  }
}
