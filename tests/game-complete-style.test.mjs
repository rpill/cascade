import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('victory panel has a compact celebratory hierarchy and animated level progress', () => {
  assert.match(css, /\.game-complete-panel\s*\{[^}]*width:\s*min\(460px/s);
  assert.match(css, /\.game-complete-time\s*\{[^}]*font:[^}]*32px/s);
  assert.match(css, /\.game-complete-progression\s*\{/);
  assert.match(css, /\.game-complete-xp-fill\s*\{[^}]*transition-property:\s*width/s);
  assert.match(css, /\.game-complete-level-reward\.is-visible/);
});
