import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('successful drag snaps directly into place while rejected drag still settles back', async () => {
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
  assert.match(
    source,
    /this\.sync\('player'\);/,
    'a rejected drag should still animate back to its previous placement',
  );
});
