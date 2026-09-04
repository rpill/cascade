import { createCard } from '../game/model/cards.ts';
import {
  SUITS,
  type Card,
  type Deal,
  type Foundations,
  type GameMode,
  type SolitaireSnapshot,
  type Suit,
} from '../game/model/types.ts';

export const ACTIVE_GAME_SAVE_VERSION = 1 as const;

export interface ActiveGameSaveV1 {
  version: 1;
  mode: GameMode;
  seed: string;
  snapshot: SolitaireSnapshot;
  attemptStarted: boolean;
  elapsedMs: number;
  daily?: {
    dailyId: string;
    algorithmVersion: number;
  };
  uiState: 'playing' | 'menu-paused';
}

export interface ActiveGameCheckpointInput {
  mode: GameMode;
  seed: bigint;
  snapshot: SolitaireSnapshot;
  attemptStarted: boolean;
  elapsedMs: number;
  daily?: ActiveGameSaveV1['daily'];
  uiState: ActiveGameSaveV1['uiState'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'original' || value === 'winnable' || value === 'daily';
}

function isSuit(value: unknown): value is Suit {
  return typeof value === 'string' && SUITS.includes(value as Suit);
}

function normalizeSeed(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value) > 0n ? value : null;
  } catch {
    return null;
  }
}

function normalizeCard(value: unknown): Card | null {
  if (!isRecord(value) || !isSuit(value.suit) || !Number.isInteger(value.rank)) {
    return null;
  }

  let canonical: Card;

  try {
    canonical = createCard(value.suit, value.rank as number);
  } catch {
    return null;
  }

  if (value.id !== canonical.id || value.color !== canonical.color) {
    return null;
  }

  return canonical;
}

function normalizeCardArray(value: unknown): Card[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cards: Card[] = [];

  for (const rawCard of value) {
    const card = normalizeCard(rawCard);

    if (card === null) {
      return null;
    }

    cards.push(card);
  }

  return cards;
}

function normalizeFoundations(value: unknown): Foundations | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);

  if (keys.length !== SUITS.length || keys.some((key) => !isSuit(key))) {
    return null;
  }

  const foundations = {} as Foundations;

  for (const suit of SUITS) {
    const cards = normalizeCardArray(value[suit]);

    if (cards === null) {
      return null;
    }

    foundations[suit] = cards;
  }

  return foundations;
}

function normalizeSnapshot(value: unknown): SolitaireSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.tableau) || value.tableau.length !== 7) {
    return null;
  }

  const tableau: Card[][] = [];

  for (const rawPile of value.tableau) {
    const pile = normalizeCardArray(rawPile);

    if (pile === null) {
      return null;
    }

    tableau.push(pile);
  }

  const stock = normalizeCardArray(value.stock);
  const waste = normalizeCardArray(value.waste);
  const foundations = normalizeFoundations(value.foundations);
  const freeCell = value.freeCell === null ? null : normalizeCard(value.freeCell);

  if (stock === null || waste === null || foundations === null || freeCell === null && value.freeCell !== null) {
    return null;
  }

  const allCards = [
    ...tableau.flat(),
    ...stock,
    ...waste,
    ...SUITS.flatMap((suit) => foundations[suit]),
    ...(freeCell === null ? [] : [freeCell]),
  ];
  const ids = new Set(allCards.map((card) => card.id));

  if (allCards.length !== 52 || ids.size !== 52) {
    return null;
  }

  return {
    tableau,
    stock,
    waste,
    foundations,
    freeCell,
  };
}

function normalizeDailyMetadata(
  mode: GameMode,
  value: unknown,
): ActiveGameSaveV1['daily'] | null | undefined {
  if (mode !== 'daily') {
    return value === undefined ? undefined : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.dailyId !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.dailyId)
    || !Number.isInteger(value.algorithmVersion)
    || (value.algorithmVersion as number) <= 0
  ) {
    return null;
  }

  return {
    dailyId: value.dailyId,
    algorithmVersion: value.algorithmVersion as number,
  };
}

export function normalizeActiveGameSave(raw: unknown): ActiveGameSaveV1 | null {
  if (!isRecord(raw) || raw.version !== ACTIVE_GAME_SAVE_VERSION || !isGameMode(raw.mode)) {
    return null;
  }

  const seed = normalizeSeed(raw.seed);
  const snapshot = normalizeSnapshot(raw.snapshot);
  const daily = normalizeDailyMetadata(raw.mode, raw.daily);

  if (
    seed === null
    || snapshot === null
    || typeof raw.attemptStarted !== 'boolean'
    || typeof raw.elapsedMs !== 'number'
    || !Number.isFinite(raw.elapsedMs)
    || raw.elapsedMs < 0
    || (raw.uiState !== 'playing' && raw.uiState !== 'menu-paused')
    || daily === null
  ) {
    return null;
  }

  return {
    version: ACTIVE_GAME_SAVE_VERSION,
    mode: raw.mode,
    seed,
    snapshot,
    attemptStarted: raw.attemptStarted,
    elapsedMs: raw.elapsedMs,
    ...(daily === undefined ? {} : { daily }),
    uiState: raw.uiState,
  };
}

export function createActiveGameSave(
  input: ActiveGameCheckpointInput,
): ActiveGameSaveV1 {
  const normalized = normalizeActiveGameSave({
    version: ACTIVE_GAME_SAVE_VERSION,
    mode: input.mode,
    seed: input.seed.toString(),
    snapshot: input.snapshot,
    attemptStarted: input.attemptStarted,
    elapsedMs: input.elapsedMs,
    ...(input.daily === undefined ? {} : { daily: input.daily }),
    uiState: input.uiState,
  });

  if (normalized === null) {
    throw new Error('Cannot create an invalid active game checkpoint.');
  }

  return normalized;
}

export function activeGameSaveToDeal(save: ActiveGameSaveV1): Deal {
  const foundations = Object.fromEntries(
    SUITS.map((suit) => [suit, [...save.snapshot.foundations[suit]]]),
  ) as Foundations;

  return {
    seed: BigInt(save.seed),
    mode: save.mode,
    tableau: save.snapshot.tableau.map((pile) => [...pile]),
    stock: [...save.snapshot.stock],
    waste: [...save.snapshot.waste],
    foundations,
    freeCell: save.snapshot.freeCell,
  };
}
