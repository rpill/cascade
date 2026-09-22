import test from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, validateBoardKey, validateDailyId, parseProfilePutBody, parseLeaderboardSubmitBody } from '../server/cascade-api/validation.ts';
import { HttpError, corsHeaders, readJsonBody } from '../server/cascade-api/http.ts';

test('board date and UUID validation use strict whitelists', () => {
  assert.equal(validateBoardKey('standard'),'standard');
  assert.equal(validateBoardKey('daily-streak'),'daily-streak');
  assert.throws(()=>validateBoardKey('admin'));
  assert.equal(validateDailyId('2026-09-20'),'2026-09-20');
  assert.throws(()=>validateDailyId('20-09-2026'));
  assert.equal(isUuid('11111111-1111-4111-8111-111111111111'),true);
  assert.equal(isUuid('nope'),false);
});

test('profile PUT validation requires explicit BASE and LOCAL profile', () => {
  assert.throws(()=>parseProfilePutBody({profile:{}}));
  assert.throws(()=>parseProfilePutBody({base:'bad',profile:{}}));
  assert.deepEqual(parseProfilePutBody({base:null,profile:{ok:true}}),{base:null,profile:{ok:true}});
});

test('Content-Length over 256 KiB returns 413 before body parse', async () => {
  const request=new Request('https://x.test/v1/profile',{method:'PUT',headers:{'content-length':'262145'},body:'{}'});
  await assert.rejects(()=>readJsonBody(request),(error:unknown)=>error instanceof HttpError && error.status===413);
});

test('actual UTF-8 body over 256 KiB returns 413', async () => {
  const body=JSON.stringify({value:'é'.repeat(140000)});
  const request=new Request('https://x.test/v1/profile',{method:'PUT',body});
  await assert.rejects(()=>readJsonBody(request),(error:unknown)=>error instanceof HttpError && error.status===413);
});

test('unlisted CORS origin receives no permissive ACAO header', () => {
  const listed=corsHeaders('https://game.example','https://game.example,http://localhost:5173');
  assert.equal(listed['Access-Control-Allow-Origin'],'https://game.example');
  const blocked=corsHeaders('https://evil.example','https://game.example,http://localhost:5173');
  assert.equal('Access-Control-Allow-Origin' in blocked,false);
});

test('Standard leaderboard rejects zero streaks that would poison client ranking decode', () => {
  assert.throws(() => parseLeaderboardSubmitBody('standard', {
    operationId:'11111111-1111-4111-8111-111111111111',
    kind:'standard',
    bestStreak:0,
  }));
});

test('runtime-independent backend path contains no Postgres backend or CAS contract', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const root = new URL('../server/cascade-api/', import.meta.url);
  const names = (await readdir(root)).filter((name) => name.endsWith('.ts'));
  const forbidden = /BackendDb|\/rest\/v1\/|\/rpc\/|SUPABASE_SERVICE_ROLE_KEY|expectedRevision|cascade_profiles|cascade_leaderboard/;
  const offenders: string[] = [];
  for (const name of names) {
    const source = await readFile(new URL(name, root), 'utf8');
    if (forbidden.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, []);
});
