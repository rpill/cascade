import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';

export type SurfaceTone = 'paper' | 'jade' | 'gold';

/** Resolution-independent chrome; illustration belongs only to the hero. */
export class UiSurface {
  readonly object: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly landscape: Phaser.GameObjects.Image | null;
  private width = 1;
  private height = 1;
  private radius = 8;
  private ornate = false;
  private tone: SurfaceTone = 'paper';

  constructor(scene: Phaser.Scene, depth = 0, decorated = false, private readonly artworkAlpha = 1, artworkKey?: string) {
    this.body = scene.add.graphics();
    this.landscape = decorated && artworkKey === CASCADE_UI_ART_KEYS.homeHero && scene.textures.exists(artworkKey)
      ? scene.add.image(0, 0, artworkKey).setOrigin(0) : null;
    this.frame = scene.add.graphics();
    this.object = scene.add.container(0, 0, [this.body, ...(this.landscape ? [this.landscape] : []), this.frame]).setDepth(depth);
  }

  layout(bounds: UiRect, tone: SurfaceTone = 'paper', ornate = false): void {
    this.tone = tone; this.ornate = ornate;
    this.width = bounds.width; this.height = bounds.height;
    this.radius = Math.min(12, Math.max(5, bounds.height * 0.045));
    this.object.setPosition(bounds.x, bounds.y);
    if (this.landscape) {
      const inset = 5;
      const crop = coverCrop(this.landscape.frame.realWidth, this.landscape.frame.realHeight, this.width - inset * 2, this.height - inset * 2, 0.5, 0.48);
      const scale = (this.width - inset * 2) / crop.width;
      this.landscape.setCrop(crop.x, crop.y, crop.width, crop.height)
        .setPosition(inset - crop.x * scale, inset - crop.y * scale).setScale(scale).setAlpha(this.artworkAlpha);
    }
    this.feedback('normal');
  }

  feedback(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    const w = this.width, h = this.height, r = this.radius;
    const colors = {
      paper: [0xf7efdc, 0xfff9e9, 0xeaddc2],
      jade: [0x153e34, 0x205346, 0x0c2923],
      gold: [0xd2af67, 0xe5c783, 0xb9914d],
    };
    const fill = colors[this.tone][state === 'hover' ? 1 : state === 'pressed' ? 2 : 0]!;
    this.body.clear().fillStyle(0x020c09, 0.22).fillRoundedRect(0, 4, w, h, r)
      .fillStyle(fill, 1).fillRoundedRect(0, 0, w, h, r);
    this.frame.clear()
      .lineStyle(1, state === 'hover' ? UI_TOKENS.color.goldLight : UI_TOKENS.color.gold, this.tone === 'paper' ? 0.9 : 0.65)
      .strokeRoundedRect(0.5, 0.5, w - 1, h - 1, r)
      .lineStyle(1, this.tone === 'jade' ? 0x71a58a : 0xffffff, 0.28)
      .lineBetween(r, 2, w - r, 2);
    if (this.ornate && w > 100 && h > 70) {
      const inset = 5;
      this.frame.lineStyle(0.7, UI_TOKENS.color.gold, 0.35)
        .strokeRoundedRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(2, r - 3));
      const size = Math.min(21, h * 0.1);
      for (const [x, y, sx, sy] of [[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1]]) {
        this.frame.lineStyle(1, UI_TOKENS.color.gold, 0.65).beginPath()
          .moveTo(x!, y! + sy! * size).lineTo(x!, y!).lineTo(x! + sx! * size, y!).strokePath();
        this.frame.fillStyle(UI_TOKENS.color.gold, 0.65);
        for (let i = 0; i < 3; i++) {
          const d = 4 + i * 5;
          this.frame.fillEllipse(x! + sx! * d, y! + sy! * d * 0.48, 5, 2.5);
          this.frame.fillEllipse(x! + sx! * d * 0.48, y! + sy! * d, 2.5, 5);
        }
      }
    }
    this.object.setAlpha(state === 'disabled' ? 0.58 : 1);
  }
  setDepth(depth: number): void { this.object.setDepth(depth); }
  setAlpha(alpha: number): void { this.object.setAlpha(alpha); }
  setVisible(visible: boolean): void { this.object.setVisible(visible); }
  destroy(): void { this.object.destroy(true); }
}
