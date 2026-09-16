import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';

test('Phaser HUD exposes localized Restart label', () => {
  const input = {
    difficulty: 'easy' as const,
    moves: 0,
    activeMs: 0,
    canUndo: false,
    coins: 0,
    hintEligible: false,
    newDealEnabled: true,
  };
  assert.equal(buildGameHudViewModel(input, 'ru').restartLabel, 'Заново');
  assert.equal(buildGameHudViewModel(input, 'en').restartLabel, 'Restart');
});

test('Phaser HUD places Restart between New Deal and Undo', () => {
  const layout = calculateGameHudLayout(calculateViewportLayout(1728, 864));
  assert.ok(layout.newDeal.y < layout.restart.y);
  assert.ok(layout.restart.y < layout.undo.y);
  assert.ok(layout.undo.y < layout.hint.y);
  assert.ok(layout.hint.y < layout.settings.y);
});

test('Phaser HUD wires Restart to same-deal restart and has a dedicated icon asset', () => {
  const hud = readFileSync(new URL('../src/ui/game/GameHud.ts', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
  const assets = readFileSync(new URL('../src/ui/assets/UiAssets.ts', import.meta.url), 'utf8');

  assert.match(hud, /readonly restart: \(\) => void/);
  assert.match(hud, /UI_ICON_KEYS\.restart/);
  assert.match(scene, /restart: \(\) => this\.restartDeal\(\)/);
  assert.match(assets, /restart:\s*'ui\.icon\.restart'/);
  assert.match(assets, /restart:'restart\.svg'/);
  assert.equal(existsSync(new URL('../public/assets/ui/icons/restart.svg', import.meta.url)), true);
});
