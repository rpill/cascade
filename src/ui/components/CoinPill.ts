import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export class CoinPill {
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly value: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, depth = 0) {
    this.surface = scene.add.graphics().setDepth(depth);
    this.icon = scene.add.image(0, 0, UI_ICON_KEYS.coin)
      .setOrigin(0.5)
      .setTint(UI_TOKENS.color.gold)
      .setDepth(depth + 0.1);
    this.value = scene.add.text(0, 0, '0', {
      color: '#1b2e29',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(depth + 0.1);
  }

  setCoins(coins: number): void {
    this.value.setText(Math.max(0, Math.floor(coins)).toLocaleString('ru-RU'));
  }

  layout(bounds: UiRect): void {
    this.surface.clear();
    this.surface.fillStyle(UI_TOKENS.color.paper, 0.98).fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      bounds.height / 2,
    );
    this.surface.lineStyle(UI_TOKENS.stroke.thin, UI_TOKENS.color.gold, 0.8)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, bounds.height / 2);
    const fontSize = Math.max(12, Math.round(bounds.height * 0.36));
    const iconSize = Math.max(16, bounds.height * 0.48);
    this.icon.setDisplaySize(iconSize, iconSize).setPosition(
      bounds.x + bounds.height * 0.48,
      bounds.y + bounds.height / 2,
    );
    this.value.setFontSize(fontSize).setPosition(
      bounds.x + bounds.height * 0.82,
      bounds.y + bounds.height / 2,
    );
  }

  destroy(): void {
    this.surface.destroy();
    this.icon.destroy();
    this.value.destroy();
  }
}
