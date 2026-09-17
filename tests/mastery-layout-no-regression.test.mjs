import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');

test('Mastery top progress bars share the same width and height contract', () => {
  assert.match(source, /const sharedProgressWidth = Math\.min\(/u);
  assert.match(source, /const sharedProgressHeight = Math\.max\(/u);
  assert.match(source, /layoutOverallSection\(sections\.overall, css, mobile, sharedProgressWidth, sharedProgressHeight\)/u);
  assert.match(source, /layoutRequirementSection\(sections\.requirements, css, mobile, sharedProgressWidth, sharedProgressHeight\)/u);
  assert.match(source, /width: sharedProgressWidth,/u);
  assert.match(source, /height: sharedProgressHeight,/u);
});

test('single requirement aligns to the same label and meter rows as overall progress', () => {
  assert.match(source, /const labelY = bounds\.y \+ bounds\.height \* 0\.23;/u);
  assert.match(source, /const meterY = bounds\.y \+ bounds\.height \* 0\.47;/u);
  assert.match(source, /const labelY = single \? bounds\.y \+ bounds\.height \* 0\.23/u);
  assert.match(source, /const meterY = single \? bounds\.y \+ bounds\.height \* 0\.47/u);
});

test('Mastery path heading is not embedded between separator lines', () => {
  assert.match(source, /const headingY = bounds\.y \+ bounds\.height \* \(mobile \? 0\.11 : 0\.10\)/u);
  assert.match(source, /pathBackdrop\?\.clear\(\)/u);
  assert.doesNotMatch(source, /sepGap/u);
  assert.doesNotMatch(source, /lineBetween\(bounds\.x, sepY/u);
});
