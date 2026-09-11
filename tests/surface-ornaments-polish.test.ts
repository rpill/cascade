import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settingsView = readFileSync(new URL('../src/game/view/SettingsView.ts', import.meta.url), 'utf8');
const purchaseView = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');
const rulesView = readFileSync(new URL('../src/game/view/RulesView.ts', import.meta.url), 'utf8');
const settingsCss = readFileSync(new URL('../src/game/view/SettingsView.css', import.meta.url), 'utf8');
const purchaseCss = readFileSync(new URL('../src/game/view/PurchaseView.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('settings, purchases and how-to dialogs all receive shell paper + corner assets', () => {
  for (const source of [settingsView, purchaseView, rulesView]) {
    assert.match(source, /setProperty\('--app-shell-paper-primary'/);
    assert.match(source, /setProperty\('--home-corner-tl'/);
    assert.match(source, /setProperty\('--home-corner-tr'/);
    assert.match(source, /setProperty\('--home-corner-br'/);
    assert.match(source, /setProperty\('--home-corner-bl'/);
  }
});

test('settings and purchases use decorated parchment dialog chrome', () => {
  for (const css of [settingsCss, purchaseCss]) {
    assert.match(css, /background-image:[\s\S]*var\(--app-shell-paper-primary\)/);
    assert.match(css, /::before \{[\s\S]*var\(--home-corner-tl\)[\s\S]*var\(--home-corner-bl\)/);
    assert.match(css, /::after \{[\s\S]*border:\s*1px solid var\(--home-frame-ink-soft\)/);
  }
});

test('rules dialog and statistics panels reuse the same ornament treatment', () => {
  assert.match(styles, /\.rules-dialog\.main-shell-rules \{[\s\S]*background-image:[\s\S]*var\(--app-shell-paper-primary\)/);
  assert.match(styles, /\.rules-dialog\.main-shell-rules::before \{[\s\S]*var\(--home-corner-tl\)[\s\S]*var\(--home-corner-bl\)/);
  assert.match(styles, /\.main-shell-statistics-summary::after,[\s\S]*\.main-shell-statistics-leaderboard::after \{[\s\S]*var\(--home-corner-tl\)/);
  assert.match(styles, /\.main-shell-statistics-summary::before,[\s\S]*\.main-shell-statistics-leaderboard::before \{[\s\S]*border:\s*1px solid var\(--home-frame-ink-soft\)/);
});
