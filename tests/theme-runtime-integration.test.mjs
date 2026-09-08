import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadTheme } from '../src/theme/ThemeLoader.ts';
import { getThemeAssets } from '../src/theme/ThemeAssets.ts';
import { getTheme } from '../src/theme/ThemeRegistry.ts';

// Only the external downloader is simulated; exercise the real bundle loader.
function downloadingScene() {
  const loaded = new Set();
  const queued = [];
  const load = new EventEmitter();
  let loading = false;
  load.image = (key, url) => queued.push({key, url});
  load.isLoading = () => loading;
  load.start = () => { loading = true; };
  return {scene: {load, events: new EventEmitter(), textures: {exists: key => loaded.has(key)}}, loaded, queued};
}

test('incomplete downloads cannot authorize a partial theme switch', async () => {
  const {scene, loaded, queued} = downloadingScene();
  const result = loadTheme(scene, getTheme());
  queued.slice(1).forEach(asset => loaded.add(asset.key));
  scene.load.emit('complete');
  assert.equal(await result, false);
  assert.equal(scene.events.listenerCount('shutdown'), 0);
});

test('cached theme skips downloads and a complete download succeeds', async () => {
  const {scene, loaded, queued} = downloadingScene();
  const theme = getTheme();
  const result = loadTheme(scene, theme);
  assert.equal(queued.length, 8);
  queued.forEach(asset => loaded.add(asset.key));
  scene.load.emit('complete');
  assert.equal(await result, true);
  queued.length = 0;
  assert.equal(await loadTheme(scene, theme), true);
  assert.equal(queued.length, 0);
});

test('shutdown cancels pending loading and releases listeners', async () => {
  const {scene} = downloadingScene();
  const result = loadTheme(scene, getTheme());
  scene.events.emit('shutdown');
  assert.equal(await result, false);
  assert.equal(scene.load.listenerCount('complete'), 0);
});

test('a failed bundle can retry only its missing resources', async () => {
  const {scene, loaded, queued} = downloadingScene();
  const theme = getTheme();
  getThemeAssets(theme).slice(1).forEach(asset => loaded.add(asset.key));
  const result = loadTheme(scene, theme);
  assert.deepEqual(queued.map(asset => asset.key), [theme.boardSurface.key]);
  loaded.add(theme.boardSurface.key);
  scene.load.emit('complete');
  assert.equal(await result, true);
});
