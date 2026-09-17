import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const configSource = readFileSync(new URL('../src/leaderboards/LeaderboardConfig.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/leaderboards/LeaderboardService.ts', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const gameSceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('backend keeps streak synchronization while the player-facing tabs are Standard + Daily + Mastery', () => {
  assert.match(configSource, /GlobalLeaderboardMode\s*=\s*'winnable'\s*\|\s*'daily'\s*\|\s*'streak'\s*\|\s*'mastery'/);
  assert.match(configSource, /DAILY_STREAK_LEADERBOARD_NAME/);
  assert.match(sceneSource, /value:\s*'winnable'/);
  assert.match(sceneSource, /value:\s*'daily'/);
  assert.doesNotMatch(sceneSource, /value:\s*'streak'/);
  assert.match(sceneSource, /value:\s*'mastery'/);
});

test('Daily leaderboard score carries date, moves and time', () => {
  assert.match(configSource, /encodeDailyLeaderboardScore\([^)]*dailyId[^)]*moves[^)]*elapsedMs/);
  assert.match(configSource, /decodeDailyLeaderboardScore[\s\S]*moves/);
});

test('streak leaderboard carries current and best Daily streak', () => {
  assert.match(configSource, /encodeDailyStreakLeaderboardScore/);
  assert.match(configSource, /decodeDailyStreakLeaderboardScore/);
  assert.match(serviceSource, /syncDailyStreak/);
  assert.match(gameSceneSource, /syncDailyStreak/);
  assert.match(gameSceneSource, /syncStandardStreak/);
});

test('leaderboard scene exposes product columns and a pinned player row', () => {
  assert.match(sceneSource, /Ходы/);
  assert.match(sceneSource, /Время/);
  assert.match(sceneSource, /Лучшая серия/);
  assert.match(sceneSource, /Ранг/);
  assert.match(sceneSource, /Очки/);
  assert.match(sceneSource, /playerEntry/);
  assert.match(sceneSource, /pinned/i);
});
