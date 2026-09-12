import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const responsive = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');

test('mobile home footer keeps leaderboard and progression blocks at the same height', () => {
  const mobileBlock = responsive.match(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(mobileBlock, /\.main-shell-player-progress\s*\{[^}]*min-height:\s*54px/s);
  assert.match(mobileBlock, /\.main-shell-secondary-action\s*\{[^}]*min-height:\s*54px/s);
});


test('compact landscape stretches footer peers to one row height and keeps ornaments anchored to the inset frame', () => {
  assert.match(responsive, /@media \(max-height: 560px\) and \(min-width: 601px\) \{[\s\S]*?\.main-shell-play-footer \{[^}]*align-items:\s*stretch/s);
  assert.match(responsive, /@media \(max-height: 560px\) and \(min-width: 601px\) \{[\s\S]*?\.main-shell-mode-card::before \{[^}]*inset:\s*5px/s);
  assert.match(responsive, /@media \(max-height: 560px\) and \(min-width: 601px\) \{[\s\S]*?\.main-shell-mode-card::after \{[^}]*inset:\s*6px[^}]*background-size:\s*18px 18px/s);
});
