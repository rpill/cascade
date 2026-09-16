import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('desktop to mobile to desktop sync cannot retain stale mobile canvas CSS dimensions', () => {
  const syncStart = main.indexOf('const syncCanvasDensity');
  const syncEnd = main.indexOf('const observer = new ResizeObserver', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  const sync = main.slice(syncStart, syncEnd);

  assert.match(sync, /game\.canvas\.style\.width\s*=\s*`\$\{next\.logicalWidth\}px`/);
  assert.match(sync, /game\.canvas\.style\.height\s*=\s*`\$\{next\.logicalHeight\}px`/);

  const resizeIndex = sync.indexOf('game.scale.resize');
  const zoomIndex = sync.indexOf('game.scale.setZoom');
  assert.ok(resizeIndex >= 0 && zoomIndex >= 0);
  assert.ok(resizeIndex < zoomIndex, 'backing-store resize must happen before changing Phaser zoom');
});
