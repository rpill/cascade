import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const themeCard = readFileSync(new URL('../src/ui/themes/ThemeCard.ts', import.meta.url), 'utf8');
const themeLayout = readFileSync(new URL('../src/ui/themes/ThemesGridLayout.ts', import.meta.url), 'utf8');
const actionCard = readFileSync(new URL('../src/ui/components/ActionCard.ts', import.meta.url), 'utf8');
const daily = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');
const fire = readFileSync(new URL('../public/assets/ui/icons/fire.svg', import.meta.url), 'utf8');
const trophy = readFileSync(new URL('../public/assets/ui/icons/trophy.svg', import.meta.url), 'utf8');
const crown = readFileSync(new URL('../public/assets/ui/icons/crown.svg', import.meta.url), 'utf8');

test('mobile Themes grid uses three columns', () => {
  assert.match(themeLayout, /const columns:\s*3\s*=\s*3/u);
});

test('Theme cards expose pointer feedback for actionable cards and always show unowned price', () => {
  assert.match(themeCard, /cursor\s*=\s*this\.state\.action\s*!==\s*'none'\s*\?\s*'pointer'\s*:\s*'default'/u);
  assert.match(themeCard, /!this\.state\.owned\s*\?\s*`● \$\{this\.state\.priceCoins\}`/u);
  assert.match(themeCard, /pointerover/u);
});

test('Home artwork cards render chevrons on circular control badges', () => {
  assert.match(actionCard, /arrowBadge/u);
  assert.match(actionCard, /fillCircle\(/u);
  assert.match(actionCard, /strokeCircle\(/u);
});

test('Daily summary icons use baked gold SVG fill instead of tinting black paths', () => {
  assert.doesNotMatch(daily, /summaryRows\.map\(row => this\.add\.image\([^\n]+setTint/u);
  for (const svg of [fire, trophy, crown]) assert.match(svg, /fill="#bc9756"/u);
  assert.match(fire, /viewBox="0 0 384 512"/u);
});

test('Theme card does not play a duplicate generic click before theme action sound', () => {
  assert.doesNotMatch(themeCard, /playUiButtonSound/u);
});

test('Home destination chevrons keep a smaller inset badge than the hero chevron', () => {
  assert.match(actionCard, /const arrowX\s*=\s*bounds\.x\s*\+\s*bounds\.width\s*\*\s*\(tile\s*\?\s*0\.86\s*:\s*0\.91\)/u);
  assert.match(actionCard, /tile\s*\?\s*\(this\.viewport\.profile\s*===\s*'mobile-landscape'\s*\?\s*38\s*:\s*44\)\s*:\s*48/u);
});
