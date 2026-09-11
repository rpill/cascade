import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function ruleFor(selector: string, marker?: RegExp): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'gm'))]
    .map((match) => match[1] ?? '');
  const rule = marker ? matches.find((candidate) => marker.test(candidate)) : matches[0];
  assert.ok(rule, `missing CSS rule for ${selector}`);
  return rule ?? '';
}

test('Home mode cards and Statistics panels share one parchment material contract', () => {
  assert.match(styles, /--home-card-paper-color:/);
  assert.match(styles, /--home-card-paper-image:/);
  assert.match(styles, /--home-card-paper-blend:/);

  const homeCard = ruleFor('.main-shell-mode-card', /background-color:/);
  assert.match(homeCard, /background-color:\s*var\(--home-card-paper-color\)/);
  assert.match(homeCard, /background-image:\s*var\(--home-card-paper-image\)/);
  assert.match(homeCard, /background-blend-mode:\s*var\(--home-card-paper-blend\)/);

  const statsPanels = ruleFor('.main-shell-statistics-summary,\n.main-shell-statistics-leaderboard');
  assert.match(statsPanels, /background-color:\s*var\(--home-card-paper-color\)/);
  assert.match(statsPanels, /background-image:\s*var\(--home-card-paper-image\)/);
  assert.match(statsPanels, /background-blend-mode:\s*var\(--home-card-paper-blend\)/);
});

test('Statistics summary keeps one vertical column of metric tiles while both large panels stay equal height', () => {
  const content = ruleFor('.main-shell-statistics-content');
  assert.match(content, /height:\s*100%/);
  assert.match(content, /align-items:\s*stretch/);

  assert.match(styles, /\.main-shell-statistics-summary \{[\s\S]*align-self:\s*stretch/);
  assert.match(styles, /\.main-shell-statistics-leaderboard \{[\s\S]*align-self:\s*stretch/);

  const values = ruleFor('.main-shell-statistics-values');
  assert.match(values, /grid-template-columns:\s*minmax\(0, 1fr\)/);

  const row = ruleFor('.main-shell-statistics-row');
  assert.match(row, /border:\s*1px solid/);
  assert.match(row, /border-radius:\s*[1-9]\d*px/);
  assert.match(row, /background:/);
});

test('Leaderboard rows and auth action are styled as game UI rather than bare HTML', () => {
  const row = ruleFor('.main-shell-statistics-leaderboard-row');
  assert.match(row, /border-radius:\s*[1-9]\d*px/);
  assert.match(row, /background:/);

  const auth = ruleFor('.main-shell-statistics-auth-button', /app-shell-wood-detail/);
  assert.match(auth, /var\(--app-shell-wood-detail\)/);
  assert.match(auth, /border-radius:\s*[1-9]\d*px/);
});
