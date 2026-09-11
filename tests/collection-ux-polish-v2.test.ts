import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync(new URL('../src/game/view/ThemeCatalogView.ts', import.meta.url), 'utf8');
const catalogCss = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');
const responsiveCss = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function ruleFor(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
}

test('top navigation keeps every destination dark and uses underline as the active cue', () => {
  const nav = ruleFor(catalogCss, '.app-shell-nav-button');
  assert.match(nav, /color:\s*var\(--ui-ink\)/);
  const active = ruleFor(catalogCss, '.app-shell-nav-button.is-active');
  assert.doesNotMatch(active, /color:\s*rgba\(/);
  const baseShellCss = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(baseShellCss, /\.app-shell-nav-button\.is-active::after\s*\{[\s\S]*transform:\s*scaleX\(1\)/);
});

test('collection filters live in the middle of the compact header instead of consuming their own row', () => {
  assert.match(catalog, /header\.append\(heading,\s*this\.filters,\s*summary\)/);
  assert.match(catalog, /this\.root\.append\(header,\s*this\.status,\s*this\.grid\)/);
  const header = ruleFor(catalogCss, '.theme-catalog-header');
  assert.match(header, /display:\s*grid/);
  assert.match(header, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
  const filters = ruleFor(catalogCss, '.theme-catalog-filters');
  assert.match(filters, /justify-self:\s*center/);
  assert.match(responsiveCss, /\.theme-catalog-header\s*\{[^}]*grid-template-columns:/);
});

test('theme cards restore four-corner ornaments and keep the action clear of them', () => {
  assert.match(catalogCss, /\.theme-catalog-card::before\s*\{/);
  assert.match(catalogCss, /\.theme-catalog-card::after\s*\{[\s\S]*var\(--home-corner-tl\)[\s\S]*var\(--home-corner-br\)/);
  const action = ruleFor(catalogCss, '.theme-catalog-card-action');
  assert.match(action, /width:\s*calc\(100%\s*-\s*64px\)/);
  assert.match(action, /justify-self:\s*center/);
});

test('purchase action is coin-price only and is visually distinct from equip', () => {
  assert.doesNotMatch(catalog, /КУПИТЬ ·/);
  assert.match(catalog, /classList\.add\('is-purchase-action'\)/);
  assert.match(catalog, /classList\.add\('is-equip-action'\)/);
  assert.match(catalog, /createCoinInline\(String\(item\.price\),\s*\{\s*className:\s*'theme-catalog-action-coin'/);
  assert.match(catalogCss, /\.theme-catalog-card-action\.is-purchase-action\s*\{/);
  assert.match(catalogCss, /\.theme-catalog-card-action\.is-equip-action\s*\{/);
});

test('successful theme purchase plays the coin reward cue exactly after accepted purchase', () => {
  const buyTheme = scene.match(/private buyTheme\(id:string\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(buyTheme, /if \(this\.dispatchMeta\(\{kind:'purchase',themeId:id\}\)\)\s*\{[\s\S]*this\.sfxController\.play\('coin-reward'\)/);
  assert.doesNotMatch(buyTheme, /Тема добавлена в коллекцию/);
});
