import type Phaser from 'phaser';
import { getBoardSlots } from './layout.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { SUITS } from '../model/types.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { getSlotFrameAsset, getSlotGlyphAsset } from '../../theme/ThemeAssets.ts';
import type { SlotRole } from '../../theme/SlotArtwork.ts';
import { TableSurfaceView } from './TableSurfaceView.ts';

/** Owns table decoration only. It never reads or changes the deal. */
export class TableAppearanceView {
  private readonly surface: TableSurfaceView;
  private readonly slots: {
    image: Phaser.GameObjects.Image;
    glyph: Phaser.GameObjects.Image | null;
    role: SlotRole;
  }[];

  constructor(scene: Phaser.Scene, theme: ThemeDefinition, layout: ViewportLayout) {
    this.surface = new TableSurfaceView(scene, theme, layout);
    let foundationIndex = 0;
    this.slots = getBoardSlots(layout).map(slot => {
      const role = slot.kind === 'foundation' ? SUITS[foundationIndex++] : slot.kind;
      const glyph = getSlotGlyphAsset(theme, role);
      return {
        role,
        image: scene.add.image(0, 0, getSlotFrameAsset(theme).key).setOrigin(0).setDepth(5),
        glyph: glyph === null ? null : scene.add.image(0, 0, glyph.key).setOrigin(0).setDepth(6),
      };
    });
    this.relayout(layout);
  }

  /** Assets must be loaded before replacing the visible bundle. */
  setTheme(theme: ThemeDefinition, layout: ViewportLayout): void {
    this.surface.setTheme(theme, layout);
    this.slots.forEach(({ image, glyph, role }) => {
      image.setTexture(getSlotFrameAsset(theme).key);
      const asset = getSlotGlyphAsset(theme, role);
      if (asset !== null) glyph?.setTexture(asset.key);
    });
    this.relayout(layout);
  }

  relayout(layout: ViewportLayout): void {
    this.surface.relayout(layout);

    getBoardSlots(layout).forEach((slot, index) => {
      this.slots[index].image.setPosition(slot.x, slot.y)
        .setDisplaySize(layout.cardWidth, layout.cardHeight);
      this.slots[index].glyph?.setPosition(slot.x, slot.y)
        .setDisplaySize(layout.cardWidth, layout.cardHeight);
    });
  }

  destroy(): void {
    this.surface.destroy();
    this.slots.forEach(({ image, glyph }) => { image.destroy(); glyph?.destroy(); });
  }
}
