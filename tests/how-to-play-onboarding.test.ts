import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const preferencesSource = readFileSync(new URL('../src/settings/Preferences.ts', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const rulesSource = readFileSync(new URL('../src/game/view/RulesView.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const englishSource = readFileSync(new URL('../src/localization/English.ts', import.meta.url), 'utf8');

test('preferences persist whether the player has completed the first how-to-play gate', () => {
  assert.match(preferencesSource, /howToPlaySeen/);
  assert.match(preferencesSource, /markHowToPlaySeen\(\)/);
  assert.match(preferencesSource, /howToPlaySeen:this\.currentHowToPlaySeen/);
});

test('first launch finishes the initial Standard deal before showing How to Play', () => {
  assert.match(sceneSource, /const firstRun = !preferences\.howToPlaySeen/);
  assert.match(sceneSource, /startFirstRunHowToPlay\(\)/);
  assert.match(sceneSource, /private pendingFirstRunHowToPlay = false/);
  assert.match(sceneSource, /this\.pendingFirstRunHowToPlay = true;[\s\S]*this\.startDeal\(deal\)/);

  const firstRunMethod = sceneSource.match(/private startFirstRunHowToPlay\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.doesNotMatch(firstRunMethod, /rulesView\.show/);
  assert.doesNotMatch(firstRunMethod, /openRulesOverlay/);

  const settledMethod = sceneSource.match(/private onBoardSettled\(gameState: SolitaireGame\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(settledMethod, /if \(this\.pendingFirstRunHowToPlay\)/);
  assert.match(settledMethod, /this\.pendingFirstRunHowToPlay = false/);
  assert.match(settledMethod, /this\.rulesBlockedBoardSettle = true/);
  assert.match(settledMethod, /this\.openRulesOverlay\(true\)/);
  assert.match(settledMethod, /return/);
  assert.match(sceneSource, /preferences\.markHowToPlaySeen\(\)/);
});

test('How to Play is a reusable modal with close X and a final Got It action', () => {
  assert.match(rulesSource, /document\.createElement\('dialog'\)/);
  assert.match(rulesSource, /main-shell-rules-close/);
  assert.match(rulesSource, /main-shell-rules-finish/);
  assert.match(rulesSource, /t\('КАК ИГРАТЬ'\)/);
  assert.match(rulesSource, /t\('ПОНЯТНО'\)/);
  assert.match(shellSource, /label: 'Как играть'/);
  assert.match(shellSource, /tooltip: 'Как играть'/);
  assert.match(englishSource, /'КАК ИГРАТЬ': 'HOW TO PLAY'/);
  assert.match(englishSource, /'Как играть': 'How to play'/);
  assert.match(englishSource, /'ПОНЯТНО': 'GOT IT'/);
});

test('rules overlay pauses gameplay activity until it closes', () => {
  assert.match(sceneSource, /this\.board\?\.setUiPaused\(true\)/);
  assert.match(sceneSource, /localInteractionBlocked: this\.rulesOpen \|\| this\.freshDealActivityBlocked/);
  assert.match(sceneSource, /this\.board\?\.setUiPaused\(false\)/);
});


test('first-run onboarding never restores an existing ordinary save before dealing a fresh Standard game', () => {
  const startup = sceneSource.match(/this\.pendingActiveSave = this\.activeGameRepository\.load\(\);[\s\S]*?this\.refreshMenuMeta\(\);/)?.[0] ?? '';
  assert.match(startup, /const firstRun = !preferences\.howToPlaySeen/);
  assert.match(startup, /const restoredOrdinary = firstRun \? false : this\.tryRestoreOrdinarySession\(\)/);
  assert.match(startup, /if \(firstRun\) \{[\s\S]*this\.startFirstRunHowToPlay\(\)/);
  assert.doesNotMatch(startup, /const restoredOrdinary = this\.tryRestoreOrdinarySession\(\);[\s\S]*if \(!preferences\.howToPlaySeen\)/);
});
