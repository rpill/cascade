import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const statisticsView = readFileSync(new URL('../src/game/view/StatisticsPageView.ts', import.meta.url), 'utf8');
const purchaseCss = readFileSync(new URL('../src/game/view/PurchaseView.css', import.meta.url), 'utf8');
const purchaseView = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');

function ruleFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match?.[1] ?? '';
}

test('statistics summary uses four equal full-width vertical rows', () => {
  const values = ruleFor(styles, '.main-shell-statistics-values');
  assert.match(values, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(values, /grid-template-rows:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);

  const row = ruleFor(styles, '.main-shell-statistics-row');
  assert.match(row, /flex-direction:\s*row/);
  assert.match(row, /align-items:\s*center/);
});

test('visible leaderboard rows are numbered contiguously and player rank follows visible top when present', () => {
  assert.match(statisticsView, /const visibleEntries = state\.entries\.slice\(0, 10\)/);
  assert.match(statisticsView, /visibleEntries\.entries\(\)/);
  assert.match(statisticsView, /index \+ 1/);
  assert.match(statisticsView, /getVisiblePlayerRank\(visibleEntries, state\.playerEntry\)/);
  assert.match(statisticsView, /createLeaderboardRow\(entry, mode, displayRank\)/);
});

test('leaderboard auth action reserves space from decorative bottom corners', () => {
  const auth = ruleFor(styles, '.main-shell-statistics-auth');
  assert.match(auth, /padding:\s*[^;]*18px[^;]*12px|padding-inline:\s*18px/);
});

test('purchase actions use pointer cursors while disabled actions opt out', () => {
  const active = ruleFor(purchaseCss, '.purchase-pack-button');
  assert.match(active, /cursor:\s*pointer/);
  const disabled = ruleFor(purchaseCss, '.purchase-pack-button:disabled');
  assert.match(disabled, /cursor:\s*default/);
});

test('purchase close control has a larger button hit target than its visible circular glyph', () => {
  assert.match(purchaseView, /purchase-close-glyph/);
  const close = ruleFor(purchaseCss, '.purchase-close-icon');
  assert.match(close, /width:\s*52px/);
  assert.match(close, /height:\s*52px/);
  const glyph = ruleFor(purchaseCss, '.purchase-close-glyph');
  assert.match(glyph, /width:\s*38px/);
  assert.match(glyph, /height:\s*38px/);
});
