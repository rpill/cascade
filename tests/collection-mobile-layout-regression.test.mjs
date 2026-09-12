import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/game/view/MenuResponsive.css', import.meta.url), 'utf8');

function mediaBlock(startMarker, endMarker) {
  const start = css.indexOf(startMarker);
  assert.notEqual(start, -1, `missing media block: ${startMarker}`);
  const end = endMarker ? css.indexOf(endMarker, start + startMarker.length) : css.length;
  assert.notEqual(end, -1, `missing next media block: ${endMarker}`);
  return css.slice(start, end);
}

test('compact landscape collection moves filters onto a second header row', () => {
  const block = mediaBlock(
    '@media (max-height: 560px) and (min-width: 601px)',
    '@media (max-width: 600px)',
  );

  assert.match(block, /\.theme-catalog-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*grid-template-rows:\s*auto\s+auto;/s);
  assert.match(block, /\.theme-catalog-heading\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/s);
  assert.match(block, /\.theme-catalog-summary\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s);
  assert.match(block, /\.theme-catalog-filters\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*justify-self:\s*start;/s);
});

test('mobile landscape theme actions preserve the ornament safe zone', () => {
  const wideCompact = mediaBlock(
    '@media (max-height: 560px) and (min-width: 601px)',
    '@media (max-width: 600px)',
  );
  const narrowCompact = mediaBlock(
    '@media (max-width: 600px) and (max-height: 560px)',
    '@media (max-height: 340px) and (min-width: 601px)',
  );

  assert.match(wideCompact, /\.theme-catalog-card-action\s*\{[^}]*width:\s*calc\(100%\s*-\s*64px\)/s);
  assert.match(narrowCompact, /\.theme-catalog-card-action\s*\{[^}]*width:\s*calc\(100%\s*-\s*64px\)/s);
});
