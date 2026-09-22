import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
export const WRANGLER = 'wrangler@4.135.0';
export const DATABASE_NAME = 'cascade-db';
export const BINDING = 'DB';

function parseDatabaseList(output) {
  let value;
  try {
    value = JSON.parse(output);
  } catch (error) {
    throw new Error('Wrangler returned invalid JSON for D1 database list.', { cause: error });
  }
  if (!Array.isArray(value)) throw new Error('Wrangler D1 database list must be an array.');
  return value;
}

function databaseId(database) {
  if (typeof database !== 'object' || database === null || Array.isArray(database)) return null;
  const raw = database.uuid ?? database.id ?? database.database_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export async function setupD1({ config, runWrangler, persistConfig }) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('Wrangler config must be an object.');
  }
  if (typeof runWrangler !== 'function') throw new Error('Wrangler runner is required.');
  if (typeof persistConfig !== 'function') throw new Error('Config persistence callback is required.');

  let databases = parseDatabaseList(await runWrangler(['d1', 'list', '--json']));
  let database = databases.find((item) => item && item.name === DATABASE_NAME);
  if (database === undefined) {
    await runWrangler(['d1', 'create', DATABASE_NAME, '--update-config=false']);
    databases = parseDatabaseList(await runWrangler(['d1', 'list', '--json']));
    database = databases.find((item) => item && item.name === DATABASE_NAME);
  }

  if (database === undefined) {
    throw new Error(`D1 database ${DATABASE_NAME} was not found after setup.`);
  }
  const id = databaseId(database);
  if (id === null) throw new Error(`D1 database id is missing for ${DATABASE_NAME}.`);

  const existingBindings = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const d1_databases = [
    ...existingBindings.filter((entry) => entry?.binding !== BINDING),
    {
      binding: BINDING,
      database_name: DATABASE_NAME,
      database_id: id,
      migrations_dir: 'migrations',
    },
  ];
  const nextConfig = { ...config, d1_databases };

  await persistConfig(nextConfig);
  await runWrangler(['d1', 'migrations', 'apply', DATABASE_NAME, '--remote']);
  return nextConfig;
}

export async function runWrangler(args) {
  const commandArgs = ['dlx', WRANGLER, ...args];
  const options = process.platform === 'win32'
    ? { shell: true, maxBuffer: 10 * 1024 * 1024 }
    : { maxBuffer: 10 * 1024 * 1024 };
  const { stdout } = await execFileAsync('pnpm', commandArgs, options);
  return stdout;
}

export async function main() {
  const configUrl = new URL('../wrangler.jsonc', import.meta.url);
  const config = JSON.parse(await readFile(configUrl, 'utf8'));
  const persistConfig = async (nextConfig) => {
    await writeFile(configUrl, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  };
  await setupD1({ config, runWrangler, persistConfig });
  console.log(`D1 ready: ${DATABASE_NAME} -> ${BINDING}`);
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
