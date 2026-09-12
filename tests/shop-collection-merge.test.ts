import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/game/view/ThemeCatalogView.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('top navigation has collection but no separate shop destination', () => {
  assert.match(shell, /createNavButton\('collection',\s*'КОЛЛЕКЦИЯ'/);
  assert.doesNotMatch(shell, /createNavButton\('shop'/);
  assert.doesNotMatch(shell, /ShellDestination[^\n]*'shop'/);
});

test('collection remains the single place to browse, buy, and equip themes', () => {
  assert.match(catalog, /actions\.buy\(item\.id\)/);
  assert.match(catalog, /actions\.equip\(item\.id\)/);
  assert.match(catalog, /createFilterButton\('all',\s*'Все'\)/);
  assert.match(catalog, /createFilterButton\('mine',\s*'Мои'\)/);
  assert.doesNotMatch(catalog, /ThemeCatalogDestination[^\n]*'shop'/);
  assert.doesNotMatch(catalog, /destination\s*===\s*'shop'/);
});

test('wallet exposes a dedicated purchase entry point and game scene opens it', () => {
  assert.match(shell, /app-shell-wallet-add/);
  assert.match(shell, /actions\.purchases\(\)/);
  assert.match(scene, /purchases:\s*\(\)\s*=>\s*this\.purchaseView\.show\(\)/);
});

test('wallet sheet is rewarded-only and contains no platform purchase actions', () => {
  const purchase = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');
  assert.match(purchase, /actions\.rewarded/);
  assert.match(purchase, /Смотреть рекламу/);
  assert.doesNotMatch(purchase, /COIN_PRODUCT_IDS|REMOVE_ADS_PRODUCT_ID|actions\.purchase/);
});
