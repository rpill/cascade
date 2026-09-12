import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const purchase = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/game/view/PurchaseView.css', import.meta.url), 'utf8');

test('coin dialog is rewarded-only and exposes no paid purchase controls', () => {
  assert.doesNotMatch(purchase, /COIN_PRODUCT_IDS|REMOVE_ADS_PRODUCT_ID/);
  assert.doesNotMatch(purchase, /actions\.purchase|actions\.retry/);
  assert.doesNotMatch(purchase, /renderPurchaseButton|currencyImageUrl|paymentsStatus/);
  assert.match(purchase, /actions\.rewarded/);
  assert.match(purchase, /rewardedRemaining/);
  assert.match(purchase, /Получайте монеты за просмотр рекламы/);
});

test('wallet invites the player to get coins instead of buying them', () => {
  assert.match(shell, /Получить монеты/);
  assert.doesNotMatch(shell, /Купить монеты/);
});

test('rewarded coin row stays on one line in compact layouts', () => {
  assert.match(styles, /\.purchase-rewarded-remaining\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /\.purchase-rewarded-button\s*\{[^}]*display:\s*inline-flex[^}]*white-space:\s*nowrap/s);
});
