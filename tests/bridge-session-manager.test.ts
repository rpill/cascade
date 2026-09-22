import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BridgeSessionManager } from '../src/backend/BridgeSessionManager.ts';
import type { BackendIdentityProvider } from '../src/platform/services.ts';

function identity(options:{authorized?:boolean; values?:string[]}={}) {
  const values=[...(options.values ?? ['pikabu.signed'])];
  let calls=0;
  const provider:BackendIdentityProvider={
    isAuthorized:()=>options.authorized !== false,
    localIdentityKey:()=>options.authorized === false ? null : '42',
    getAssertion:async()=>{ calls+=1; const value=values.shift() ?? 'pikabu.signed'; return options.authorized === false ? null : {provider:'pikabu',value}; },
  };
  return {provider,get calls(){return calls;}};
}

function response(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

function sessionResponse(token:string,expiresAtMs:number,status=200){
  return response(status===200?{token,expiresAtMs}:{error:'conflict'},status);
}

test('guest rejects before session network request', async()=>{
  const id=identity({authorized:false}); let fetchCalls=0;
  const manager=new BridgeSessionManager({baseUrl:'https://api.test',identity:id.provider,fetchImpl:async()=>{fetchCalls+=1;return sessionResponse('x',999999);}});
  await assert.rejects(()=>manager.getToken(),/authorized|identity/i);
  assert.equal(fetchCalls,0);
});

test('concurrent callers share one session bootstrap and cache token', async()=>{
  const id=identity(); let fetchCalls=0; let release!:()=>void;
  const gate=new Promise<void>((resolve)=>{release=resolve;});
  const manager=new BridgeSessionManager({baseUrl:'https://api.test',identity:id.provider,nowMs:()=>1000,fetchImpl:async()=>{fetchCalls+=1;await gate;return sessionResponse('bridge.jwt',100_000);}});
  const a=manager.getToken(), b=manager.getToken();
  release();
  assert.equal(await a,'bridge.jwt'); assert.equal(await b,'bridge.jwt');
  assert.equal(fetchCalls,1); assert.equal(id.calls,1);
  assert.equal(await manager.getToken(),'bridge.jwt'); assert.equal(fetchCalls,1);
});

test('token within 30 seconds of expiry is refreshed', async()=>{
  const id=identity({values:['first','second']}); let now=1_000; let call=0;
  const manager=new BridgeSessionManager({baseUrl:'https://api.test',identity:id.provider,nowMs:()=>now,fetchImpl:async()=>{call+=1;return sessionResponse(`token-${call}`,call===1?40_000:100_000);}});
  assert.equal(await manager.getToken(),'token-1');
  now=9_999; assert.equal(await manager.getToken(),'token-1');
  now=10_000; assert.equal(await manager.getToken(),'token-2');
  assert.equal(id.calls,2);
});

test('session bootstrap sends only Pikabu signedData once', async () => {
  const id=identity({values:['signed-token']});
  const bodies: unknown[] = [];
  const manager = new BridgeSessionManager({
    baseUrl: 'https://api.example',
    identity: id.provider,
    nowMs: () => 1000,
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return response({ token: 'bridge-token', expiresAtMs: 100_000 });
    },
  });
  assert.equal(await manager.getToken(), 'bridge-token');
  assert.deepEqual(bodies, [{ signedData: 'signed-token' }]);
  assert.equal(id.calls,1);
});

test('409 is a normal session failure and never loads a second provider', async () => {
  const id=identity();
  let calls = 0;
  const manager = new BridgeSessionManager({
    baseUrl: 'https://api.example', identity: id.provider,
    fetchImpl: async () => { calls += 1; return response({ error: 'conflict' }, 409); },
  });
  await assert.rejects(() => manager.getToken(), /status 409/);
  assert.equal(calls, 1);
  assert.equal(id.calls,1);
});

test('invalidate discards cached token and fetches fresh Pikabu signed data', async()=>{
  const id=identity({values:['signed-1','signed-2']}); let call=0;
  const manager=new BridgeSessionManager({baseUrl:'https://api.test',identity:id.provider,nowMs:()=>0,fetchImpl:async()=>sessionResponse(`token-${++call}`,100_000)});
  assert.equal(await manager.getToken(),'token-1'); manager.invalidate(); assert.equal(await manager.getToken(),'token-2');
  assert.equal(id.calls,2);
});

test('Pikabu browser session path has no GamePush provisioning hooks', () => {
  const session = readFileSync('src/backend/BridgeSessionManager.ts', 'utf8');
  const pikabu = readFileSync('src/platform/pikabu.ts', 'utf8');
  for (const source of [session,pikabu]) {
    assert.doesNotMatch(source, /GamePush|PROVISIONING_REQUIRED|backendProvisioning|game-score|onGPInit/);
  }
});
