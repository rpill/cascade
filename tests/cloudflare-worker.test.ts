import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareWorker, type CloudflareWorkerRuntimeFactory } from '../server/cloudflare/worker.ts';
import type { CloudflareEnv } from '../server/cloudflare/config.ts';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../server/cloudflare/d1.ts';

const noopStatement:D1PreparedStatementLike={bind(){return this;},async first(){return null;},async all(){return{results:[]};},async run(){return{success:true};}};
const db:D1DatabaseLike={prepare(){return noopStatement;}};
const env={DB:db,PIKABU_GAME_SECRET:'pikabu-secret',BRIDGE_SESSION_SECRET:'bridge-secret',CASCADE_ALLOWED_ORIGINS:'https://allowed.example'} satisfies CloudflareEnv;
test('reuses one Cascade handler within one Worker isolate',async()=>{let builds=0;const factory:CloudflareWorkerRuntimeFactory=()=>{builds+=1;return async()=>new Response('ok');};const worker=createCloudflareWorker(factory);await worker.fetch(new Request('https://worker.test/a'),env);await worker.fetch(new Request('https://worker.test/b'),env);assert.equal(builds,1);});
test('missing DB binding fails closed without leaking config names',async()=>{const worker=createCloudflareWorker();const response=await worker.fetch(new Request('https://worker.test/__cascade_missing_route__'),{...env,DB:undefined});assert.equal(response.status,500);const text=await response.text();assert.equal(text.includes('DB is required'),false);assert.deepEqual(JSON.parse(text),{error:'Internal server error.'});});
test('real Worker adapter preserves exact CORS and OPTIONS behavior',async()=>{const worker=createCloudflareWorker();const response=await worker.fetch(new Request('https://worker.test/v1/profile',{method:'OPTIONS',headers:{Origin:'https://allowed.example'}}),env);assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'https://allowed.example');});
