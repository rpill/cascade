import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const playSource = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const thirdPartySource = readFileSync(new URL('../THIRD_PARTY_ASSETS.md', import.meta.url), 'utf8');

const projectFile = (path: string) => new URL(`../${path}`, import.meta.url);

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(stylesSource);
  assert.notEqual(match, null, `missing CSS block ${selector}`);
  return match?.[1] ?? '';
}

test('Home uses a dedicated professional art-icon layer rather than hand-drawn presentation glyphs', () => {
  assert.equal(existsSync(projectFile('src/game/view/ui/HomeArtIcons.ts')), true);
  assert.equal(existsSync(projectFile('public/assets/ui/icons/')), true);
  assert.match(shellSource, /createHomeArtIcon\('rules'\)/);
  assert.match(shellSource, /createHomeArtIcon\('settings'\)/);
  assert.match(playSource, /createHomeArtIcon\(icon\)/);
  assert.match(playSource, /createHomeArtIcon\('trophy'\)/);
});

test('home background uses the real table surface and does not render decorative card props', () => {
  const rootBlocks = stylesSource.match(/\.app-shell-dom\s*\{[\s\S]*?\n\}/g) ?? [];
  const root = rootBlocks.find((rule) => rule.includes('background: var(--app-shell-wood)')) ?? '';
  assert.match(root, /background:\s*var\(--app-shell-wood\)/);
  assert.doesNotMatch(stylesSource, /\.app-shell-decor-card\s*\{/);
  assert.doesNotMatch(shellSource, /app-shell-decor-card|decor-card-back-red\.png|decor-card-queen-spades\.png/);
});

test('ornamented frames use fixed corner artwork without detached ornament DOM nodes', () => {
  const shellFrame = cssBlock('.app-shell-surface::before');
  const cardFrame = cssBlock('.main-shell-mode-card::after');
  assert.match(shellFrame, /var\(--home-corner-tl\)/);
  assert.match(cardFrame, /var\(--home-corner-tl\)/);
  assert.doesNotMatch(shellSource, /app-shell-corner-ornament/);
  assert.doesNotMatch(playSource, /main-shell-card-ornament/);
});

test('shell navigation has one explicit vertical alignment contract', () => {
  const navButton = cssBlock('.app-shell-nav-button');
  assert.match(navButton, /display:\s*(?:inline-)?flex/);
  assert.match(navButton, /align-items:\s*center/);
  assert.match(navButton, /justify-content:\s*center/);
  assert.match(navButton, /height:\s*58px/);
});

test('brand is larger and lifted away from the parchment shell', () => {
  const brand = cssBlock('.app-shell-brand');
  const title = cssBlock('.app-shell-brand-title');
  assert.match(brand, /translateY\(-(?:1[2-9]|[2-9]\d)px\)/);
  assert.match(title, /font-size:\s*clamp\((?:5[0-9]|[6-9]\d)px/);
});

test('third-party inventory records the professional icon license', () => {
  assert.match(thirdPartySource, /Font Awesome Free/i);
  assert.match(thirdPartySource, /CC BY 4\.0/i);
  assert.equal(existsSync(projectFile('public/assets/licenses/fontawesome-free-license.txt')), true);
});
