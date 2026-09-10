import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');

test('BootScene preloads and decodes the verified deal catalog before GameScene starts', () => {
  assert.match(source, /verified-deals-binary/);
  assert.match(source, /verified-deals-manifest/);
  assert.match(source, /load\.binary\([^]*verified-deals\.bin/);
  assert.match(source, /load\.json\([^]*verified-deals-manifest\.json/);
  assert.match(source, /VerifiedDealCatalog\.decode/);
  assert.match(source, /VERIFIED_DEALS_REGISTRY_KEY\s*=\s*'verified-deal-catalog'/);
  assert.match(source, /registry\.set\(VERIFIED_DEALS_REGISTRY_KEY,\s*catalog\)/);
  const registry = source.indexOf('registry.set');
  const start = source.indexOf("scene.start('GameScene')");
  assert.ok(registry >= 0 && start > registry, 'catalog must be registered before GameScene starts');
});
