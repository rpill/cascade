import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');

test('compact victory overlay is capped to a phone-landscape sized dialog', () => {
  assert.match(source, /Math\.min\(vw \* \(compact \? 0\.78 : 0\.62\), compact \? 820 : 930\)/);
  assert.match(source, /Math\.min\(vh \* \(compact \? 0\.88 : 0\.78\), compact \? 520 : 650\)/);
});

test('victory typography and buttons scale from the bounded overlay instead of viewport constants', () => {
  assert.match(source, /setFontSize\(Math\.max\(24,height\*0\.075\)\)/);
  assert.match(source, /setFontSize\(Math\.max\(14,height\*0\.038\)\)/);
  assert.match(source, /buttonH=Math\.max\(44,height\*0\.105\)/);
});
