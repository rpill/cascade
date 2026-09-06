import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const playSource = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('../src/game/view/ui/HomeArtIcons.ts', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const calendarSource = readFileSync(new URL('../public/assets/ui/icons/calendar.svg', import.meta.url), 'utf8');


test('Home uses authored ornament assets without detached corner DOM nodes', () => {
  const ornamentDir = new URL('../public/assets/ui/ornaments/corners/', import.meta.url);
  assert.equal(existsSync(ornamentDir), true);
  assert.match(shellSource, /--home-corner-tl/);
  assert.match(stylesSource, /var\(--home-corner-tl\)/);
  assert.doesNotMatch(shellSource, /app-shell-corner-ornament/);
  assert.doesNotMatch(playSource, /main-shell-card-ornament/);
});

test('mode presentation icons use one clean vector asset language', () => {
  const assetLines = iconSource.match(/\w+:\s*'\.\/assets\/ui\/icons\/[^']+'/g) ?? [];
  assert.ok(assetLines.length >= 7);
  assert.equal(assetLines.every((line) => line.endsWith('.svg\'')), true);
  assert.doesNotMatch(iconSource, /\.png/);
});

test('brand is optically larger and higher without changing the shell material direction', () => {
  const titleRule = stylesSource.match(/\.app-shell-brand-title\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const brandRule = stylesSource.match(/\.app-shell-brand\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(titleRule, /font-size:\s*clamp\([^,]+,[^,]+,\s*(?:6[4-9]|[7-9]\d)px\)/);
  assert.match(brandRule, /translateY\(-(?:1[2-9]|[2-9]\d)px\)/);
});

test('navigation has an explicit optical baseline correction instead of relying on font metrics alone', () => {
  const navButtonRule = stylesSource.match(/\.app-shell-nav-button\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(navButtonRule, /--app-shell-nav-optical-offset/);
  assert.match(navButtonRule, /translateY\(var\(--app-shell-nav-optical-offset\)\)/);
});

test('footer emphasis and calendar detail read as finished iconography', () => {
  assert.match(stylesSource, /\.main-shell-leaderboard-icon\s*\{\s*color:\s*#(?:a77a23|b18228|b78a2c)/i);
  const detailCount = (calendarSource.match(/<(?:path|rect)\b/g) ?? []).length;
  assert.ok(detailCount >= 3, `calendar should have interior day detail, got ${detailCount} shapes`);
});

test('primary Play buttons use wood grain rather than a repeated paper texture', () => {
  const playRules = stylesSource.match(/\.main-shell-mode-play\s*\{[\s\S]*?\n\}/g) ?? [];
  const playRule = playRules.find((rule) => rule.includes('background-image')) ?? '';
  assert.match(playRule, /var\(--app-shell-wood-detail\)|var\(--app-shell-wood\)/);
  assert.doesNotMatch(playRule, /var\(--app-shell-paper-warm\)/);
  assert.match(playRule, /no-repeat|background-repeat:\s*no-repeat/);
});
