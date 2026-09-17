import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { normalizeTouchTarget } from '../layout/UiViewport.ts';
import { ButtonSurface } from './ButtonSurface.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly enabled?: boolean;
}

interface SegmentView<T extends string> {
  readonly option: SegmentOption<T>;
  readonly surface: ButtonSurface;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
}

export class SegmentedControl<T extends string> {
  readonly enabled = true;
  private readonly views: readonly SegmentView<T>[];
  private readonly onSelect: (value: T) => void;
  private viewport: ResolvedUiViewport;
  private selected: T;
  private bounds: UiRect | null = null;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    options: readonly SegmentOption<T>[],
    selected: T,
    onSelect: (value: T) => void,
    depth = 0,
  ) {
    this.viewport = viewport;
    this.selected = selected;
    this.onSelect = onSelect;
    this.views = options.map((option) => {
      const surface = new ButtonSurface(scene, depth);
      const label = scene.add.text(0, 0, option.label, {
        color: '#24302e',
        fontFamily: 'Georgia, serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(depth + 0.1);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
      zone.on('pointerdown', () => {
        if (this.enabled && option.enabled !== false) {
          playUiButtonSound(scene);
          this.onSelect(option.value);
        }
      });
      zone.input!.cursor = 'pointer';
      zone.on('pointerover', () => {
        if (!this.enabled || option.enabled === false) return;
        if (option.value !== this.selected) surface.feedback('hover');
      });
      zone.on('pointerout', () => {
        surface.feedback(option.enabled === false ? 'disabled' : 'normal');
      });
      return { option, surface, label, zone };
    });
  }

  setSelected(value: T): void {
    this.selected = value;
    if (this.bounds) this.layout(this.bounds);
  }

  setViewport(viewport: ResolvedUiViewport): void {
    this.viewport = viewport;
  }

  layout(bounds: UiRect): void {
    this.bounds = bounds;
    const count = Math.max(1, this.views.length);
    const width = bounds.width / count;
    const hitHeight = normalizeTouchTarget(bounds.height, this.viewport);
    const gap = Math.max(10, bounds.height * 0.12);
    for (let index = 0; index < this.views.length; index += 1) {
      const view = this.views[index]!;
      const x = bounds.x + width * index;
      const selected = view.option.value === this.selected;
      const optionEnabled = view.option.enabled !== false;
      const alpha = optionEnabled ? 1 : 0.45;
      const buttonBounds = { x: x + gap / 2, y: bounds.y, width: width - gap, height: bounds.height };
      view.surface.layout(buttonBounds, selected ? 'jade' : 'paper', 'wide');
      view.surface.setAlpha(alpha);
      view.surface.feedback(optionEnabled ? 'normal' : 'disabled');
      const baseFont = Math.max(11, Math.round(bounds.height * 0.28));
      view.label
        .setColor(selected ? '#fff3da' : '#24302e')
        .setAlpha(alpha)
        .setFontSize(baseFont)
        .setPosition(x + width / 2, bounds.y + bounds.height / 2);
      const maxTextWidth = buttonBounds.width * 0.78;
      if (view.label.width > maxTextWidth) {
        view.label.setFontSize(Math.max(10, Math.floor(baseFont * (maxTextWidth / view.label.width))));
      }
      view.zone.setPosition(x, bounds.y - (hitHeight - bounds.height) / 2).setSize(width, hitHeight);
      if (optionEnabled) view.zone.setInteractive();
      else view.zone.disableInteractive();
    }
  }

  destroy(): void {
    for (const view of this.views) {
      view.surface.destroy();
      view.label.destroy();
      view.zone.destroy();
    }
  }
}
