import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULE_SLIDES } from '../src/game/view/RulesSlides.ts';

test('tutorial illustrations keep the same intrinsic size when moving between rules', () => {
  const sizes = new Set(RULE_SLIDES.map(slide => `${slide.imageWidth}x${slide.imageHeight}`));
  assert.equal(sizes.size, 1, 'Switching rules must not change image dimensions or card scale');
});

test('every tutorial illustration ships at its declared size with embedded image assets', () => {
  for (const slide of RULE_SLIDES) {
    const artwork = readFileSync(new URL(`../public/${slide.image}`, import.meta.url), 'utf8');
    const root = artwork.match(/<svg\b[^>]*>/)?.[0] ?? '';
    assert.equal(Number(root.match(/\bwidth="(\d+)"/)?.[1]), slide.imageWidth, slide.id);
    assert.equal(Number(root.match(/\bheight="(\d+)"/)?.[1]), slide.imageHeight, slide.id);
    const sources = [...artwork.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)];
    assert.ok(sources.length > 0, `${slide.id}: card artwork must be present`);
    for (const [, source] of sources) {
      assert.ok(source!.startsWith('data:image/'), `${slide.id}: SVG images cannot depend on external files`);
    }
  }
});
