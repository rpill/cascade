import Phaser from 'phaser';

import { SolitaireGame } from '../model/SolitaireGame.ts';
import { getTableauDealSequence } from '../model/deal.ts';
import {
  SUITS,
  type Card,
  type CardSource,
  type MoveTarget,
} from '../model/types.ts';
import {
  tableauCardY,
  wasteCardX,
  type Point,
} from './layout.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { TableAppearanceView } from './TableAppearanceView.ts';
import { STOCK_EDGE_ASSET } from '../../theme/ThemeAssets.ts';
import { CARD_BACK_ART_FRAME } from '../../theme/CardBackTexture.ts';
import {
  getCardMotionDuration,
  getFoundationStepDelay,
  getStockFlightOriginY,
  type CardMotionKind,
} from './CardAnimation.ts';
import { getCardDepthTransition } from './CardMotionDepth.ts';
import { getCardFlightPoint } from './CardFlight.ts';
import { isCommittedCardDrop } from './DropGeometry.ts';
import {
  MAX_STOCK_LAYERS,
  StockVisualState,
} from './StockVisualState.ts';

interface BoardActions {
  readonly draw: () => Card[];
  readonly move: (source: CardSource, target: MoveTarget) => boolean;
  readonly autoFoundation: (source: CardSource) => boolean;
  readonly autoFoundationStep: () => Card | null;
  readonly settled: () => void;
  readonly undo: () => boolean;
}

interface Placement extends Point {
  readonly depth: number;
  readonly source?: CardSource;
}

interface DraggedCard {
  readonly image: Phaser.GameObjects.Image;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface DragState {
  readonly source: CardSource;
  readonly cards: DraggedCard[];
}

const STOCK_DEAL_STAGGER = 52;
const STOCK_DRAW_STAGGER = 80;

export class BoardView {
  private readonly scene: Phaser.Scene;
  private readonly game: SolitaireGame;
  private readonly actions: BoardActions;
  private theme: ThemeDefinition;
  private readonly cardImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly stockBacks: Phaser.GameObjects.Image[] = [];
  private readonly ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly activeFlights = new Map<
    Phaser.GameObjects.Image,
    Phaser.Tweens.Tween
  >();
  private readonly stockVisual: StockVisualState;
  private layout: ViewportLayout;
  private readonly appearance: TableAppearanceView;

  private dragState: DragState | null = null;
  private inputLocked = true;
  private uiPaused = false;
  private lastTap: { cardId: string; time: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    game: SolitaireGame,
    actions: BoardActions,
    layout: ViewportLayout,
    theme: ThemeDefinition,
  ) {
    this.scene = scene;
    this.game = game;
    this.actions = actions;
    this.layout = layout;
    this.theme = theme;
    this.stockVisual = new StockVisualState(game.stock.length);

    this.appearance = new TableAppearanceView(scene, theme, layout);
    this.createCardImages();
    this.createStockStack();
    this.relayout(layout);
  }

  setUiPaused(paused: boolean): void {
    this.uiPaused = paused;

    if (paused) {
      this.lastTap = null;
    }
  }

  showRestoredState(): void {
    this.activeFlights.forEach((flight) => flight.stop());
    this.activeFlights.clear();
    this.dragState = null;
    this.stockVisual.sync(this.game.stock.length);
    this.inputLocked = false;
    this.sync(null);
  }

  playInitialDeal(): void {
    this.inputLocked = true;
    this.cardImages.forEach((image) => image.setVisible(false));

    const sequence = getTableauDealSequence(this.game.tableau);
    this.stockVisual.sync(this.game.stock.length + sequence.length);
    this.updateStockStack();

    sequence.forEach((card, index) => {
      const image = this.cardImages.get(card.id);

      if (image === undefined) {
        return;
      }

      image
        .setDepth(900 + index)
        .setVisible(false);

      const timer = this.scene.time.delayedCall(index * STOCK_DEAL_STAGGER, () => {
        const target = this.calculatePlacements().get(card.id);

        if (target === undefined) {
          return;
        }

        const stockOriginY = getStockFlightOriginY(
          this.layout.stock.y,
          this.stockVisual.layerOffsets,
        );

        this.stockVisual.removeDealtCard();
        this.updateStockStack();
        image
          .setPosition(this.layout.stock.x, stockOriginY)
          .setVisible(true);
        this.animateCardTo(image, target, 'stock');
      });

      this.timers.push(timer);
    });

    const finishTimer = this.scene.time.delayedCall(
      sequence.length * STOCK_DEAL_STAGGER
        + getCardMotionDuration('stock')
        + 20,
      () => {
        this.stockVisual.sync(this.game.stock.length);
        this.sync(null);
        this.scheduleAutoFoundationStep(0);
      },
    );

    this.timers.push(finishTimer);
  }

  relayout(layout: ViewportLayout): void {
    this.activeFlights.forEach((flight) => flight.stop());
    this.activeFlights.clear();
    this.dragState = null;
    this.layout = layout;

    this.appearance.relayout(layout);

    this.cardImages.forEach((image) => {
      image.setDisplaySize(layout.cardWidth, layout.cardHeight);
    });
    this.stockBacks.forEach((back) => {
      back.setDisplaySize(layout.cardWidth, layout.cardHeight);
    });

    this.sync(null);
  }

  destroy(): void {
    this.timers.forEach((timer) => timer.remove(false));
    this.activeFlights.forEach((flight) => flight.stop());
    this.activeFlights.clear();
    this.appearance.destroy();
    this.ownedObjects.forEach((object) => object.destroy());
    this.cardImages.clear();
  }

  setTheme(theme: ThemeDefinition): void {
    this.theme = theme;
    this.appearance.setTheme(theme, this.layout);
    this.updateStockStack();
  }

  private createCardImages(): void {
    const allCards = [
      ...this.game.tableau.flat(),
      ...this.game.stock,
      ...this.game.waste,
      ...SUITS.flatMap((suit) => this.game.foundations[suit]),
      ...(this.game.freeCell === null ? [] : [this.game.freeCell]),
    ];

    allCards.forEach((card) => {
      const image = this.scene.add.image(0, 0, card.id)
        .setOrigin(0)
        .setDisplaySize(this.layout.cardWidth, this.layout.cardHeight)
        .setVisible(false);

      image.on('pointerdown', () => this.handleCardPointerDown(card));
      image.on('dragstart', () => this.beginDrag(card));
      image.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        this.continueDrag(dragX, dragY);
      });
      image.on('dragend', () => this.endDrag());

      this.cardImages.set(card.id, image);
      this.ownedObjects.push(image);
    });
  }

  private createStockStack(): void {
    for (let index = 0; index < MAX_STOCK_LAYERS; index += 1) {
      const back = this.scene.add.image(this.layout.stock.x, this.layout.stock.y, this.theme.cardBack.key)
        .setOrigin(0)
        .setDisplaySize(this.layout.cardWidth, this.layout.cardHeight)
        .setVisible(false)
        .setDepth(50 + index);

      back.on('pointerdown', () => this.handleStockClick());

      this.stockBacks.push(back);
      this.ownedObjects.push(back);
    }
  }

  private updateStockStack(): void {
    const offsets = this.stockVisual.layerOffsets;

    this.stockBacks.forEach((back, index) => {
      const offset = offsets[index];
      const visible = offset !== undefined;
      const top = index === offsets.length - 1;

      back
        .setTexture(top ? this.theme.cardBack.key : STOCK_EDGE_ASSET.key,
          top && this.theme.cardBack.crop !== undefined ? CARD_BACK_ART_FRAME : undefined)
        .setDisplaySize(this.layout.cardWidth, this.layout.cardHeight)
        .setVisible(visible)
        .setPosition(this.layout.stock.x, this.layout.stock.y + (offset ?? 0))
        .setDepth(50 + index);

      if (visible) {
        back.setInteractive({ useHandCursor: true });
      } else {
        back.disableInteractive();
      }
    });
  }

  requestUndo(): void {
    if (this.inputLocked || !this.actions.undo()) {
      return;
    }

    this.inputLocked = true;
    this.stockVisual.sync(this.game.stock.length);
    this.sync('undo');

    const timer = this.scene.time.delayedCall(
      getCardMotionDuration('undo') + 20,
      () => {
        this.inputLocked = false;
        this.sync(null);
        this.actions.settled();
      },
    );

    this.timers.push(timer);
  }

  private handleStockClick(): void {
    if (this.inputLocked || this.uiPaused) {
      return;
    }

    const drawn = this.actions.draw();

    if (drawn.length === 0) {
      return;
    }

    this.animateDraw(drawn);
  }

  private animateDraw(drawn: readonly Card[]): void {
    this.inputLocked = true;
    const stockOriginY = getStockFlightOriginY(
      this.layout.stock.y,
      this.stockVisual.layerOffsets,
    );

    this.stockVisual.sync(this.game.stock.length);
    this.updateStockStack();

    const placements = this.calculatePlacements();
    const drawnIds = new Set(drawn.map((card) => card.id));

    this.sync('player', drawnIds);

    drawn.forEach((card, index) => {
      const image = this.cardImages.get(card.id);
      const target = placements.get(card.id);

      if (image === undefined || target === undefined) {
        return;
      }

      image
        .setVisible(true)
        .setPosition(this.layout.stock.x, stockOriginY)
        .setDepth(1200 + index);

      this.animateCardTo(
        image,
        target,
        'stock',
        index * STOCK_DRAW_STAGGER,
      );
    });

    const timer = this.scene.time.delayedCall(
      drawn.length * STOCK_DRAW_STAGGER
        + getCardMotionDuration('stock')
        + 20,
      () => {
        this.sync(null);
        this.scheduleAutoFoundationStep(0);
      },
    );

    this.timers.push(timer);
  }

  private handleCardPointerDown(card: Card): void {
    if (this.inputLocked || this.uiPaused) {
      return;
    }

    const source = this.findSource(card.id);

    if (source === null) {
      return;
    }

    const now = this.scene.time.now;
    const isDoubleTap = this.lastTap?.cardId === card.id
      && now - this.lastTap.time < 300;

    this.lastTap = { cardId: card.id, time: now };

    if (isDoubleTap && this.actions.autoFoundation(source)) {
      this.finishMoveWithAutoFoundation('foundation');
    }
  }

  private beginDrag(card: Card): void {
    if (this.inputLocked || this.uiPaused) {
      return;
    }

    const source = this.findSource(card.id);

    if (source === null) {
      return;
    }

    const cards = this.game.cardsFromSource(source);
    const root = this.cardImages.get(card.id);

    if (root === undefined || cards.length === 0) {
      return;
    }

    this.dragState = {
      source,
      cards: cards.flatMap((movingCard, index) => {
        const image = this.cardImages.get(movingCard.id);

        if (image === undefined) {
          return [];
        }

        image.setDepth(3000 + index);

        return [{
          image,
          offsetX: image.x - root.x,
          offsetY: image.y - root.y,
        }];
      }),
    };
  }

  private continueDrag(x: number, y: number): void {
    this.dragState?.cards.forEach((card) => {
      card.image.setPosition(x + card.offsetX, y + card.offsetY);
    });
  }

  private endDrag(): void {
    const dragState = this.dragState;
    this.dragState = null;

    if (dragState === null) {
      return;
    }

    const root = dragState.cards[0]?.image;
    const target = root === undefined
      ? null
      : this.findDropTarget(dragState.source, root);

    if (target !== null && this.actions.move(dragState.source, target)) {
      this.finishMoveWithAutoFoundation('player', false);
      return;
    }

    this.sync(null);
  }

  private finishMoveWithAutoFoundation(
    initialMotion: 'foundation' | 'player',
    animateInitialMove = true,
  ): void {
    this.inputLocked = true;
    this.sync(animateInitialMove ? initialMotion : null);
    this.scheduleAutoFoundationStep(
      initialMotion === 'foundation'
        ? getFoundationStepDelay()
        : getCardMotionDuration('player') + 20,
    );
  }

  private scheduleAutoFoundationStep(delay: number): void {
    const timer = this.scene.time.delayedCall(delay, () => {
      const movedCard = this.actions.autoFoundationStep();

      if (movedCard === null) {
        this.inputLocked = false;
        this.sync(null);
        return;
      }

      this.sync('foundation');
      this.scheduleAutoFoundationStep(getFoundationStepDelay());
    });

    this.timers.push(timer);
  }

  private findDropTarget(
    source: CardSource,
    image: Phaser.GameObjects.Image,
  ): MoveTarget | null {
    const movingBounds = new Phaser.Geom.Rectangle(
      image.x,
      image.y,
      this.layout.cardWidth,
      this.layout.cardHeight,
    );

    const candidates: Array<{ target: MoveTarget; bounds: Phaser.Geom.Rectangle; center: Point }> = [
      ...this.layout.tableauX.map((x, pile) => {
        const cards = this.game.tableau[pile];
        const y = cards.length === 0
          ? this.layout.tableauY
          : tableauCardY(this.layout, cards.length, cards.length - 1);

        return {
          target: { zone: 'tableau', pile } as const,
          bounds: new Phaser.Geom.Rectangle(x, y, this.layout.cardWidth, this.layout.cardHeight),
          center: { x: x + this.layout.cardWidth / 2, y: y + this.layout.cardHeight / 2 },
        };
      }),
      ...SUITS.map((suit, index) => {
        const point = this.layout.foundations[index];
        return {
          target: { zone: 'foundation', suit } as const,
          bounds: new Phaser.Geom.Rectangle(
            point.x,
            point.y,
            this.layout.cardWidth,
            this.layout.cardHeight,
          ),
          center: {
            x: point.x + this.layout.cardWidth / 2,
            y: point.y + this.layout.cardHeight / 2,
          },
        };
      }),
      {
        target: { zone: 'free' } as const,
        bounds: new Phaser.Geom.Rectangle(this.layout.stock.x, this.layout.stock.y, this.layout.cardWidth, this.layout.cardHeight),
        center: { x: this.layout.stock.x + this.layout.cardWidth / 2, y: this.layout.stock.y + this.layout.cardHeight / 2 },
      },
    ];

    const centerX = image.x + this.layout.cardWidth / 2;
    const centerY = image.y + this.layout.cardHeight / 2;

    return candidates
      .filter((candidate) =>
        isCommittedCardDrop(movingBounds, candidate.bounds)
        && this.game.canMove(source, candidate.target),
      )
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Squared(centerX, centerY, left.center.x, left.center.y);
        const rightDistance = Phaser.Math.Distance.Squared(centerX, centerY, right.center.x, right.center.y);
        return leftDistance - rightDistance;
      })[0]?.target ?? null;
  }

  private sync(
    motion: CardMotionKind | null,
    skippedIds = new Set<string>(),
  ): void {
    const placements = this.calculatePlacements();
    const animated = motion !== null;

    this.cardImages.forEach((image, id) => {
      const placement = placements.get(id);

      image.disableInteractive();

      if (placement === undefined) {
        image.setVisible(false);
        return;
      }

      image.setVisible(true);

      if (skippedIds.has(id)) {
        image.setDepth(placement.depth);
        return;
      }

      const positionChanged = Math.abs(image.x - placement.x) > 0.01
        || Math.abs(image.y - placement.y) > 0.01;
      const depth = getCardDepthTransition(
        image.depth,
        placement.depth,
        animated,
        positionChanged,
      );

      image.setDepth(depth.active);

      if (animated && positionChanged) {
        this.animateCardTo(
          image,
          { ...placement, depth: depth.resting },
          motion,
        );
      } else if (!animated) {
        this.stopCardFlight(image);
        image.setPosition(placement.x, placement.y);
      }

      if (!this.inputLocked && placement.source !== undefined) {
        image.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(image, true);
      }
    });

    this.updateStockStack();
  }

  private animateCardTo(
    image: Phaser.GameObjects.Image,
    placement: Placement,
    motion: CardMotionKind,
    delay = 0,
  ): void {
    this.stopCardFlight(image);

    const start = { x: image.x, y: image.y };
    const target = { x: placement.x, y: placement.y };
    let flight!: Phaser.Tweens.Tween;

    flight = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: getCardMotionDuration(motion),
      delay,
      ease: 'Cubic.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const progress = tween.getValue();

        if (progress !== null) {
          const point = getCardFlightPoint(start, target, progress);
          image.setPosition(point.x, point.y);
        }
      },
      onComplete: () => {
        if (this.activeFlights.get(image) === flight) {
          this.activeFlights.delete(image);
        }

        image
          .setPosition(placement.x, placement.y)
          .setDepth(placement.depth);
      },
    });

    this.activeFlights.set(image, flight);
  }

  private stopCardFlight(image: Phaser.GameObjects.Image): void {
    this.activeFlights.get(image)?.stop();
    this.activeFlights.delete(image);
  }

  private calculatePlacements(): Map<string, Placement> {
    const placements = new Map<string, Placement>();

    this.game.tableau.forEach((pile, pileIndex) => {
      pile.forEach((card, cardIndex) => {
        const source = { zone: 'tableau', pile: pileIndex, index: cardIndex } as const;
        const movable = this.game.cardsFromSource(source).length > 0;

        placements.set(card.id, {
          x: this.layout.tableauX[pileIndex],
          y: tableauCardY(this.layout, pile.length, cardIndex),
          depth: 200 + cardIndex,
          source: movable ? source : undefined,
        });
      });
    });

    this.game.waste.forEach((card, index) => {
      const isTop = index === this.game.waste.length - 1;

      placements.set(card.id, {
        x: wasteCardX(this.layout, this.game.waste.length, index),
        y: this.layout.wasteLaneBounds.y,
        depth: 500 + index,
        source: isTop ? { zone: 'waste' } : undefined,
      });
    });

    SUITS.forEach((suit, index) => {
      const point = this.layout.foundations[index];
      this.game.foundations[suit].forEach((card, cardIndex) => {
        placements.set(card.id, {
          x: point.x,
          y: point.y,
          depth: 400 + index * 20 + cardIndex,
        });
      });
    });

    if (this.game.freeCell !== null) {
      placements.set(this.game.freeCell.id, {
        x: this.layout.stock.x,
        y: this.layout.stock.y,
        depth: 600,
        source: { zone: 'free' },
      });
    }

    return placements;
  }

  private findSource(cardId: string): CardSource | null {
    for (let pile = 0; pile < this.game.tableau.length; pile += 1) {
      const index = this.game.tableau[pile].findIndex((card) => card.id === cardId);

      if (index >= 0) {
        const source = { zone: 'tableau', pile, index } as const;
        return this.game.cardsFromSource(source).length > 0 ? source : null;
      }
    }

    if (this.game.waste.at(-1)?.id === cardId) {
      return { zone: 'waste' };
    }

    if (this.game.freeCell?.id === cardId) {
      return { zone: 'free' };
    }

    return null;
  }
}
