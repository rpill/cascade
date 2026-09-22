import test from 'node:test';
import assert from 'node:assert/strict';
import { setupD1 } from '../scripts/setup-cloudflare-d1.mjs';

function baseConfig() {
  return {
    name: 'cascade-api',
    vars: { CASCADE_ALLOWED_ORIGINS: 'http://localhost:5173' },
    d1_databases: [{ binding: 'OLD', database_name: 'other-db', database_id: 'other' }],
  };
}

async function ignorePersist() {}



test('setup persists DB binding before applying remote migrations', async () => {
  const events = [];
  const runner = async (args) => {
    const command = args.join(' ');
    if (command === 'd1 list --json') return JSON.stringify([{ name: 'cascade-db', uuid: 'db-uuid' }]);
    if (command === 'd1 migrations apply cascade-db --remote') {
      assert.equal(events.at(-1), 'persist');
      return 'applied';
    }
    throw new Error(`unexpected: ${command}`);
  };
  const persistConfig = async (nextConfig) => {
    assert.equal(nextConfig.d1_databases.find((x) => x.binding === 'DB')?.database_id, 'db-uuid');
    events.push('persist');
  };

  await setupD1({ config: baseConfig(), runWrangler: runner, persistConfig });
  assert.deepEqual(events, ['persist']);
});
test('setup reuses existing cascade-db and writes one DB binding', async () => {
  const calls = [];
  const config = baseConfig();
  const runner = async (args) => {
    calls.push(args);
    if (args.join(' ') === 'd1 list --json') return JSON.stringify([{ name: 'cascade-db', uuid: 'db-uuid' }]);
    if (args.join(' ') === 'd1 migrations apply cascade-db --remote') return '';
    throw new Error(`unexpected: ${args.join(' ')}`);
  };
  const result = await setupD1({ config, runWrangler: runner, persistConfig: ignorePersist });
  assert.equal(calls.some((args) => args.includes('create')), false);
  assert.deepEqual(result.d1_databases.filter((x) => x.binding === 'DB'), [{
    binding: 'DB', database_name: 'cascade-db', database_id: 'db-uuid', migrations_dir: 'migrations',
  }]);
  assert.deepEqual(result.d1_databases.find((x) => x.binding === 'OLD'), config.d1_databases[0]);
  assert.deepEqual(result.vars, config.vars);
});

test('setup creates cascade-db only when missing and a second invocation reuses it', async () => {
  let exists = false;
  let createCalls = 0;
  const runner = async (args) => {
    const command = args.join(' ');
    if (command === 'd1 list --json') return JSON.stringify(exists ? [{ name: 'cascade-db', id: 'created-id' }] : []);
    if (command === 'd1 create cascade-db --update-config=false') { exists = true; createCalls += 1; return 'created'; }
    if (command === 'd1 migrations apply cascade-db --remote') return 'applied';
    throw new Error(`unexpected: ${command}`);
  };
  const first = await setupD1({ config: baseConfig(), runWrangler: runner, persistConfig: ignorePersist });
  assert.equal(createCalls, 1);
  assert.equal(first.d1_databases.find((x) => x.binding === 'DB')?.database_id, 'created-id');

  const second = await setupD1({ config: first, runWrangler: runner, persistConfig: ignorePersist });
  assert.equal(createCalls, 1);
  assert.equal(second.d1_databases.filter((x) => x.binding === 'DB').length, 1);
});

for (const [field, value] of [['uuid','uuid-value'], ['id','id-value'], ['database_id','database-id-value']]) {
  test(`setup accepts Wrangler database id field ${field}`, async () => {
    const runner = async (args) => {
      if (args.join(' ') === 'd1 list --json') return JSON.stringify([{ name: 'cascade-db', [field]: value }]);
      if (args.join(' ') === 'd1 migrations apply cascade-db --remote') return '';
      throw new Error('unexpected command');
    };
    const result = await setupD1({ config: baseConfig(), runWrangler: runner, persistConfig: ignorePersist });
    assert.equal(result.d1_databases.find((x) => x.binding === 'DB')?.database_id, value);
  });
}

test('setup fails clearly when Wrangler list does not expose a usable database id', async () => {
  const runner = async (args) => {
    if (args.join(' ') === 'd1 list --json') return JSON.stringify([{ name: 'cascade-db' }]);
    throw new Error('unexpected command');
  };
  await assert.rejects(() => setupD1({ config: baseConfig(), runWrangler: runner, persistConfig: ignorePersist }), /database id/i);
});
