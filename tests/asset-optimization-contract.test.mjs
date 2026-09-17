import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test('heavy panel and rank artwork uses WebP runtime assets', () => {
  const art = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
  for (const name of ['daily-panel-bg.webp', 'mastery-panel-bg.webp', 'leaderboard-panel-bg.webp']) assert.match(art, new RegExp(name.replace('.', '\\.')));
  for (const rank of ['novice','player','tactician','expert','master','grandmaster']) {
    assert.match(art, new RegExp(`rank-${rank}\\.webp`));
    assert.match(art, new RegExp(`rank-leaderboard-${rank}\\.webp`));
  }
  assert.doesNotMatch(art, /rank-[a-z-]+\.svg/);
  assert.doesNotMatch(art, /panel-bg\.png/);
});

test('rules use procedural illustrations and no longer ship legacy SVG screenshots', () => {
  const slides = readFileSync('src/game/view/RulesSlides.ts', 'utf8');
  assert.doesNotMatch(slides, /imageWidth|imageHeight|imageAlt|assets\/rules/);
  assert.equal(existsSync('public/assets/rules'), false);
});

test('runtime asset budget stays under 11 MiB after cleanup', () => {
  const total = walk('public/assets').reduce((sum, p) => sum + statSync(p).size, 0);
  assert.ok(total < 11 * 1024 * 1024, `public/assets is ${(total / 1024 / 1024).toFixed(2)} MiB`);
});
