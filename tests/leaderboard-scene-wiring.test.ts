import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts',import.meta.url),'utf8');
function method(name:string):string{const direct=scene.indexOf(`private ${name}`),asyncStart=scene.indexOf(`private async ${name}`),start=direct===-1?asyncStart:direct;assert.notEqual(start,-1,`missing ${name}`);const next=scene.indexOf('\n  private ',start+1);return scene.slice(start,next===-1?scene.length:next);}

test('Trifold-style leaderboard scene owns Daily, streak and Mastery tabs',()=>{
  assert.match(ui,/extends BaseUiScene/);assert.match(ui,/value:'daily'/);assert.match(ui,/value:'winnable'/);assert.match(ui,/value:'mastery'/);assert.match(ui,/decodeMasteryLeaderboardScore/);
});

test('authorized bootstrap synchronizes streak, current Daily best, and Mastery',()=>{
  const initialize=method('initializeMeta');assert.match(initialize,/this\.leaderboardService = new LeaderboardService\(this\.platform\)/);assert.match(initialize,/syncHistoricalLeaderboards\(\)/);
  const sync=method('syncHistoricalLeaderboards');assert.match(sync,/syncStandardStreak/);assert.match(sync,/syncDailyBest/);assert.match(sync,/syncMasteryScore\(encodeMasteryLeaderboardScore\(this\.metaState\)\)/);
});

test('product leaderboard authorization checkpoints active game, merges profile, then syncs all boards',()=>{
  const auth=method('authorizeProductLeaderboard');assert.match(auth,/checkpointActiveGame/);assert.match(auth,/stageProfileMergeTransfer/);assert.match(auth,/service\.requestAuthorization\(\)/);assert.match(auth,/await this\.syncHistoricalLeaderboards\(\)/);
  assert.doesNotMatch(scene,/ysdk\.leaderboards|YaGames/);
});
