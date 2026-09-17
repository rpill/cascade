import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';

test('game HUD removes Settings and groups frequent actions before destructive actions', () => {
  const viewport = calculateViewportLayout(1728, 864);
  const hud = calculateGameHudLayout(viewport, true);

  assert.equal('settings' in hud, false);
  assert.equal(hud.home.width, hud.undo.width);
  assert.equal(hud.home.height, hud.undo.height);
  assert.ok(hud.home.y < hud.undo.y);
  assert.ok(hud.undo.y < hud.hint.y);
  assert.ok(hud.hint.y < hud.restart.y);
  assert.ok(hud.restart.y < hud.newDeal.y);
  const intraGroupGap = hud.hint.y - (hud.undo.y + hud.undo.height);
  const navGap = hud.undo.y - (hud.home.y + hud.home.height);
  const destructiveGroupGap = hud.restart.y - (hud.hint.y + hud.hint.height);
  const metricsGap = hud.metrics.y - (hud.newDeal.y + hud.newDeal.height);
  assert.ok(navGap > intraGroupGap, `expected nav gap ${navGap} > intra-group gap ${intraGroupGap}`);
  assert.ok(destructiveGroupGap > intraGroupGap, `expected destructive group gap ${destructiveGroupGap} > intra-group gap ${intraGroupGap}`);
  assert.ok(metricsGap >= intraGroupGap, `expected metrics gap ${metricsGap} >= intra-group gap ${intraGroupGap}`);
  assert.ok(metricsGap <= destructiveGroupGap, `expected metrics gap ${metricsGap} <= destructive group gap ${destructiveGroupGap}`);
  assert.ok(hud.metrics.height > viewport.homeControl.height * 4.1, `metrics block should fill the remaining rail height: ${hud.metrics.height}`);
  assert.equal(Math.round(hud.metrics.y + hud.metrics.height), Math.round(viewport.boardBounds.y + viewport.boardBounds.height));
});

test('Daily keeps the same hierarchy without a New Deal slot', () => {
  const viewport = calculateViewportLayout(1728, 864);
  const hud = calculateGameHudLayout(viewport, false);
  assert.ok(hud.home.y < hud.undo.y);
  assert.ok(hud.undo.y < hud.hint.y);
  assert.ok(hud.hint.y < hud.restart.y);
  const dailyMetricsGap = hud.metrics.y - (hud.restart.y + hud.restart.height);
  assert.ok(dailyMetricsGap >= 10 && dailyMetricsGap <= 54, `unexpected Daily metrics gap: ${dailyMetricsGap}`);
  assert.equal(Math.round(hud.metrics.y + hud.metrics.height), Math.round(viewport.boardBounds.y + viewport.boardBounds.height));
});

test('New Deal keeps the short label and Home is full-width with its label', () => {
  const ru = buildGameHudViewModel({ moves: 0, activeMs: 0, canUndo: false, hintEligible: false, newDealEnabled: true }, 'ru');
  assert.equal(ru.newDealLabel, 'Новая');

  const hudSource = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  const sceneSource = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  assert.doesNotMatch(hudSource, /readonly settings:/);
  assert.doesNotMatch(hudSource, /this\.buttons\.settings/);
  assert.match(hudSource, /home: this\.createButton\([^\n]+true, wrap\(actions\.home\), depth, false/);
  assert.doesNotMatch(sceneSource, /settings: \(\) => this\.openSettingsFromGame\(\)/);
});
