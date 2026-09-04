import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const suits = ['club', 'diamond', 'heart', 'spade'] as const;
const ranks = [
  'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'Jack', 'Queen', 'King',
] as const;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(bytes: Buffer): { width: number; height: number } {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test('all 52 runtime card faces exist as high-resolution PNG files', () => {
  const missingOrInvalid: string[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      const fileName = `${suit}${rank}.png`;
      const runtime = new URL(`../public/assets/cards/${fileName}`, import.meta.url);

      try {
        const bytes = readFileSync(runtime);
        if (bytes.length <= PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
          missingOrInvalid.push(fileName);
          continue;
        }

        const { width, height } = pngSize(bytes);
        if (width < 216 || height < 302) {
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
