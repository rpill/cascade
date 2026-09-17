import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export type ButtonSurfaceTone = 'paper' | 'jade' | 'gold';
export type ButtonSurfaceShape = 'wide' | 'square';
type FeedbackState = 'normal' | 'hover' | 'pressed' | 'disabled';

interface TonePalette {
  readonly normal: number;
  readonly hover: number;
  readonly pressed: number;
  readonly border: number;
}

const PALETTE: Readonly<Record<ButtonSurfaceTone, TonePalette>> = {
  paper: {
    normal: UI_TOKENS.color.paper,
    hover: 0xfff8e8,
    pressed: UI_TOKENS.color.paperPressed,
    border: UI_TOKENS.color.gold,
  },
  jade: {
    normal: UI_TOKENS.color.control,
    hover: UI_TOKENS.color.controlActive,
    pressed: 0x0f3129,
    border: UI_TOKENS.color.gold,
  },
  gold: {
    normal: 0xd2af67,
    hover: 0xe0c17d,
    pressed: 0xb9914d,
    border: 0x8f6e35,
  },
};

export class ButtonSurface {
  readonly object: Phaser.GameObjects.Container;

  private readonly body: Phaser.GameObjects.Graphics;
  private bounds: UiRect = { x: 0, y: 0, width: 1, height: 1 };
  private tone: ButtonSurfaceTone = 'paper';
  private shape: ButtonSurfaceShape = 'wide';
  private visible = true;
  private userAlpha = 1;
  private feedbackState: FeedbackState = 'normal';

  constructor(scene: Phaser.Scene, depth = 0) {
    this.body = scene.add.graphics();
    this.object = scene.add.container(0, 0, [this.body]).setDepth(depth);
  }

  layout(bounds: UiRect, tone: ButtonSurfaceTone, shape: ButtonSurfaceShape = 'wide'): void {
    this.bounds = bounds;
    this.tone = tone;
    this.shape = shape;
    this.object.setPosition(bounds.x, bounds.y);
    this.redraw();
  }

  feedback(state: FeedbackState): void {
    this.feedbackState = state;
    this.redraw();
  }

  setAlpha(alpha: number): void {
    this.userAlpha = alpha;
    this.applyObjectAlpha();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.object.setVisible(visible);
  }

  destroy(): void {
    this.object.destroy(true);
  }

  private redraw(): void {
    const palette = PALETTE[this.tone];
    const fill = this.feedbackState === 'hover' ? palette.hover
      : this.feedbackState === 'pressed' ? palette.pressed
        : palette.normal;
    const radiusCap = this.shape === 'square' ? 9 : 11;
    const radius = Math.min(radiusCap, Math.max(5, this.bounds.height * 0.16));
    const borderAlpha = this.feedbackState === 'disabled' ? 0.32 : 0.82;

    this.body.clear()
      .fillStyle(fill, 1)
      .fillRoundedRect(0, 0, this.bounds.width, this.bounds.height, radius)
      .lineStyle(1, palette.border, borderAlpha)
      .strokeRoundedRect(0.5, 0.5, Math.max(0, this.bounds.width - 1), Math.max(0, this.bounds.height - 1), radius);

    this.applyObjectAlpha();
  }

  private applyObjectAlpha(): void {
    const stateAlpha = this.feedbackState === 'disabled' ? 0.46 : 1;
    this.object.setAlpha(this.visible ? this.userAlpha * stateAlpha : 0);
  }
}
