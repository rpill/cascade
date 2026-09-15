import test from 'node:test';
import assert from 'node:assert/strict';
import { MetaRepository } from '../src/meta/MetaRepository.ts';
import { createDefaultMetaSave, META_SAVE_VERSION } from '../src/meta/MetaSave.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

test('repository stores meta under one stable top-level key', async () => {
  let written: Record<string, unknown> | null = null;
  const storage: PlayerStorage = { load: async()=>({}), save: async(data)=>{written=data;} };
  const state=createDefaultMetaSave(); await new MetaRepository(storage).save(state);
  assert.deepEqual(written,{cascadeMeta:state});
});

test('failed save keeps the newest snapshot pending and retry writes only that snapshot', async () => {
  const writes:Record<string,unknown>[]=[];let fail=true;
  const storage:PlayerStorage={load:async()=>({}),save:async(data)=>{if(fail)throw new Error('offline');writes.push(data);}};
  const repo=new MetaRepository(storage),first=createDefaultMetaSave(),second=createDefaultMetaSave();
  second.daily.records['2026-09-04']={completed:true,completedOnTime:true,attempts:1,bestTimeMs:1000};
  await repo.save(first);await repo.save(second);fail=false;await repo.retryPending();
  assert.deepEqual(writes,[{cascadeMeta:second}]);
});

test('repository intentionally resets old unpublished save schemas', async () => {
  const storage:PlayerStorage={load:async()=>({cascadeMeta:{version:META_SAVE_VERSION-1,progression:{coins:12345}}}),save:async()=>{}};
  assert.deepEqual(await new MetaRepository(storage).load(),createDefaultMetaSave());
});
