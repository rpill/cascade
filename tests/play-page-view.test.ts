import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const playSource = readFileSync(
  new URL('../src/game/view/PlayPageView.ts', import.meta.url),
  'utf8',
);

test('Play destination renders Standard Daily Classic through one mode-card helper', () => {
  assert.match(playSource, /createModeCard\(/);
  assert.match(playSource, /main-shell-mode-card/);
  assert.match(playSource, /СТАНДАРТ/);
  assert.match(playSource, /ИСПЫТАНИЕ ДНЯ/);
  assert.match(playSource, /КЛАССИКА/);

  const helperDefinitions = playSource.match(/private createModeCard\(/g) ?? [];
  assert.equal(helperDefinitions.length, 1);
  assert.doesNotMatch(playSource, /createStandardCard|createDailyCard|createClassicCard/);
});

test('weekly progress is one compact seven-dot strip instead of debug week text', () => {
  assert.match(playSource, /На этой неделе/);
  assert.match(playSource, /main-shell-week-dot/);
  assert.match(playSource, /completedCount/);
  assert.match(playSource, /\$\{completedCount\}\/7/);
  assert.doesNotMatch(playSource, /НЕДЕЛЯ \$\{/);
  assert.doesNotMatch(playSource, /WEEKLY_MILESTONES/);
  assert.doesNotMatch(playSource, /Пн|Вт|Ср|Чт|Пт|Сб|Вс/);
});

test('Daily availability is enforced without changing ordinary mode actions', () => {
  assert.match(playSource, /button\.disabled\s*=\s*!state\.available/);
  assert.match(playSource, /actions\.play\(mode\)/);
});

test('Play page does not waste shell height on a redundant choose-mode intro', () => {
  assert.doesNotMatch(playSource, /Выберите режим/);
  assert.doesNotMatch(playSource, /main-shell-play-intro/);
});


test('Daily card uses a human date and its own seven-day progress row', () => {
  assert.match(playSource, /formatDailyDate/);
  assert.match(playSource, /main-shell-daily-dots/);
  assert.match(playSource, /main-shell-daily-count/);
  assert.match(playSource, /completedCount/);
  assert.doesNotMatch(playSource, /state\.dailyId\s*\?\?\s*'Сегодня'/);
});

test('mode and footer artwork uses the dedicated Home art-icon layer instead of text glyphs', () => {
  assert.match(playSource, /createModeCard\('winnable',\s*'spade'/);
  assert.match(playSource, /createModeCard\('daily',\s*'crown'/);
  assert.match(playSource, /createModeCard\('original',\s*'heart'/);
  assert.match(playSource, /emblemNode\.append\(createHomeArtIcon\(icon\)\)/);
  assert.match(playSource, /createHomeArtIcon\('calendar'\)/);
  assert.match(playSource, /createHomeArtIcon\('trophy'\)/);
  assert.doesNotMatch(playSource, /'♠'|'♛'|'♥'/);
});
