import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultMetaSave,
  normalizeMetaSave,
} from '../src/meta/MetaSave.ts';

test('missing or malformed saves normalize to version 5 defaults', () => {
  const defaults = createDefaultMetaSave();

  assert.equal(defaults.version, 5);
  assert.deepEqual(defaults.standardWinStreak, { current: 0, best: 0 });
  assert.deepEqual(defaults.stats, {
    original: { played: 0, wins: 0 },
    winnable: { played: 0, wins: 0 },
  });
  assert.deepEqual(normalizeMetaSave(null), defaults);
  assert.deepEqual(normalizeMetaSave({ version: 99 }), defaults);
});

test('version 1 save migrates to version 5 without losing persistent meta progress', () => {
  const save = normalizeMetaSave({
    version: 1,
    collection: {
      ownedCardBacks: ['paper', 'paper', 'obsidian'],
      ownedTables: ['wood'],
      ownedThemes: ['classic'],
    },
    equipped: {
      cardBack: 'obsidian',
      table: 'wood',
      theme: 'classic',
    },
    achievements: ['first-win', 'first-win'],
    daily: {
      algorithmVersion: 1,
      records: {
        '2026-09-03': { completed: false, attempts: 2 },
        '2026-09-04': { completed: true, bestTimeMs: 12_345, attempts: 3 },
        broken: { completed: true, bestTimeMs: -5, attempts: -1 },
      },
    },
    weekly: {
      weekId: '2026-W36',
      completedDailyIds: ['2026-09-03', '2026-09-04', '2026-09-04', 'bad'],
      claimedMilestones: [3, 3, 5, 99],
    },
  });

  assert.equal(save.version, 5);
  assert.deepEqual(save.collection, {
    ownedCardBacks: ['paper', 'obsidian'],
    ownedTables: ['wood'],
    ownedThemes: ['walnut_study', 'classic'],
  });
  assert.deepEqual(save.equipped, {
    cardBack: 'obsidian',
    table: 'wood',
    theme: 'walnut_study',
  });
  assert.deepEqual(save.achievements, ['first-win']);
  assert.deepEqual(save.stats, {
    original: { played: 0, wins: 0 },
    winnable: { played: 0, wins: 0 },
  });
  assert.deepEqual(save.daily.records['2026-09-03'], {
    completed: false,
    attempts: 2,
  });
  assert.deepEqual(save.daily.records['2026-09-04'], {
    completed: true,
    bestTimeMs: 12_345,
    attempts: 3,
  });
  assert.equal(save.daily.records.broken, undefined);
  assert.deepEqual(save.weekly, {
    weekId: '2026-W36',
    completedDailyIds: ['2026-09-03', '2026-09-04'],
    claimedMilestones: [3, 5],
  });
});

test('version 2 normalization sanitizes each mode stats independently', () => {
  const save = normalizeMetaSave({
    version: 2,
    stats: {
      original: {
        played: -3,
        wins: 2.5,
        bestTimeMs: 5_000,
      },
      winnable: {
        played: 4,
        wins: 9,
        bestTimeMs: 3_200,
      },
    },
    daily: {
      algorithmVersion: 1,
      records: {
        '2026-09-04': { completed: true, bestTimeMs: 8_000, attempts: 1 },
      },
    },
  });

  assert.deepEqual(save.stats.original, { played: 0, wins: 0 });
  assert.deepEqual(save.stats.winnable, {
    played: 4,
    wins: 4,
    bestTimeMs: 3_200,
  });
  assert.deepEqual(save.daily.records['2026-09-04'], {
    completed: true,
    bestTimeMs: 8_000,
    attempts: 1,
  });
});

test('mode stats remove invalid best times and best times without a win', () => {
  const noWins = normalizeMetaSave({
    version: 2,
    stats: {
      original: { played: 3, wins: 0, bestTimeMs: 2_000 },
      winnable: { played: 5, wins: 2, bestTimeMs: 0 },
    },
  });

  assert.deepEqual(noWins.stats.original, { played: 3, wins: 0 });
  assert.deepEqual(noWins.stats.winnable, { played: 5, wins: 2 });

  const nonFinite = normalizeMetaSave({
    version: 2,
    stats: {
      original: { played: 2, wins: 1, bestTimeMs: Number.POSITIVE_INFINITY },
      winnable: { played: 2, wins: 1, bestTimeMs: Number.NaN },
    },
  });

  assert.deepEqual(nonFinite.stats.original, { played: 2, wins: 1 });
  assert.deepEqual(nonFinite.stats.winnable, { played: 2, wins: 1 });
});


test('version 3 save migrates to version 5 with default hidden Standard difficulty and streak state', () => {
  const raw: Record<string, unknown> = structuredClone(createDefaultMetaSave()) as unknown as Record<string, unknown>;
  raw.version = 3;
  delete raw.standardDifficulty;
  raw.progression = {
    totalXp: 345,
    coins: 678,
    lastWinDay: '2026-09-09',
    startedAttempts: ['keep-started'],
    completedAttempts: ['keep-completed'],
    receipts: { stream: 9 },
  };
  raw.stats = {
    original: { played: 7, wins: 4, bestTimeMs: 7_000 },
    winnable: { played: 12, wins: 8, bestTimeMs: 5_000 },
  };

  const save = normalizeMetaSave(raw);

  assert.equal(save.version, 5);
  assert.deepEqual(save.standardDifficulty, {
    failureStreak: 0,
    lastServedTier: '',
    recentSeeds: [],
  });
  assert.deepEqual(save.standardWinStreak, { current: 0, best: 0 });
  assert.equal(save.progression.totalXp, 345);
  assert.equal(save.progression.coins, 678);
  assert.deepEqual(save.stats.winnable, { played: 12, wins: 8, bestTimeMs: 5_000 });
});

test('version 4 migrates to version 5 preserving difficulty and defaulting Standard streak', () => {
  const raw: Record<string, unknown> = structuredClone(createDefaultMetaSave()) as unknown as Record<string, unknown>;
  raw.version = 4;
  raw.standardDifficulty = {
    failureStreak: 99,
    lastServedTier: 'nightmare',
    recentSeeds: ['1', '2', '1', '0', '-4', '4294967295', '4294967296', 'abc', 12],
  };

  const save = normalizeMetaSave(raw);

  assert.deepEqual(save.standardDifficulty, {
    failureStreak: 3,
    lastServedTier: '',
    recentSeeds: ['2', '1', '4294967295'],
  });
  assert.deepEqual(save.standardWinStreak, { current: 0, best: 0 });
});


test('version 5 normalization sanitizes Standard win streak and keeps best at least current', () => {
  const raw: Record<string, unknown> = structuredClone(createDefaultMetaSave()) as unknown as Record<string, unknown>;
  raw.version = 5;
  raw.standardWinStreak = { current: 7, best: 3 };
  assert.deepEqual(normalizeMetaSave(raw).standardWinStreak, { current: 7, best: 7 });

  raw.standardWinStreak = { current: -2, best: 11 };
  assert.deepEqual(normalizeMetaSave(raw).standardWinStreak, { current: 0, best: 11 });
});
