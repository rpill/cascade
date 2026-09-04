import Phaser from 'phaser';

const BOARD_TEXTURE_KEY = 'cascade-board-surface';

export function getBoardTexture(_scene: Phaser.Scene): string {
  return BOARD_TEXTURE_KEY;
}
