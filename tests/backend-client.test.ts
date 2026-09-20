import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendClient, BackendHttpError } from '../src/backend/BackendClient.ts';
import { CloudProfileService } from '../src/backend/CloudProfileService.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { BackendIdentityProvider } from '../src/platform/services.ts';

function identity(value: string | null = 'signed.jwt.value') {
  let calls=0;
  const provider: BackendIdentityProvider={
    isAuthorized:()=>value!==null,
    localIdentityKey:()=>value===null?null:'player-1',
    getAssertion:async()=>{calls+=1;return value===null?null:{provider:'pikabu',value};},
  };
  return {provider,get calls(){return calls;}};
}

test('authorized request attaches exact signed assertion as Bearer token', async () => {
  const id=identity();
  let auth:string|null=null;
  const client=new BackendClient('https://api.test/',id.provider,async (_input,init)=>{
    auth=new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  });
  await client.request('/v1/profile');
  assert.equal(auth,'Bearer signed.jwt.value');
  assert.equal(id.calls,1);
});

test('public request does not ask identity provider for assertion', async () => {
  const id=identity();
  const client=new BackendClient('https://api.test',id.provider,async()=>new Response('{}',{status:200}));
  await client.request('/v1/leaderboards/standard',{authorized:false});
  assert.equal(id.calls,0);
});

test('missing assertion on authorized request fails before fetch', async () => {
  const id=identity(null); let fetchCalls=0;
  const client=new BackendClient('https://api.test',id.provider,async()=>{fetchCalls+=1;return new Response('{}');});
  await assert.rejects(()=>client.request('/v1/profile'),/identity assertion/i);
  assert.equal(fetchCalls,0);
});

test('409 preserves parsed response for coordinator conflict handling', async () => {
  const id=identity();
  const client=new BackendClient('https://api.test',id.provider,async()=>new Response(JSON.stringify({revision:9,profile:null}),{status:409}));
  await assert.rejects(()=>client.request('/v1/profile',{method:'PUT',body:'{}'}),(error:unknown)=>{
    assert.ok(error instanceof BackendHttpError);
    assert.equal(error.status,409);
    assert.deepEqual(error.body,{revision:9,profile:null});
    return true;
  });
});

test('invalid non-json success response is rejected', async () => {
  const id=identity();
  const client=new BackendClient('https://api.test',id.provider,async()=>new Response('not-json',{status:200}));
  await assert.rejects(()=>client.request('/v1/profile'),/JSON/i);
});

test('AbortSignal timeout becomes a non-fatal request error', async () => {
  const id=identity();
  const client=new BackendClient('https://api.test',id.provider,async (_input,init)=>new Promise<Response>((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  }),5);
  await assert.rejects(()=>client.request('/v1/profile'),/timed out/i);
});

test('cloud profile service normalizes load and maps 409 to conflict result', async () => {
  const id=identity();
  const profile={schemaVersion:1 as const,meta:createDefaultMetaSave()};
  let call=0;
  const client=new BackendClient('https://api.test',id.provider,async()=>{
    call+=1;
    return call===1
      ? new Response(JSON.stringify({revision:2,profile,updatedAt:'2026-09-20T00:00:00Z'}),{status:200})
      : new Response(JSON.stringify({revision:3,profile}),{status:409});
  });
  const service=new CloudProfileService(client);
  assert.equal((await service.load()).revision,2);
  const result=await service.save({kind:'profile',operationId:'11111111-1111-4111-8111-111111111111',expectedRevision:2,profile});
  assert.equal(result.status,'conflict');
  assert.equal(result.revision,3);
});
