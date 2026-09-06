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

test('mode card ornaments are four fixed-size corner decorations instead of a faint stretched border-image', () => {
  const ornament = ruleFor('.main-shell-mode-card::after');
  assert.doesNotMatch(ornament, /border-image-/);
  assert.match(ornament, /background-image:\s*var\(--home-corner-tl\),\s*var\(--home-corner-tr\),\s*var\(--home-corner-br\),\s*var\(--home-corner-bl\)/);
  assert.match(ornament, /background-size:\s*28px 28px/);
});

test('the visible Home shell uses an unmistakably rounded native outline and fixed-size ornament corners', () => {
  const shell = ruleFor('.app-shell-surface', /background-color:/);
  const ornament = ruleFor('.app-shell-surface::before');
  assert.match(shell, /border-radius:\s*(?:18|20|22)px/);
  assert.doesNotMatch(ornament, /border-image-/);
  assert.match(ornament, /background-size:\s*36px 36px/);
  assert.match(ornament, /border-radius:\s*(?:14|16|18)px/);
});
