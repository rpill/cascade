import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('home back-to-game button stays high-contrast on the generated wood background', () => {
  assert.match(stylesSource, /\.app-shell-return\s*\{[\s\S]*border:\s*1px solid rgba\(224, 186, 118, 0\.42\)/);
  assert.match(stylesSource, /\.app-shell-return\s*\{[\s\S]*background:\s*linear-gradient\(180deg, rgba\(94, 57, 32, 0\.78\), rgba\(52, 30, 18, 0\.84\)\)/);
  assert.match(stylesSource, /\.app-shell-return\s*\{[\s\S]*color:\s*#f8e8bf/);
  assert.match(stylesSource, /\.app-shell-return\s*\{[\s\S]*text-shadow:\s*0 1px 1px rgba\(14, 8, 5, 0\.72\)/);
  assert.match(stylesSource, /\.app-shell-return:hover\s*\{[\s\S]*color:\s*#fff3d3/);
});
