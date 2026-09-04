import test from 'node:test';
import assert from 'node:assert/strict';

import { createCard } from '../src/game/model/cards.ts';
import { createOriginalDeal } from '../src/game/model/deal.ts';
import { SolitaireGame } from '../src/game/model/SolitaireGame.ts';
import {
  activeGameSaveToDeal,
  createActiveGameSave,
  normalizeActiveGameSave,
  type ActiveGameSaveV1,
} from '../src/persistence/ActiveGameSave.ts';

function createValidSave(mode: 'original' | 'winnable' | 'daily' = 'winnable'): ActiveGameSaveV1 {
  const seed = 123456789n;
  const deal = createOriginalDeal(seed, mode);
  const snapshot = new SolitaireGame(deal).snapshot();

  return createActiveGameSave({
    mode,
    seed,
    snapshot,
    attemptStarted: true,
    elapsedMs: 12_345,
    ...(mode === 'daily'
      ? { daily: { dailyId: '2026-09-04', algorithmVersion: 1 } }
      : {}),
    uiState: 'playing',
  });
}

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function clone<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>;
}

test('active game save survives JSON round-trip and converts back to a Deal', () => {
  const save = createValidSave();
  const normalized = normalizeActiveGameSave(clone(save));

  assert.notEqual(normalized, null);
  assert.equal(normalized?.seed, '123456789');
  assert.deepEqual(
    normalized?.snapshot.stock.map((card) => card.id),
    save.snapshot.stock.map((card) => card.id),
  );

  const deal = activeGameSaveToDeal(normalized!);
  assert.equal(deal.seed, 123456789n);
  assert.equal(deal.mode, 'winnable');
  assert.deepEqual(deal.tableau, normalized?.snapshot.tableau);
  assert.deepEqual(deal.stock, normalized?.snapshot.stock);
  assert.deepEqual(deal.waste, normalized?.snapshot.waste);
  assert.deepEqual(deal.foundations, normalized?.snapshot.foundations);
  assert.deepEqual(deal.freeCell, normalized?.snapshot.freeCell);
});

test('active game save preserves Daily identity and menu-paused UI state', () => {
  const raw = clone(createValidSave('daily'));
  raw.uiState = 'menu-paused';

  const normalized = normalizeActiveGameSave(raw);

  assert.deepEqual(normalized?.daily, {
    dailyId: '2026-09-04',
    algorithmVersion: 1,
  });
  assert.equal(normalized?.uiState, 'menu-paused');
});

test('active game normalization rejects invalid top-level fields', () => {
  const valid = createValidSave();

  const cases: unknown[] = [
    { ...clone(valid), version: 2 },
    { ...clone(valid), mode: 'arcade' },
    { ...clone(valid), seed: '0' },
    { ...clone(valid), seed: 'not-a-seed' },
    { ...clone(valid), seed: '0x10' },
    { ...clone(valid), elapsedMs: -1 },
    { ...clone(valid), elapsedMs: Number.NaN },
    { ...clone(valid), attemptStarted: 'yes' },
    { ...clone(valid), uiState: 'overlay' },
  ];

  for (const raw of cases) {
    assert.equal(normalizeActiveGameSave(raw), null);
  }
});

test('active game normalization requires exactly seven tableau piles and every foundation suit', () => {
  const tooFewTableau = clone(createValidSave());
  tooFewTableau.snapshot.tableau = tooFewTableau.snapshot.tableau.slice(0, 6);

  const missingFoundation = clone(createValidSave()) as unknown as {
    snapshot: { foundations: Record<string, unknown> };
  };
  delete missingFoundation.snapshot.foundations.spades;

  const extraFoundation = clone(createValidSave()) as unknown as {
    snapshot: { foundations: Record<string, unknown> };
  };
  extraFoundation.snapshot.foundations.jokers = [];

  assert.equal(normalizeActiveGameSave(tooFewTableau), null);
  assert.equal(normalizeActiveGameSave(missingFoundation), null);
  assert.equal(normalizeActiveGameSave(extraFoundation), null);
});

test('active game normalization rejects malformed non-canonical cards', () => {
  const invalidRank = clone(createValidSave());
  invalidRank.snapshot.stock[0] = {
    ...invalidRank.snapshot.stock[0],
    rank: 14,
  };

  const invalidSuit = clone(createValidSave()) as unknown as {
    snapshot: { stock: Array<Record<string, unknown>> };
  };
  invalidSuit.snapshot.stock[0] = {
    ...invalidSuit.snapshot.stock[0],
    suit: 'stars',
  };

  const invalidId = clone(createValidSave());
  invalidId.snapshot.stock[0] = {
    ...invalidId.snapshot.stock[0],
    id: 'wrong-id',
  };

  const invalidColor = clone(createValidSave());
  invalidColor.snapshot.stock[0] = {
    ...invalidColor.snapshot.stock[0],
    color: invalidColor.snapshot.stock[0].color === 'red' ? 'black' : 'red',
  };

  for (const raw of [invalidRank, invalidSuit, invalidId, invalidColor]) {
    assert.equal(normalizeActiveGameSave(raw), null);
  }
});

test('active game normalization rejects duplicate cards and non-52-card snapshots', () => {
  const duplicate = clone(createValidSave());
  duplicate.snapshot.stock[0] = clone(duplicate.snapshot.tableau[0][0]);

  const missingCard = clone(createValidSave());
  missingCard.snapshot.stock = missingCard.snapshot.stock.slice(1);

  assert.equal(normalizeActiveGameSave(duplicate), null);
  assert.equal(normalizeActiveGameSave(missingCard), null);
});

test('active game normalization enforces Daily metadata only for Daily mode', () => {
  const ordinaryWithDaily = clone(createValidSave());
  ordinaryWithDaily.daily = {
    dailyId: '2026-09-04',
    algorithmVersion: 1,
  };

  const dailyWithoutMetadata = clone(createValidSave('daily')) as Partial<ActiveGameSaveV1>;
  delete dailyWithoutMetadata.daily;

  const badDailyId = clone(createValidSave('daily'));
  badDailyId.daily!.dailyId = '04-09-2026';

  const badAlgorithmVersion = clone(createValidSave('daily'));
  badAlgorithmVersion.daily!.algorithmVersion = 0;

  assert.equal(normalizeActiveGameSave(ordinaryWithDaily), null);
  assert.equal(normalizeActiveGameSave(dailyWithoutMetadata), null);
  assert.equal(normalizeActiveGameSave(badDailyId), null);
  assert.equal(normalizeActiveGameSave(badAlgorithmVersion), null);
});

test('normalization rebuilds canonical immutable cards rather than trusting persisted objects', () => {
  const save = createValidSave();
  const normalized = normalizeActiveGameSave(clone(save));
  const stockCard = normalized?.snapshot.stock[0];

  assert.notEqual(stockCard, undefined);
  assert.deepEqual(stockCard, createCard(stockCard!.suit, stockCard!.rank));
  assert.equal(Object.isFrozen(stockCard), true);
});
