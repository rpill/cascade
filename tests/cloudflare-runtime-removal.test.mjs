import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Yandex Cloud hosting artifacts are gone while Yandex Games tooling remains', () => {
  for (const path of [
    'server/yandex/adapter.ts',
    'server/yandex/config.ts',
    'server/yandex/gateway.openapi.yaml.template',
    'server/yandex/index.ts',
    'scripts/build-yandex-function.mjs',
    'scripts/deploy-yandex-backend.ps1',
    'scripts/render-yandex-gateway.mjs',
    'scripts/yandex-backend-smoke.mjs',
  ]) assert.equal(existsSync(path), false, `${path} must be removed`);

  for (const path of [
    'scripts/yandex-dev-proxy.mjs',
    'scripts/yandex-dev-proxy-lib.mjs',
    'tests/yandex-dev-proxy.test.mjs',
    'tests/yandex-dev-cheats.test.ts',
    'tests/yandex-build-paths.test.ts',
  ]) assert.equal(existsSync(path), true, `${path} must be preserved`);

  assert.ok(pkg.scripts['yandex:dev']);
  assert.equal(Object.keys(pkg.scripts).some((key) => key.startsWith('backend:') && key.endsWith(':yandex')), false);
  assert.equal(existsSync('supabase'), false);
});
