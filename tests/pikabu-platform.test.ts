import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPikabuPlatformFromApi,
  createPikabuPlatformServices,
  initializePikabuPlatform,
  type PikabuSdk,
} from '../src/platform/pikabu.ts';

function fakeSdk(overrides: Partial<PikabuSdk> = {}): PikabuSdk {
  const listeners = new Map<string, () => void>();
  const player = {
    id: 'guest-1',
    name: 'Guest',
    avatar: '',
    isAuthorized: false,
    getSignedData: async () => 'signed-data',
  };
  return {
    player,
    auth: { openAuthDialog: async () => undefined },
    gameStarted: () => undefined,
    once: (event, listener) => { listeners.set(event, listener); },
    ...overrides,
    __emit: (event: string) => listeners.get(event)?.(),
  } as PikabuSdk;
}

test('Pikabu init is singleton and ready calls gameStarted once', async () => {
  let initCalls=0, started=0;
  const sdk=fakeSdk({gameStarted:()=>{started+=1;}});
  (globalThis as any).window={PkbSDK:{init:async()=>{initCalls+=1;return sdk;}}};
  const a=await initializePikabuPlatform();
  const b=await initializePikabuPlatform();
  assert.equal(a,b);
  assert.equal(initCalls,1);
  a.ready(); a.ready();
  assert.equal(started,1);
});

test('guest uses browser local player storage and remains playable', async () => {
  const platform=createPikabuPlatformServices(fakeSdk());
  assert.equal(platform.auth.isAuthorized(),false);
  await platform.playerStorage.save({value:7});
  assert.deepEqual(await platform.playerStorage.load(),{value:7});
  assert.equal(platform.auth.playerStorageScopeChangesOnAuthorization,false);
});

test('requestAuthorization checks updated player state after dialog closes', async () => {
  const sdk=fakeSdk();
  sdk.auth.openAuthDialog=async()=>{sdk.player.isAuthorized=true;};
  const platform=createPikabuPlatformServices(sdk);
  assert.equal(await platform.auth.requestAuthorization(),true);
});

test('userAuthorized event observes changed player id and notifies account listeners', () => {
  const sdk=fakeSdk();
  const platform=createPikabuPlatformServices(sdk);
  let calls=0;
  platform.auth.onAccountSelectionClosed(()=>{calls+=1;});
  sdk.player.id='account-9'; sdk.player.isAuthorized=true;
  (sdk as any).__emit('userAuthorized');
  assert.equal(calls,1);
  assert.equal(platform.backendIdentity?.localIdentityKey(),'account-9');
});

test('signed assertion is unavailable for guest and returned for authorized player', async () => {
  const sdk=fakeSdk();
  const platform=createPikabuPlatformServices(sdk);
  assert.equal(await platform.backendIdentity?.getAssertion(),null);
  sdk.player.isAuthorized=true;
  assert.deepEqual(await platform.backendIdentity?.getAssertion(),{provider:'pikabu',value:'signed-data'});
});

test('SDK load/init failure returns unavailable local-first platform instead of throwing startup', async () => {
  const platform=await createPikabuPlatformFromApi({init:async()=>{throw new Error('outside platform');}});
  assert.equal(platform.auth.isAuthorized(),false);
  await platform.playerStorage.save({still:'works'});
  assert.deepEqual(await platform.playerStorage.load(),{still:'works'});
});
