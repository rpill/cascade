import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = 'supabase/migrations';
const sql = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationDir, name), 'utf8'))
  .join('\n');

const requiredServiceRoleRpcGrants = [
  'cascade_resolve_account\\(text,text,text,text\\)',
  'cascade_put_profile\\(uuid,uuid,bigint,integer,jsonb\\)',
  'cascade_submit_daily_result\\(uuid,uuid,date,text,integer,bigint,boolean\\)',
  'cascade_upsert_leaderboard_entry\\(uuid,uuid,text,text,bigint,bigint,jsonb\\)',
];

test('service_role can execute every protected Cascade backend RPC', () => {
  for (const signature of requiredServiceRoleRpcGrants) {
    assert.match(
      sql,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${signature}\\s+to\\s+service_role`, 'i'),
      `Missing service_role EXECUTE grant for ${signature}`,
    );
  }
});
