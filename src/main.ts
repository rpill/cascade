import Phaser from 'phaser';

import './styles.css';

import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { GAME_HEIGHT, GAME_WIDTH } from './game/view/layout.ts';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#393937',
  disableContextMenu: true,
  scene: [BootScene, GameScene],
  input: {
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
});
