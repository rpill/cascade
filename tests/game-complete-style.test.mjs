import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');

test('victory panel has a compact celebratory hierarchy and animated level progress', () => {
  assert.match(css, /\.game-complete-panel\s*\{[^}]*width:\s*min\(460px/s);
  assert.match(css, /\.game-complete-time\s*\{[^}]*font:[^}]*32px/s);
  assert.match(css, /\.game-complete-progression\s*\{/);
  assert.match(css, /\.game-complete-xp-fill\s*\{[^}]*transition-property:\s*width/s);
  assert.match(css, /\.game-complete-level-reward\.is-visible/);
  assert.match(themeCss, /\.main-shell-xp-fill\s*\{[^}]*#2f7049[^}]*#4f9264/s);
  assert.match(css, /\.game-complete-panel\s*\{[^}]*border-radius:\s*20px/s);
  assert.match(css, /\.game-complete-panel::before[^]*var\(--victory-corner-tl\)/);
  assert.match(css, /\.game-complete-actions \.daily-complete-button\s*\{[^}]*border-radius:\s*10px[^}]*var\(--victory-wood-detail\)/s);
  assert.match(css, /@keyframes game-complete-confetti-fall/);
  assert.match(css, /\.game-complete-coin-icon/);
});
