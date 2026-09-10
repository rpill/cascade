import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(
  new URL('../src/game/view/ThemeCatalogView.css', import.meta.url),
  'utf8',
);

test('wallet capsule has rounding only on the outer clickable button', () => {
  const outer = styles.match(/\.app-shell-wallet-group\s*\{[\s\S]*?\}/)?.[0] ?? '';
  const balance = styles.match(/\.app-shell-wallet\s*\{\s*min-height:\s*34px;[\s\S]*?\}/)?.[0] ?? '';

  assert.match(outer, /border-radius:\s*999px/);
  assert.match(balance, /border-radius:\s*0/);
  assert.match(balance, /box-shadow:\s*none/);
});
