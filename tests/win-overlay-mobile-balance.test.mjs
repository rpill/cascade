import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');

test('compact victory typography is capped to a balanced phone-landscape range', () => {
  assert.doesNotMatch(source, /compact \? Math\.max\(36,/);
  assert.match(source, /compact \? Math\.max\(30, Math\.min\(35, height \* 0\.078\)\)/);
  assert.match(source, /compact \? Math\.max\(13, Math\.min\(16, height \* 0\.034\)\)/);
  assert.match(source, /compact \? Math\.max\(13, Math\.min\(16, bounds\.height \* 0\.06\)\)/);
});

test('compact victory panels leave header room for record and Daily detail lines', () => {
  assert.match(source, /const compactPanelsTopRatio = this\.content\.detailLine\s*\? 0\.285\s*:\s*this\.content\.noticeLine\s*\? 0\.265\s*:\s*0\.235/);
  assert.match(source, /const panelsTop = y \+ height \* \(compact \? compactPanelsTopRatio : 0\.25\)/);
});

test('compact victory buttons use medium phone-landscape sizing rather than oversized minimums', () => {
  assert.match(source, /Math\.max\(42, Math\.min\(46, height \* 0\.095\)\)/);
  assert.match(source, /compact \? Math\.max\(13, Math\.min\(16, bounds\.height \* 0\.34\)\)/);
});
