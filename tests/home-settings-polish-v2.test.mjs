import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const play = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/game/view/SettingsView.ts', import.meta.url), 'utf8');
const settingsCss = readFileSync(new URL('../src/game/view/SettingsView.css', import.meta.url), 'utf8');
const stats = readFileSync(new URL('../src/game/view/StatisticsPageView.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');
const english = readFileSync(new URL('../src/localization/English.ts', import.meta.url), 'utf8');

test('Game card uses player-facing copy rather than verified-deal implementation language', () => {
  assert.match(play, /Соберите пасьянс в своём темпе/);
  assert.doesNotMatch(play, /Раздачи с гарантированным решением/);
  assert.match(english, /'Соберите пасьянс в своём темпе':\s*'Solve at your own pace'/);
});

test('Play cards and footer share one wider desktop content width', () => {
  assert.match(styles, /\.main-shell-play\s*\{[\s\S]*?--play-content-width:\s*640px/);
  assert.match(styles, /\.main-shell-mode-grid\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--play-content-width\)\)/);
  assert.match(styles, /\.main-shell-play-footer\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--play-content-width\)\)/);
  assert.match(styles, /\.main-shell-mode-card\s*\{[\s\S]*?aspect-ratio:\s*0\.78/);
  assert.match(styles, /\.main-shell-mode-play\s*\{[\s\S]*?min-width:\s*158px[\s\S]*?min-height:\s*54px/);
  assert.match(styles, /\.main-shell-mode-emblem\s*\{[\s\S]*?width:\s*78px;[\s\S]*?height:\s*78px/);
  assert.match(styles, /\.main-shell-daily-dot\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px/);
});

test('Compact landscape and phone layouts keep two cards and larger tap targets', () => {
  assert.match(responsive, /@media \(max-height:\s*560px\) and \(min-width:\s*601px\)[\s\S]*?--play-content-width:\s*580px/);
  assert.match(responsive, /@media \(max-height:\s*560px\) and \(min-width:\s*601px\)[\s\S]*?\.main-shell-mode-emblem\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px/);
  assert.match(responsive, /@media \(max-height:\s*560px\) and \(min-width:\s*601px\)[\s\S]*?\.main-shell-mode-play\s*\{[^}]*min-height:\s*44px/);
  assert.match(responsive, /@media \(max-width:\s*600px\)[\s\S]*?\.main-shell-mode-grid\s*\{[^}]*grid-template-rows:\s*repeat\(2,/);
  assert.match(responsive, /@media \(max-width:\s*600px\)[\s\S]*?\.main-shell-mode-emblem\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px/);
});

test('legacy Play fallback has no XP or Level product progression while Daily copy remains localized', () => {
  assert.doesNotMatch(play, /\bXP\b|Уровень|updateProgression|playerXp|playerLevel/);
  assert.doesNotMatch(english, /'\{current\} из \{required\} XP'|Новый уровень|Следующий уровень|Уровень \{/);
  assert.match(stats, /createModeTab\('ЕЖЕДНЕВНЫЕ', 'daily'\)/);
  assert.match(english, /'ЕЖЕДНЕВНЫЕ':\s*'DAILY'/);
  assert.match(play, /t\('\{current\} из 7'/);
  assert.doesNotMatch(play, /completedCount\}\/7|—\/7/);
});

test('Settings language choice is a two-button control with no select dropdown', () => {
  assert.doesNotMatch(settings, /HTMLSelectElement|createElement\('select'\)|settings-language[^-]/);
  assert.match(settings, /settings-language-options/);
  assert.match(settings, /settings-language-option/);
  assert.match(settings, /dataset\.language/);
  assert.match(settings, /setLanguage\(language\)/);
  assert.match(settingsCss, /\.settings-language-options/);
  assert.match(settingsCss, /\.settings-language-option\.is-active/);
  assert.match(english, /'Русский':\s*'Russian'/);
  assert.match(english, /'Английский':\s*'English'/);
});
