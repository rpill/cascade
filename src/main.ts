import Phaser from 'phaser';

import './styles.css';

import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#393937',
  disableContextMenu: true,
  scene: [BootScene, GameScene],
  input: {
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoRound: true,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
});
