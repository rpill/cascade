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
