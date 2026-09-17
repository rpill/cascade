import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';

export type ArtworkMode = 'cover' | 'contain';

export type SurfaceTone = 'paper' | 'jade' | 'gold';

/** Resolution-independent chrome; illustration stays visual-only and may be uniformly muted. */
export class UiSurface {
  readonly object: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly landscape: Phaser.GameObjects.Image | null;
  private readonly artworkWash: Phaser.GameObjects.Graphics | null;
  private readonly artworkCorners: Phaser.GameObjects.Graphics | null;
  private width = 1;
  private height = 1;
  private radius = 8;
  private tone: SurfaceTone = 'paper';

  constructor(
    scene: Phaser.Scene,
    depth = 0,
    decorated = false,
    private readonly artworkAlpha = 1,
    artworkKey?: string,
    private readonly artworkWashAlpha = 0,
    private readonly artworkMode: ArtworkMode = 'cover',
    private readonly artworkFocusX = 0.5,
    private readonly artworkFocusY = 0.48,
  ) {
    this.body = scene.add.graphics();
    this.landscape = decorated && artworkKey && scene.textures.exists(artworkKey)
      ? scene.add.image(0, 0, artworkKey).setOrigin(0) : null;
    this.artworkWash = this.landscape && artworkWashAlpha > 0 ? scene.add.graphics() : null;
    this.artworkCorners = this.landscape ? scene.add.graphics() : null;
    this.frame = scene.add.graphics();
    this.object = scene.add.container(0, 0, [
      this.body,
      ...(this.landscape ? [this.landscape] : []),
      ...(this.artworkWash ? [this.artworkWash] : []),
      ...(this.artworkCorners ? [this.artworkCorners] : []),
      this.frame,
    ]).setDepth(depth);
  }

  layout(bounds: UiRect, tone: SurfaceTone = 'paper', _ornate = false): void {
    this.tone = tone;
    this.width = bounds.width; this.height = bounds.height;
    this.radius = Math.min(12, Math.max(5, bounds.height * 0.045));
    this.object.setPosition(bounds.x, bounds.y);
    if (this.landscape) {
      const inset = 5;
      const availableWidth = this.width - inset * 2;
      const availableHeight = this.height - inset * 2;
      const sourceWidth = this.landscape.frame.realWidth;
      const sourceHeight = this.landscape.frame.realHeight;
      if (this.artworkMode === 'contain') {
        const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        this.landscape.setCrop();
        this.landscape.setPosition(inset + (availableWidth - drawWidth) / 2, inset + (availableHeight - drawHeight) / 2)
          .setScale(scale).setAlpha(this.artworkAlpha);
      } else {
        const crop = coverCrop(sourceWidth, sourceHeight, availableWidth, availableHeight, this.artworkFocusX, this.artworkFocusY);
        const scale = availableWidth / crop.width;
        this.landscape.setCrop(crop.x, crop.y, crop.width, crop.height)
          .setPosition(inset - crop.x * scale, inset - crop.y * scale).setScale(scale).setAlpha(this.artworkAlpha);
      }
      this.artworkWash?.clear()
        .fillStyle(UI_TOKENS.color.paper, this.artworkWashAlpha)
        .fillRoundedRect(inset, inset, availableWidth, availableHeight, Math.max(3, this.radius - 2));
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
    this.drawArtworkCornerCutouts(fill);
    this.frame.clear()
      .lineStyle(1, state === 'hover' ? UI_TOKENS.color.goldLight : UI_TOKENS.color.gold, this.tone === 'paper' ? 0.9 : 0.65)
      .strokeRoundedRect(0.5, 0.5, w - 1, h - 1, r)
      .lineStyle(1, this.tone === 'jade' ? 0x71a58a : 0xffffff, 0.28)
      .lineBetween(r, 2, w - r, 2);
    this.object.setAlpha(state === 'disabled' ? 0.58 : 1);
  }
  private drawArtworkCornerCutouts(fill: number): void {
    if (!this.artworkCorners || !this.landscape) return;
    const inset = 5;
    const innerRadius = Math.max(3, this.radius - 2);
    const left = inset;
    const top = inset;
    const right = this.width - inset;
    const bottom = this.height - inset;
    const segments = 8;

    const arcPoints = (cx: number, cy: number, start: number, end: number): Phaser.Math.Vector2[] => {
      const points: Phaser.Math.Vector2[] = [];
      for (let index = 0; index <= segments; index += 1) {
        const angle = start + (end - start) * (index / segments);
        points.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius));
      }
      return points;
    };

    this.artworkCorners.clear().fillStyle(fill, 1);
    this.artworkCorners.fillPoints([
      new Phaser.Math.Vector2(left, top),
      new Phaser.Math.Vector2(left + innerRadius, top),
      ...arcPoints(left + innerRadius, top + innerRadius, -Math.PI / 2, -Math.PI),
    ], true);
    this.artworkCorners.fillPoints([
      new Phaser.Math.Vector2(right, top),
      new Phaser.Math.Vector2(right, top + innerRadius),
      ...arcPoints(right - innerRadius, top + innerRadius, 0, -Math.PI / 2),
    ], true);
    this.artworkCorners.fillPoints([
      new Phaser.Math.Vector2(right, bottom),
      new Phaser.Math.Vector2(right - innerRadius, bottom),
      ...arcPoints(right - innerRadius, bottom - innerRadius, Math.PI / 2, 0),
    ], true);
    this.artworkCorners.fillPoints([
      new Phaser.Math.Vector2(left, bottom),
      new Phaser.Math.Vector2(left, bottom - innerRadius),
      ...arcPoints(left + innerRadius, bottom - innerRadius, Math.PI, Math.PI / 2),
    ], true);
  }

  setDepth(depth: number): void { this.object.setDepth(depth); }
  setAlpha(alpha: number): void { this.object.setAlpha(alpha); }
  setVisible(visible: boolean): void { this.object.setVisible(visible); }
  destroy(): void { this.object.destroy(true); }
}
