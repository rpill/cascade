import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const playStyles = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');

test('home footer panels reuse the same paper tone family as the main home cards', () => {
  const progressRule = playStyles.match(/\.main-shell-player-progress\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const actionRule = baseStyles.match(/\.main-shell-weekly,\s*[\r\n]+\.main-shell-secondary-action\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(progressRule, /background-color:\s*var\(--home-card-paper-color\)/);
  assert.match(progressRule, /background-image:\s*var\(--home-card-paper-image\)/);
  assert.match(actionRule, /background-color:\s*var\(--home-card-paper-color\)/);
  assert.match(actionRule, /background-image:\s*var\(--home-card-paper-image\)/);
});

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
