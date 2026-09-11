import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('how-to-play overlay keeps its paper dialog surface instead of falling back to browser dialog styling', () => {
  assert.match(css, /\.rules-dialog\.main-shell-rules\s*\{[\s\S]*?background-image:[\s\S]*?var\(--app-shell-paper-primary\)/);
  assert.match(css, /\.rules-dialog::backdrop\s*\{[^}]*background:/);
  assert.match(css, /\.main-shell-rules-close\s*\{[^}]*border-radius:\s*50%/);
  assert.match(css, /\.main-shell-rules-finish\s*\{[^}]*background-image:/);
});

test('how-to-play overlay preserves full-height compact mobile navigation targets', () => {
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.rules-dialog \.main-shell-rules-arrow\s*\{[^}]*min-height:\s*100%/);
  assert.match(css, /@media \(max-height: 560px\)[\s\S]*?\.rules-dialog\.main-shell-rules\s*\{[^}]*height:\s*calc\(100dvh - 20px\)/);
});
