import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dailyScene = readFileSync('src/ui/scenes/DailyScene.ts', 'utf8');

test('daily calendar upgrades only the selected day to the new button surface skin', () => {
  assert.match(dailyScene, /import \{ ButtonSurface \} from '\.\.\/components\/ButtonSurface\.ts';/);
  assert.match(dailyScene, /readonly activeSurface: ButtonSurface;/);
  assert.match(dailyScene, /const activeSurface = new ButtonSurface\(this, 20\.5\);/);
  assert.match(dailyScene, /if \(selected\) \{[\s\S]*cell\.activeSurface\.setVisible\(true\);[\s\S]*cell\.activeSurface\.layout\(\{ x: bounds\.x \+ insetX, y: bounds\.y \+ insetY, width: bounds\.width - insetX \* 2, height: bounds\.height - insetY \* 2 \}, 'jade', 'square'\);/s);
  assert.match(dailyScene, /else \{\s*cell\.surface\.fillStyle\(fill, alpha\)/s);
});
