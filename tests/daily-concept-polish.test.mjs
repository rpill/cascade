import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');

test('daily summary follows the three-row concept hierarchy', () => {
  assert.match(scene, /t\('Серия'\)/u);
  assert.match(scene, /t\('Официальный рекорд'\)/u);
  assert.match(scene, /t\('Личный рекорд'\)/u);
  assert.match(scene, /UI_ICON_KEYS\.fire/u);
  assert.match(scene, /UI_ICON_KEYS\.trophy/u);
  assert.match(scene, /UI_ICON_KEYS\.crown/u);
});

test('selectable calendar dates advertise pointer and hover affordance', () => {
  assert.match(scene, /zone\.input!\.cursor\s*=\s*selectable\s*\?\s*'pointer'\s*:\s*'default'/u);
  assert.match(scene, /zone\.on\('pointerover'/u);
  assert.match(scene, /zone\.on\('pointerout'/u);
});
