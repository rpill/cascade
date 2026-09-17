import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');

test('Mastery path is explicitly labelled and future ranks are visually secondary to the current rank', () => {
  assert.match(source, /pathHeading/);
  assert.match(source, /t\('Путь мастерства'\)/);
  assert.match(source, /item\.current\s*\?\s*1/);
  assert.match(source, /item\.completed/);
});


test('Mastery uses the screen width instead of a centered 1200px island and keeps the rank path readable', () => {
  assert.doesNotMatch(source, /viewport\.width-1200\*css/);
  assert.match(source, /pathBackdrop/);
  assert.doesNotMatch(source, /CoinPill|wallet|coin/i);
  assert.match(source, /bounds\.width\s*\*\s*\(mobile \? 0\.90 : 0\.88\)/);
  assert.match(source, /pathBadges/);
  assert.doesNotMatch(source, /pathLocks|drawDiamond/);
  assert.match(source, /drawPathConnectors/);
  assert.doesNotMatch(source, /item\.completed\?0\.78:0\.42/);
});
