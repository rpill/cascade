import Phaser from 'phaser';

import { SUITS, type Suit } from '../model/types.ts';
import { VerifiedDealCatalog } from '../model/VerifiedDealCatalog.ts';
import { getTheme } from '../../theme/ThemeRegistry.ts';
import { resolveThemeId } from '../../theme/ThemeSelection.ts';
import type { ThemeAssetRef } from '../../theme/ThemeDefinition.ts';
import { getThemeAssets } from '../../theme/ThemeAssets.ts';
import { prepareCardBack } from '../../theme/CardBackTexture.ts';
import { SFX_ASSETS } from '../../settings/SfxController.ts';

const SUIT_FILE: Record<Suit, string> = {
  clubs: 'club',
  diamonds: 'diamond',
  hearts: 'heart',
  spades: 'spade',
};

const CARD_ASSET_ROOT = './assets/cards';
export const VERIFIED_DEALS_BINARY_KEY = 'verified-deals-binary';
export const VERIFIED_DEALS_MANIFEST_KEY = 'verified-deals-manifest';
export const VERIFIED_DEALS_REGISTRY_KEY = 'verified-deal-catalog';

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
    this.load.binary(VERIFIED_DEALS_BINARY_KEY, './assets/deals/verified-deals.bin');
    this.load.json(VERIFIED_DEALS_MANIFEST_KEY, './assets/deals/verified-deals-manifest.json');

    getThemeAssets(theme).forEach(asset => this.loadThemeAsset(asset));
    Object.values(SFX_ASSETS).forEach((asset) => {
      asset.keys.forEach((key, index) => this.load.audio(key, asset.urls[index]));
    });

    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank += 1) {
        const fileRank = FACE_FILE[rank] ?? String(rank);
        const fileName = `${SUIT_FILE[suit]}${fileRank}.png`;
        this.load.image(`${suit}-${rank}`, `${CARD_ASSET_ROOT}/${fileName}`);
      }
    });
  }

  create(): void {
    const binary = this.cache.binary.get(VERIFIED_DEALS_BINARY_KEY) as ArrayBuffer | undefined;
    const manifest = this.cache.json.get(VERIFIED_DEALS_MANIFEST_KEY) as unknown;
    if (!(binary instanceof ArrayBuffer)) {
      throw new Error('Verified deal catalog binary failed to load.');
    }
    const catalog = VerifiedDealCatalog.decode(binary, manifest);
    this.registry.set(VERIFIED_DEALS_REGISTRY_KEY, catalog);

    prepareCardBack(this, getTheme(resolveThemeId(import.meta.env.DEV ? window.location.search : '')));
    this.scene.start('GameScene');
  }

  private loadThemeAsset(asset: ThemeAssetRef): void {
    this.load.image(asset.key, asset.url);
  }
}
