import assert from 'node:assert/strict';
import test from 'node:test';
import { D1CascadeStore, type D1DatabaseLike, type D1PreparedStatementLike } from '../server/cloudflare/d1.ts';

type FirstValue = Record<string, unknown> | null;
type AllValue = Record<string, unknown>[];
type RunValue = { success: boolean };

class ScriptedStatement implements D1PreparedStatementLike {
  readonly binds: unknown[] = [];
  readonly sql: string;
  private readonly owner: ScriptedD1;

  constructor(sql: string, owner: ScriptedD1) {
    this.sql = sql;
    this.owner = owner;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.binds.splice(0, this.binds.length, ...values);
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.owner.firsts.shift() ?? null) as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: (this.owner.alls.shift() ?? []) as T[] };
  }

  async run(): Promise<{ success: boolean }> {
    return this.owner.runs.shift() ?? { success: true };
  }
}

class ScriptedD1 implements D1DatabaseLike {
  readonly statements: ScriptedStatement[] = [];
  readonly firsts: FirstValue[] = [];
  readonly alls: AllValue[] = [];
  readonly runs: RunValue[] = [];

  prepare(sql: string): D1PreparedStatementLike {
    const statement = new ScriptedStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }

  queueFirst(value: FirstValue): void { this.firsts.push(value); }
  queueAll(value: AllValue): void { this.alls.push(value); }
  queueRun(value: RunValue): void { this.runs.push(value); }
}

test('Standard upsert cannot lower best streak', async () => {
  const db = new ScriptedD1();
  const store = new D1CascadeStore(db);
  await store.submitStandard('p1', 7, 1000);
  const statement = db.statements.at(-1)!;
  assert.match(statement.sql, /MAX\s*\(standard_scores\.best_streak,\s*excluded\.best_streak\)/i);
  assert.deepEqual(statement.binds, ['p1', 7, 1000]);
});

test('Daily exact retry is published but a changed retry is replay', async () => {
  const db = new ScriptedD1();
  db.queueRun({ success: true });
  db.queueFirst({ attempt_id: null, moves: 44, elapsed_ms: 90000, completed_on_time: 1 });
  const store = new D1CascadeStore(db);
  assert.equal(await store.submitDaily('p1', {
    dailyId: '2026-09-20', moves: 44, elapsedMs: 90000,
    completedOnTime: true, completedAt: 1234,
  }), 'published');

  db.queueRun({ success: true });
  db.queueFirst({ attempt_id: null, moves: 45, elapsed_ms: 90000, completed_on_time: 1 });
  assert.equal(await store.submitDaily('p1', {
    dailyId: '2026-09-20', moves: 44, elapsedMs: 90000,
    completedOnTime: true, completedAt: 9999,
  }), 'replay');
});

test('player entry query ranks the full board before filtering one Pikabu id', async () => {
  const db = new ScriptedD1();
  db.queueAll([]);
  db.queueFirst(null);
  const store = new D1CascadeStore(db);
  await store.readStandard(20, 'outside-top');
  const playerQuery = db.statements.at(-1)!.sql;
  assert.match(playerQuery, /WITH\s+ranked\s+AS/i);
  assert.match(playerQuery, /ROW_NUMBER\(\)\s+OVER/i);
  assert.match(playerQuery, /WHERE\s+pikabu_id\s*=\s*\?/i);
});

test('ranking SQL uses deterministic product tie-breakers', async () => {
  const db = new ScriptedD1();
  const store = new D1CascadeStore(db);
  db.queueAll([]); await store.readStandard(20);
  assert.match(db.statements.at(-1)!.sql, /best_streak DESC,\s*s\.updated_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readDaily('2026-09-20', 20);
  assert.match(db.statements.at(-1)!.sql, /moves ASC,\s*elapsed_ms ASC,\s*completed_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readDailyStreak(20);
  assert.match(db.statements.at(-1)!.sql, /current_streak DESC,\s*best_streak DESC,\s*s\.updated_at ASC,\s*[^,]*pikabu_id ASC/i);
  db.queueAll([]); await store.readMastery(20);
  assert.match(db.statements.at(-1)!.sql, /mastery_rank DESC,\s*mastery_points DESC,\s*m\.updated_at ASC,\s*[^,]*pikabu_id ASC/i);
});
