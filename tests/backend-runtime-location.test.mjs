import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const modules = [
  'auth.ts',
  'http.ts',
  'leaderboards.ts',
  'profile.ts',
  'session.ts',
  'store.ts',
  'validation.ts',
  'handler.ts',
];

test('backend business layer lives under server/cascade-api and is runtime independent', () => {
  for (const name of modules) {
    const path = `server/cascade-api/${name}`;
    assert.equal(existsSync(path), true, `${path} must exist`);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bDeno\b/);
    assert.doesNotMatch(source, /supabase/i);
    assert.doesNotMatch(source, /GamePush|GAMEPUSH_/i);
  }
});

test('obsolete GamePush backend adapter is removed', () => {
  assert.equal(existsSync('server/cascade-api/gamepush.ts'), false);
});
