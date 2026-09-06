import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(stylesSource);
  assert.notEqual(match, null, `missing CSS block ${selector}`);
  return match?.[1] ?? '';
}

test('Home ornament layers use bounded fixed-size corner art rather than stretching one artwork across the panel', () => {
  const shellFrame = cssBlock('.app-shell-surface::before');
  const cardFrame = cssBlock('.main-shell-mode-card::after');

  for (const rule of [shellFrame, cardFrame]) {
    assert.doesNotMatch(rule, /border-image-/);
    assert.match(rule, /background-image:[\s\S]*var\(--home-corner-tl\)[\s\S]*var\(--home-corner-bl\)/);
    assert.match(rule, /background-repeat:\s*no-repeat/);
    assert.doesNotMatch(rule, /background-size:\s*100%\s+100%/);
  }
});

test('nine-slice frame sources are shipped as bounded raster frame atlases', () => {
  assert.match(shellSource, /home-shell-frame-9slice\.png/);
  assert.match(shellSource, /home-mode-card-frame-9slice\.png/);
  assert.equal(existsSync(new URL('../public/assets/ui/frames/home-shell-frame-9slice.png', import.meta.url)), true);
  assert.equal(existsSync(new URL('../public/assets/ui/frames/home-mode-card-frame-9slice.png', import.meta.url)), true);
});
