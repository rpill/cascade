import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const presenter = readFileSync('src/game/view/VictoryMastery.ts', 'utf8');
const overlay = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');

function interfaceBody(source, name) {
  const match = source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${name} interface missing`);
  return match[1];
}

function readonlyProps(body) {
  return [...body.matchAll(/readonly\s+(\w+)\s*:/g)].map((match) => match[1]).sort();
}

test('VictoryMastery presenter contract stays in sync with WinOverlay mastery contract', () => {
  const presenterProps = readonlyProps(interfaceBody(presenter, 'WinOverlayMasteryContent'));
  const overlayProps = readonlyProps(interfaceBody(overlay, 'WinOverlayMasteryContent'));
  assert.deepEqual(presenterProps, overlayProps);
});
