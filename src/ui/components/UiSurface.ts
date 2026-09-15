import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_ART_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';

export type SurfaceTone = 'paper' | 'jade' | 'gold';

/** One neutral nine-slice shared by panels and buttons. No state-specific textures. */
export class UiSurface {
  readonly object: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.NineSlice | null;
  private readonly canvasBody: Phaser.GameObjects.Graphics | null;
  private bodyWidth = 1;
  private bodyHeight = 1;
  private bodyRadius = 1;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly grain: Phaser.GameObjects.TileSprite;
  private readonly landscape: Phaser.GameObjects.Image | null;
  private tone: SurfaceTone = 'paper';

  constructor(scene: Phaser.Scene, depth = 0, decorated = false, private readonly artworkAlpha = 0.72, artworkKey: string = UI_ART_KEYS.paper) {
    // Phaser's NineSlice only renders in WebGL; AUTO can fall back to Canvas.
    this.body = scene.game.renderer.type === Phaser.WEBGL
      ? scene.add.nineslice(0, 0, UI_ART_KEYS.material, undefined, 192, 192, 16, 16, 16, 16).setOrigin(0) : null;
    this.canvasBody = this.body ? null : scene.add.graphics();
    this.grain = scene.add.tileSprite(0, 0, 1, 1, UI_ART_KEYS.paperGrain).setOrigin(0).setAlpha(0.15).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.landscape = decorated && scene.textures.exists(artworkKey) ? scene.add.image(0, 0, artworkKey).setOrigin(0) : null;
    this.frame = scene.add.graphics();
    this.object = scene.add.container(0, 0, [this.body ?? this.canvasBody!, this.grain, ...(this.landscape ? [this.landscape] : []), this.frame]).setDepth(depth);
  }

  layout(bounds: UiRect, tone: SurfaceTone = 'paper', ornate = false): void {
    this.tone = tone;
    this.object.setPosition(bounds.x, bounds.y);
    const { width: w, height: h } = bounds;
    const scale = Math.min(1.5, h / 96, w / 96);
    this.body?.setSize(w / scale, h / scale).setScale(scale);
    this.bodyWidth = w;
    this.bodyHeight = h;
    this.bodyRadius = 12 * scale;
    this.grain.setPosition(10 * scale, 10 * scale).setSize(Math.max(1, w - 20 * scale), Math.max(1, h - 20 * scale));
    this.feedback('normal');
    if (this.landscape) {
      const inset = 7 * scale;
      const crop = coverCrop(this.landscape.frame.realWidth, this.landscape.frame.realHeight, w - inset * 2, h - inset * 2, 0.5, w / h > 2 ? 0.72 : 0.5);
      const artScale = (w - inset * 2) / crop.width;
      this.landscape.setCrop(crop.x, crop.y, crop.width, crop.height)
        .setPosition(inset - crop.x * artScale, inset - crop.y * artScale).setScale(artScale).setAlpha(tone === 'paper' ? this.artworkAlpha : 0.05);
    }
    const radius = 12 * scale;
    this.frame.clear().lineStyle(Math.max(0.7, scale * 0.7), UI_TOKENS.color.gold, 0.82)
      .strokeRoundedRect(0.5, 0.5, w - 1, h - 1, radius);
    this.frame.lineStyle(Math.max(0.5, scale * 0.45), tone === 'jade' ? UI_TOKENS.color.gold : 0xfff5dc, 0.25)
      .strokeRoundedRect(3 * scale, 3 * scale, w - 6 * scale, h - 6 * scale, radius * 0.8);
    if (ornate && w > 180 && h > 85) {
      const size = Math.min(22 * scale, h * 0.16);
      for (const [x, y, sx, sy] of [[8, 8, 1, 1], [w - 8, 8, -1, 1], [8, h - 8, 1, -1], [w - 8, h - 8, -1, -1]]) {
        this.frame.lineStyle(Math.max(0.8, scale), UI_TOKENS.color.gold, 0.6).beginPath()
          .moveTo(x!, y! + sy! * size).lineTo(x!, y!).lineTo(x! + sx! * size, y!)
          .moveTo(x! + sx! * size * 0.6, y! + sy! * 4).lineTo(x! + sx! * 4, y! + sy! * 4).lineTo(x! + sx! * 4, y! + sy! * size * 0.6).strokePath();
      }
    }
  }

  feedback(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    const colors = { paper: [0xf7ecd6, 0xfff6e3, 0xddcfb4], jade: [0x123d32, 0x1b5142, 0x0a2923], gold: [0xc5a05a, 0xddb970, 0xa78549] };
    const color = colors[this.tone][state === 'hover' ? 1 : state === 'pressed' ? 2 : 0]!;
    this.body?.setTint(color);
    this.canvasBody?.clear().fillStyle(color).fillRoundedRect(0, 0, this.bodyWidth, this.bodyHeight, this.bodyRadius);
    this.object.setAlpha(state === 'disabled' ? 0.48 : 1);
  }
  setDepth(depth: number): void { this.object.setDepth(depth); }
  setAlpha(alpha: number): void { this.object.setAlpha(alpha); }
  setVisible(visible: boolean): void { this.object.setVisible(visible); }
  destroy(): void { this.object.destroy(true); }
}
