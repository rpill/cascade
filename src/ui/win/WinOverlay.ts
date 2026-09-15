import Phaser from 'phaser';
import type { ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UiSurface } from '../components/UiSurface.ts';

export interface WinOverlayContent {
  readonly title: string;
  readonly kicker: string | null;
  readonly resultLine: string;
  readonly rewardLine: string | null;
  readonly detailLine: string | null;
  readonly noticeLine: string | null;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel: string;
  readonly rewardActionLabel: string | null;
  readonly rewardActionEnabled: boolean;
}

export interface WinOverlayActions {
  readonly newDeal: () => void;
  readonly home: () => void;
  readonly doubleCoins?: () => void;
}

interface OverlayButton {
  readonly surface: UiSurface;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly action: () => void;
  enabled: boolean;
}

export class WinOverlay {
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly panel: PaperPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly kicker: Phaser.GameObjects.Text;
  private readonly result: Phaser.GameObjects.Text;
  private readonly reward: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly primary: OverlayButton;
  private readonly secondary: OverlayButton;
  private readonly rewardAction: OverlayButton;
  private content: WinOverlayContent;
  private readonly actions: WinOverlayActions;
  private visible = true;

  constructor(
    scene: Phaser.Scene,
    content: WinOverlayContent,
    actions: WinOverlayActions,
    depth = 5000,
  ) {
    this.content = content;
    this.actions = actions;
    this.dimmer = scene.add.rectangle(0, 0, 1, 1, UI_TOKENS.color.overlay, 0.74)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive();
    this.panel = new PaperPanel(scene, { textureKey: UI_TOKENS.asset.paperPanel, depth: depth + 1 });
    this.kicker = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.title = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.result = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.reward = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.detail = scene.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.notice = scene.add.text(0, 0, '', {
      color: '#8b7430', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.primary = this.createButton(scene, actions.newDeal, depth + 2);
    this.secondary = this.createButton(scene, actions.home, depth + 2);
    this.rewardAction = this.createButton(scene, () => this.actions.doubleCoins?.(), depth + 2);
    this.syncContent();
  }

  setContent(content: WinOverlayContent): void {
    this.content = content;
    this.syncContent();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.dimmer.setVisible(visible).setActive(visible);
    if (visible) this.dimmer.setInteractive(); else this.dimmer.disableInteractive();
    this.panel.setVisible(visible);
    for (const text of [this.kicker, this.title, this.result, this.reward, this.detail, this.notice]) text.setVisible(visible);
    for (const button of [this.primary, this.secondary, this.rewardAction]) {
      button.surface.setVisible(visible);
      button.label.setVisible(visible);
      button.zone.setVisible(visible).setActive(visible);
      if (!visible) button.zone.disableInteractive();
    }
    if (visible) this.syncContent();
  }

  layout(layout: ViewportLayout): void {
    if (!this.visible) return;
    const compact = layout.profile === 'compact-landscape';
    const margin = Math.max(12, layout.hudBounds.height * 0.35);
    const maxWidth = compact ? layout.viewportWidth * 0.72 : layout.viewportWidth * 0.48;
    const width = Math.min(maxWidth, Math.max(layout.cardWidth * (compact ? 5.6 : 5.2), compact ? 420 : 560));
    const maxHeight = layout.viewportHeight - margin * 2;
    const height = Math.min(maxHeight, compact ? layout.viewportHeight * 0.82 : layout.viewportHeight * 0.56);
    const x = (layout.viewportWidth - width) / 2;
    const y = (layout.viewportHeight - height) / 2;
    const buttonHeight = Math.max(layout.hudBounds.height, compact ? 44 : 48);
    const gap = compact ? 8 : 14;
    const innerX = x + width * 0.09;
    const innerWidth = width * 0.82;

    this.dimmer.setPosition(0, 0).setSize(layout.viewportWidth, layout.viewportHeight);
    this.panel.layout({ x, y, width, height });

    const kickerY = y + height * (compact ? 0.11 : 0.12);
    const titleY = y + height * (compact ? 0.23 : 0.24);
    const resultY = y + height * (compact ? 0.39 : 0.40);
    const rewardY = y + height * (compact ? 0.51 : 0.52);
    const detailY = y + height * (compact ? 0.61 : 0.62);
    const noticeY = y + height * (compact ? 0.69 : 0.70);
    this.kicker.setPosition(x + width / 2, kickerY).setFontSize(Math.max(11, Math.min(18, height * 0.045)));
    this.title.setPosition(x + width / 2, titleY).setFontSize(Math.max(22, Math.min(42, height * 0.105)));
    this.result.setPosition(x + width / 2, resultY).setFontSize(Math.max(13, Math.min(22, height * 0.057)));
    this.reward.setPosition(x + width / 2, rewardY).setFontSize(Math.max(13, Math.min(22, height * 0.055)));
    this.detail.setPosition(x + width / 2, detailY).setFontSize(Math.max(11, Math.min(18, height * 0.042)));
    this.notice.setPosition(x + width / 2, noticeY).setFontSize(Math.max(10, Math.min(16, height * 0.038)));

    const rewardVisible = this.content.rewardActionEnabled && this.actions.doubleCoins !== undefined;
    const buttonsY = y + height - buttonHeight - Math.max(gap, height * 0.07);
    if (rewardVisible) {
      const rewardWidth = innerWidth * 0.31;
      const standardWidth = (innerWidth - rewardWidth - gap * 2) / 2;
      this.layoutButton(this.secondary, { x: innerX, y: buttonsY, width: standardWidth, height: buttonHeight }, false);
      this.layoutButton(this.primary, { x: innerX + standardWidth + gap, y: buttonsY, width: standardWidth, height: buttonHeight }, true);
      this.layoutButton(this.rewardAction, {
        x: innerX + standardWidth * 2 + gap * 2,
        y: buttonsY,
        width: rewardWidth,
        height: buttonHeight,
      }, true);
    } else {
      const buttonWidth = (innerWidth - gap) / 2;
      this.layoutButton(this.secondary, { x: innerX, y: buttonsY, width: buttonWidth, height: buttonHeight }, false);
      this.layoutButton(this.primary, { x: innerX + buttonWidth + gap, y: buttonsY, width: buttonWidth, height: buttonHeight }, true);
      this.setButtonVisible(this.rewardAction, false);
    }
  }

  destroy(): void {
    this.dimmer.destroy();
    this.panel.destroy();
    this.kicker.destroy();
    this.title.destroy();
    this.result.destroy();
    this.reward.destroy();
    this.detail.destroy();
    this.notice.destroy();
    this.destroyButton(this.primary);
    this.destroyButton(this.secondary);
    this.destroyButton(this.rewardAction);
  }

  private syncContent(): void {
    this.kicker.setText(this.content.kicker ?? '').setVisible(Boolean(this.content.kicker));
    this.title.setText(this.content.title);
    this.result.setText(this.content.resultLine);
    this.reward.setText(this.content.rewardLine ?? '').setVisible(Boolean(this.content.rewardLine));
    this.detail.setText(this.content.detailLine ?? '').setVisible(Boolean(this.content.detailLine));
    this.notice.setText(this.content.noticeLine ?? '').setVisible(Boolean(this.content.noticeLine));
    this.primary.label.setText(this.content.primaryActionLabel);
    this.secondary.label.setText(this.content.secondaryActionLabel);
    this.rewardAction.label.setText(this.content.rewardActionLabel ?? '');
    this.rewardAction.enabled = this.content.rewardActionEnabled;
    if (!this.visible) this.setVisible(false);
  }

  private createButton(scene: Phaser.Scene, action: () => void, depth: number): OverlayButton {
    const surface = new UiSurface(scene, depth);
    const label = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    const button: OverlayButton = { surface, label, zone, action, enabled: true };
    zone.on('pointerdown', () => {
      if (button.enabled) button.action();
    });
    return button;
  }

  private layoutButton(
    button: OverlayButton,
    bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    primary: boolean,
  ): void {
    this.setButtonVisible(button, true);
    const alpha = button.enabled ? 1 : 0.45;
    button.surface.layout(bounds, primary ? 'gold' : 'paper');
    button.surface.feedback(button.enabled ? 'normal' : 'disabled');
    button.label.setAlpha(alpha)
      .setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      .setFontSize(Math.max(11, Math.min(18, bounds.height * 0.34)));
    button.zone.setPosition(bounds.x, bounds.y).setSize(bounds.width, bounds.height);
    if (button.enabled) button.zone.setInteractive();
    else button.zone.disableInteractive();
  }

  private setButtonVisible(button: OverlayButton, visible: boolean): void {
    button.surface.setVisible(visible);
    button.label.setVisible(visible);
    button.zone.setVisible(visible).setActive(visible);
    if (!visible) button.zone.disableInteractive();
  }

  private destroyButton(button: OverlayButton): void {
    button.surface.destroy();
    button.label.destroy();
    button.zone.destroy();
  }
}
