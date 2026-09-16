import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts',import.meta.url),'utf8');
function method(name:string):string{const direct=scene.indexOf(`private ${name}`),asyncStart=scene.indexOf(`private async ${name}`),start=direct===-1?asyncStart:direct;assert.notEqual(start,-1,`missing ${name}`);const next=scene.indexOf('\n  private ',start+1);return scene.slice(start,next===-1?scene.length:next);}

test('leaderboard scene owns Standard, Daily, streak and Mastery tabs with product columns',()=>{
  assert.match(ui,/extends BaseUiScene/);assert.match(ui,/value:\s*'winnable'/);assert.match(ui,/value:\s*'daily'/);assert.match(ui,/value:\s*'streak'/);assert.match(ui,/value:\s*'mastery'/);
  assert.match(ui,/Ходы/);assert.match(ui,/Текущая серия/);assert.match(ui,/Лучшая серия/);assert.match(ui,/Ранг/);assert.match(ui,/Очки/);assert.match(ui,/pinnedRow/);
});

test('authorized bootstrap synchronizes Standard streak, current Daily result, Daily streak, and Mastery',()=>{
  const sync=method('syncHistoricalLeaderboards');assert.match(sync,/syncStandardStreak/);assert.match(sync,/syncDailyBest/);assert.match(sync,/syncDailyStreak/);assert.match(sync,/syncMasteryScore/);
});

test('local builds can use deterministic leaderboard fixtures without touching Yandex boards',()=>{
  const load=method('loadProductLeaderboard');assert.match(load,/leaderboardFixturesEnabled/);assert.match(load,/createLeaderboardFixtureResult/);
});
