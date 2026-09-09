import Phaser from 'phaser';

import './styles.css';
import './game/view/ThemeCatalogView.css';
import './game/view/SettingsView.css';
import './game/view/MenuResponsive.css';

import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';

const host = document.getElementById('game');
if (!(host instanceof HTMLElement)) {
  throw new Error('Cascade Solitaire requires a #game host element.');
}

host.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

void startWhenHostReady(
  () => {
    const bounds = host.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  },
  ({ width, height }) => new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width,
    height,
    backgroundColor: '#393937',
    disableContextMenu: true,
    scene: [BootScene, GameScene],
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoRound: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
  }),
);
