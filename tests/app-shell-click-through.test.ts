import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const barrierUrl = new URL('../src/game/view/UiClickBarrier.ts', import.meta.url);
const shellSource = readFileSync(
  new URL('../src/game/view/AppShellView.ts', import.meta.url),
  'utf8',
);

test('UI click barrier consumes the DOM click and defers gameplay exposure until the next frame', async () => {
  assert.equal(existsSync(barrierUrl), true, 'UiClickBarrier.ts must exist');
  if (!existsSync(barrierUrl)) {
    return;
  }

  const { deferClickThroughAction } = await import(barrierUrl.href);
  const calls: string[] = [];
  let scheduled: (() => void) | null = null;

  deferClickThroughAction(
    {
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
    },
    () => calls.push('action'),
    (callback: () => void) => {
      scheduled = callback;
    },
  );

  assert.deepEqual(calls, ['preventDefault', 'stopPropagation']);
  assert.notEqual(scheduled, null);
  scheduled!();
  assert.deepEqual(calls, ['preventDefault', 'stopPropagation', 'action']);
});

test('Back-to-game button uses the click-through barrier instead of hiding the shell synchronously', () => {
  assert.match(shellSource, /deferClickThroughAction/);
  assert.match(shellSource, /addEventListener\('pointerdown',[^]*stopPropagation/);
  assert.match(shellSource, /addEventListener\('pointerup',[^]*stopPropagation/);
  assert.match(shellSource, /deferClickThroughAction\(event, \(\) => actions\.cancel\(\)\)/);
  assert.doesNotMatch(shellSource, /returnButton\.addEventListener\('click', \(\) => actions\.cancel\(\)\)/);
});
