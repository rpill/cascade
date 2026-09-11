import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');

test('phone navigation tabs use larger text in both mobile responsive stylesheets', () => {
  assert.ok(baseStyles.includes('  .app-shell-nav-button {\n    height: 36px;\n    min-height: 36px;\n    font-size: 11px;\n  }'));
  assert.ok(responsive.includes('  .app-shell-nav-button { font-size: 12px; height: 44px; min-height: 44px; letter-spacing: 0.01em; padding: 0 2px; }'));
});
