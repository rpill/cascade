import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manual drag snaps directly into place whether accepted or rejected', async () => {
  const source = await readFile('src/game/view/BoardView.ts', 'utf8');

  assert.match(
    source,
    /if \(target !== null && this\.actions\.move\(dragState\.source, target\)\) \{[\s\S]*?this\.finishMoveWithAutoFoundation\('player', false\);/,
    'an accepted drag must opt out of the player settle tween',
  );
  assert.match(
    source,
    /this\.sync\(animateInitialMove \? initialMotion : null\);/,
    'the complete-action finisher must support an immediate snap sync',
  );
  const endDrag = source.slice(
    source.indexOf('private endDrag(): void'),
    source.indexOf('private finishMoveWithAutoFoundation'),
  );
  assert.match(
    endDrag,
    /this\.sync\(null\);/,
    'a rejected drag must snap immediately back to its previous placement',
  );
  assert.doesNotMatch(
    endDrag,
    /this\.sync\('player'\);/,
    'a rejected drag must not use the player settle tween',
  );
});
