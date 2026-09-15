import Phaser from 'phaser';
import { UI_ART_KEYS } from '../assets/UiAssets.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';

/** Art never participates in input or gameplay geometry. */
export class SceneBackdrop {
  private readonly image: Phaser.GameObjects.Image;
  private readonly wash: Phaser.GameObjects.Rectangle;
  private readonly grain: Phaser.GameObjects.TileSprite;
  private readonly border: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, private readonly mode: 'home' | 'menu' | 'game' = 'menu', tint = 0x123b34) {
    this.image = scene.add.image(0, 0, UI_ART_KEYS.jade).setOrigin(0).setDepth(-100);
    this.wash = scene.add.rectangle(0, 0, 1, 1, tint, mode === 'home' ? 0 : mode === 'game' ? 0.86 : 0.48).setOrigin(0).setDepth(-99);
    this.grain = scene.add.tileSprite(0, 0, 1, 1, UI_ART_KEYS.grain).setTint(tint).setAlpha(mode === 'game' ? 0.55 : 0.12).setOrigin(0).setDepth(-98);
    this.border = scene.add.graphics().setDepth(-97);
  }
  layout(width: number, height: number): void {
    const frame = this.image.frame;
    const crop = coverCrop(frame.realWidth, frame.realHeight, width, height, 0, this.mode === 'home' ? 0.4 : 0.5);
    this.image.setCrop(crop.x, crop.y, crop.width, crop.height).setScale(width / crop.width).setPosition(-crop.x * width / crop.width, -crop.y * height / crop.height);
    this.wash.setSize(width, height);
    this.grain.setSize(width, height);
    const m = Math.max(7, height * 0.012);
    this.border.clear().lineStyle(1, 0xc5a05a, this.mode === 'game' ? 0.13 : 0.42).strokeRoundedRect(m, m, width - m * 2, height - m * 2, 12);
  }
  destroy(): void { this.image.destroy(); this.wash.destroy(); this.grain.destroy(); this.border.destroy(); }
}
