import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const componentFiles = [
  'src/ui/components/PaperPanel.ts',
  'src/ui/components/ActionCard.ts',
  'src/ui/components/IconButton.ts',
  'src/ui/components/ProgressMeter.ts',
  'src/ui/components/SegmentedControl.ts',
  'src/ui/components/ModalShell.ts',
  'src/ui/components/ScrollRegion.ts',
];

const forbidden = ['meta/profile', 'DailyService', 'MasteryService', 'ShopService', 'yandex'];

test('schematic UI component layer is present and domain-agnostic', () => {
  for (const file of componentFiles) {
    assert.equal(existsSync(file), true, `${file} must exist`);
    const source = readFileSync(file, 'utf8');
    for (const needle of forbidden) {
      assert.equal(source.includes(needle), false, `${file} imports domain ${needle}`);
    }
  }
});

test('interactive components expose enabled state and shared touch target normalization', () => {
  const action = readFileSync('src/ui/components/ActionCard.ts', 'utf8');
  const icon = readFileSync('src/ui/components/IconButton.ts', 'utf8');
  const segmented = readFileSync('src/ui/components/SegmentedControl.ts', 'utf8');
  assert.ok(action.includes('enabled'));
  assert.ok(icon.includes('enabled'));
  assert.ok(segmented.includes('enabled'));
  assert.ok(icon.includes('normalizeTouchTarget'));
  assert.ok(segmented.includes('normalizeTouchTarget'));
});

test('modal and scrolling components own input capture locally', () => {
  const modal = readFileSync('src/ui/components/ModalShell.ts', 'utf8');
  const scroll = readFileSync('src/ui/components/ScrollRegion.ts', 'utf8');
  assert.ok(modal.includes('setInteractive'));
  assert.ok(scroll.includes('containsPointer'));
  assert.ok(scroll.includes('wheel'));
});
