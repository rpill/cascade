import Phaser from 'phaser';

import './styles.css';
import './game/view/ThemeCatalogView.css';
import './game/view/SettingsView.css';
import './game/view/PurchaseView.css';
import './game/view/NewDealConfirmView.css';
import './game/view/MenuResponsive.css';

import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { initializeYandexMetrica } from './analytics/YandexMetrica.ts';
import { planHiDpiCanvas } from './render/HiDpiCanvas.ts';

initializeYandexMetrica();

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
  ({ width, height }) => {
    const initial = planHiDpiCanvas(width, height, window.devicePixelRatio);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: initial.backingWidth,
      height: initial.backingHeight,
      backgroundColor: '#393937',
      disableContextMenu: true,
      scene: [BootScene, GameScene],
      input: { activePointers: 3 },
      scale: {
        mode: Phaser.Scale.NONE,
        zoom: initial.cssZoom,
        autoRound: true,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
    });

    let lastBackingWidth = initial.backingWidth;
    let lastBackingHeight = initial.backingHeight;
    let lastCssZoom = initial.cssZoom;

    const syncCanvasDensity = (): void => {
      const bounds = host.getBoundingClientRect();
      const next = planHiDpiCanvas(bounds.width, bounds.height, window.devicePixelRatio);
      const zoomChanged = Math.abs(lastCssZoom - next.cssZoom) > 0.0001;
      const sizeChanged = lastBackingWidth !== next.backingWidth
        || lastBackingHeight !== next.backingHeight;

      if (!zoomChanged && !sizeChanged) return;

      if (zoomChanged) {
        game.scale.setZoom(next.cssZoom);
        lastCssZoom = next.cssZoom;
      }
      if (sizeChanged) {
        game.scale.resize(next.backingWidth, next.backingHeight);
        lastBackingWidth = next.backingWidth;
        lastBackingHeight = next.backingHeight;
      }
    };

    const observer = new ResizeObserver(syncCanvasDensity);
    observer.observe(host);
    window.addEventListener('resize', syncCanvasDensity);
    game.events.once(Phaser.Core.Events.DESTROY, () => {
      observer.disconnect();
      window.removeEventListener('resize', syncCanvasDensity);
    });

    return game;
  },
);
