import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { normalizeTouchTarget } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UiSurface } from './UiSurface.ts';

export interface IconButtonState {
  readonly iconKey: string;
  readonly enabled: boolean;
  readonly selected?: boolean;
}

export class IconButton {
  private readonly surface: UiSurface;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly onPress: () => void;
  private state: IconButtonState;
  private viewport: ResolvedUiViewport;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    state: IconButtonState,
    onPress: () => void,
    depth = 0,
  ) {
    this.viewport = viewport;
    this.state = state;
    this.onPress = onPress;
    this.surface = new UiSurface(scene, depth);
    this.icon = scene.add.image(0, 0, state.iconKey)
      .setOrigin(0.5)
      .setTint(UI_TOKENS.color.paper)
      .setDepth(depth + 0.1);
    this.zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    this.zone.on('pointerdown', () => {
      if (this.state.enabled) this.onPress();
    });
    this.zone.input!.cursor = 'pointer';
    this.zone.on('pointerover', () => { if (this.state.enabled) this.surface.feedback('hover'); });
    this.zone.on('pointerout', () => this.surface.feedback(this.state.enabled ? 'normal' : 'disabled'));
  }

  setState(state: IconButtonState): void {
    this.state = state;
    this.icon.setTexture(state.iconKey);
  }

  setViewport(viewport: ResolvedUiViewport): void {
    this.viewport = viewport;
  }

  layout(bounds: UiRect): void {
    const hitWidth = normalizeTouchTarget(bounds.width, this.viewport);
    const hitHeight = normalizeTouchTarget(bounds.height, this.viewport);
    const hitX = bounds.x - (hitWidth - bounds.width) / 2;
    const hitY = bounds.y - (hitHeight - bounds.height) / 2;
    const alpha = this.state.enabled ? 1 : 0.38;
    this.surface.layout(bounds, this.state.selected ? 'gold' : 'jade');
    this.surface.feedback(this.state.enabled ? 'normal' : 'disabled');

    const iconSize = Math.max(16, Math.min(bounds.width, bounds.height) * 0.46);
    this.icon
      .setAlpha(alpha)
      .setTint(this.state.selected ? UI_TOKENS.color.ink : UI_TOKENS.color.goldLight)
      .setDisplaySize(iconSize, iconSize)
      .setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    this.zone.setPosition(hitX, hitY).setSize(hitWidth, hitHeight);
    if (this.state.enabled) this.zone.setInteractive();
    else this.zone.disableInteractive();
  }

  destroy(): void {
    this.surface.destroy();
    this.icon.destroy();
    this.zone.destroy();
  }
}
