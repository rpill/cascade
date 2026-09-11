import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const suits = ['club', 'diamond', 'heart', 'spade'] as const;
const ranks = [
  'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'Jack', 'Queen', 'King',
] as const;

function webpSize(bytes: Buffer): { width: number; height: number } | null {
  if (
    bytes.length < 30
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.toString('ascii', 12, 16) !== 'VP8X'
  ) {
    return null;
  }

  const read24LE = (offset: number) => (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
  );

  return {
    width: read24LE(24) + 1,
    height: read24LE(27) + 1,
  };
}

test('all 52 runtime card faces exist as high-resolution WebP files', () => {
  const missingOrInvalid: string[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      const fileName = `${suit}${rank}.webp`;
      const runtime = new URL(`../public/assets/cards/${fileName}`, import.meta.url);

      try {
        const bytes = readFileSync(runtime);
        const dimensions = webpSize(bytes);
        if (!dimensions || dimensions.width < 216 || dimensions.height < 302) {
          missingOrInvalid.push(fileName);
        }
      } catch {
        missingOrInvalid.push(fileName);
      }
    }
  }

  assert.deepEqual(missingOrInvalid, []);
});

test('Phaser runtime card URLs are relative for nested Yandex hosting', () => {
  const bootScene = readFileSync(
    new URL('../src/game/scenes/BootScene.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(bootScene, /['"`]\/assets\//);
  assert.match(bootScene, /CARD_ASSET_ROOT = ['"]\.\/assets\/cards['"]/);
});
