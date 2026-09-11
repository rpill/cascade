import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const themeCatalog = readFileSync(new URL('../src/game/view/ThemeCatalogView.ts', import.meta.url), 'utf8');
const purchaseView = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');
const playPage = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const rewardSummary = readFileSync(new URL('../src/game/view/RewardSummaryView.ts', import.meta.url), 'utf8');
const gameComplete = readFileSync(new URL('../src/game/view/GameCompleteView.ts', import.meta.url), 'utf8');
const sharedStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');
const purchaseStyles = readFileSync(new URL('../src/game/view/PurchaseView.css', import.meta.url), 'utf8');


test('coin-facing UI uses explicit coin icon markup instead of plain text-only labels', () => {
  assert.match(themeCatalog, /createCoinInline/);
  assert.match(themeCatalog, /theme-catalog-price-coin/);
  assert.match(themeCatalog, /theme-catalog-action-coin/);

  assert.match(purchaseView, /createCoinInline/);
  assert.match(purchaseView, /purchase-pack-coin/);

  assert.match(playPage, /renderLevelReward/);
  assert.match(playPage, /main-shell-level-reward-coin/);

  assert.match(rewardSummary, /createRewardValueContent/);
  assert.match(rewardSummary, /reward-summary-coin-inline/);

  assert.match(gameComplete, /game-complete-level-reward-coin/);
});


test('shared and modal styles define the coin icon and wood-button presentation', () => {
  assert.match(sharedStyles, /\.coin-inline\s*\{/);
  assert.match(sharedStyles, /\.coin-inline-icon\s*\{/);
  assert.match(sharedStyles, /\.game-complete-level-reward-coin\s*\{/);

  assert.match(shellStyles, /\.main-shell-level-reward\s*\{/);
  assert.match(shellStyles, /\.theme-catalog-action-coin\s*\{/);

  assert.match(purchaseStyles, /var\(--purchase-wood-detail\)/);
  assert.match(purchaseStyles, /\.purchase-pack-button\s*\{/);
  assert.match(purchaseStyles, /\.purchase-close-icon\s*\{/);
  assert.doesNotMatch(purchaseStyles, /content:\s*'●'/);
});
