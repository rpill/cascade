import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settingsCss = readFileSync(new URL('../src/game/view/SettingsView.css', import.meta.url), 'utf8');
const themeCatalogCss = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');

test('settings primary action uses the shared wood button treatment', () => {
  assert.match(settingsCss, /\.settings-close \{[\s\S]*background-color:#5d3b24;/);
  assert.match(settingsCss, /\.settings-close \{[\s\S]*var\(--app-shell-wood-detail\)/);
  assert.match(settingsCss, /\.settings-close:hover:not\(:disabled\)/);
});

test('theme catalog cards use ornamented panels and styled action buttons', () => {
  assert.match(themeCatalogCss, /\.theme-catalog-card::before \{/);
  assert.match(themeCatalogCss, /\.theme-catalog-card::after \{[\s\S]*var\(--home-corner-tl\)/);
  assert.match(themeCatalogCss, /\.theme-catalog-card-action \{[\s\S]*background-color: #5d3b24;/);
  assert.match(themeCatalogCss, /\.theme-catalog-card\.is-equipped \.theme-catalog-card-action \{[\s\S]*var\(--app-shell-paper-primary\)/);
});


test('theme catalog keeps ornaments in all four card corners and narrows the bottom action around them', () => {
  assert.match(themeCatalogCss, /\.theme-catalog-card::after \{[\s\S]*inset: 8px;/);
  assert.match(themeCatalogCss, /\.theme-catalog-card-action \{[\s\S]*width: calc\(100% - 64px\);/);
  assert.match(themeCatalogCss, /\.theme-catalog-card-action \{[\s\S]*max-width: 220px;/);
  assert.match(themeCatalogCss, /\.theme-catalog-card-action \{[\s\S]*justify-self: center;/);
});
