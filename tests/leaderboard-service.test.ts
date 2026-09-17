import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { encodeDailyLeaderboardScore, encodeDailyStreakLeaderboardScore, encodeMasteryLeaderboardScore } from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function platform(options: {
  available?: boolean;
  authorized?: boolean;
  entries?: PlatformServices['leaderboards']['getEntries'];
  player?: PlatformServices['leaderboards']['getPlayerEntry'];
  write?: PlatformServices['leaderboards']['setScore'];
} = {}): PlatformServices {
  return {
    playerStorage:{load:async()=>({}),save:async()=>undefined},trustedClock:{nowMs:()=>null},
    auth:{isAuthorized:()=>options.authorized??true,requestAuthorization:async()=>options.authorized??true,onAccountSelectionClosed:()=>()=>undefined},
    leaderboards:{available:options.available??true,getEntries:options.entries??(async()=>[]),getPlayerEntry:options.player??(async()=>null),setScore:options.write??(async()=>undefined)},
    ads:{available:false,showInterstitial:async()=>false},platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined,
  };
}

test('unavailable leaderboard service reports unavailable without requests', async()=>{
  const service=new LeaderboardService(platform({available:false}));
  assert.deepEqual(await service.load('streak'),{status:'unavailable',authorized:true,entries:[],playerEntry:null});
});

test('public browsing works without authorization while player row stays hidden', async()=>{
  const service=new LeaderboardService(platform({authorized:false,entries:async()=>[{rank:1,score:encodeDailyStreakLeaderboardScore(8,12),playerId:'a',publicName:'Ada'}]}));
  const result=await service.load('streak');assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.equal(result.authorized,false);assert.equal(result.playerEntry,null);assert.deepEqual(result.entries[0]?.metric,{kind:'streak',current:8,best:12});
});

test('authorized player row is normalized for Mastery', async()=>{
  const profile=createDefaultMetaSave();profile.mastery.rank='expert';profile.futurePrestige.mediumSeeds=['1','2'];
  const score=encodeMasteryLeaderboardScore(profile);
  const service=new LeaderboardService(platform({entries:async()=>[{rank:1,score,playerId:'a',publicName:'Ada'}],player:async()=>({rank:7,score,playerId:'me',publicName:'Me'})}));
  const result=await service.load('mastery');assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.equal(result.entries[0]?.metric.kind,'mastery');assert.equal(result.playerEntry?.rank,7);
});

test('Daily load rejects missing day and filters other dates', async()=>{
  const today='2026-09-16';
  const service=new LeaderboardService(platform({entries:async()=>[
    {rank:1,score:encodeDailyLeaderboardScore(today,40,80_000),playerId:'a',publicName:'Ada'},
    {rank:2,score:encodeDailyLeaderboardScore('2026-09-15',20,60_000),playerId:'b',publicName:'Old'},
  ]}));
  assert.equal((await service.load('daily')).status,'error');
  const result=await service.load('daily',today);assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.equal(result.entries.length,1);assert.deepEqual(result.entries[0]?.metric,{kind:'daily',moves:40,elapsedMs:80_000});
});

test('transport failures return non-fatal error state', async()=>{
  const service=new LeaderboardService(platform({entries:async()=>{throw new Error('network');}}));
  assert.equal((await service.load('mastery')).status,'error');
});

test('syncDailyBest keeps the fixed local first-attempt pair authoritative for the same day', async()=>{
  const today='2026-09-16';let server=encodeDailyLeaderboardScore(today,40,70_000);const writes:number[]=[];
  const service=new LeaderboardService(platform({player:async()=>({rank:1,score:server,playerId:'me',publicName:'Me'}),write:async(_name,score)=>{writes.push(score);server=score;}}));
  assert.equal(await service.syncDailyBest(today,40,80_000),'submitted');
  assert.equal(await service.syncDailyBest(today,40,80_000),'unchanged');
  assert.equal(writes.length,1);
});

test('syncDailyStreak writes changed score including downward current streak', async()=>{
  const writes:number[]=[];const server=encodeDailyStreakLeaderboardScore(9,15);
  const service=new LeaderboardService(platform({player:async()=>({rank:1,score:server,playerId:'me',publicName:'Me'}),write:async(_name,score)=>{writes.push(score);}}));
  assert.equal(await service.syncDailyStreak(0,15),'submitted');assert.deepEqual(writes,[encodeDailyStreakLeaderboardScore(0,15)]);
});


test('syncStandardStreak only improves the saved best streak', async()=>{
  let server=6;const writes:Array<[string,number]>=[];
  const service=new LeaderboardService(platform({
    player:async()=>({rank:10,score:server,playerId:'me',publicName:'Me'}),
    write:async(name,score)=>{writes.push([name,score]);server=score;},
  }));
  assert.equal(await service.syncStandardStreak(5),'unchanged');
  assert.equal(await service.syncStandardStreak(9),'submitted');
  assert.deepEqual(writes,[['standardwinstreak',9]]);
});

test('syncDailyBest treats the fixed first-attempt score as authoritative even when server has a better same-day score', async()=>{
  const today='2026-09-16';
  const server=encodeDailyLeaderboardScore(today,35,50_000);
  const writes:number[]=[];
  const service=new LeaderboardService(platform({
    player:async()=>({rank:1,score:server,playerId:'me',publicName:'Me'}),
    write:async(_name,score)=>{writes.push(score);},
  }));
  assert.equal(await service.syncDailyBest(today,50,70_000),'submitted');
  assert.deepEqual(writes,[encodeDailyLeaderboardScore(today,50,70_000)]);
});
