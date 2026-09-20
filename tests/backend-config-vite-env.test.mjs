import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/backend/BackendConfig.ts', import.meta.url), 'utf8');

test('backend URL uses a direct Vite import.meta.env reference so production builds inline it', () => {
  assert.match(source, /import\.meta\.env\.VITE_BACKEND_URL/);
  assert.doesNotMatch(source, /const\s+meta\s*=\s*import\.meta/);
});

test('backend URL resolver is safe when import.meta.env is absent outside Vite', async () => {
  const { resolveBackendUrl } = await import('../src/backend/BackendConfig.ts');
  assert.equal(resolveBackendUrl(), null);
});
