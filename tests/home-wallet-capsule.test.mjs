import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesSource = readFileSync(new URL('../src/game/view/ThemeCatalogView.css', import.meta.url), 'utf8');

function ruleFor(selector, marker) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...stylesSource.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'gm'))]
    .map((match) => match[1] ?? '');
  const rule = marker ? matches.find((candidate) => marker.test(candidate)) : matches.at(-1);
  assert.ok(rule, `missing CSS rule for ${selector}`);
  return rule ?? '';
}

test('Home wallet balance and add action render as one continuous capsule', () => {
  const group = ruleFor('.app-shell-wallet-group', /overflow:/);
  const wallet = ruleFor('.app-shell-wallet', /border:\s*0/);
  const add = ruleFor('.app-shell-wallet-add', /border-left:/);

  assert.match(group, /gap:\s*0/);
  assert.match(group, /border-radius:\s*999px/);
  assert.match(group, /overflow:\s*hidden/);
  assert.match(group, /background(?:-color|-image)?:/);
  assert.match(group, /border:\s*1px solid/);

  assert.match(wallet, /border:\s*0/);
  assert.match(wallet, /border-radius:\s*0/);
  assert.match(wallet, /background:\s*transparent/);

  assert.match(add, /border:\s*0/);
  assert.match(add, /border-left:\s*1px solid/);
  assert.match(add, /border-radius:\s*0/);
  assert.match(add, /background:\s*transparent/);
});
