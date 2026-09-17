import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const gameScene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/game/view/ViewportLayout.ts', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('../src/game/view/TableAppearanceView.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/ui/scenes/SettingsScene.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('runtime UI is canvas-only and no legacy DOM layout is mounted', () => {
  for (const token of [
    'AppShellView', 'PlayPageView', 'ThemeCatalogView', 'SettingsView',
    'PurchaseView', 'RulesView', 'StatisticsPageView', 'GameControlsView',
  ]) assert.doesNotMatch(gameScene, new RegExp(token));
  assert.doesNotMatch(main, /game\/view\/(?:ThemeCatalogView|SettingsView|PurchaseView|NewDealConfirmView|MenuResponsive)\.css/);
  assert.match(gameScene, /GameHud/);
  assert.match(gameScene, /SceneBackdrop/);
});

test('Cascade keeps its board geometry but reserves the Trifold-style right HUD rail', () => {
  for (const token of ['homeControl', 'newDealControl', 'undoControl']) assert.match(layout, new RegExp(token));
  assert.match(layout, /controlRailWidth/);
  assert.match(layout, /tableauX/);
  assert.match(layout, /foundations/);
});

test('table appearance is flat canvas styling rather than old themed HTML-like surface assets', () => {
  assert.doesNotMatch(appearance, /TableSurfaceView|getSlotFrameAsset|getSlotGlyphAsset/);
  assert.match(appearance, /Phaser\.GameObjects\.Graphics/);
  assert.match(appearance, /strokeRoundedRect/);
});

test('settings can be opened from the canvas game HUD and return to the paused game scene', () => {
  assert.match(settings, /returnScene/);
  assert.match(settings, /service-overlay-closed/);
  assert.match(settings, /scene\.resume\(returnScene\)/);
  assert.match(settings, /this\.refreshState\(\);/);
  assert.doesNotMatch(settings, /if\s*\(\s*!this\.isUiSceneActive\(\)\s*\)\s*return/);
});

test('Cascade table slots use the shared flat gold edge treatment while keeping Cascade geometry', () => {
  assert.match(appearance, /UI_TOKENS\.color\.gold/);
  assert.match(appearance, /UI_TOKENS\.color\.goldLight/);
  assert.match(appearance, /slot\.kind === 'foundation'/);
  assert.match(appearance, /slot\.kind === 'tableau'/);
  assert.match(appearance, /strokeRoundedRect/);
});

test('global CSS only hosts the canvas and contains no legacy DOM game layout', () => {
  assert.doesNotMatch(styles, /\.game-controls|\.app-shell-dom|\.ui-icon-control|#game::after/);
  assert.match(styles, /html[\s\S]*body[\s\S]*#game/);
  assert.match(styles, /canvas\s*\{/);
});
