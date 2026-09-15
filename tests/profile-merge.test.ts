import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, MAX_ECONOMY_VALUE, type MetaSave } from '../src/meta/MetaSave.ts';

async function loadProfileMerge() {
  try {
    return await import('../src/meta/ProfileMerge.ts');
  } catch {
    return {} as Record<string, unknown>;
  }
}

function makeState(mutator: (state: MetaSave) => void): MetaSave {
  const state = structuredClone(createDefaultMetaSave());
  mutator(state);
  return state;
}

test('guest profile merge preserves both profiles and prefers the active guest selection/current streak', async () => {
  const module = await loadProfileMerge() as {
    mergeMetaProfiles?: (target: MetaSave, source: MetaSave, sourceScope: string) => MetaSave;
    profileMergeReceiptKey?: (scope: string) => string;
  };
  assert.equal(typeof module.mergeMetaProfiles, 'function');
  assert.equal(typeof module.profileMergeReceiptKey, 'function');

  const cloud = makeState((state) => {
    state.collection.ownedThemes.push('winter_living_room');
    state.equipped.theme = 'winter_living_room';
    state.progression.totalXp = 900;
    state.progression.coins = 120;
    state.progression.lastWinDay = '2026-09-14';
    state.progression.startedAttempts = ['cloud-start'];
    state.progression.completedAttempts = ['cloud-done'];
    state.progression.receipts = { stream: 4 };
    state.achievements = ['cloud-achievement'];
    state.stats.original = { played: 4, wins: 3, bestTimeMs: 90_000 };
    state.stats.winnable = { played: 6, wins: 5, bestTimeMs: 80_000 };
    state.daily.records['2026-09-14'] = { completed: true, attempts: 2, bestTimeMs: 70_000 };
    state.weekly = { weekId: '2026-W38', completedDailyIds: ['2026-09-14'], claimedMilestones: [3] };
    state.standardWinStreak = { current: 5, best: 8 };
    state.standardDifficulty = { failureStreak: 0, lastServedTier: 'medium', recentSeeds: ['101'] };
    state.monetization = { ...state.monetization, rewardedDay: '2026-09-15', rewardedCount: 2, creditedPurchaseTokens: ['cloud-token'] };
  });

  const guest = makeState((state) => {
    state.collection.ownedThemes.push('autumn_evening');
    state.equipped.theme = 'autumn_evening';
    state.progression.totalXp = 350;
    state.progression.coins = 75;
    state.progression.lastWinDay = '2026-09-15';
    state.progression.startedAttempts = ['guest-start'];
    state.progression.completedAttempts = ['guest-done'];
    state.progression.receipts = { stream: 7, guest: 2 };
    state.achievements = ['guest-achievement'];
    state.stats.original = { played: 2, wins: 1, bestTimeMs: 75_000 };
    state.stats.winnable = { played: 3, wins: 2, bestTimeMs: 65_000 };
    state.daily.records['2026-09-14'] = { completed: true, attempts: 1, bestTimeMs: 60_000 };
    state.daily.records['2026-09-15'] = { completed: true, attempts: 1, bestTimeMs: 55_000 };
    state.weekly = { weekId: '2026-W38', completedDailyIds: ['2026-09-15'], claimedMilestones: [5] };
    state.standardWinStreak = { current: 2, best: 4 };
    state.standardDifficulty = { failureStreak: 1, lastServedTier: 'hard', recentSeeds: ['202', '303'] };
    state.monetization = { ...state.monetization, rewardedDay: '2026-09-15', rewardedCount: 3, creditedPurchaseTokens: ['guest-token'] };
  });

  const merged = module.mergeMetaProfiles!(cloud, guest, 'yandex-guest-42');
  assert.deepEqual(new Set(merged.collection.ownedThemes), new Set(['walnut_study', 'winter_living_room', 'autumn_evening']));
  assert.equal(merged.equipped.theme, 'autumn_evening');
  assert.equal(merged.progression.totalXp, 1250);
  assert.equal(merged.progression.coins, 195);
  assert.equal(merged.progression.lastWinDay, '2026-09-15');
  assert.deepEqual(new Set(merged.progression.startedAttempts), new Set(['cloud-start', 'guest-start']));
  assert.deepEqual(new Set(merged.progression.completedAttempts), new Set(['cloud-done', 'guest-done']));
  assert.equal(merged.progression.receipts.stream, 7);
  assert.equal(merged.progression.receipts.guest, 2);
  assert.equal(merged.progression.receipts[module.profileMergeReceiptKey!('yandex-guest-42')], 1);
  assert.deepEqual(new Set(merged.achievements), new Set(['cloud-achievement', 'guest-achievement']));
  assert.deepEqual(merged.stats.original, { played: 6, wins: 4, bestTimeMs: 75_000 });
  assert.deepEqual(merged.stats.winnable, { played: 9, wins: 7, bestTimeMs: 65_000 });
  assert.deepEqual(merged.daily.records['2026-09-14'], { completed: true, attempts: 3, bestTimeMs: 60_000 });
  assert.deepEqual(merged.daily.records['2026-09-15'], { completed: true, attempts: 1, bestTimeMs: 55_000 });
  assert.deepEqual(new Set(merged.weekly.completedDailyIds), new Set(['2026-09-14', '2026-09-15']));
  assert.deepEqual(new Set(merged.weekly.claimedMilestones), new Set([3, 5]));
  assert.deepEqual(merged.standardWinStreak, { current: 2, best: 8 });
  assert.equal(merged.standardDifficulty.failureStreak, 1);
  assert.equal(merged.standardDifficulty.lastServedTier, 'hard');
  assert.deepEqual(merged.standardDifficulty.recentSeeds, ['101', '202', '303']);
  assert.equal(merged.monetization.rewardedDay, '2026-09-15');
  assert.equal(merged.monetization.rewardedCount, 5);
  assert.deepEqual(new Set(merged.monetization.creditedPurchaseTokens), new Set(['cloud-token', 'guest-token']));
});

test('profile merge is idempotent for the same guest scope', async () => {
  const module = await loadProfileMerge() as { mergeMetaProfiles?: (target: MetaSave, source: MetaSave, sourceScope: string) => MetaSave };
  assert.equal(typeof module.mergeMetaProfiles, 'function');
  const cloud = makeState((state) => { state.progression.coins = 10; state.stats.original = { played: 1, wins: 1, bestTimeMs: 1000 }; });
  const guest = makeState((state) => { state.progression.coins = 20; state.stats.original = { played: 2, wins: 1, bestTimeMs: 900 }; });
  const first = module.mergeMetaProfiles!(cloud, guest, 'guest-scope');
  const second = module.mergeMetaProfiles!(first, guest, 'guest-scope');
  assert.deepEqual(second, first);
});

test('profile merge saturates additive economy values and keeps the newer weekly/rewarded window', async () => {
  const module = await loadProfileMerge() as { mergeMetaProfiles?: (target: MetaSave, source: MetaSave, sourceScope: string) => MetaSave };
  assert.equal(typeof module.mergeMetaProfiles, 'function');
  const cloud = makeState((state) => {
    state.progression.coins = MAX_ECONOMY_VALUE - 2;
    state.progression.totalXp = MAX_ECONOMY_VALUE - 3;
    state.weekly = { weekId: '2026-W39', completedDailyIds: ['2026-09-21'], claimedMilestones: [3] };
    state.monetization = { ...state.monetization, rewardedDay: '2026-09-21', rewardedCount: 4 };
  });
  const guest = makeState((state) => {
    state.progression.coins = 10;
    state.progression.totalXp = 10;
    state.weekly = { weekId: '2026-W38', completedDailyIds: ['2026-09-15'], claimedMilestones: [5] };
    state.monetization = { ...state.monetization, rewardedDay: '2026-09-15', rewardedCount: 5 };
  });
  const merged = module.mergeMetaProfiles!(cloud, guest, 'old-guest');
  assert.equal(merged.progression.coins, MAX_ECONOMY_VALUE);
  assert.equal(merged.progression.totalXp, MAX_ECONOMY_VALUE);
  assert.equal(merged.weekly.weekId, '2026-W39');
  assert.deepEqual(merged.weekly.completedDailyIds, ['2026-09-21']);
  assert.equal(merged.monetization.rewardedDay, '2026-09-21');
  assert.equal(merged.monetization.rewardedCount, 4);
});

test('pending profile transfer survives reload and validates its payload', async () => {
  const module = await loadProfileMerge() as {
    stageProfileMergeTransfer?: (scope: string, state: MetaSave, storage: StorageLike) => boolean;
    readProfileMergeTransfer?: (storage: StorageLike) => { sourceScope: string; state: MetaSave } | null;
    clearProfileMergeTransfer?: (storage: StorageLike) => void;
  };
  assert.equal(typeof module.stageProfileMergeTransfer, 'function');
  assert.equal(typeof module.readProfileMergeTransfer, 'function');
  assert.equal(typeof module.clearProfileMergeTransfer, 'function');

  const map = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
  const guest = makeState((state) => { state.progression.coins = 77; });
  assert.equal(module.stageProfileMergeTransfer!('yandex-guest', guest, storage), true);
  assert.equal(module.readProfileMergeTransfer!(storage)?.sourceScope, 'yandex-guest');
  assert.equal(module.readProfileMergeTransfer!(storage)?.state.progression.coins, 77);
  module.clearProfileMergeTransfer!(storage);
  assert.equal(module.readProfileMergeTransfer!(storage), null);

  storage.setItem('cascadePendingProfileMerge', '{bad json');
  assert.equal(module.readProfileMergeTransfer!(storage), null);
});

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

test('active game is preserved only for an authorized staged merge from the current scope', async () => {
  const module = await loadProfileMerge() as {
    shouldPreserveActiveGameForProfileMerge?: (
      currentScope: string,
      authorized: boolean,
      transfer: { sourceScope: string; state: MetaSave } | null,
    ) => boolean;
  };
  assert.equal(typeof module.shouldPreserveActiveGameForProfileMerge, 'function');
  const transfer = { sourceScope: 'yandex-guest-42', state: createDefaultMetaSave() };
  assert.equal(module.shouldPreserveActiveGameForProfileMerge!('yandex-guest-42', true, transfer), true);
  assert.equal(module.shouldPreserveActiveGameForProfileMerge!('yandex-guest-42', false, transfer), false);
  assert.equal(module.shouldPreserveActiveGameForProfileMerge!('yandex-other', true, transfer), false);
  assert.equal(module.shouldPreserveActiveGameForProfileMerge!('yandex-guest-42', true, null), false);
});
