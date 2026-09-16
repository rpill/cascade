import * as Phaser from 'phaser';
import { getBoardSlots } from './layout.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { UI_TOKENS } from '../../ui/style/UiTokens.ts';

const FOUNDATION_SYMBOLS = ['♣', '♥', '♦', '♠'] as const;

/** Lightweight slot outlines and glyphs for the game table. */
export class TableAppearanceView {
  private readonly slots: Phaser.GameObjects.Graphics;
  private readonly foundationIcons: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene, _theme: ThemeDefinition, layout: ViewportLayout) {
    this.slots = scene.add.graphics().setDepth(5);
    this.foundationIcons = FOUNDATION_SYMBOLS.map((symbol) => scene.add.text(0, 0, symbol, {
      color: '#d7c08a',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.72).setDepth(5.1));
    this.relayout(layout);
  }

  setTheme(_theme: ThemeDefinition, layout: ViewportLayout): void {
    this.relayout(layout);
  }

  relayout(layout: ViewportLayout): void {
    this.slots.clear();
    const lineWidth = Math.max(0.9, layout.cardWidth * 0.0105);
    const radius = Math.max(4, layout.cardWidth * 0.055);
    const slotFill = 0.04;

    for (const slot of getBoardSlots(layout)) {
      const alpha = slot.kind === 'foundation' ? 0.62
        : slot.kind === 'tableau' ? 0.46
          : 0.56;
      this.slots.fillStyle(UI_TOKENS.color.table, slotFill)
        .fillRoundedRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight, radius);
      this.slots.lineStyle(lineWidth, UI_TOKENS.color.goldLight, alpha);
      this.slots.strokeRoundedRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight, radius);
    }

    layout.foundations.forEach((point, index) => {
      const icon = this.foundationIcons[index];
      if (!icon) return;
      const fontSize = Math.max(18, Math.min(layout.cardWidth * 0.31, layout.cardHeight * 0.28));
      icon.setFontSize(fontSize)
        .setPosition(point.x + layout.cardWidth / 2, point.y + layout.cardHeight / 2)
        .setVisible(true);
    });

  }

  destroy(): void {
    this.slots.destroy();
    this.foundationIcons.forEach((icon) => icon.destroy());
  }

}