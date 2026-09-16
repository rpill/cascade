import * as Phaser from 'phaser';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { computeSceneShellLayout, type SceneShellLayout } from '../layout/SceneShellLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { IconButton } from './IconButton.ts';

export class SceneShell {
  private readonly back: IconButton;
  private readonly title: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    title: string,
    onBack: () => void,
    depth = 0,
  ) {
    this.back = new IconButton(scene, viewport, { iconKey: UI_ICON_KEYS.back, enabled: true }, onBack, depth);
    this.title = scene.add.text(0, 0, title, {
      color: '#f2e6c9',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
  }

  setTitle(title: string): void {
    this.title.setText(title);
  }

  layout(viewport: ResolvedUiViewport): SceneShellLayout {
    const bounds = computeSceneShellLayout(viewport);
    const css = viewport.minTouchTarget / 44;
    const fontSize = Math.max(
      20 * css,
      Math.min((viewport.profile === 'desktop' ? 34 : 27) * css, bounds.header.height * 0.60),
    );
    this.back.setViewport(viewport);
    this.back.layout(bounds.back);
    this.title
      .setFontSize(fontSize)
      .setPosition(bounds.title.x + bounds.title.width / 2, bounds.title.y + bounds.title.height / 2);
    return bounds;
  }

  destroy(): void {
    this.back.destroy();
    this.title.destroy();
  }
}
