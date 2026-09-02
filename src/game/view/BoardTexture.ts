import Phaser from 'phaser';

import {
  GAME_HEIGHT,
  GAME_WIDTH,
} from './layout.ts';

const BOARD_TEXTURE_KEY = 'cascade-board-surface';

export function getBoardTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(BOARD_TEXTURE_KEY)) {
    return BOARD_TEXTURE_KEY;
  }

  const graphics = scene.make.graphics({
    x: 0,
    y: 0,
  }, false);

  graphics.fillStyle(0x393937, 1);
  graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  graphics.fillStyle(0x242b2a, 1);
  graphics.fillRect(0, 0, 170, GAME_HEIGHT);
  graphics.lineStyle(2, 0x738280, 0.8);
  graphics.lineBetween(170, 0, 170, GAME_HEIGHT);
  graphics.fillStyle(0xffffff, 0.025);

  for (let y = 10; y < GAME_HEIGHT; y += 12) {
    for (let x = 182 + ((y / 12) % 2) * 6; x < GAME_WIDTH; x += 12) {
      graphics.fillCircle(x, y, 1);
    }
  }

  graphics.generateTexture(
    BOARD_TEXTURE_KEY,
    GAME_WIDTH,
    GAME_HEIGHT,
  );
  graphics.destroy();

  return BOARD_TEXTURE_KEY;
}
