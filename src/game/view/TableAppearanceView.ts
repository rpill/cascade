import type Phaser from 'phaser';
import { getBoardSlots } from './layout.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { SUITS } from '../model/types.ts';
import type { ThemeDefinition } from '../../theme/ThemeDefinition.ts';
import { getSlotAsset } from '../../theme/ThemeAssets.ts';
import type { SlotRole } from '../../theme/SlotArtwork.ts';
import { getBoardTexture, getSurfaceTransform } from './BoardTexture.ts';

/** Owns table decoration only. It never reads or changes the deal. */
export class TableAppearanceView {
  private readonly scene: Phaser.Scene;
  private theme: ThemeDefinition;
  private readonly surface: Phaser.GameObjects.TileSprite;
  private readonly slots: { image: Phaser.GameObjects.Image; role: SlotRole }[];

  constructor(scene: Phaser.Scene, theme: ThemeDefinition, layout: ViewportLayout) {
    this.scene = scene;
    this.theme = theme;
    this.surface = scene.add.tileSprite(0, 0, 1, 1, getBoardTexture(theme))
      .setOrigin(0).setDepth(0);
    let foundationIndex = 0;
    this.slots = getBoardSlots(layout).map(slot => {
      const role = slot.kind === 'foundation' ? SUITS[foundationIndex++] : slot.kind;
      return {
        role,
        image: scene.add.image(0, 0, getSlotAsset(theme, role).key).setOrigin(0).setDepth(5),
      };
    });
    this.setTheme(theme, layout);
  }

  /** Assets must be loaded before replacing the visible bundle. */
  setTheme(theme: ThemeDefinition, layout: ViewportLayout): void {
    this.theme = theme;
    this.surface.setTexture(getBoardTexture(theme)).setTint(theme.boardTint ?? 0xffffff);
    this.slots.forEach(({ image, role }) => image.setTexture(getSlotAsset(theme, role).key));
    this.relayout(layout);
  }

  relayout(layout: ViewportLayout): void {
    this.surface.setSize(layout.viewportWidth, layout.viewportHeight).setScale(1);
    const source = this.scene.textures.get(getBoardTexture(this.theme)).getSourceImage();
    const transform = getSurfaceTransform(this.theme.surfaceScale,
      layout.viewportWidth, layout.viewportHeight, source.width, source.height);
    this.surface.setTileScale(transform.scale).setTilePosition(transform.x, transform.y);

    getBoardSlots(layout).forEach((slot, index) => {
      this.slots[index].image.setPosition(slot.x, slot.y)
        .setDisplaySize(layout.cardWidth, layout.cardHeight);
    });
  }

  destroy(): void {
    this.surface.destroy();
    this.slots.forEach(({ image }) => image.destroy());
  }
}
