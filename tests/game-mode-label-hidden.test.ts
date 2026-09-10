import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/view/GameControlsView.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/game/view/GameControlsView.css', import.meta.url), 'utf8');

test('ordinary games fully hide the Daily mode label', () => {
  assert.match(source, /this\.modeLabel\.hidden = mode !== 'daily'/);
  assert.match(css, /\.game-mode-label\[hidden\]\s*\{[\s\S]*?display:\s*none/);
});
