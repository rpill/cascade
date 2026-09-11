import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../src/game/view/RulesView.ts', import.meta.url), 'utf8');
const purchase = readFileSync(new URL('../src/game/view/PurchaseView.ts', import.meta.url), 'utf8');
const purchaseCss = readFileSync(new URL('../src/game/view/PurchaseView.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('new players see the completed Standard deal before How to play opens over it', () => {
  assert.match(scene, /const firstRun = !preferences\.howToPlaySeen;[\s\S]*if \(firstRun\) \{[\s\S]*startFirstRunHowToPlay\(\)/);
  assert.match(scene, /private startFirstRunHowToPlay\(\): void/);
  assert.match(scene, /this\.startSelectedMode\('winnable'\)/);
  assert.match(scene, /this\.appShell\.hide\(\)/);
  assert.match(scene, /this\.pendingFirstRunHowToPlay = true/);
  assert.match(scene, /if \(this\.pendingFirstRunHowToPlay\)[\s\S]*this\.openRulesOverlay\(true\)/);
  assert.doesNotMatch(scene, /pendingHowToPlayMode/);
});

test('How to play is a modal dialog mounted over the game rather than a shell content page', () => {
  assert.match(rules, /document\.createElement\('dialog'\)/);
  assert.match(rules, /className = 'rules-dialog main-shell-rules'/);
  assert.match(rules, /showModal\(\)/);
  assert.match(scene, /new RulesView\(this\.game\.canvas\.parentElement!/);
  assert.doesNotMatch(scene, /new RulesView\(this\.appShell\.contentHost/);
});

test('How to play can be closed immediately with X and completed from the last slide', () => {
  assert.match(rules, /main-shell-rules-close/);
  assert.match(rules, /textContent = '×'/);
  assert.match(rules, /this\.closeButton\.addEventListener\('click', \(\) => actions\.close\(\)\)/);
  assert.match(rules, /this\.finishButton\.hidden = boundedIndex !== RULE_SLIDES\.length - 1/);
  assert.match(rules, /this\.finishButton\.addEventListener\('click', \(\) => actions\.close\(\)\)/);
});

test('shell help opens the same overlay without navigating to a Rules page', () => {
  assert.match(scene, /if \(destination === 'rules'\) \{[\s\S]*openRulesOverlay\(false\)[\s\S]*return;/);
  assert.doesNotMatch(scene, /this\.shellDestination = 'rules'/);
  assert.doesNotMatch(scene, /this\.appShell\.setDestination\('rules'\)/);
});

test('purchase dialog uses a top-right X close control and no bottom Done button', () => {
  assert.match(purchase, /className = 'purchase-close-icon'/);
  assert.match(purchase, /textContent = '×'/);
  assert.doesNotMatch(purchase, /this\.closeButton\.textContent = t\('Готово'\)/);
  assert.match(purchaseCss, /\.purchase-close-icon\s*\{/);
  assert.doesNotMatch(purchaseCss, /\.purchase-close \{ display: block; width: 100%; margin-top:/);
});

test('rules dialog shares the parchment modal treatment and has a dedicated close icon', () => {
  assert.match(styles, /\.rules-dialog\.main-shell-rules\s*\{/);
  assert.match(styles, /\.main-shell-rules-close\s*\{/);
  assert.match(styles, /\.rules-dialog::backdrop\s*\{/);
});


test('rules modal carries its own wood texture variables because it is mounted outside the shell', () => {
  assert.match(rules, /--app-shell-wood/);
  assert.match(rules, /--app-shell-wood-detail/);
  assert.match(rules, /const RULES_WOOD = '\.\/assets\/theme\/menu-dark-wood\.jpg'/);
  assert.match(rules, /resolveAssetUrl\(RULES_WOOD\)/);
});


test('phone rules arrows use full-height tap rails instead of tiny chevron hit areas', () => {
  assert.ok(styles.includes(`  .rules-dialog .main-shell-rules-carousel {
    grid-template-columns: 32px minmax(0, 1fr) 32px;
    gap: 5px;
    padding: 5px 0 0;
    align-items: stretch;
  }`));
  assert.ok(styles.includes(`  .rules-dialog .main-shell-rules-arrow {
    width: 32px;
    height: auto;
    min-height: 100%;
    align-self: stretch;
    border-radius: 10px;
  }`));
});
