import Phaser from 'phaser';

const BOARD_TEXTURE_KEY = 'cascade-board-pattern';
const TILE_SIZE = 48;

export function getBoardTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(BOARD_TEXTURE_KEY)) {
    return BOARD_TEXTURE_KEY;
  }

  const graphics = scene.make.graphics({
    x: 0,
    y: 0,
  }, false);

  graphics.fillStyle(0x393937, 1);
  graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  graphics.fillStyle(0xffffff, 0.025);

  for (let y = 6; y < TILE_SIZE; y += 12) {
    for (let x = 6 + ((y / 12) % 2) * 6; x < TILE_SIZE; x += 12) {
      graphics.fillCircle(x, y, 1);
    }
  }

  graphics.generateTexture(BOARD_TEXTURE_KEY, TILE_SIZE, TILE_SIZE);
  graphics.destroy();

  return BOARD_TEXTURE_KEY;
}
