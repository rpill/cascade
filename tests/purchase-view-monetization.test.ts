import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');

test('purchase view uses monetization products, rewarded state, SDK currency and retry without hard-coded portal prices', () => {
  assert.doesNotMatch(source, /\b4000\b/);
  assert.doesNotMatch(source, /\b39\b|\b89\b|\b129\b|\b99\b|Yan/);
  assert.match(source, /COIN_PRODUCT_IDS/);
  assert.match(source, /rewarded/);
  assert.match(source, /currencyImageUrl/);
  assert.match(source, /actions\.retry/);
  assert.match(source, /getThemeBundleCoinGrant|getCoinGrantForProduct/);
});
