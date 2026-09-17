import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const surface = readFileSync('src/ui/components/ButtonSurface.ts', 'utf8');
const art = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');

test('button chrome uses pre-sliced assets instead of cropping stretched images at runtime', () => {
  assert.match(surface, /buttonJadeLeft/);
  assert.match(surface, /buttonJadeCenter/);
  assert.match(surface, /buttonJadeRight/);
  assert.doesNotMatch(surface, /\.setCrop\(/);
});

test('all generated button slice assets are registered centrally', () => {
  for (const key of [
    'buttonJadeLeft', 'buttonJadeCenter', 'buttonJadeRight',
    'buttonPaperLeft', 'buttonPaperCenter', 'buttonPaperRight',
    'buttonGoldLeft', 'buttonGoldCenter', 'buttonGoldRight',
    'buttonIconJade',
  ]) {
    assert.match(art, new RegExp(`${key}:`));
  }
});

test('game-table HUD remains on its old surface implementation', () => {
  assert.doesNotMatch(hud, /ButtonSurface/);
  assert.match(hud, /UiSurface/);
});

test('modal close action uses the shared rounded button skin', () => {
  const modal = readFileSync('src/ui/components/ModalShell.ts', 'utf8');
  assert.match(modal, /ButtonSurface/);
  assert.match(modal, /closeSurface/);
});
