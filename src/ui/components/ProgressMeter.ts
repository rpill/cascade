import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export interface ProgressValue {
  readonly current: number;
  readonly total: number;
}

export class ProgressMeter {
  private readonly surface: Phaser.GameObjects.Graphics;
  private progress: ProgressValue = { current: 0, total: 1 };

  constructor(scene: Phaser.Scene, depth = 0) {
    this.surface = scene.add.graphics().setDepth(depth);
  }

  setProgress(progress: ProgressValue): void {
    this.progress = progress;
  }

  layout(bounds: UiRect): void {
    const total = Math.max(1, this.progress.total);
    const ratio = Phaser.Math.Clamp(this.progress.current / total, 0, 1);
    const radius = Math.min(bounds.height / 2, UI_TOKENS.radius.control);
    this.surface.clear();
    this.surface.fillStyle(UI_TOKENS.color.ink, 0.16).fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      radius,
    );
    if (ratio > 0) {
      this.surface.fillStyle(UI_TOKENS.color.gold, 0.9).fillRoundedRect(
        bounds.x,
        bounds.y,
        bounds.width * ratio,
        bounds.height,
        radius,
      );
    }
  }

  setVisible(visible: boolean): void {
    this.surface.setVisible(visible);
  }

  destroy(): void {
    this.surface.destroy();
  }
}
