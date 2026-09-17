import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';

export type ButtonSurfaceTone = 'paper' | 'jade' | 'gold';
export type ButtonSurfaceShape = 'wide' | 'square';
type FeedbackState = 'normal' | 'hover' | 'pressed' | 'disabled';

interface SliceKeys {
  readonly left: string;
  readonly center: string;
  readonly right: string;
}

const WIDE_KEYS: Record<ButtonSurfaceTone, SliceKeys> = {
  jade: {
    left: CASCADE_UI_ART_KEYS.buttonJadeLeft,
    center: CASCADE_UI_ART_KEYS.buttonJadeCenter,
    right: CASCADE_UI_ART_KEYS.buttonJadeRight,
  },
  paper: {
    left: CASCADE_UI_ART_KEYS.buttonPaperLeft,
    center: CASCADE_UI_ART_KEYS.buttonPaperCenter,
    right: CASCADE_UI_ART_KEYS.buttonPaperRight,
  },
  gold: {
    left: CASCADE_UI_ART_KEYS.buttonGoldLeft,
    center: CASCADE_UI_ART_KEYS.buttonGoldCenter,
    right: CASCADE_UI_ART_KEYS.buttonGoldRight,
  },
};

export class ButtonSurface {
  readonly object: Phaser.GameObjects.Container;

  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly left: Phaser.GameObjects.Image;
  private readonly center: Phaser.GameObjects.TileSprite;
  private readonly right: Phaser.GameObjects.Image;
  private readonly square: Phaser.GameObjects.Image;
  private readonly overlay: Phaser.GameObjects.Graphics;

  private bounds: UiRect = { x: 0, y: 0, width: 1, height: 1 };
  private tone: ButtonSurfaceTone = 'paper';
  private shape: ButtonSurfaceShape = 'wide';
  private visible = true;
  private userAlpha = 1;
  private feedbackState: FeedbackState = 'normal';

  constructor(scene: Phaser.Scene, depth = 0) {
    this.shadow = scene.add.graphics();
    this.left = scene.add.image(0, 0, CASCADE_UI_ART_KEYS.buttonPaperLeft).setOrigin(0, 0);
    this.center = scene.add.tileSprite(0, 0, 1, 1, CASCADE_UI_ART_KEYS.buttonPaperCenter).setOrigin(0, 0);
    this.right = scene.add.image(0, 0, CASCADE_UI_ART_KEYS.buttonPaperRight).setOrigin(0, 0);
    this.square = scene.add.image(0, 0, CASCADE_UI_ART_KEYS.buttonIconJade).setOrigin(0, 0);
    this.overlay = scene.add.graphics();
    this.object = scene.add.container(0, 0, [this.shadow, this.left, this.center, this.right, this.square, this.overlay]).setDepth(depth);
  }

  layout(bounds: UiRect, tone: ButtonSurfaceTone, shape: ButtonSurfaceShape = 'wide'): void {
    this.bounds = bounds;
    this.tone = tone;
    this.shape = shape;
    this.object.setPosition(bounds.x, bounds.y);
    this.rebuild();
    this.feedback(this.feedbackState === 'disabled' ? 'disabled' : 'normal');
  }

  feedback(state: FeedbackState): void {
    this.feedbackState = state;
    const radius = Math.min(this.bounds.height / 2, 18);
    this.overlay.clear();

    if (state === 'hover') {
      this.applyTint(this.tone === 'jade' ? 0xe7fff3 : 0xfff5d9);
      this.overlay.fillStyle(0xffffff, 0.08).fillRoundedRect(0, 0, this.bounds.width, this.bounds.height, radius);
    } else if (state === 'pressed') {
      this.applyTint(this.tone === 'jade' ? 0xbdd3c8 : 0xd7c39a);
      this.overlay.fillStyle(0x000000, 0.10).fillRoundedRect(0, 0, this.bounds.width, this.bounds.height, radius);
    } else if (state === 'disabled') {
      this.applyTint(0xb9b9b9);
    } else {
      this.applyTint(0xffffff);
    }

    this.applyObjectAlpha(state === 'disabled' ? 0.46 : 1);
  }

  setAlpha(alpha: number): void {
    this.userAlpha = alpha;
    this.applyObjectAlpha(this.feedbackState === 'disabled' ? 0.46 : 1);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.object.setVisible(visible);
  }

  destroy(): void {
    this.object.destroy(true);
  }

  private rebuild(): void {
    const shadowRadius = Math.min(this.bounds.height / 2, 18);
    this.shadow.clear()
      .fillStyle(0x000000, 0.16)
      .fillRoundedRect(0, Math.max(1, this.bounds.height * 0.055), this.bounds.width, this.bounds.height, shadowRadius);

    if (this.shape === 'square') {
      this.square.setTexture(CASCADE_UI_ART_KEYS.buttonIconJade)
        .setVisible(true)
        .setPosition(0, 0)
        .setDisplaySize(this.bounds.width, this.bounds.height);
      this.left.setVisible(false);
      this.center.setVisible(false);
      this.right.setVisible(false);
      return;
    }

    const keys = WIDE_KEYS[this.tone];
    this.square.setVisible(false);
    this.left.setTexture(keys.left).setVisible(true);
    this.center.setTexture(keys.center).setVisible(true);
    this.right.setTexture(keys.right).setVisible(true);

    const leftFrame = this.left.frame;
    const rightFrame = this.right.frame;
    const leftAspect = leftFrame.realWidth / leftFrame.realHeight;
    const rightAspect = rightFrame.realWidth / rightFrame.realHeight;
    const naturalLeft = this.bounds.height * leftAspect;
    const naturalRight = this.bounds.height * rightAspect;
    const maxCaps = this.bounds.width * 0.42;
    const scaleDown = Math.min(1, maxCaps / Math.max(1, naturalLeft + naturalRight));
    const leftWidth = naturalLeft * scaleDown;
    const rightWidth = naturalRight * scaleDown;
    const centerWidth = Math.max(1, this.bounds.width - leftWidth - rightWidth);

    this.left.setPosition(0, 0).setDisplaySize(leftWidth, this.bounds.height);
    const centerScale = this.bounds.height / Math.max(1, this.center.frame.realHeight);
    this.center.setPosition(leftWidth, 0).setSize(centerWidth, this.bounds.height).setTileScale(centerScale, centerScale);
    this.right.setPosition(leftWidth + centerWidth, 0).setDisplaySize(rightWidth, this.bounds.height);
  }

  private applyTint(tint: number): void {
    this.left.setTint(tint);
    this.center.setTint(tint);
    this.right.setTint(tint);
    this.square.setTint(tint);
  }

  private applyObjectAlpha(stateAlpha: number): void {
    this.object.setAlpha(this.visible ? this.userAlpha * stateAlpha : 0);
  }
}
