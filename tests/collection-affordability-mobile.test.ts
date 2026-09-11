import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as catalog from '../src/theme/ThemeCatalog.ts';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';

const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const completeSource = readFileSync(new URL('../src/game/view/GameCompleteView.ts', import.meta.url), 'utf8');
const rewardSource = readFileSync(new URL('../src/game/view/RewardSummaryView.ts', import.meta.url), 'utf8');
const responsiveCss = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');

const hasAffordableUnownedTheme = (catalog as unknown as {
  hasAffordableUnownedTheme?: (coins: number, owned: readonly string[]) => boolean;
}).hasAffordableUnownedTheme;
const didCoinsUnlockThemePurchase = (catalog as unknown as {
  didCoinsUnlockThemePurchase?: (beforeCoins: number, afterCoins: number, owned: readonly string[]) => boolean;
}).didCoinsUnlockThemePurchase;

test('catalog exposes whether the player can afford any unowned released theme', () => {
  assert.equal(typeof hasAffordableUnownedTheme, 'function');
  assert.equal(hasAffordableUnownedTheme!(299, ['walnut_study']), false);
  assert.equal(hasAffordableUnownedTheme!(300, ['walnut_study']), true);
  assert.equal(hasAffordableUnownedTheme!(999_999, ['walnut_study', 'navy_study', 'burgundy_club']), false);
});

test('unlock detection only fires when coin gain crosses from unavailable to available', () => {
  assert.equal(typeof didCoinsUnlockThemePurchase, 'function');
  assert.equal(didCoinsUnlockThemePurchase!(275, 325, ['walnut_study']), true);
  assert.equal(didCoinsUnlockThemePurchase!(325, 375, ['walnut_study']), false);
  assert.equal(didCoinsUnlockThemePurchase!(275, 325, ['walnut_study', 'navy_study', 'burgundy_club']), false);
});

test('collection success chatter is removed and the shell gets a live purchase-availability badge', () => {
  assert.doesNotMatch(sceneSource, /Тема применена/);
  assert.doesNotMatch(sceneSource, /Тема добавлена в коллекцию/);
  assert.match(shellSource, /setCollectionPurchaseAvailable\(available: boolean\)/);
  assert.match(shellSource, /has-theme-purchase/);
  assert.match(sceneSource, /setCollectionPurchaseAvailable\(/);
  assert.match(sceneSource, /hasAffordableUnownedTheme\(/);
});

test('compact landscape collection uses two cards per row', () => {
  const compactBlock = responsiveCss.match(/@media \(max-height: 560px\) and \(min-width: 601px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(compactBlock, /\.theme-catalog-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(responsiveCss, /@media \(max-width: 600px\) and \(max-height: 560px\) \{[\s\S]*?\.theme-catalog-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('level reward UI can announce that a theme purchase has just become available', () => {
  assert.match(sceneSource, /didCoinsUnlockThemePurchase/);
  assert.match(sceneSource, /themePurchaseUnlocked/);
  assert.match(completeSource, /themePurchaseUnlocked/);
  assert.match(completeSource, /Доступны новые темы в коллекции/);
  assert.match(rewardSource, /themePurchaseUnlocked/);
  assert.match(rewardSource, /Доступны новые темы в коллекции/);
});

test('compact board lowers main play without pushing down the foundation rail', () => {
  const layout = calculateViewportLayout(882, 440);
  assert.equal(layout.profile, 'compact-landscape');
  assert.ok(layout.stock.y >= layout.boardBounds.y + 10, `stock.y=${layout.stock.y}, board.y=${layout.boardBounds.y}`);
  assert.equal(layout.mainPlayBounds.y, layout.stock.y);
  assert.equal(layout.wasteLaneBounds.y, layout.stock.y);
  assert.ok(layout.foundations[0]!.y < layout.stock.y + layout.cardHeight, 'foundation rail should keep its independent vertical placement');
});
