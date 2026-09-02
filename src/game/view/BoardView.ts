import Phaser from 'phaser';

import { SolitaireGame } from '../model/SolitaireGame.ts';
import { getTableauDealSequence } from '../model/deal.ts';
import {
  SUITS,
  type Card,
  type CardSource,
  type MoveTarget,
  type Suit,
} from '../model/types.ts';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FOUNDATION_X,
  FOUNDATION_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  STOCK_X,
  STOCK_Y,
  TABLEAU_X,
  TABLEAU_Y,
  WASTE_X,
  tableauCardY,
  wasteCardX,
  type Point,
} from './layout.ts';
import { getBoardTexture } from './BoardTexture.ts';
import {
  getCardMotionDuration,
  getFoundationStepDelay,
  getStockFlightOriginY,
  type CardMotionKind,
} from './CardAnimation.ts';
import { getCardDepthTransition } from './CardMotionDepth.ts';
import {
  MAX_STOCK_LAYERS,
  StockVisualState,
} from './StockVisualState.ts';

interface BoardActions {
  readonly draw: () => Card[];
  readonly move: (source: CardSource, target: MoveTarget) => boolean;
  readonly autoFoundation: (source: CardSource) => boolean;
  readonly autoFoundationStep: () => Card | null;
  readonly restart: () => void;
  readonly newGame: () => void;
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

const FOUNDATION_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const STOCK_DEAL_STAGGER = 52;
const STOCK_DRAW_STAGGER = 80;

export class BoardView {
  private readonly scene: Phaser.Scene;
  private readonly game: SolitaireGame;
  private readonly actions: BoardActions;
  private readonly cardImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly stockBacks: Phaser.GameObjects.Image[] = [];
  private readonly ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly stockVisual: StockVisualState;

  private dragState: DragState | null = null;
  private inputLocked = true;
  private lastTap: { cardId: string; time: number } | null = null;

  constructor(scene: Phaser.Scene, game: SolitaireGame, actions: BoardActions) {
    this.scene = scene;
    this.game = game;
    this.actions = actions;
    this.stockVisual = new StockVisualState(game.stock.length);

    this.createBoardSurface();
    this.createSlots();
    this.createGameButtons();
    this.createCardImages();
    this.createStockStack();
  }

  playInitialDeal(): void {
    this.inputLocked = true;
    this.cardImages.forEach((image) => image.setVisible(false));

    const sequence = getTableauDealSequence(this.game.tableau);
    const placements = this.calculatePlacements();

    this.stockVisual.sync(this.game.stock.length + sequence.length);
    this.updateStockStack();

    sequence.forEach((card, index) => {
      const image = this.cardImages.get(card.id);
      const target = placements.get(card.id);

      if (image === undefined || target === undefined) {
        return;
      }

      image
        .setDepth(900 + index)
        .setVisible(false);

      const timer = this.scene.time.delayedCall(index * STOCK_DEAL_STAGGER, () => {
        const stockOriginY = getStockFlightOriginY(
          STOCK_Y,
          this.stockVisual.layerOffsets,
        );

        this.stockVisual.removeDealtCard();
        this.updateStockStack();
        image
          .setPosition(STOCK_X, stockOriginY)
          .setVisible(true);
        this.scene.tweens.add({
          targets: image,
          x: target.x,
          y: target.y,
          duration: getCardMotionDuration('stock'),
          ease: 'Cubic.easeOut',
        });
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

  destroy(): void {
    this.timers.forEach((timer) => timer.remove(false));
    this.scene.tweens.killTweensOf([...this.cardImages.values()]);
    this.ownedObjects.forEach((object) => object.destroy());
    this.cardImages.clear();
  }

  private createBoardSurface(): void {
    const surface = this.scene.add.image(
      0,
      0,
      getBoardTexture(this.scene),
    ).setOrigin(0).setDepth(0);

    this.ownedObjects.push(surface);
  }

  private createSlots(): void {
    SUITS.forEach((suit, index) => {
      this.createSlot(FOUNDATION_X, FOUNDATION_Y[index]);

      const color = suit === 'diamonds' || suit === 'hearts'
        ? '#8c514a'
        : '#66706e';

      const symbol = this.scene.add.text(
        FOUNDATION_X + CARD_WIDTH / 2,
        FOUNDATION_Y[index] + CARD_HEIGHT / 2,
        FOUNDATION_SYMBOLS[suit],
        {
          color,
          fontFamily: 'Georgia, serif',
          fontSize: '43px',
        },
      ).setOrigin(0.5).setAlpha(0.6).setDepth(10);

      this.ownedObjects.push(symbol);
    });

    this.createSlot(STOCK_X, STOCK_Y);
    this.createSlot(WASTE_X, STOCK_Y, 0.22);

    TABLEAU_X.forEach((x) => this.createSlot(x, TABLEAU_Y, 0.16));

    const freeArrow = this.scene.add.text(
      STOCK_X + CARD_WIDTH / 2,
      STOCK_Y + CARD_HEIGHT / 2,
      '↓',
      {
        color: '#67716f',
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
      },
    ).setOrigin(0.5).setAlpha(0.42).setDepth(10);

    this.ownedObjects.push(freeArrow);
  }

  private createSlot(x: number, y: number, alpha = 0.32): void {
    const slot = this.scene.add.rectangle(
      x + CARD_WIDTH / 2,
      y + CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT,
      0x151b1a,
      alpha,
    ).setStrokeStyle(2, 0x667370, 0.58).setDepth(5);

    this.ownedObjects.push(slot);
  }

  private createGameButtons(): void {
    this.createGameButton(
      GAME_WIDTH - 212,
      144,
      'НОВАЯ ИГРА',
      () => this.actions.newGame(),
    );
    this.createGameButton(
      GAME_WIDTH - 68,
      112,
      'РЕСТАРТ  R',
      () => this.actions.restart(),
    );
  }

  private createGameButton(
    x: number,
    width: number,
    text: string,
    action: () => void,
  ): void {
    const button = this.scene.add.rectangle(x, 24, width, 32, 0xb8473e, 0.96)
      .setStrokeStyle(1, 0xe07a6d, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(2000);

    const label = this.scene.add.text(x, 24, text, {
      color: '#fff4df',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2001);

    button.on('pointerover', () => button.setFillStyle(0xd05a4e));
    button.on('pointerout', () => button.setFillStyle(0xb8473e));
    button.on('pointerdown', action);

    this.ownedObjects.push(button, label);
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
        .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
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
      const back = this.scene.add.image(STOCK_X, STOCK_Y, 'card-back')
        .setOrigin(0)
        .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
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

      back
        .setVisible(visible)
        .setPosition(STOCK_X, STOCK_Y + (offset ?? 0))
        .setDepth(50 + index);

      if (visible) {
        back.setInteractive({ useHandCursor: true });
      } else {
        back.disableInteractive();
      }
    });
  }

  private handleStockClick(): void {
    if (this.inputLocked) {
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
      STOCK_Y,
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
        .setPosition(STOCK_X, stockOriginY)
        .setDepth(1200 + index);

      this.scene.tweens.add({
        targets: image,
        x: target.x,
        y: target.y,
        duration: getCardMotionDuration('stock'),
        delay: index * STOCK_DRAW_STAGGER,
        ease: 'Cubic.easeOut',
      });
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
    if (this.inputLocked) {
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
    if (this.inputLocked) {
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
      this.finishMoveWithAutoFoundation('player');
      return;
    }

    this.sync('player');
  }

  private finishMoveWithAutoFoundation(
    initialMotion: 'foundation' | 'player',
  ): void {
    this.inputLocked = true;
    this.sync(initialMotion);
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
      CARD_WIDTH,
      CARD_HEIGHT,
    );

    const candidates: Array<{ target: MoveTarget; bounds: Phaser.Geom.Rectangle; center: Point }> = [
      ...TABLEAU_X.map((x, pile) => ({
        target: { zone: 'tableau', pile } as const,
        bounds: new Phaser.Geom.Rectangle(x - 18, TABLEAU_Y - 18, CARD_WIDTH + 36, GAME_HEIGHT - TABLEAU_Y + 18),
        center: { x: x + CARD_WIDTH / 2, y: TABLEAU_Y + CARD_HEIGHT / 2 },
      })),
      ...SUITS.map((suit, index) => ({
        target: { zone: 'foundation', suit } as const,
        bounds: new Phaser.Geom.Rectangle(FOUNDATION_X - 14, FOUNDATION_Y[index] - 14, CARD_WIDTH + 28, CARD_HEIGHT + 28),
        center: { x: FOUNDATION_X + CARD_WIDTH / 2, y: FOUNDATION_Y[index] + CARD_HEIGHT / 2 },
      })),
      {
        target: { zone: 'free' } as const,
        bounds: new Phaser.Geom.Rectangle(STOCK_X - 14, STOCK_Y - 14, CARD_WIDTH + 28, CARD_HEIGHT + 28),
        center: { x: STOCK_X + CARD_WIDTH / 2, y: STOCK_Y + CARD_HEIGHT / 2 },
      },
    ];

    const centerX = image.x + CARD_WIDTH / 2;
    const centerY = image.y + CARD_HEIGHT / 2;

    return candidates
      .filter((candidate) =>
        Phaser.Geom.Intersects.RectangleToRectangle(movingBounds, candidate.bounds)
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
        this.scene.tweens.killTweensOf(image);
        this.scene.tweens.add({
          targets: image,
          x: placement.x,
          y: placement.y,
          duration: getCardMotionDuration(motion),
          ease: 'Cubic.easeOut',
          onComplete: () => image.setDepth(depth.resting),
        });
      } else if (!animated) {
        image.setPosition(placement.x, placement.y);
      }

      if (!this.inputLocked && placement.source !== undefined) {
        image.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(image, true);
      }
    });

    this.updateStockStack();
  }

  private calculatePlacements(): Map<string, Placement> {
    const placements = new Map<string, Placement>();

    this.game.tableau.forEach((pile, pileIndex) => {
      pile.forEach((card, cardIndex) => {
        const source = { zone: 'tableau', pile: pileIndex, index: cardIndex } as const;
        const movable = this.game.cardsFromSource(source).length > 0;

        placements.set(card.id, {
          x: TABLEAU_X[pileIndex],
          y: tableauCardY(pile.length, cardIndex),
          depth: 200 + cardIndex,
          source: movable ? source : undefined,
        });
      });
    });

    this.game.waste.forEach((card, index) => {
      const isTop = index === this.game.waste.length - 1;

      placements.set(card.id, {
        x: wasteCardX(this.game.waste.length, index),
        y: STOCK_Y,
        depth: 500 + index,
        source: isTop ? { zone: 'waste' } : undefined,
      });
    });

    SUITS.forEach((suit, index) => {
      const card = this.game.foundations[suit].at(-1);

      if (card !== undefined) {
        placements.set(card.id, {
          x: FOUNDATION_X,
          y: FOUNDATION_Y[index],
          depth: 400 + index,
        });
      }
    });

    if (this.game.freeCell !== null) {
      placements.set(this.game.freeCell.id, {
        x: STOCK_X,
        y: STOCK_Y,
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
