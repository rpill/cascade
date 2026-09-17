import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { PaperPanel, type PaperPanelOptions } from './PaperPanel.ts';
import { ButtonSurface } from './ButtonSurface.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';

export class ModalShell {
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly panel: PaperPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly closeSurface: ButtonSurface;
  private readonly close: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly onClose: () => void;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, title: string, onClose: () => void, depth = 5000, panelOptions: PaperPanelOptions = {}) {
    this.onClose = onClose;
    this.scene = scene;
    this.dimmer = scene.add.rectangle(0, 0, 1, 1, UI_TOKENS.color.overlay, 0.72)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive();
    this.panel = new PaperPanel(scene, { depth: depth + 1, ...panelOptions });
    this.title = scene.add.text(0, 0, title, {
      color: '#24302e',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.closeSurface = new ButtonSurface(scene, depth + 2);
    this.close = scene.add.text(0, 0, '×', {
      color: '#f4dfad',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2.1);
    this.closeZone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 3).setInteractive();
    this.closeZone.input!.cursor = 'pointer';
    this.closeZone.on('pointerover', () => this.closeSurface.feedback('hover'));
    this.closeZone.on('pointerout', () => this.closeSurface.feedback('normal'));
    this.closeZone.on('pointerdown', () => this.closeSurface.feedback('pressed'));
    this.closeZone.on('pointerup', () => {
      this.closeSurface.feedback('hover');
      playUiButtonSound(scene);
      this.onClose();
    });
  }

  layout(viewportWidth: number, viewportHeight: number, bounds: UiRect): void {
    this.dimmer.setSize(viewportWidth, viewportHeight);
    this.panel.layout(bounds);
    const scale = 1 / this.scene.scale.zoom;
    const headerHeight = Math.max(44 * scale, bounds.height * 0.13);
    this.title.setFontSize(Math.max(18, Math.round(headerHeight * 0.35)))
      .setPosition(bounds.x + bounds.width / 2, bounds.y + headerHeight / 2);
    const closeSize = Math.max(40 * scale, headerHeight * 0.68);
    const closeBounds: UiRect = {
      x: bounds.x + bounds.width - closeSize - Math.max(10 * scale, closeSize * 0.22),
      y: bounds.y + (headerHeight - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.closeSurface.layout(closeBounds, 'jade', 'square');
    this.close.setFontSize(Math.max(20, Math.round(closeSize * 0.43)))
      .setPosition(closeBounds.x + closeBounds.width / 2, closeBounds.y + closeBounds.height / 2 - closeSize * 0.03);
    this.closeZone.setPosition(closeBounds.x, closeBounds.y).setSize(closeBounds.width, closeBounds.height);
  }

  setTitle(title: string): void {
    this.title.setText(title);
  }

  setVisible(visible: boolean): void {
    this.dimmer.setVisible(visible).setActive(visible);
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.closeSurface.setVisible(visible);
    this.close.setVisible(visible);
    this.closeZone.setVisible(visible).setActive(visible);
  }

  destroy(): void {
    this.dimmer.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.closeSurface.destroy();
    this.close.destroy();
    this.closeZone.destroy();
  }
}
