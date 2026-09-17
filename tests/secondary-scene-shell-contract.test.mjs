import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const daily = read('src/ui/scenes/DailyScene.ts');
const mastery = read('src/ui/scenes/MasteryScene.ts');
const leaderboard = read('src/ui/scenes/LeaderboardsScene.ts');
const settings = read('src/ui/scenes/SettingsScene.ts');
const how = read('src/ui/scenes/HowToPlayScene.ts');

for (const [name, source] of [
  ['Daily', daily], ['Mastery', mastery], ['Leaderboards', leaderboard], ['Settings', settings], ['HowToPlay', how],
]) {
  test(`${name} uses the shared SceneShell`, () => assert.match(source, /new SceneShell/));
}

test('Daily delegates outer geometry to SceneShell', () => {
  assert.doesNotMatch(daily, /private homeButton: IconButton/);
  assert.match(daily, /computeDailyLayout\(viewport, shell\.content\)/);
});

test('Mastery and Leaderboards share shell content edges without local page caps', () => {
  assert.doesNotMatch(mastery, /viewport\.width \* \(mobile \? 0\.018 : 0\.035\)/);
  assert.doesNotMatch(leaderboard, /Math\.min\(1180/);
  assert.match(mastery, /const content = shell\.content/);
  assert.match(leaderboard, /const content = shell\.content/);
});

test('Settings and HowToPlay keep centered capped panels inside the shared shell content', () => {
  assert.match(settings, /Math\.min\(shell\.content\.width, 760 \* css\)/);
  assert.match(how, /Math\.min\(content\.width, 1080 \* css\)/);
  assert.match(settings, /private closeButton: ActionCard/);
  assert.match(settings, /t\('ЗАКРЫТЬ'\)/);
  assert.match(how, /t\('ЗАКРЫТЬ'\)/);
});

test('shell titles use natural localized casing', () => {
  assert.match(daily, /new SceneShell\(this,\s*viewport,\s*'Daily'/);
  assert.match(mastery, /new SceneShell\(this,\s*viewport,\s*t\('Мастерство'\)/);
  assert.match(leaderboard, /new SceneShell\(this,\s*viewport,\s*t\('Таблица лидеров'\)/);
  assert.match(settings, /new SceneShell\(this,\s*viewport,\s*t\('Настройки'\)/);
  assert.match(how, /new SceneShell\(this,\s*viewport,\s*t\('Как играть'\)/);
});
