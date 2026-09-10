import { createDealForMode } from './deal.ts';
import { SolitaireGame } from './SolitaireGame.ts';
import type { CardSource, Deal, Suit } from './types.ts';

export type DealProofSource =
  | { readonly zone: 'tableau'; readonly pile: number }
  | { readonly zone: 'waste' }
  | { readonly zone: 'free' };

export type DealProofAction =
  | { readonly kind: 'draw'; readonly cardIds: readonly string[] }
  | { readonly kind: 'tableau-to-tableau'; readonly sourcePile: number; readonly startCardId: string; readonly destinationPile: number }
  | { readonly kind: 'waste-to-tableau'; readonly cardId: string; readonly destinationPile: number }
  | { readonly kind: 'free-to-tableau'; readonly cardId: string; readonly destinationPile: number }
  | { readonly kind: 'to-free'; readonly source: Exclude<DealProofSource, { readonly zone: 'free' }>; readonly cardId: string }
  | { readonly kind: 'to-foundation'; readonly source: DealProofSource; readonly cardId: string; readonly suit: Suit; readonly automatic?: true };

export interface DealProofVerification {
  readonly seed: bigint;
  readonly actionCount: number;
  readonly foundationCount: number;
}

function fail(seed: bigint, actionIndex: number, kind: string, message: string): never {
  throw new Error(`seed=${seed.toString()} action=${actionIndex} kind=${kind}: ${message}`);
}

function tableauSource(
  game: SolitaireGame,
  pileIndex: number,
  cardId: string,
  seed: bigint,
  actionIndex: number,
  kind: string,
): CardSource {
  const pile = game.tableau[pileIndex];
  if (pile === undefined) {
    fail(seed, actionIndex, kind, `tableau pile ${pileIndex} does not exist`);
  }

  const index = pile.findIndex((card) => card.id === cardId);
  if (index < 0) {
    fail(seed, actionIndex, kind, `card ${cardId} is not in tableau pile ${pileIndex}`);
  }

  return { zone: 'tableau', pile: pileIndex, index };
}

function exposedSource(
  game: SolitaireGame,
  source: DealProofSource,
  cardId: string,
  seed: bigint,
  actionIndex: number,
  kind: string,
): CardSource {
  if (source.zone === 'tableau') {
    return tableauSource(game, source.pile, cardId, seed, actionIndex, kind);
  }

  if (source.zone === 'waste') {
    const exposed = game.waste.at(-1);
    if (exposed?.id !== cardId) {
      fail(seed, actionIndex, kind, `expected exposed waste card ${cardId}, got ${exposed?.id ?? 'none'}`);
    }
    return { zone: 'waste' };
  }

  if (game.freeCell?.id !== cardId) {
    fail(seed, actionIndex, kind, `expected free-cell card ${cardId}, got ${game.freeCell?.id ?? 'none'}`);
  }
  return { zone: 'free' };
}

function allCardIds(game: SolitaireGame): string[] {
  return [
    ...game.tableau.flat(),
    ...game.stock,
    ...game.waste,
    ...(game.freeCell === null ? [] : [game.freeCell]),
    ...Object.values(game.foundations).flat(),
  ].map((card) => card.id);
}

function assertDeckIntegrity(game: SolitaireGame, seed: bigint, actionIndex: number, kind: string): void {
  const ids = allCardIds(game);
  const unique = new Set(ids);

  if (ids.length !== 52 || unique.size !== 52) {
    fail(seed, actionIndex, kind, `expected 52 unique card IDs after action, got ${ids.length} cards / ${unique.size} unique`);
  }
}

function replayAction(game: SolitaireGame, action: DealProofAction, actionIndex: number): void {
  const seed = game.seed;
  const kind = action.kind;

  if (kind === 'draw') {
    const actual = game.draw().map((card) => card.id);
    if (
      actual.length !== action.cardIds.length
      || actual.some((cardId, index) => cardId !== action.cardIds[index])
    ) {
      fail(seed, actionIndex, kind, `draw mismatch: expected [${action.cardIds.join(',')}], got [${actual.join(',')}]`);
    }
    return;
  }

  if (kind === 'tableau-to-tableau') {
    const source = tableauSource(game, action.sourcePile, action.startCardId, seed, actionIndex, kind);
    if (!game.move(source, { zone: 'tableau', pile: action.destinationPile })) {
      fail(seed, actionIndex, kind, `move ${action.startCardId} from tableau ${action.sourcePile} to tableau ${action.destinationPile} was rejected`);
    }
    return;
  }

  if (kind === 'waste-to-tableau') {
    const source = exposedSource(game, { zone: 'waste' }, action.cardId, seed, actionIndex, kind);
    if (!game.move(source, { zone: 'tableau', pile: action.destinationPile })) {
      fail(seed, actionIndex, kind, `move ${action.cardId} from waste to tableau ${action.destinationPile} was rejected`);
    }
    return;
  }

  if (kind === 'free-to-tableau') {
    const source = exposedSource(game, { zone: 'free' }, action.cardId, seed, actionIndex, kind);
    if (!game.move(source, { zone: 'tableau', pile: action.destinationPile })) {
      fail(seed, actionIndex, kind, `move ${action.cardId} from free cell to tableau ${action.destinationPile} was rejected`);
    }
    return;
  }

  if (kind === 'to-free') {
    const source = exposedSource(game, action.source, action.cardId, seed, actionIndex, kind);
    if (!game.move(source, { zone: 'free' })) {
      fail(seed, actionIndex, kind, `move ${action.cardId} to free cell was rejected`);
    }
    return;
  }

  const source = exposedSource(game, action.source, action.cardId, seed, actionIndex, kind);
  if (!game.move(source, { zone: 'foundation', suit: action.suit })) {
    fail(seed, actionIndex, kind, `move ${action.cardId} to ${action.suit} foundation was rejected`);
  }
}

export function replayDealProof(
  deal: Deal,
  actions: readonly DealProofAction[],
): DealProofVerification {
  const game = new SolitaireGame(deal);

  actions.forEach((action, actionIndex) => {
    try {
      replayAction(game, action, actionIndex);
      assertDeckIntegrity(game, game.seed, actionIndex, action.kind);
    } catch (error) {
      if (error instanceof Error && /seed=.*action=/u.test(error.message)) {
        throw error;
      }
      fail(
        game.seed,
        actionIndex,
        action.kind,
        error instanceof Error ? error.message : String(error),
      );
    }
  });

  const finalActionIndex = Math.max(0, actions.length - 1);
  if (!game.isWon || game.foundationCount !== 52) {
    fail(game.seed, finalActionIndex, 'complete', `proof ended before victory at foundationCount=${game.foundationCount}`);
  }

  return {
    seed: game.seed,
    actionCount: actions.length,
    foundationCount: game.foundationCount,
  };
}

export function verifySeedProof(
  seed: bigint,
  actions: readonly DealProofAction[],
): DealProofVerification {
  return replayDealProof(createDealForMode('winnable', seed), actions);
}
