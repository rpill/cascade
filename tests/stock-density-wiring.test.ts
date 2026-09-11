import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('BoardView selects stock density from the active viewport profile everywhere', () => {
  const source = readFileSync(new URL('../src/game/view/BoardView.ts', import.meta.url), 'utf8');

  assert.match(
    source,
    /stockVisual\.getLayerOffsets\(this\.layout\.profile\)/,
    'BoardView must derive stock offsets from the current layout profile',
  );
  assert.doesNotMatch(
    source,
    /stockVisual\.layerOffsets/,
    'BoardView must not use profile-agnostic stock offsets',
  );
});
