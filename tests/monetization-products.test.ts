import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCoinGrantForProduct,
  getThemeBundleCoinGrant,
  REWARDED_COINS,
  REWARDED_DAILY_LIMIT,
} from '../src/monetization/Products.ts';

test('theme bundle equals 300 coins per released paid theme', () => {
  assert.equal(getThemeBundleCoinGrant(), 2400);
  assert.equal(getCoinGrantForProduct('coins_theme_bundle'), 2400);
});

test('fixed packs and rewarded constants remain stable', () => {
  assert.equal(getCoinGrantForProduct('coins_500'), 500);
  assert.equal(getCoinGrantForProduct('coins_1500'), 1500);
  assert.equal(getCoinGrantForProduct('remove_ads'), null);
  assert.equal(getCoinGrantForProduct('unknown'), null);
  assert.equal(REWARDED_COINS, 25);
  assert.equal(REWARDED_DAILY_LIMIT, 5);
});
