import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';

test('compact landscape reserves enough room for the bottom metrics card', () => {
  const viewport = calculateViewportLayout(667, 375);
  const hud = calculateGameHudLayout(viewport, true);
  const boardBottom = viewport.boardBounds.y + viewport.boardBounds.height;

  assert.equal(viewport.profile, 'compact-landscape');
  assert.ok(hud.metrics.height >= 90, `expected >= 90px for metrics, got ${hud.metrics.height}`);
  assert.ok(hud.metrics.y + hud.metrics.height <= boardBottom + 0.001);
  assert.ok(hud.settings.y + hud.settings.height < hud.metrics.y);
});

test('very short compact landscape still keeps controls and metrics inside the board rail', () => {
  const viewport = calculateViewportLayout(740, 360);
  const hud = calculateGameHudLayout(viewport, true);
  const boardBottom = viewport.boardBounds.y + viewport.boardBounds.height;

  assert.ok(hud.home.y >= viewport.boardBounds.y);
  assert.ok(hud.home.y < hud.newDeal.y);
  assert.ok(hud.newDeal.y < hud.restart.y);
  assert.ok(hud.restart.y < hud.undo.y);
  assert.ok(hud.undo.y < hud.hint.y);
  assert.ok(hud.hint.y < hud.settings.y);
  assert.ok(hud.metrics.height >= 90, `expected >= 90px for metrics, got ${hud.metrics.height}`);
  assert.ok(hud.metrics.y + hud.metrics.height <= boardBottom + 0.001);
});
