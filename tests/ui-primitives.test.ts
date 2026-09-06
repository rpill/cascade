import test from 'node:test';
import assert from 'node:assert/strict';

type Attrs = Map<string, string>;

class FakeElement {
  readonly attributes: Attrs = new Map();
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  className = '';
  title = '';
  type = '';

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  addEventListener(): void {}

  querySelector(selector: string): FakeElement | null {
    if (selector === 'svg') {
      return this.find((element) => element.attributes.get('viewBox') !== undefined);
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const key = selector === '[data-card]' ? 'card' : selector === '[data-card-mark]' ? 'cardMark' : selector === '[data-plus]' ? 'plus' : null;
    if (key === null) return [];
    const found: FakeElement[] = [];
    this.walk((element) => {
      if (element.dataset[key] !== undefined) found.push(element);
    });
    return found;
  }

  private find(predicate: (element: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested !== null) return nested;
    }
    return null;
  }

  private walk(visitor: (element: FakeElement) => void): void {
    for (const child of this.children) {
      visitor(child);
      child.walk(visitor);
    }
  }
}

(globalThis as unknown as { document: unknown }).document = {
  createElement: () => new FakeElement(),
  createElementNS: () => new FakeElement(),
};

import { createUiIcon } from '../src/game/view/ui/UiIcons.ts';
import { createIconControl } from '../src/game/view/ui/UiControls.ts';

test('icon controls expose accessible labels and native title fallback', () => {
  const button = createIconControl({
    icon: 'home',
    label: 'На главную',
    tooltip: 'На главную',
  });

  assert.equal(button.getAttribute('aria-label'), 'На главную');
  assert.equal(button.title, 'На главную');
  assert.equal(button.querySelector('svg')?.getAttribute('aria-hidden'), 'true');
});

test('new-deal icon is its own card-plus glyph rather than shuffle', () => {
  const svg = createUiIcon('new-deal');
  assert.equal(svg.dataset.icon, 'new-deal');
  assert.equal(svg.querySelectorAll('[data-card]').length >= 1, true);
  assert.equal(svg.querySelectorAll('[data-plus]').length, 1);
});

test('new-deal glyph reads as fanned cards with a visible card mark and plus', () => {
  const svg = createUiIcon('new-deal');
  assert.equal(svg.querySelectorAll('[data-card]').length, 2);
  assert.equal(svg.querySelectorAll('[data-card-mark]').length, 1);
  assert.equal(svg.querySelectorAll('[data-plus]').length, 1);
});


test('shared icon vocabulary includes Home presentation glyphs', () => {
  for (const icon of ['spade', 'heart', 'crown', 'calendar', 'trophy'] as const) {
    const svg = createUiIcon(icon);
    assert.equal(svg.dataset.icon, icon);
    assert.equal(svg.children.length > 0, true);
  }
});

test('Home display icons use bolder silhouette treatment than compact HUD glyphs', () => {
  const crown = createUiIcon('crown');
  assert.equal(crown.children[0]?.getAttribute('fill'), 'currentColor');

  for (const icon of ['calendar', 'trophy'] as const) {
    const svg = createUiIcon(icon);
    assert.equal(svg.children[0]?.getAttribute('stroke-width'), '2.2');
  }
});
