import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const surface = readFileSync('src/ui/components/ButtonSurface.ts', 'utf8');

test('button skin no longer uses sliced raster chrome', () => {
  assert.doesNotMatch(surface, /buttonJadeLeft|buttonPaperLeft|buttonGoldLeft/);
  assert.doesNotMatch(surface, /setCrop|setTexture|tileSprite/);
  assert.match(surface, /fillRoundedRect/);
  assert.match(surface, /strokeRoundedRect/);
});
