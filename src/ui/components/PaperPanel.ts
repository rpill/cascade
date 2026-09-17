import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UiSurface, type ArtworkMode } from './UiSurface.ts';

export interface PaperPanelOptions {
  readonly textureKey?: string;
  readonly alpha?: number;
  readonly depth?: number;
  readonly artworkAlpha?: number;
  readonly artworkWashAlpha?: number;
  readonly artworkMode?: ArtworkMode;
  readonly artworkFocusX?: number;
  readonly artworkFocusY?: number;
}
export class PaperPanel {
  private readonly surface: UiSurface;
  private alpha: number;
  constructor(scene: Phaser.Scene, options: PaperPanelOptions = {}) {
    this.surface = new UiSurface(
      scene,
      options.depth ?? 0,
      true,
      options.artworkAlpha ?? 0.26,
      options.textureKey,
      options.artworkWashAlpha ?? 0,
      options.artworkMode ?? 'cover',
      options.artworkFocusX ?? 0.5,
      options.artworkFocusY ?? 0.48,
    );
    this.alpha = options.alpha ?? 1;
  }
  layout(bounds: UiRect): void { this.surface.layout(bounds, 'paper', true); this.surface.setAlpha(this.alpha); }
  setDepth(depth: number): void { this.surface.setDepth(depth); }
  setAlpha(alpha: number): void { this.alpha = alpha; this.surface.setAlpha(alpha); }
  setVisible(visible: boolean): void { this.surface.setVisible(visible); }
  destroy(): void { this.surface.destroy(); }
}
