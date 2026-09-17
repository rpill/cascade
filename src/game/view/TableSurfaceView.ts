import type * as Phaser from 'phaser';
import type { GameAppearance } from '../appearance/GameAppearance.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { getSurfaceTransform } from './BoardTexture.ts';
import { getSurfaceSlices } from './SurfaceSlices.ts';

/** Uses ordinary images for nine-slicing, so Canvas and WebGL have the same layout. */
export class TableSurfaceView {
  private readonly scene: Phaser.Scene;
  private appearance: GameAppearance;
  private tile: Phaser.GameObjects.TileSprite | null = null;
  private pieces: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, appearance: GameAppearance, layout: ViewportLayout) {
    this.scene = scene;
    this.appearance = appearance;
    this.setAppearance(appearance, layout);
  }

  setAppearance(appearance: GameAppearance, layout: ViewportLayout): void {
    this.destroy();
    this.appearance = appearance;
    if (appearance.surfaceScale === 'framed') {
      const texture = this.scene.textures.get(appearance.boardSurface.key);
      const source = texture.getSourceImage();
      const bounds = appearance.surfaceCrop ?? source;
      const slices = getSurfaceSlices(layout.viewportWidth, layout.viewportHeight,
        bounds.width, bounds.height, appearance.surfaceSlices);
      this.pieces = slices.map((slice, index) => {
        const frame = `surface-slice-${index}`;
        if (!texture.has(frame)) texture.add(frame, 0, slice.sx, slice.sy, slice.sw, slice.sh);
        return this.scene.add.image(0, 0, texture.key, frame).setOrigin(0).setDepth(0)
          .setTint(appearance.boardTint ?? 0xffffff);
      });
    } else {
      this.tile = this.scene.add.tileSprite(0, 0, 1, 1, appearance.boardSurface.key)
        .setOrigin(0).setDepth(0).setTint(appearance.boardTint ?? 0xffffff);
    }
    this.relayout(layout);
  }

  relayout(layout: ViewportLayout): void {
    const source = this.scene.textures.get(this.appearance.boardSurface.key).getSourceImage();
    if (this.appearance.surfaceScale === 'framed') {
      const bounds = this.appearance.surfaceCrop ?? source;
      getSurfaceSlices(layout.viewportWidth, layout.viewportHeight,
        bounds.width, bounds.height, this.appearance.surfaceSlices).forEach((slice, index) => {
        this.pieces[index].setPosition(slice.x, slice.y).setDisplaySize(slice.width, slice.height);
      });
    } else {
      const transform = getSurfaceTransform(this.appearance.surfaceScale,
        layout.viewportWidth, layout.viewportHeight, source.width, source.height);
      this.tile?.setSize(layout.viewportWidth, layout.viewportHeight).setScale(1)
        .setTileScale(transform.scale).setTilePosition(transform.x, transform.y);
    }
  }

  destroy(): void {
    this.tile?.destroy();
    this.tile = null;
    this.pieces.forEach(piece => piece.destroy());
    this.pieces = [];
  }
}
