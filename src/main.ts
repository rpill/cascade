import * as Phaser from 'phaser';

import './styles.css';

import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { HomeScene } from './ui/scenes/HomeScene.ts';
import { MasteryScene } from './ui/scenes/MasteryScene.ts';
import { DailyScene } from './ui/scenes/DailyScene.ts';
import { LeaderboardsScene } from './ui/scenes/LeaderboardsScene.ts';
import { SettingsScene } from './ui/scenes/SettingsScene.ts';
import { HowToPlayScene } from './ui/scenes/HowToPlayScene.ts';
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
      backgroundColor: '#082f27',
      disableContextMenu: true,
      scene: [BootScene, GameScene, HomeScene, DailyScene, MasteryScene, LeaderboardsScene, SettingsScene, HowToPlayScene],
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

      // Phaser leaves an inline CSS size behind after HiDPI zoom. When the
      // zoom returns to 1, ScaleManager.resize() intentionally does not
      // overwrite that style, so a mobile CSS size can survive on desktop.
      // Own the display size explicitly and update the backing store before
      // changing zoom so the final refresh always uses the new dimensions.
      game.canvas.style.width = `${next.logicalWidth}px`;
      game.canvas.style.height = `${next.logicalHeight}px`;

      if (sizeChanged) {
        game.scale.resize(next.backingWidth, next.backingHeight);
        lastBackingWidth = next.backingWidth;
        lastBackingHeight = next.backingHeight;
      }
      if (zoomChanged) {
        game.scale.setZoom(next.cssZoom);
        lastCssZoom = next.cssZoom;
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
