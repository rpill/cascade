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

test('Home shell has a CSS-native continuous outline so it stays readable at 100 percent zoom', () => {
  const shell = ruleFor('.app-shell-surface', /background-color:/);
  const ornament = ruleFor('.app-shell-surface::before');
  assert.match(shell, /border:\s*1px solid (?:rgba\(|var\(--home-frame-ink\))/);
  assert.doesNotMatch(ornament, /box-shadow:[\s\S]*0\s+0\s+0\s+1px\s+rgba\(/);
});

test('Mode card frame remains unchanged by the shell-only visibility fix', () => {
  const rule = ruleFor('.main-shell-mode-card::after');
  assert.doesNotMatch(rule, /box-shadow:[\s\S]*0\s+0\s+0\s+1px\s+rgba\(/);
});
