import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesSource.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

test('Home shell ornament uses fixed corner geometry independent of the rounded native outline', () => {
  const rule = ruleFor('.app-shell-surface::before');
  assert.doesNotMatch(rule, /border-image-/);
  assert.match(rule, /background-size:\s*36px 36px/);
  assert.match(rule, /background-repeat:\s*no-repeat/);
});

test('Mode card ornament stays smaller than the shell ornament without freezing border-image geometry', () => {
  const rule = ruleFor('.main-shell-mode-card::after');
  assert.doesNotMatch(rule, /border-image-/);
  assert.match(rule, /background-size:\s*28px 28px/);
  assert.match(rule, /background-repeat:\s*no-repeat/);
});
