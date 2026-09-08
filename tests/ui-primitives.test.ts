import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('gameplay action icons identify the shared Tabler icon set', () => {
  for (const name of ['undo', 'restart', 'new-deal', 'home'] as const) {
    const svg = createUiIcon(name);
    assert.equal(svg.dataset.icon, name);
    assert.equal(svg.dataset.iconSet, 'tabler');
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  }
});

test('Home display icons use authored assets rather than the compact HUD path vocabulary', () => {
  const homeArtSource = readFileSync(
    new URL('../src/game/view/ui/HomeArtIcons.ts', import.meta.url),
    'utf8',
  );

  assert.match(homeArtSource, /const ICON_ASSETS/);
  assert.match(homeArtSource, /crown:\s*'\.\/assets\/ui\/icons\/crown\.svg'/);
  assert.match(homeArtSource, /calendar:\s*'\.\/assets\/ui\/icons\/calendar\.svg'/);
  assert.match(homeArtSource, /trophy:\s*'\.\/assets\/ui\/icons\/trophy\.svg'/);
  assert.match(homeArtSource, /--home-art-icon/);
});
