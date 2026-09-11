const CARDS_PER_LAYER = 5;
const FULL_DECK_SIZE = 52;
const STANDARD_LAYER_GAP = 3;
const COMPACT_LAYER_GAP = 1;

type StockLayoutProfile = 'standard' | 'compact-landscape';

export const MAX_STOCK_LAYERS = Math.ceil(
  FULL_DECK_SIZE / CARDS_PER_LAYER,
);

export class StockVisualState {
  private visibleCardCount: number;

  constructor(stockCards: number, pendingDealCards = 0) {
    this.visibleCardCount = Math.max(
      0,
      stockCards + pendingDealCards,
    );
  }

  get cardCount(): number {
    return this.visibleCardCount;
  }

  get layerCount(): number {
    if (this.visibleCardCount === 0) {
      return 0;
    }

    return Math.min(
      MAX_STOCK_LAYERS,
      Math.ceil(this.visibleCardCount / CARDS_PER_LAYER),
    );
  }

  get layerOffsets(): readonly number[] {
    return this.getLayerOffsets('standard');
  }

  getLayerOffsets(profile: StockLayoutProfile): readonly number[] {
    const layerGap = profile === 'compact-landscape'
      ? COMPACT_LAYER_GAP
      : STANDARD_LAYER_GAP;

    return Array.from(
      { length: this.layerCount },
      (_, index) => 0 - index * layerGap,
    );
  }

  removeDealtCard(): void {
    this.visibleCardCount = Math.max(
      0,
      this.visibleCardCount - 1,
    );
  }

  sync(cardCount: number): void {
    this.visibleCardCount = Math.max(0, cardCount);
  }
}
