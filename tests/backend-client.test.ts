import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendClient, BackendHttpError, DEFAULT_BACKEND_REQUEST_TIMEOUT_MS } from '../src/backend/BackendClient.ts';
import { CloudProfileService } from '../src/backend/CloudProfileService.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { BackendSessionProvider } from '../src/platform/services.ts';

function session(value: string | null = 'bridge.jwt') {
  let calls=0, invalidations=0;
  const provider: BackendSessionProvider={
    getToken:async()=>{calls+=1;if(value===null) throw new Error('Backend session is required.');return value;},
    invalidate:()=>{invalidations+=1;},
  };
  return {provider,get calls(){return calls;},get invalidations(){return invalidations;}};
}



test('default browser fetch keeps the global receiver', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = function (this: typeof globalThis, _input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
    calls += 1;
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve(new Response('{}', { status: 200 }));
  } as typeof fetch;

  try {
    const client = new BackendClient('https://api.test', session().provider);
    await client.request('/v1/leaderboards/standard', { authorized: false });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('default backend timeout leaves headroom for slow production requests', () => {
  assert.equal(DEFAULT_BACKEND_REQUEST_TIMEOUT_MS, 30_000);
});

test('authorized request attaches bridge session as Bearer token', async () => {
  let auth:string|null=null;
  const client=new BackendClient('https://api.test/',session().provider,async (_input,init)=>{
    auth=new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  });
  await client.request('/v1/profile');
  assert.equal(auth,'Bearer bridge.jwt');
});

test('public request does not initialize bridge session', async () => {
  const auth=session();
  const client=new BackendClient('https://api.test',auth.provider,async()=>new Response('{}',{status:200}));
  await client.request('/v1/leaderboards/standard',{authorized:false});
  assert.equal(auth.calls,0);
});

test('missing session on authorized request fails before fetch', async () => {
  const auth=session(null); let fetchCalls=0;
  const client=new BackendClient('https://api.test',auth.provider,async()=>{fetchCalls+=1;return new Response('{}');});
  await assert.rejects(()=>client.request('/v1/profile'),/session/i);
  assert.equal(fetchCalls,0);
});

test('401 invalidates once, retries once, and never loops on second 401', async () => {
  let tokenCall=0, invalidations=0, fetchCalls=0;
  const auth:BackendSessionProvider={getToken:async()=>`token-${++tokenCall}`,invalidate:()=>{invalidations+=1;}};
  const client=new BackendClient('https://api.test',auth,async()=>{fetchCalls+=1;return new Response(JSON.stringify({error:'expired'}),{status:401});});
  await assert.rejects(()=>client.request('/v1/profile'),(error:unknown)=>error instanceof BackendHttpError && error.status===401);
  assert.equal(fetchCalls,2); assert.equal(invalidations,1); assert.equal(tokenCall,2);
});

test('409 preserves parsed response for coordinator conflict handling', async () => {
  const client=new BackendClient('https://api.test',session().provider,async()=>new Response(JSON.stringify({revision:9,profile:null}),{status:409}));
  await assert.rejects(()=>client.request('/v1/profile',{method:'PUT',body:'{}'}),(error:unknown)=>{
    if (!(error instanceof BackendHttpError)) return false;
    assert.equal(error.status,409);
    assert.deepEqual(error.body,{revision:9,profile:null});
    return true;
  });
});

test('invalid non-json success response is rejected', async () => {
  const client=new BackendClient('https://api.test',session().provider,async()=>new Response('not-json',{status:200}));
  await assert.rejects(()=>client.request('/v1/profile'),/JSON/i);
});

test('AbortSignal timeout becomes a non-fatal request error', async () => {
  const client=new BackendClient('https://api.test',session().provider,async (_input,init)=>new Promise<Response>((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  }),5);
  await assert.rejects(()=>client.request('/v1/profile'),/timed out/i);
});

test('cloud profile service uses profile-only BASE/LOCAL transport without revisions', async () => {
  const profile={schemaVersion:1 as const,meta:createDefaultMetaSave()};
  const bodies:string[]=[]; let call=0;
  const client=new BackendClient('https://api.test',session().provider,async (_input,init)=>{
    call+=1; if(init?.body) bodies.push(String(init.body));
    return new Response(JSON.stringify({profile}),{status:200});
  });
  const service=new CloudProfileService(client);
  assert.deepEqual((await service.load()).profile,profile);
  const result=await service.save({kind:'profile',base:null,profile});
  assert.deepEqual(result.profile,profile);
  assert.deepEqual(JSON.parse(bodies[0]!),{base:null,profile});
  assert.equal(call,2);
});
