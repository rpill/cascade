import * as Phaser from 'phaser';
import { getBoardSlots } from './layout.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';

const TRIFOLD_BASE_SLOT_EDGE = 0x8aa095;

/**
 * Canvas-only table decoration. Cascade keeps its own slot geometry while the
 * table treatment mirrors Trifold's quiet base-table outlines.
 */
export class TableAppearanceView {
  private readonly slots: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, _theme: ThemeDefinition, layout: ViewportLayout) {
    this.slots = scene.add.graphics().setDepth(5);
    this.relayout(layout);
  }

  setTheme(_theme: ThemeDefinition, layout: ViewportLayout): void {
    this.relayout(layout);
  }

  relayout(layout: ViewportLayout): void {
    this.slots.clear();
    const lineWidth = Math.max(1, layout.cardWidth * 0.015);
    const radius = Math.max(4, layout.cardWidth * 0.06);

    for (const slot of getBoardSlots(layout)) {
      const alpha = slot.kind === 'foundation' ? 0.56
        : slot.kind === 'tableau' ? 0.34
          : 0.42;
      this.slots.lineStyle(lineWidth, TRIFOLD_BASE_SLOT_EDGE, alpha);
      this.slots.strokeRoundedRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight, radius);
    }
  }

  destroy(): void {
    this.slots.destroy();
  }
}
