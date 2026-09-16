import type * as Phaser from 'phaser';
import type { ThemeDefinition } from './ThemeDefinition.ts';

export const CARD_BACK_ART_FRAME = 'card-back-art';

export function prepareCardBack(scene: Phaser.Scene, theme: ThemeDefinition): boolean {
  const crop = theme.cardBack.crop;
  if (crop === undefined) return true;
  const texture = scene.textures.get(theme.cardBack.key);
  const source = texture.getSourceImage();
  if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0
    || crop.x + crop.width > source.width || crop.y + crop.height > source.height) return false;
  if (!texture.has(CARD_BACK_ART_FRAME)) {
    texture.add(CARD_BACK_ART_FRAME, 0, crop.x, crop.y, crop.width, crop.height);
  }
  return true;
}
