import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/game/GameHud.ts', 'utf8');

test('HUD button keeps hover state across periodic relayouts', () => {
  assert.match(source, /hovered:\s*boolean/);
  assert.match(source, /button\.hovered\s*=\s*true/);
  assert.match(source, /button\.hovered\s*=\s*false/);
  assert.match(source, /button\.enabled\s*\?\s*\(button\.hovered\s*\?\s*'hover'\s*:\s*'normal'\)\s*:\s*'disabled'/);
});
