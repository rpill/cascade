import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const controlsSource = readFileSync(
  new URL('../src/game/view/GameControlsView.ts', import.meta.url),
  'utf8',
);
const controlsPolishStylesSource = readFileSync(
  new URL('../src/game/view/GameControlsView.css', import.meta.url),
  'utf8',
);
const gameSceneSource = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('../src/styles.css', import.meta.url),
  'utf8',
);

test('Home is visually separated from destructive deal actions', () => {
  assert.match(stylesSource, /--ui-home-gap:\s*24px/);
  assert.match(stylesSource, /\.game-control-home\s*\{[\s\S]*margin-left:/);
});


test('gameplay removes the decorative perimeter frame and shows the active mode without changing board geometry', () => {
  assert.match(
    controlsPolishStylesSource,
    /#game:has\(\.game-hud\)::after\s*\{[^}]*display:\s*none/s,
  );
  assert.match(controlsSource, /game-mode-label/);
  assert.match(controlsSource, /winnable:\s*['"]STANDARD['"]/);
  assert.match(controlsSource, /original:\s*['"]CLASSIC['"]/);
  assert.match(controlsSource, /daily:\s*['"]DAILY['"]/);
  assert.match(gameSceneSource, /gameControls\.setMode\(gameState\.mode\)/);
});

test('hybrid shell uses one quiet parchment surface instead of the legacy framed modal stack', () => {
  assert.match(stylesSource, /\.app-shell-surface\s*\{[\s\S]*--ui-parchment/);
  assert.match(stylesSource, /\.main-shell-mode-grid\s*\{[\s\S]*repeat\(3/);
  assert.match(stylesSource, /\.main-shell-mode-card\s*\{[\s\S]*--ui-parchment-light/);
  assert.doesNotMatch(stylesSource, /\.main-menu-panel|\.main-menu-divider|\.main-menu-weekly-milestones/);
});

test('shell navigation is text-first with a restrained active underline rather than boxed buttons', () => {
  const navRule = stylesSource.match(/\.app-shell-nav-button\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(navRule, /border:\s*0/);
  assert.match(navRule, /background:\s*transparent/);
  assert.match(stylesSource, /\.app-shell-nav-button\.is-active::after/);
});

test('hybrid shell presents an opaque wood scene with a compact parchment work surface', () => {
  const rootRules = stylesSource.match(/\.app-shell-dom\s*\{[\s\S]*?\n\}/g) ?? [];
  const rootRule = rootRules.find((rule) => rule.includes('--app-shell-wood')) ?? '';
  const surfaceRules = stylesSource.match(/\.app-shell-surface\s*\{[\s\S]*?\n\}/g) ?? [];
  const surfaceRule = surfaceRules.find((rule) => rule.includes('height: min(')) ?? '';
  assert.match(rootRule, /background[\s\S]*var\(--app-shell-wood\)/);
  assert.match(stylesSource, /\.app-shell-topbar,\s*\n\.app-shell-surface\s*\{[\s\S]*width:\s*min\(9\d\dpx/);
  assert.match(surfaceRule, /height:\s*min\(5\d\dpx/);
  assert.doesNotMatch(surfaceRule, /1180px|740px/);
});

test('hybrid shell separates the wood brand header from the parchment content surface', () => {
  assert.match(stylesSource, /\.app-shell-topbar\s*\{/);
  assert.match(stylesSource, /\.app-shell-decor-card\s*\{/);
  assert.match(stylesSource, /\.main-shell-mode-card::after\s*\{/);
});


test('Home presentation uses photographed paper and visible source ornaments rather than generated placeholder frames', () => {
  assert.match(stylesSource, /var\(--app-shell-paper-primary\)/);
  assert.match(stylesSource, /var\(--home-corner-tl\)/);
  assert.match(stylesSource, /var\(--home-corner-br\)/);
  assert.match(stylesSource, /\.app-shell-brand-flourish/);
  assert.doesNotMatch(stylesSource, /var\(--app-shell-paper-fiber\)|var\(--app-shell-frame\)|var\(--app-shell-mode-frame\)/);
});

test('mode cards and primary play actions have card-like proportions and softer controls', () => {
  const cardRules = stylesSource.match(/\.main-shell-mode-card\s*\{[\s\S]*?\n\}/g) ?? [];
  const cardRule = cardRules.find((rule) => rule.includes('aspect-ratio')) ?? '';
  const playRules = stylesSource.match(/\.main-shell-mode-play\s*\{[\s\S]*?\n\}/g) ?? [];
  const playRule = playRules.find((rule) => /min-height:\s*(?:4[0-9]|[5-9]\d)px/.test(rule)) ?? '';
  assert.match(cardRule, /aspect-ratio/);
  assert.match(cardRule, /border-radius:\s*(?:[6-9]|\d{2,})px/);
  assert.match(playRule, /border-radius:\s*(?:[6-9]|\d{2,})px/);
  assert.match(playRule, /min-height:\s*(?:4[0-9]|[5-9]\d)px/);
});

test('weekly footer is icon-led and its progress pips are not tiny debug dots', () => {
  assert.match(stylesSource, /\.main-shell-week-dot\s*\{[\s\S]*width:\s*(?:1[1-9]|[2-9]\d)px/);
  assert.match(stylesSource, /\.main-shell-weekly-icon/);
  assert.match(stylesSource, /\.main-shell-leaderboard-icon/);
});
