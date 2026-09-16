
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

function method(name) {
  let start = source.indexOf(`private ${name}`);
  if (start === -1) start = source.indexOf(`private async ${name}`);
  if (start === -1) start = source.indexOf(`  ${name}():`);
  assert.notEqual(start, -1, `${name} not found`);
  const nextPrivate = source.indexOf('\n  private ', start + 1);
  const nextPublic = source.indexOf('\n  protected ', start + 1);
  const candidates = [nextPrivate, nextPublic].filter((value) => value !== -1);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return source.slice(start, next === -1 ? source.length : next);
}

test('delayed Daily restore resumes gameplay instead of restoring a menu-paused GameScene', () => {
  const restore = method('tryRestoreDailySession');

  assert.match(
    restore,
    /flow\.resume\(activeGameSaveToDeal\(save\),\s*'playing'\)/,
    'Daily restore must normalize the restored flow to playing',
  );
  assert.doesNotMatch(
    restore,
    /flow\.resume\(activeGameSaveToDeal\(save\),\s*save\.uiState\)/,
    'Daily restore must not re-enter menu-paused state from a persisted checkpoint',
  );
  assert.doesNotMatch(
    restore,
    /save\.uiState === 'menu-paused'[^]*showProductHome/,
    'after choosing automatic Daily restore, it must not immediately reopen the paused menu',
  );
});

test('startup does not flash Home while a pending Daily save waits for trusted identity', () => {
  const create = method('create');
  assert.match(
    create,
    /else if \(!restoredOrdinary && this\.pendingDailyRestore === null\) \{\s*this\.showProductHome\(false\);\s*\}/,
  );

  const initialize = method('initializeMeta');
  assert.match(
    initialize,
    /if \(this\.gameState === null && !this\.scene\.isActive\('HomeScene'\)\) \{\s*this\.showProductHome\(false\);\s*\}/,
    'if delayed Daily restore cannot start, startup must fall back to Home',
  );
});
