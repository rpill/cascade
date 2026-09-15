import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const playPageUrl = new URL('../src/game/view/PlayPageView.ts', import.meta.url);
const progressionUrl = new URL('../src/meta/Progression.ts', import.meta.url);
const victoryProgressUrl = new URL('../src/game/view/VictoryProgress.ts', import.meta.url);
const sfxUrl = new URL('../src/settings/SfxController.ts', import.meta.url);
const englishUrl = new URL('../src/localization/English.ts', import.meta.url);

test('unpublished revamp removes the obsolete XP/Level product model instead of carrying compatibility code', () => {
  const playPage = readFileSync(playPageUrl, 'utf8');
  assert.doesNotMatch(playPage, /PlayerProgressionState|playerLevel|playerXp|xpTrack|xpFill|levelReward|updateProgression|\bXP\b|Уровень/);
  assert.equal(existsSync(progressionUrl), false);
  assert.equal(existsSync(victoryProgressUrl), false);
  assert.doesNotMatch(readFileSync(sfxUrl, 'utf8'), /level-up|sfx-level-up/);
  assert.doesNotMatch(readFileSync(englishUrl, 'utf8'), /\bXP\b|Новый уровень|Следующий уровень|Уровень \{|Уровень —/);
});
