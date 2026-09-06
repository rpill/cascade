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

test('Home shell and mode cards share one visible outer frame ink contract', () => {
  assert.match(stylesSource, /--home-frame-ink:\s*rgba\(/);
  const shell = ruleFor('.app-shell-surface', /background-color:/);
  const card = ruleFor('.main-shell-mode-card', /background-color:/);
  assert.match(shell, /border:\s*1px solid var\(--home-frame-ink\)/);
  assert.match(card, /border:\s*1px solid var\(--home-frame-ink\)/);
});

test('Home shell has the same kind of rounded inner frame as mode cards', () => {
  assert.match(stylesSource, /--home-frame-ink-soft:\s*rgba\(/);
  const shellInner = ruleFor('.app-shell-surface::after');
  const cardInner = ruleFor('.main-shell-mode-card::before');
  assert.match(shellInner, /border:\s*1px solid var\(--home-frame-ink-soft\)/);
  assert.match(cardInner, /border:\s*1px solid var\(--home-frame-ink-soft\)/);
  assert.match(shellInner, /border-radius:\s*(?:14|16|18)px/);
});
