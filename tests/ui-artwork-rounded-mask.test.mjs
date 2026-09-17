import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const surface = readFileSync('src/ui/components/UiSurface.ts', 'utf8');
const actionCard = readFileSync('src/ui/components/ActionCard.ts', 'utf8');
const paperPanel = readFileSync('src/ui/components/PaperPanel.ts', 'utf8');

test('decorated UiSurface rounds artwork without WebGL or geometry masks that can clip the image bounds', () => {
  assert.doesNotMatch(surface, /artworkMaskShape/);
  assert.doesNotMatch(surface, /addMask\(/);
  assert.doesNotMatch(surface, /createGeometryMask\(/);
  assert.doesNotMatch(surface, /setMask\(/);
  assert.match(surface, /artworkCorners/);
  assert.match(surface, /drawArtworkCornerCutouts/);
  assert.match(surface, /coverCrop\(/);
});

test('shared decorated card and paper panel backgrounds still flow through UiSurface', () => {
  assert.match(actionCard, /new UiSurface\(/);
  assert.match(paperPanel, /new UiSurface\(/);
});
