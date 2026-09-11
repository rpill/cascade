import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogCss = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function ruleFor(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
}

test('purchase button uses a dark high-contrast treatment instead of the old pale gold fill', () => {
  const rule = ruleFor(catalogCss, '.theme-catalog-card-action.is-purchase-action');
  assert.match(rule, /background(?:-color)?:\s*#(?:8b3f24|6f321f|5e291a)/i);
  assert.doesNotMatch(rule, /#d7ad55|#f0d88e|#c89437/i);
  assert.match(rule, /color:\s*#(?:ffe8ae|f8e9bf)/i);
});

test('successful theme equip plays a button cue only after accepted equip persistence', () => {
  const equip = scene.match(/private async equipOwnedTheme\(id:string\): Promise<void> \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(equip, /if \(!this\.dispatchMeta\(\{kind:'equip',themeId:id\}\)\) await this\.setTheme\(previous\);\s*else this\.sfxController\.play\('button'\);/);
});

test('statistics summary and leaderboard restore the four corner ornaments', () => {
  assert.match(shellCss, /\.main-shell-statistics-summary::after,\s*\.main-shell-statistics-leaderboard::after\s*\{/);
  assert.match(shellCss, /var\(--home-corner-tl\)[\s\S]*var\(--home-corner-tr\)[\s\S]*var\(--home-corner-br\)[\s\S]*var\(--home-corner-bl\)/);
  assert.match(shellCss, /\.main-shell-statistics-summary > \*,\s*\.main-shell-statistics-leaderboard > \*\s*\{[\s\S]*z-index:\s*1/);
});
