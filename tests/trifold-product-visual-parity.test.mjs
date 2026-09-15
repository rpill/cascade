import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const cases = [
  ['DailyScene', 'src/ui/scenes/DailyScene.ts', [
    'new PaperPanel', 'new CoinPill', 'new ModalShell', 'computeDailyLayout', 'computeCalendarCellBounds',
    '42', 'summaryPanel', 'calendarPanel', 'confirmReplacement', 'previousMonth', 'nextMonth',
  ]],
  ['ThemesScene', 'src/ui/scenes/ThemesScene.ts', [
    'new ScrollRegion', 'computeThemesGridLayout', 'new ThemeCard', 'new CoinPill', 'rewardedCoins',
  ]],
  ['LeaderboardsScene', 'src/ui/scenes/LeaderboardsScene.ts', [
    'new PaperPanel', 'new SegmentedControl', 'new ActionCard', 'rows', 'authorizeAndReload',
  ]],
  ['SettingsScene', 'src/ui/scenes/SettingsScene.ts', [
    'new PaperPanel', 'new SegmentedControl', 'new ActionCard', 'panelHeight', 'languageControl',
  ]],
  ['HowToPlayScene', 'src/ui/scenes/HowToPlayScene.ts', [
    'new PaperPanel', 'new ActionCard', 'pageIndex', 'counterText', 'bodyText', 'illustration', 'cards',
  ]],
  ['MasteryScene', 'src/ui/scenes/MasteryScene.ts', [
    'new PaperPanel', 'new ProgressMeter', 'leftPanel', 'rightPanel', 'pathBadges', 'requirementTexts',
  ]],
];

test('every Cascade product screen keeps the Trifold visual building blocks', () => {
  for (const [name, path, tokens] of cases) {
    const source = read(path);
    for (const token of tokens) {
      assert.ok(source.includes(token), `${name} is missing Trifold visual token: ${token}`);
    }
  }
});

test('product screens do not route back through legacy DOM views', () => {
  for (const [, path] of cases) {
    const source = read(path);
    assert.doesNotMatch(source, /AppShellView|PlayPageView|StatisticsPageView|ThemeCatalogView/);
  }
});
