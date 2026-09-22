import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCloudflareRuntimeConfig } from '../server/cloudflare/config.ts';

const complete={PIKABU_GAME_SECRET:'pikabu-secret',BRIDGE_SESSION_SECRET:'bridge-secret',CASCADE_ALLOWED_ORIGINS:'http://localhost:5173,http://127.0.0.1:5173'};
test('parses only Pikabu, bridge and CORS Worker config',()=>{assert.deepEqual(loadCloudflareRuntimeConfig(complete),{pikabuSecret:'pikabu-secret',bridgeSecret:'bridge-secret',allowedOrigins:complete.CASCADE_ALLOWED_ORIGINS});});
test('rejects a missing required secret binding',()=>{assert.throws(()=>loadCloudflareRuntimeConfig({...complete,PIKABU_GAME_SECRET:''}),/PIKABU_GAME_SECRET is required/);});
