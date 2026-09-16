import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/components/SceneShell.ts', import.meta.url), 'utf8');

test('SceneShell owns the shared back button and centered Georgia title', () => {
  assert.match(source, /new IconButton/);
  assert.match(source, /UI_ICON_KEYS\.back/);
  assert.match(source, /Georgia, serif/);
  assert.match(source, /computeSceneShellLayout/);
  assert.match(source, /setOrigin\(0\.5\)/);
});
