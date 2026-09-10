import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  filterThemeCatalogItems,
  type ThemeCatalogItemView,
} from '../src/game/view/ThemeCatalogView.ts';

const source = readFileSync(
  new URL('../src/game/view/ThemeCatalogView.ts', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../src/game/view/ThemeCatalogView.css', import.meta.url),
  'utf8',
);

const items: ThemeCatalogItemView[] = Array.from({ length: 12 }, (_, index) => ({
  id: `theme-${index}`,
  name: `Theme ${index}`,
  description: `Description ${index}`,
  previewUrl: `/preview-${index}.webp`,
  cardBackUrl: `/back-${index}.png`,
  price: index === 0 ? 0 : 300,
  owned: index === 0 || index === 4 || index === 11,
  equipped: index === 0,
}));

test('scrolling collection exposes all 12 items and filters ownership without losing the last item', () => {
  assert.equal(filterThemeCatalogItems(items, 'all').length, 12);
  assert.deepEqual(filterThemeCatalogItems(items, 'mine').map(item=>item.id), ['theme-0', 'theme-4', 'theme-11']);
});

test('collection keeps purchasable and base themes together', () => {
  const all = filterThemeCatalogItems(items, 'all');
  assert.equal(all.length, 12);
  assert.equal(all[0]?.price, 0);
  assert.equal(all.at(-1)?.id, 'theme-11');
});

test('catalog keeps typed buy/equip/retry actions and uses an internal scroll region', () => {
  assert.ok(source.includes('actions.buy(item.id)'));
  assert.ok(source.includes('actions.equip(item.id)'));
  assert.ok(source.includes('actions.retry()'));
  assert.ok(styles.includes('overflow-y: auto'));
  assert.ok(!source.includes('theme-catalog-pagination'));
});
