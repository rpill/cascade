import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as catalog from '../src/theme/ThemeCatalog.ts';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { computeThemesGridLayout } from '../src/ui/themes/ThemesGridLayout.ts';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import { computeSceneShellLayout } from '../src/ui/layout/SceneShellLayout.ts';

const scene=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
const themes=readFileSync(new URL('../src/ui/scenes/ThemesScene.ts',import.meta.url),'utf8');
const complete=readFileSync(new URL('../src/game/view/GameCompleteView.ts',import.meta.url),'utf8');

const hasAffordableUnownedTheme=(catalog as any).hasAffordableUnownedTheme as (coins:number,owned:readonly string[])=>boolean;
const didCoinsUnlockThemePurchase=(catalog as any).didCoinsUnlockThemePurchase as (before:number,after:number,owned:readonly string[])=>boolean;

test('catalog exposes whether the player can afford an unowned released theme',()=>{
  assert.equal(hasAffordableUnownedTheme(299,['walnut_study']),false);assert.equal(hasAffordableUnownedTheme(300,['walnut_study']),true);assert.equal(hasAffordableUnownedTheme(999999,catalog.THEME_CATALOG.map(x=>x.id)),false);
});

test('coin gain can flag that the new Trifold Themes screen just became affordable',()=>{
  assert.equal(didCoinsUnlockThemePurchase(275,325,['walnut_study']),true);
  assert.match(scene,/themePurchaseUnlocked/);assert.match(complete,/themePurchaseUnlocked/);assert.match(themes,/CoinPill/);
});

test('Trifold Themes grid keeps three columns in compact landscape',()=>{
  const viewport=resolveUiViewport({width:882,height:440,touchPrimary:true});
  const content=computeSceneShellLayout(viewport).content;
  const layout=computeThemesGridLayout(viewport,content,6);
  assert.equal(layout.columns,3);
  assert.equal(layout.content.x,content.x);
  assert.equal(layout.content.width,content.width);
  assert.equal(layout.cards.length,6);
  assert.ok(layout.cards[1]!.x>layout.cards[0]!.x);
  assert.ok(layout.cards[2]!.x>layout.cards[1]!.x);
  assert.equal(layout.cards[3]!.x,layout.cards[0]!.x);
  assert.ok(layout.cards[0]!.height >= 105, `mobile theme cards should not be squashed: ${layout.cards[0]!.height}`);
});

test('compact gameplay board still keeps foundation rail independent from main play',()=>{
  const layout=calculateViewportLayout(882,440);assert.equal(layout.profile,'compact-landscape');assert.equal(layout.mainPlayBounds.y,layout.stock.y);assert.ok(layout.foundations[0]!.y<layout.stock.y+layout.cardHeight);
});
