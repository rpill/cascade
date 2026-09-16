import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/ui/scenes/DailyScene.ts', import.meta.url),
  'utf8',
);

function methodBody(name: string, nextName: string): string {
  const start = source.indexOf(`private ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf(`\n  private ${nextName}`, start + 1);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

test('Daily layout snapshots product state once instead of once per calendar cell', () => {
  const layoutStart = source.indexOf('protected layout(');
  const createCellsStart = source.indexOf('\n  private createCalendarCells', layoutStart);
  assert.notEqual(layoutStart, -1);
  assert.notEqual(createCellsStart, -1);
  const layout = source.slice(layoutStart, createCellsStart);

  const snapshotCalls = layout.match(/productBridge\.snapshot\(\)/g) ?? [];
  assert.equal(snapshotCalls.length, 1, `expected one snapshot per Daily layout, got ${snapshotCalls.length}`);
  assert.match(layout, /const records = snapshot\.state\.daily\.records/);
  assert.match(layout, /this\.layoutCell\(cell,[\s\S]*records\)/);
});

test('layoutCell is pure with respect to productBridge snapshot/server-time access', () => {
  const layoutCell = methodBody('layoutCell', 'selectDate');
  assert.doesNotMatch(layoutCell, /productBridge\.snapshot\(\)/);
  assert.match(source, /type DailyRecordMap = Readonly<Record<string, DailyRecord>>/);
  assert.match(layoutCell, /records:\s*DailyRecordMap/);
  assert.match(layoutCell, /records\[cell\.dateKey\]/);
});
