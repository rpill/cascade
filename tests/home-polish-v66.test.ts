import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

function ruleFor(selector: string, marker?: RegExp): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...stylesSource.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'gm'))]
    .map((match) => match[1] ?? '');
  const rule = marker ? matches.find((candidate) => marker.test(candidate)) : matches[0];
  assert.ok(rule, `missing CSS rule for ${selector}`);
  return rule ?? '';
}

test('Home shell uses one restrained continuous outline instead of stacking multiple one-pixel outlines', () => {
  const shell = ruleFor('.app-shell-surface', /background-color:/);
  const ornament = ruleFor('.app-shell-surface::before');

  assert.match(shell, /border:\s*1px solid (?:rgba\(|var\(--home-frame-ink\))/);
  assert.doesNotMatch(shell, /inset\s+0\s+0\s+0\s+1px\s+rgba\(/);
  assert.doesNotMatch(ornament, /box-shadow:\s*0\s+0\s+0\s+1px\s+rgba\(/);
});

test('the whole game host suppresses the browser context menu for DOM and Phaser surfaces', () => {
  assert.match(mainSource, /host\.addEventListener\(['"]contextmenu['"]/);
  assert.match(mainSource, /event\.preventDefault\(\)/);
});
