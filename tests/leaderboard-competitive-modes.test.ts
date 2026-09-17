import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { encodeDailyLeaderboardScore, encodeDailyStreakLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function fakePlatform(options: {
  authorized?: boolean;
  getEntries?: PlatformServices['leaderboards']['getEntries'];
  getPlayerEntry?: PlatformServices['leaderboards']['getPlayerEntry'];
  setScore?: PlatformServices['leaderboards']['setScore'];
} = {}): PlatformServices {
  return {
    playerStorage: { load: async () => ({}), save: async () => undefined },
    trustedClock: { nowMs: () => null },
    auth: { isAuthorized: () => options.authorized ?? true, requestAuthorization: async () => options.authorized ?? true, onAccountSelectionClosed: () => () => undefined },
    leaderboards: { available: true, getEntries: options.getEntries ?? (async () => []), getPlayerEntry: options.getPlayerEntry ?? (async () => null), setScore: options.setScore ?? (async () => undefined) },
    ads:{available:false,showInterstitial:async()=>false},platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined,
  };
}

test('Daily leaderboard loads only the requested day with moves and time', async () => {
  const today='2026-09-16';
  const service=new LeaderboardService(fakePlatform({
    getEntries:async(name)=>{assert.equal(name,'dailyfastest');return[
      {rank:1,score:encodeDailyLeaderboardScore(today,39,130_000),playerId:'a',publicName:'Ada'},
      {rank:2,score:encodeDailyLeaderboardScore(today,41,90_000),playerId:'b',publicName:'Bob'},
      {rank:3,score:encodeDailyLeaderboardScore('2026-09-15',20,50_000),playerId:'c',publicName:'Old'},
    ];},
    getPlayerEntry:async()=>({rank:2,score:encodeDailyLeaderboardScore(today,41,90_000),playerId:'b',publicName:'Bob'}),
  }));
  const result=await service.load('daily',today);assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.deepEqual(result.entries.map(row=>row.metric),[
    {kind:'daily',moves:39,elapsedMs:130_000},{kind:'daily',moves:41,elapsedMs:90_000},
  ]);
  assert.deepEqual(result.playerEntry?.metric,{kind:'daily',moves:41,elapsedMs:90_000});
});

test('Daily streak leaderboard loads current and best streak', async () => {
  const service=new LeaderboardService(fakePlatform({
    getEntries:async(name)=>{assert.equal(name,'dailystreak');return[{rank:1,score:encodeDailyStreakLeaderboardScore(12,18),playerId:'a',publicName:'Ada'}];},
  }));
  const result=await service.load('streak');assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.deepEqual(result.entries[0]?.metric,{kind:'streak',current:12,best:18});
});

test('Daily sync submits lexicographically better moves/time pair', async () => {
  const writes:Array<[string,number]>=[];const today='2026-09-16';
  const service=new LeaderboardService(fakePlatform({getPlayerEntry:async()=>({rank:1,score:encodeDailyLeaderboardScore(today,50,80_000),playerId:'me',publicName:'Me'}),setScore:async(name,score)=>{writes.push([name,score]);}}));
  assert.equal(await service.syncDailyBest(today,49,120_000),'submitted');
  assert.deepEqual(writes,[['dailyfastest',encodeDailyLeaderboardScore(today,49,120_000)]]);
});

test('Daily streak sync can submit a lower current streak after a missed day', async () => {
  const writes:Array<[string,number]>=[];
  const service=new LeaderboardService(fakePlatform({getPlayerEntry:async()=>({rank:1,score:encodeDailyStreakLeaderboardScore(9,14),playerId:'me',publicName:'Me'}),setScore:async(name,score)=>{writes.push([name,score]);}}));
  assert.equal(await service.syncDailyStreak(0,14),'submitted');
  assert.deepEqual(writes,[['dailystreak',encodeDailyStreakLeaderboardScore(0,14)]]);
});
