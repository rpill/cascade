import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function ruleFor(selector: string, marker?: RegExp): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...stylesSource.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'gm'))]
    .map((match) => match[1] ?? '');
  const rule = marker ? matches.find((candidate) => marker.test(candidate)) : matches[0];
  assert.ok(rule, `missing CSS rule for ${selector}`);
  return rule ?? '';
}

function expectRounded(selector: string, marker?: RegExp): void {
  const rule = ruleFor(selector, marker);
  assert.match(rule, /border-radius:\s*(?:var\([^)]*\)|[1-9]\d*px)/);
}

test('mode cards keep a visible rounded native outer border independent of ornament art', () => {
  const card = ruleFor('.main-shell-mode-card', /background-color:/);
  assert.match(card, /border:\s*1px solid (?:rgba\(|var\(--home-frame-ink\))/);
  assert.match(card, /border-radius:\s*(?:var\([^)]*\)|[1-9]\d*px)/);
});

test('mode cards have a separate rounded inner frame so ornament visibility cannot erase the border', () => {
  const inner = ruleFor('.main-shell-mode-card::before');
  assert.match(inner, /border:\s*1px solid (?:rgba\(|var\(--home-frame-ink-soft\))/);
  assert.match(inner, /border-radius:\s*(?:var\([^)]*\)|[1-9]\d*px)/);
  assert.match(inner, /pointer-events:\s*none/);
});

test('Home paper surfaces and wood buttons share a rounded-corner language', () => {
  expectRounded('.app-shell-surface', /background-color:/);
  expectRounded('.main-shell-mode-card', /background-color:/);
  expectRounded('.main-shell-weekly,\n.main-shell-secondary-action');
  expectRounded('.main-shell-mode-play', /background-color:/);
});
