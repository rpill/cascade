import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { buildHomeViewModel } from '../src/ui/home/HomeViewModel.ts';

test('Home view model exposes Trifold product hierarchy for a fresh Cascade profile', () => {
  const state = createDefaultMetaSave();
  const vm = buildHomeViewModel({
    state,
    activeMode: null,
    activeDifficulty: null,
    currentDailyId: '2026-09-16',
    leaderboardsEnabled: true,
    themesTotal: 9,
    language: 'ru',
  });
  assert.equal(vm.primary.title, 'ИГРАТЬ');
  assert.match(vm.primary.subtitle, /Лёгкая/);
  assert.equal(vm.primary.hasActiveGame, false);
  assert.equal(vm.selectedDifficulty, 'easy');
  assert.equal(vm.daily.subtitle, 'Сегодня новая · серия 0');
  assert.equal(vm.mastery.rank, 'novice');
  assert.match(vm.mastery.subtitle, /0 \/ 10/);
  assert.equal(vm.themes.subtitle, '1 / 9');
  assert.equal(vm.coins, 0);
  assert.equal(vm.leaderboardsEnabled, true);
});

test('Home primary continues the current game without changing selected Standard difficulty', () => {
  const state = createDefaultMetaSave();
  state.standard.selectedDifficulty = 'hard';
  const vm = buildHomeViewModel({
    state,
    activeMode: 'daily',
    activeDifficulty: null,
    currentDailyId: '2026-09-16',
    leaderboardsEnabled: false,
    themesTotal: 9,
    language: 'ru',
  });
  assert.equal(vm.primary.title, 'ПРОДОЛЖИТЬ');
  assert.equal(vm.primary.subtitle, 'Daily');
  assert.equal(vm.primary.hasActiveGame, true);
  assert.equal(vm.selectedDifficulty, 'hard');
});

test('Home Daily and Mastery summaries reflect persistent product state', () => {
  const state = createDefaultMetaSave();
  state.progression.coins = 345;
  state.daily.records['2026-09-16'] = { completed: true, completedOnTime: true, attempts: 1, bestTimeMs: 42_000 };
  state.mastery = { rank: 'player', stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 } };
  const vm = buildHomeViewModel({
    state,
    activeMode: 'winnable',
    activeDifficulty: 'medium',
    currentDailyId: '2026-09-16',
    leaderboardsEnabled: true,
    themesTotal: 9,
    language: 'ru',
  });
  assert.equal(vm.primary.subtitle, 'Standard · Средняя');
  assert.equal(vm.daily.subtitle, 'Сегодня выполнено · серия 1');
  assert.equal(vm.mastery.title, 'Игрок');
  assert.match(vm.mastery.subtitle, /Средние 4 \/ 15/);
  assert.match(vm.mastery.subtitle, /Сложные 1 \/ 3/);
  assert.equal(vm.coins, 345);
});
