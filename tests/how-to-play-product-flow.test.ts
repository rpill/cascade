import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('first-run rules use the Trifold-style HowToPlayScene instead of legacy DOM RulesView', () => {
  const game=readFileSync('src/game/scenes/GameScene.ts','utf8');
  const how=readFileSync('src/ui/scenes/HowToPlayScene.ts','utf8');
  const bridge=readFileSync('src/ui/bridge/CascadeProductBridge.ts','utf8');
  assert.match(game,/scene\.launch\('HowToPlayScene'/);
  assert.match(game,/finishProductHowToPlay/);
  assert.match(how,/init\(/);
  assert.match(how,/productBridge\.closeHowToPlay/);
  assert.match(bridge,/closeHowToPlay/);
  const settled=game.slice(game.indexOf('private onBoardSettled'),game.indexOf('\n  private ',game.indexOf('private onBoardSettled')+1));
  assert.doesNotMatch(settled,/openRulesOverlay\(true\)/);
});
