import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizationUsesProfileScopeTransfer } from '../src/platform/AuthorizationPolicy.ts';
import { createUnavailablePlatformServices } from '../src/platform/services.ts';

test('authorization scope transfer is explicit: Yandex true and Pikabu false',()=>{
  const base=createUnavailablePlatformServices();
  assert.equal(authorizationUsesProfileScopeTransfer({...base,auth:{...base.auth,playerStorageScopeChangesOnAuthorization:true}}),true);
  assert.equal(authorizationUsesProfileScopeTransfer({...base,auth:{...base.auth,playerStorageScopeChangesOnAuthorization:false}}),false);
});
