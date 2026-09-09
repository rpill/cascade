import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);

test('hybrid shell exposes one brand, destination nav, utilities, and content host', () => {
  assert.match(shellSource, /CASCADE/);
  assert.match(shellSource, /data-destination/);
  assert.match(shellSource, /contentHost/);
  assert.match(shellSource, /icon:\s*'rules'/);
  assert.match(shellSource, /icon:\s*'settings'/);
  assert.doesNotMatch(shellSource, /ГЛАВНОЕ МЕНЮ/);
});

test('collection and shop are navigable and the shell exposes a wallet state', () => {
  assert.match(shellSource, /'collection'/);
  assert.match(shellSource, /'shop'/);
  assert.match(shellSource, /setCoins\(coins: number \| null\)/);
  assert.match(shellSource, /app-shell-wallet/);
  assert.doesNotMatch(shellSource, /createNavButton\('collection',[^]*true\)/);
  assert.doesNotMatch(shellSource, /createNavButton\('shop',[^]*true\)/);
});

test('shell back-to-game action is compact and contextual', () => {
  assert.match(shellSource, /К игре/);
  assert.match(shellSource, /canCancel/);
  assert.doesNotMatch(shellSource, /ЗАКРЫТЬ/);
});

test('hybrid presentation hides the live board behind its own wood backdrop', () => {
  assert.match(shellSource, /fine-grained-wood\.jpg/);
  assert.match(shellSource, /app-shell-topbar/);
  assert.match(shellSource, /app-shell-decor-card/);
  assert.match(shellSource, /decor-card-back-red\.png/);
  assert.match(shellSource, /decor-card-queen-spades\.png/);
  assert.match(shellSource, /this\.root\.append\([\s\S]*topbar[\s\S]*surface/);
});

test('brand and utilities live on the wood header rather than inside the parchment surface', () => {
  const surfaceAppend = shellSource.match(/surface\.append\(([\s\S]*?)\);/)?.[1] ?? '';
  assert.doesNotMatch(surfaceAppend, /header|brand|utilities/);
  assert.match(shellSource, /topbar\.append\(this\.returnButton, brand, utilities\)/);
});
