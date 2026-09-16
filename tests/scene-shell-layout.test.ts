import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import {
  computeNarrowScenePanel,
  computeSceneShellLayout,
} from '../src/ui/layout/SceneShellLayout.ts';

test('desktop shell has square back button, viewport-centered title, and shared content edges', () => {
  const viewport = resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false });
  const shell = computeSceneShellLayout(viewport);

  assert.equal(shell.back.width, shell.back.height);
  assert.equal(shell.back.x, shell.content.x);
  assert.equal(shell.content.x + shell.content.width, viewport.width - shell.content.x);
  assert.equal(shell.title.x + shell.title.width / 2, viewport.width / 2);
  assert.ok(shell.content.y > shell.header.y + shell.header.height);
});

test('mobile-landscape shell preserves the same structural contract', () => {
  const viewport = resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  const shell = computeSceneShellLayout(viewport);

  assert.equal(viewport.profile, 'mobile-landscape');
  assert.equal(shell.back.width, shell.back.height);
  assert.equal(shell.back.x, shell.content.x);
  assert.equal(shell.title.x + shell.title.width / 2, viewport.width / 2);
  assert.ok(shell.content.height > 0);
});

test('narrow panel is centered inside shell content and never exceeds it', () => {
  const viewport = resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false });
  const content = computeSceneShellLayout(viewport).content;
  const panel = computeNarrowScenePanel(content, viewport);

  assert.ok(panel.width <= content.width);
  assert.equal(panel.x + panel.width / 2, content.x + content.width / 2);
  assert.equal(panel.y, content.y);
  assert.equal(panel.height, content.height);
});
