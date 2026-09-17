import * as Phaser from 'phaser';

import { SUITS, type Card, type Deal, type Suit } from '../model/types.ts';
import { createDealForMode } from '../model/deal.ts';
import { createCard } from '../model/cards.ts';
import { createRandomDealSeed } from '../model/GameSession.ts';
import { pickStandardDeal, type StandardDealSelection } from '../model/StandardDealPicker.ts';
import { VerifiedDealCatalog } from '../model/VerifiedDealCatalog.ts';
import { preferences } from '../../settings/Preferences.ts';
import { SFX_ASSETS, type SfxAssetGroup } from '../../settings/SfxController.ts';
import { preloadUiAssets } from '../../ui/assets/UiAssets.ts';
import { GAME_APPEARANCE, type GameAssetRef } from '../appearance/GameAppearance.ts';
import { getGameAppearanceAssets } from '../appearance/GameAppearanceAssets.ts';

const SUIT_FILE: Record<Suit, string> = {
  clubs: 'club',
  diamonds: 'diamond',
  hearts: 'heart',
  spades: 'spade',
};

const CARD_ASSET_ROOT = './assets/cards';
const HOW_TO_PLAY_CARDS = [
  createCard('spades', 9),
  createCard('hearts', 8),
  createCard('clubs', 7),
] as const;
export const VERIFIED_DEALS_BINARY_KEY = 'verified-deals-binary';
export const VERIFIED_DEALS_MANIFEST_KEY = 'verified-deals-manifest';
export const VERIFIED_DEALS_REGISTRY_KEY = 'verified-deal-catalog';
export const FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY = 'first-run-standard-selection';

const FACE_FILE: Partial<Record<number, string>> = {
  1: 'Ace',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
};

export interface CardFaceAssetRef {
  readonly key: string;
  readonly url: string;
}

export function getCardFaceAsset(card: Pick<Card, 'id' | 'suit' | 'rank'>): CardFaceAssetRef {
  const fileRank = FACE_FILE[card.rank] ?? String(card.rank);
  const fileName = `${SUIT_FILE[card.suit]}${fileRank}.webp`;
  return {
    key: card.id,
    url: `${CARD_ASSET_ROOT}/${fileName}`,
  };
}

export function getCriticalFirstRunCards(deal: Deal): readonly Card[] {
  return [
    ...deal.tableau.flat(),
    ...deal.stock.slice(-3),
  ];
}

export function getDeferredFirstRunCards(deal: Deal): readonly Card[] {
  const criticalIds = new Set(getCriticalFirstRunCards(deal).map(card => card.id));
  return deal.stock.filter(card => !criticalIds.has(card.id));
}

export function getDeferredFirstRunCardBatches(deal: Deal): readonly (readonly Card[])[] {
  const deferred = deal.stock.slice(0, -3);
  const batches: Card[][] = [];

  for (let end = deferred.length; end > 0; end -= 3) {
    batches.push(deferred.slice(Math.max(0, end - 3), end));
  }

  return batches;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    preloadUiAssets(this);
    const firstRun = !preferences.howToPlaySeen;
    this.load.binary(VERIFIED_DEALS_BINARY_KEY, './assets/deals/verified-deals.bin');
    this.load.json(VERIFIED_DEALS_MANIFEST_KEY, './assets/deals/verified-deals-manifest.json');

    getGameAppearanceAssets(GAME_APPEARANCE).forEach(asset => this.loadGameAppearanceAsset(asset));

    if (firstRun) {
      this.loadSfxGroup(SFX_ASSETS.deal);
      HOW_TO_PLAY_CARDS.forEach((card) => {
        const asset = getCardFaceAsset(card);
        this.load.image(asset.key, asset.url);
      });
    } else {
      Object.values(SFX_ASSETS).forEach(asset => this.loadSfxGroup(asset));
      this.loadAllCardFaces();
    }
  }

  create(): void {
    const binary = this.cache.binary.get(VERIFIED_DEALS_BINARY_KEY) as ArrayBuffer | undefined;
    const manifest = this.cache.json.get(VERIFIED_DEALS_MANIFEST_KEY) as unknown;
    if (!(binary instanceof ArrayBuffer)) {
      throw new Error('Verified deal catalog binary failed to load.');
    }
    const catalog = VerifiedDealCatalog.decode(binary, manifest);
    this.registry.set(VERIFIED_DEALS_REGISTRY_KEY, catalog);


    if (!preferences.howToPlaySeen) {
      this.loadFirstRunCriticalAssets(catalog);
      return;
    }

    this.scene.start('GameScene');
  }

  private loadFirstRunCriticalAssets(catalog: VerifiedDealCatalog): void {
    const selection: StandardDealSelection = pickStandardDeal({
      catalog,
      requestedDifficulty: 'easy',
      onboardingWins: 0,
      completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
      recentSeeds: [],
      randomIndex: (candidateCount) => Number(createRandomDealSeed() % BigInt(candidateCount)),
    });
    const deal = createDealForMode('winnable', selection.seed);
    this.registry.set(FIRST_RUN_STANDARD_SELECTION_REGISTRY_KEY, selection);

    getCriticalFirstRunCards(deal).forEach((card) => {
      if (this.textures.exists(card.id)) return;
      const asset = getCardFaceAsset(card);
      this.load.image(asset.key, asset.url);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.scene.start('GameScene');
    });
    this.load.start();
  }

  private loadAllCardFaces(): void {
    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank += 1) {
        const fileRank = FACE_FILE[rank] ?? String(rank);
        const fileName = `${SUIT_FILE[suit]}${fileRank}.webp`;
        this.load.image(`${suit}-${rank}`, `${CARD_ASSET_ROOT}/${fileName}`);
      }
    });
  }

  private loadSfxGroup(asset: SfxAssetGroup): void {
    asset.keys.forEach((key, index) => this.load.audio(key, asset.urls[index]));
  }

  private loadGameAppearanceAsset(asset: GameAssetRef): void {
    this.load.image(asset.key, asset.url);
  }
}
