import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');

test('leaderboard rows live in an internal ScrollRegion while header and pinned player row stay outside it', () => {
  assert.match(source, /import \{ ScrollRegion \}/);
  assert.match(source, /private scroll:\s*ScrollRegion \| null/);
  assert.match(source, /new ScrollRegion\(this/);
  assert.match(source, /this\.scroll\.add\(/);
  assert.match(source, /this\.scroll\.layout\(/);
  assert.match(source, /this\.scroll\.setContentHeight\(/);
  assert.doesNotMatch(source, /Math\.min\(this\.rows\.length,\s*10/);
});
