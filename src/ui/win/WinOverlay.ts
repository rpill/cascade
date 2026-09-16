import * as Phaser from 'phaser';
import type { ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UiSurface } from '../components/UiSurface.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';
import { ProgressMeter } from '../components/ProgressMeter.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';

export interface WinOverlayRewardContent {
  readonly title: string;
  readonly baseLabel: string | null;
  readonly baseCoins: number;
  readonly rankLabel: string | null;
  readonly rankCoins: number;
  readonly totalLabel: string;
  readonly totalCoins: number;
  readonly pendingLabel: string | null;
  readonly emptyLabel: string | null;
  readonly helperLine: string | null;
}

export interface WinOverlayMasteryContent {
  readonly title: string;
  readonly beforeRank: keyof typeof CASCADE_UI_ART_KEYS.rank;
  readonly afterRank: keyof typeof CASCADE_UI_ART_KEYS.rank;
  readonly beforeRankLabel: string;
  readonly afterRankLabel: string;
  readonly beforeProgressCurrent: number;
  readonly beforeProgressTotal: number;
  readonly afterProgressCurrent: number;
  readonly afterProgressTotal: number;
  readonly beforeCaption: string;
  readonly afterCaption: string;
  readonly progressLabel: string;
  readonly promoted: boolean;
  readonly rewardLine: string | null;
}

export interface WinOverlayContent {
  readonly title: string;
  readonly kicker: string | null;
  readonly resultLine: string;
  readonly detailLine: string | null;
  readonly noticeLine: string | null;
  readonly rewards: WinOverlayRewardContent | null;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel: string;
  readonly rewardActionLabel: string | null;
  readonly rewardActionEnabled: boolean;
  readonly mastery?: WinOverlayMasteryContent | null;
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
  private readonly rewardPanel: UiSurface;
  private readonly masteryPanel: UiSurface;

  private readonly title: Phaser.GameObjects.Text;
  private readonly kicker: Phaser.GameObjects.Text;
  private readonly result: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;

  private readonly rewardTitle: Phaser.GameObjects.Text;
  private readonly rewardBaseIcon: Phaser.GameObjects.Image;
  private readonly rewardBaseLabel: Phaser.GameObjects.Text;
  private readonly rewardBaseValue: Phaser.GameObjects.Text;
  private readonly rewardRankIcon: Phaser.GameObjects.Image;
  private readonly rewardRankLabel: Phaser.GameObjects.Text;
  private readonly rewardRankValue: Phaser.GameObjects.Text;
  private readonly rewardDivider: Phaser.GameObjects.Graphics;
  private readonly rewardTotalLabel: Phaser.GameObjects.Text;
  private readonly rewardIcon: Phaser.GameObjects.Image;
  private readonly reward: Phaser.GameObjects.Text;
  private readonly rewardHelperBox: UiSurface;
  private readonly rewardHintIcon: Phaser.GameObjects.Image;
  private readonly rewardHint: Phaser.GameObjects.Text;

  private readonly masteryTitle: Phaser.GameObjects.Text;
  private readonly masteryBadge: Phaser.GameObjects.Image;
  private readonly masteryRank: Phaser.GameObjects.Text;
  private readonly masteryCaption: Phaser.GameObjects.Text;
  private readonly masteryProgressLabel: Phaser.GameObjects.Text;
  private readonly masteryProgressValue: Phaser.GameObjects.Text;
  private readonly masteryReward: Phaser.GameObjects.Text;
  private readonly masteryMeter: ProgressMeter;

  private readonly primary: OverlayButton;
  private readonly secondary: OverlayButton;
  private readonly rewardAction: OverlayButton;
  private content: WinOverlayContent;
  private readonly actions: WinOverlayActions;
  private visible = true;
  private lastLayout: ViewportLayout | null = null;
  private masteryMeterBounds: { x: number; y: number; width: number; height: number } | null = null;

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
    if (this.dimmer.input) this.dimmer.input.cursor = 'default';
    this.panel = new PaperPanel(scene, { textureKey: UI_TOKENS.asset.paperPanel, depth: depth + 1 });
    this.rewardPanel = new UiSurface(scene, depth + 1.2);
    this.masteryPanel = new UiSurface(scene, depth + 1.2);

    this.kicker = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.title = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.result = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.detail = scene.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.notice = scene.add.text(0, 0, '', {
      color: '#8b7430', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);

    this.rewardTitle = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.rewardBaseIcon = scene.add.image(0, 0, UI_ICON_KEYS.coin).setOrigin(0.5).setTint(UI_TOKENS.color.gold).setDepth(depth + 2);
    this.rewardBaseLabel = scene.add.text(0, 0, '', {
      color: '#48554f', fontFamily: 'system-ui, sans-serif', align: 'left',
    }).setOrigin(0, 0.5).setDepth(depth + 2);
    this.rewardBaseValue = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'right',
    }).setOrigin(1, 0.5).setDepth(depth + 2);
    this.rewardRankIcon = scene.add.image(0, 0, UI_ICON_KEYS.mastery).setOrigin(0.5).setTint(UI_TOKENS.color.gold).setDepth(depth + 2);
    this.rewardRankLabel = scene.add.text(0, 0, '', {
      color: '#48554f', fontFamily: 'system-ui, sans-serif', align: 'left',
    }).setOrigin(0, 0.5).setDepth(depth + 2);
    this.rewardRankValue = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'right',
    }).setOrigin(1, 0.5).setDepth(depth + 2);
    this.rewardDivider = scene.add.graphics().setDepth(depth + 2);
    this.rewardTotalLabel = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'left',
    }).setOrigin(0, 0.5).setDepth(depth + 2);
    this.rewardIcon = scene.add.image(0, 0, UI_ICON_KEYS.coin).setOrigin(0.5).setTint(UI_TOKENS.color.gold).setDepth(depth + 2);
    this.reward = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'right',
    }).setOrigin(1, 0.5).setDepth(depth + 2);
    this.rewardHelperBox = new UiSurface(scene, depth + 1.8);
    this.rewardHintIcon = scene.add.image(0, 0, UI_ICON_KEYS.rewardVideo).setOrigin(0.5).setTint(UI_TOKENS.color.gold).setDepth(depth + 2);
    this.rewardHint = scene.add.text(0, 0, '', {
      color: '#6a5329', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'left',
    }).setOrigin(0, 0.5).setLineSpacing(4).setDepth(depth + 2);

    this.masteryTitle = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.masteryBadge = scene.add.image(0, 0, CASCADE_UI_ART_KEYS.rank.novice).setDepth(depth + 2);
    this.masteryRank = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'left',
    }).setOrigin(0, 0).setDepth(depth + 2);
    this.masteryCaption = scene.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'left',
    }).setOrigin(0, 0).setDepth(depth + 2);
    this.masteryProgressLabel = scene.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'left',
    }).setOrigin(0, 0).setDepth(depth + 2);
    this.masteryProgressValue = scene.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'right',
    }).setOrigin(1, 0.5).setDepth(depth + 2);
    this.masteryReward = scene.add.text(0, 0, '', {
      color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.masteryMeter = new ProgressMeter(scene, depth + 2);

    this.primary = this.createButton(scene, actions.newDeal, depth + 2);
    this.secondary = this.createButton(scene, actions.home, depth + 2);
    this.rewardAction = this.createButton(scene, () => this.actions.doubleCoins?.(), depth + 2);
    this.syncContent();
  }

  setContent(content: WinOverlayContent): void {
    this.content = content;
    this.syncContent();
  }

  playMasteryAnimation(): void {
    const mastery = this.content.mastery;
    if (!this.visible || !mastery) return;
    const scene = this.dimmer.scene;
    scene.tweens.killTweensOf(this.masteryBadge);
    scene.tweens.killTweensOf(this.masteryRank);
    scene.tweens.killTweensOf(this.masteryCaption);
    scene.tweens.killTweensOf(this.masteryReward);
    this.masteryBadge.setAlpha(1).setTexture(CASCADE_UI_ART_KEYS.rank[mastery.beforeRank]);
    this.masteryRank.setAlpha(1).setText(mastery.beforeRankLabel);
    this.masteryCaption.setAlpha(1).setText(mastery.beforeCaption);
    this.masteryReward.setAlpha(mastery.promoted && mastery.rewardLine ? 0 : 1).setText(mastery.promoted ? '' : (mastery.rewardLine ?? ''));
    this.masteryMeter.setProgress({ current: mastery.beforeProgressCurrent, total: mastery.beforeProgressTotal });
    if (this.masteryMeterBounds) this.masteryMeter.layout(this.masteryMeterBounds);

    if (mastery.promoted) {
      const gauge = { value: mastery.beforeProgressCurrent };
      scene.tweens.add({
        targets: gauge,
        value: mastery.beforeProgressTotal,
        duration: 700,
        ease: 'Cubic.Out',
        onUpdate: () => {
          this.masteryMeter.setProgress({ current: gauge.value, total: mastery.beforeProgressTotal });
          if (this.masteryMeterBounds) this.masteryMeter.layout(this.masteryMeterBounds);
        },
        onComplete: () => {
          scene.tweens.add({
            targets: [this.masteryBadge, this.masteryRank, this.masteryCaption],
            alpha: 0,
            duration: 180,
            ease: 'Sine.In',
            onComplete: () => {
              this.masteryBadge.setTexture(CASCADE_UI_ART_KEYS.rank[mastery.afterRank]);
              this.masteryRank.setText(mastery.afterRankLabel);
              this.masteryCaption.setText(mastery.afterCaption);
              this.masteryReward.setText(mastery.rewardLine ?? '');
              this.masteryMeter.setProgress({ current: mastery.afterProgressCurrent, total: mastery.afterProgressTotal });
              if (this.masteryMeterBounds) this.masteryMeter.layout(this.masteryMeterBounds);
              scene.tweens.add({
                targets: [this.masteryBadge, this.masteryRank, this.masteryCaption, this.masteryReward],
                alpha: 1,
                duration: 260,
                ease: 'Sine.Out',
              });
            },
          });
        },
      });
      return;
    }

    if (mastery.beforeProgressCurrent === mastery.afterProgressCurrent && mastery.beforeProgressTotal === mastery.afterProgressTotal) return;
    const gauge = { value: mastery.beforeProgressCurrent };
    scene.tweens.add({
      targets: gauge,
      value: mastery.afterProgressCurrent,
      duration: 700,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.masteryMeter.setProgress({ current: gauge.value, total: mastery.afterProgressTotal });
        if (this.masteryMeterBounds) this.masteryMeter.layout(this.masteryMeterBounds);
      },
      onComplete: () => {
        this.masteryCaption.setText(mastery.afterCaption);
      },
    });
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.dimmer.setVisible(visible).setActive(visible);
    if (visible) this.dimmer.setInteractive(); else this.dimmer.disableInteractive();
    this.panel.setVisible(visible);
    this.rewardPanel.setVisible(visible);
    this.rewardHelperBox.setVisible(visible);
    this.masteryPanel.setVisible(visible && Boolean(this.content.mastery));
    for (const text of [
      this.kicker, this.title, this.result, this.detail, this.notice,
      this.rewardTitle, this.rewardBaseLabel, this.rewardBaseValue, this.rewardRankLabel, this.rewardRankValue,
      this.rewardTotalLabel, this.reward, this.rewardHint,
      this.masteryTitle, this.masteryRank, this.masteryCaption, this.masteryProgressLabel, this.masteryProgressValue, this.masteryReward,
    ]) text.setVisible(visible);
    for (const image of [this.rewardBaseIcon, this.rewardRankIcon, this.rewardIcon, this.rewardHintIcon, this.masteryBadge]) image.setVisible(visible);
    this.rewardDivider.setVisible(visible);
    this.masteryMeter.setVisible(visible && Boolean(this.content.mastery));
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
    this.lastLayout = layout;
    const compact = layout.profile === 'compact-landscape';
    const margin = compact ? 6 : Math.max(12, layout.hudBounds.height * 0.22);
    const availableWidth = Math.max(1, layout.viewportWidth - margin * 2);
    const availableHeight = Math.max(1, layout.viewportHeight - margin * 2);
    const width = Math.min(availableWidth, compact ? layout.viewportWidth * 0.97 : Math.max(780, layout.viewportWidth * 0.78));
    const height = Math.min(availableHeight, compact ? layout.viewportHeight * 0.97 : layout.viewportHeight * 0.86);
    const x = (layout.viewportWidth - width) / 2;
    const y = (layout.viewportHeight - height) / 2;
    const buttonHeight = compact
      ? Math.max(42, Math.min(46, height * 0.095))
      : Math.max(52, Math.min(layout.hudBounds.height, 62));
    const gap = compact ? 8 : 14;
    const innerX = x + width * (compact ? 0.035 : 0.045);
    const innerWidth = width * (compact ? 0.93 : 0.91);
    const hasMastery = Boolean(this.content.mastery);

    this.dimmer.setPosition(0, 0).setSize(layout.viewportWidth, layout.viewportHeight);
    this.panel.layout({ x, y, width, height });

    this.kicker.setPosition(x + width / 2, y + height * 0.04)
      .setFontSize(compact ? Math.max(10, height * 0.025) : Math.max(9, Math.min(13, height * 0.024)));
    this.title.setPosition(x + width / 2, y + height * (compact ? 0.095 : 0.105))
      .setFontSize(compact ? Math.max(30, Math.min(35, height * 0.078)) : Math.max(30, Math.min(60, height * 0.11)))
      .setWordWrapWidth(width * 0.86, true)
      .setLineSpacing(-4);
    this.result.setPosition(x + width / 2, y + height * (compact ? 0.17 : 0.175))
      .setFontSize(compact ? Math.max(13, Math.min(16, height * 0.034)) : Math.max(14, Math.min(24, height * 0.05)))
      .setWordWrapWidth(width * 0.90, true);
    this.notice.setPosition(x + width / 2, y + height * (compact ? 0.215 : 0.218))
      .setFontSize(compact ? Math.max(10, Math.min(12, height * 0.026)) : Math.max(10, Math.min(18, height * 0.034)))
      .setWordWrapWidth(width * 0.86, true);
    this.detail.setPosition(x + width / 2, y + height * (compact ? 0.25 : 0.242))
      .setFontSize(compact ? Math.max(10, Math.min(12, height * 0.024)) : Math.max(9, Math.min(16, height * 0.03)))
      .setWordWrapWidth(width * 0.86, true);

    const buttonsY = y + height - buttonHeight - Math.max(gap * 0.8, height * 0.028);
    const compactPanelsTopRatio = this.content.detailLine
      ? 0.285
      : this.content.noticeLine
        ? 0.265
        : 0.235;
    const panelsTop = y + height * (compact ? compactPanelsTopRatio : 0.25);
    const panelsBottom = buttonsY - Math.max(gap * 0.8, height * 0.016);
    const panelsHeight = Math.max(80, panelsBottom - panelsTop);
    const panelGap = compact ? 8 : 16;
    const rewardPanelWidth = (innerWidth - panelGap) * 0.49;
    const masteryPanelWidth = innerWidth - panelGap - rewardPanelWidth;
    const rewardPanelBounds = { x: innerX, y: panelsTop, width: rewardPanelWidth, height: panelsHeight };
    const masteryPanelBounds = { x: innerX + rewardPanelWidth + panelGap, y: panelsTop, width: masteryPanelWidth, height: panelsHeight };

    this.rewardPanel.layout(rewardPanelBounds, 'paper', true);
    this.layoutRewardPanel(rewardPanelBounds, compact);

    if (hasMastery && this.content.mastery) {
      this.masteryPanel.setVisible(true);
      this.masteryPanel.layout(masteryPanelBounds, 'paper', true);
      this.layoutMasteryPanel(masteryPanelBounds, compact);
    } else {
      this.masteryPanel.setVisible(false);
      this.masteryBadge.setVisible(false);
      this.masteryTitle.setVisible(false);
      this.masteryRank.setVisible(false);
      this.masteryCaption.setVisible(false);
      this.masteryProgressLabel.setVisible(false);
      this.masteryProgressValue.setVisible(false);
      this.masteryReward.setVisible(false);
      this.masteryMeter.setVisible(false);
      this.masteryMeterBounds = null;
    }

    const rewardVisible = this.content.rewardActionLabel !== null && this.actions.doubleCoins !== undefined;
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
    this.rewardPanel.destroy();
    this.masteryPanel.destroy();
    this.kicker.destroy();
    this.title.destroy();
    this.result.destroy();
    this.detail.destroy();
    this.notice.destroy();
    this.rewardTitle.destroy();
    this.rewardBaseIcon.destroy();
    this.rewardBaseLabel.destroy();
    this.rewardBaseValue.destroy();
    this.rewardRankIcon.destroy();
    this.rewardRankLabel.destroy();
    this.rewardRankValue.destroy();
    this.rewardDivider.destroy();
    this.rewardTotalLabel.destroy();
    this.rewardIcon.destroy();
    this.reward.destroy();
    this.rewardHelperBox.destroy();
    this.rewardHintIcon.destroy();
    this.rewardHint.destroy();
    this.masteryTitle.destroy();
    this.masteryBadge.destroy();
    this.masteryRank.destroy();
    this.masteryCaption.destroy();
    this.masteryProgressLabel.destroy();
    this.masteryProgressValue.destroy();
    this.masteryReward.destroy();
    this.masteryMeter.destroy();
    this.destroyButton(this.primary);
    this.destroyButton(this.secondary);
    this.destroyButton(this.rewardAction);
  }

  private layoutRewardPanel(bounds: { x: number; y: number; width: number; height: number }, compact: boolean): void {
    const rewards = this.content.rewards;
    if (!rewards) return;
    const pad = bounds.width * 0.08;
    const left = bounds.x + pad;
    const right = bounds.x + bounds.width - pad;
    const centerX = bounds.x + bounds.width / 2;
    const titleSize = compact ? Math.max(15, Math.min(18, bounds.height * 0.07)) : Math.max(15, Math.min(27, bounds.height * 0.115));
    const rowSize = compact ? Math.max(13, Math.min(16, bounds.height * 0.06)) : Math.max(13, Math.min(22, bounds.height * 0.09));
    const totalSize = compact ? Math.max(19, Math.min(24, bounds.height * 0.085)) : Math.max(22, Math.min(38, bounds.height * 0.15));
    const iconSize = compact ? Math.max(15, Math.min(19, bounds.height * 0.065)) : Math.max(16, Math.min(26, bounds.height * 0.10));
    const titleY = bounds.y + bounds.height * (compact ? 0.09 : 0.095);
    const baseY = bounds.y + bounds.height * (compact
      ? (rewards.rankCoins > 0 ? 0.25 : 0.29)
      : (rewards.rankCoins > 0 ? 0.255 : 0.30));
    const rankY = bounds.y + bounds.height * (compact ? 0.36 : 0.375);
    const dividerY = bounds.y + bounds.height * (compact ? 0.47 : 0.49);
    const totalY = bounds.y + bounds.height * (compact ? 0.58 : 0.59);
    const helperActive = Boolean(rewards.helperLine);
    const helperBoxWidth = bounds.width * 0.86;
    const helperBoxHeight = bounds.height * (compact ? 0.24 : 0.27);
    const helperBoxX = bounds.x + (bounds.width - helperBoxWidth) / 2;
    const helperBoxY = bounds.y + bounds.height * (compact ? 0.69 : 0.675);

    this.rewardTitle.setPosition(centerX, titleY).setFontSize(titleSize);
    this.rewardBaseIcon.setDisplaySize(iconSize, iconSize).setPosition(left + iconSize / 2, baseY);
    this.rewardBaseLabel.setPosition(left + iconSize + Math.max(6, iconSize * 0.35), baseY).setFontSize(rowSize);
    this.rewardBaseValue.setPosition(right, baseY).setFontSize(rowSize);
    this.rewardRankIcon.setDisplaySize(iconSize, iconSize).setPosition(left + iconSize / 2, rankY);
    this.rewardRankLabel.setPosition(left + iconSize + Math.max(6, iconSize * 0.35), rankY).setFontSize(rowSize);
    this.rewardRankValue.setPosition(right, rankY).setFontSize(rowSize);

    this.rewardDivider.clear().lineStyle(Math.max(1.2, bounds.height * 0.006), UI_TOKENS.color.gold, 0.52)
      .lineBetween(left, dividerY, right, dividerY);
    this.rewardTotalLabel.setPosition(left, totalY).setFontSize(Math.max(rowSize + 1, totalSize * 0.58));
    this.reward.setPosition(right, totalY).setFontSize(totalSize);
    const totalIconSize = iconSize * 1.16;
    this.rewardIcon.setDisplaySize(totalIconSize, totalIconSize).setPosition(right - this.reward.width - totalIconSize * 0.72, totalY);

    if (helperActive) {
      const iconInset = Math.max(12, helperBoxHeight * 0.18);
      const hintIconSize = compact ? Math.max(18, Math.min(24, helperBoxHeight * 0.34)) : Math.max(22, Math.min(36, helperBoxHeight * 0.44));
      this.rewardHelperBox.setVisible(true);
      this.rewardHelperBox.layout({ x: helperBoxX, y: helperBoxY, width: helperBoxWidth, height: helperBoxHeight }, 'gold', false);
      this.rewardHintIcon.setVisible(true).setDisplaySize(hintIconSize, hintIconSize).setPosition(helperBoxX + iconInset + hintIconSize / 2, helperBoxY + helperBoxHeight / 2);
      this.rewardHint.setVisible(true)
        .setPosition(helperBoxX + iconInset * 1.9 + hintIconSize, helperBoxY + helperBoxHeight / 2)
        .setFontSize(compact ? Math.max(10, Math.min(13, helperBoxHeight * 0.19)) : Math.max(11, Math.min(17, bounds.height * 0.064)))
        .setWordWrapWidth(helperBoxWidth - iconInset * 3.2 - hintIconSize, true);
    } else {
      this.rewardHelperBox.setVisible(false);
      this.rewardHintIcon.setVisible(false);
      this.rewardHint.setVisible(false);
    }
  }

  private layoutMasteryPanel(bounds: { x: number; y: number; width: number; height: number }, compact: boolean): void {
    const mastery = this.content.mastery;
    if (!mastery) return;
    const centerX = bounds.x + bounds.width / 2;
    const titleY = bounds.y + bounds.height * 0.095;
    const badgeSize = Math.min(bounds.width * (compact ? 0.22 : 0.26), bounds.height * (compact ? 0.28 : 0.40));
    const badgeX = bounds.x + bounds.width * 0.24;
    const badgeY = bounds.y + bounds.height * (compact ? 0.33 : 0.34);
    const textX = bounds.x + bounds.width * 0.42;
    const textTop = bounds.y + bounds.height * (compact ? 0.22 : 0.21);
    const textWidth = bounds.width * 0.50;
    const titleSize = compact ? Math.max(15, Math.min(18, bounds.height * 0.07)) : Math.max(15, Math.min(27, bounds.height * 0.115));
    const rankSize = compact ? Math.max(18, Math.min(24, bounds.height * 0.095)) : Math.max(18, Math.min(34, bounds.height * 0.155));
    const captionSize = compact ? Math.max(11, Math.min(13, bounds.height * 0.052)) : Math.max(11, Math.min(17, bounds.height * 0.075));
    const progressLabelY = bounds.y + bounds.height * (compact ? 0.61 : 0.565);
    const meterY = bounds.y + bounds.height * (compact ? 0.70 : 0.655);
    const rewardY = bounds.y + bounds.height * 0.83;
    const meterLeft = bounds.x + bounds.width * 0.08;
    const meterWidth = bounds.width * 0.68;
    const progressValueX = bounds.x + bounds.width * 0.92;

    this.masteryTitle.setPosition(centerX, titleY).setFontSize(titleSize);
    this.masteryBadge.setPosition(badgeX, badgeY).setDisplaySize(badgeSize, badgeSize).setVisible(true);
    this.masteryRank.setPosition(textX, textTop).setFontSize(rankSize).setWordWrapWidth(textWidth, true).setVisible(true);
    this.masteryCaption.setPosition(textX, textTop + rankSize * 1.25).setFontSize(captionSize).setWordWrapWidth(textWidth, true).setVisible(true);
    this.masteryProgressLabel.setPosition(meterLeft, progressLabelY).setFontSize(captionSize).setVisible(true);
    this.masteryProgressValue.setPosition(progressValueX, meterY + Math.max(7, bounds.height * 0.035) / 2).setFontSize(captionSize).setVisible(true);
    this.masteryMeterBounds = {
      x: meterLeft,
      y: meterY,
      width: meterWidth,
      height: Math.max(7, bounds.height * 0.035),
    };
    this.masteryMeter.layout(this.masteryMeterBounds);
    this.masteryMeter.setVisible(true);
    this.masteryReward.setPosition(centerX, rewardY).setFontSize(compact ? Math.max(10, Math.min(12, bounds.height * 0.048)) : Math.max(9, Math.min(14, bounds.height * 0.065)))
      .setWordWrapWidth(bounds.width * 0.82, true);
  }

  private syncContent(): void {
    this.kicker.setText(this.content.kicker ?? '').setVisible(this.visible && Boolean(this.content.kicker));
    this.title.setText(this.content.title).setVisible(this.visible);
    this.result.setText(this.content.resultLine).setVisible(this.visible);
    this.detail.setText(this.content.detailLine ?? '').setVisible(this.visible && Boolean(this.content.detailLine));
    this.notice.setText(this.content.noticeLine ?? '').setVisible(this.visible && Boolean(this.content.noticeLine));

    const rewards = this.content.rewards;
    this.rewardPanel.setVisible(this.visible && rewards !== null);
    if (rewards) {
      const busyOrEmpty = Boolean(rewards.pendingLabel || rewards.emptyLabel);
      this.rewardTitle.setText(rewards.title).setVisible(this.visible);
      this.rewardBaseLabel.setText(rewards.baseLabel ?? '').setVisible(this.visible && !busyOrEmpty && Boolean(rewards.baseLabel));
      this.rewardBaseValue.setText(rewards.baseCoins > 0 ? `+${rewards.baseCoins}` : '').setVisible(this.visible && !busyOrEmpty && rewards.baseCoins > 0);
      this.rewardBaseIcon.setVisible(this.visible && !busyOrEmpty && rewards.baseCoins > 0);
      this.rewardRankLabel.setText(rewards.rankLabel ?? '').setVisible(this.visible && !busyOrEmpty && rewards.rankCoins > 0 && Boolean(rewards.rankLabel));
      this.rewardRankValue.setText(rewards.rankCoins > 0 ? `+${rewards.rankCoins}` : '').setVisible(this.visible && !busyOrEmpty && rewards.rankCoins > 0);
      this.rewardRankIcon.setVisible(this.visible && !busyOrEmpty && rewards.rankCoins > 0);
      this.rewardTotalLabel.setText(rewards.totalLabel).setVisible(this.visible && !busyOrEmpty);
      this.reward.setText(String(rewards.totalCoins)).setVisible(this.visible && !busyOrEmpty);
      this.rewardIcon.setVisible(this.visible && !busyOrEmpty);
      this.rewardDivider.setVisible(this.visible && !busyOrEmpty);
      this.rewardHint.setText(rewards.pendingLabel ?? rewards.emptyLabel ?? rewards.helperLine ?? '')
        .setVisible(this.visible && Boolean(rewards.pendingLabel ?? rewards.emptyLabel ?? rewards.helperLine));
      const helperActive = Boolean(rewards.helperLine);
      this.rewardHelperBox.setVisible(this.visible && helperActive);
      this.rewardHintIcon.setVisible(this.visible && helperActive);
    }

    if (!rewards) {
      this.rewardHelperBox.setVisible(false);
      this.rewardHintIcon.setVisible(false);
    }

    this.primary.label.setText(this.content.primaryActionLabel);
    this.secondary.label.setText(this.content.secondaryActionLabel);
    this.rewardAction.label.setText(this.content.rewardActionLabel ?? '');
    this.rewardAction.enabled = this.content.rewardActionEnabled;

    const mastery = this.content.mastery;
    this.masteryPanel.setVisible(this.visible && Boolean(mastery));
    if (mastery) {
      this.masteryTitle.setText(mastery.title).setVisible(this.visible);
      this.masteryBadge.setTexture(CASCADE_UI_ART_KEYS.rank[mastery.afterRank]).setVisible(this.visible);
      this.masteryRank.setText(mastery.afterRankLabel).setVisible(this.visible);
      this.masteryCaption.setText(mastery.afterCaption).setVisible(this.visible);
      this.masteryProgressLabel.setText(mastery.progressLabel).setVisible(this.visible);
      this.masteryProgressValue.setText(`${Math.round(mastery.afterProgressCurrent)} / ${Math.round(mastery.afterProgressTotal)}`).setVisible(this.visible);
      this.masteryReward.setText(mastery.rewardLine ?? '').setVisible(this.visible && Boolean(mastery.rewardLine));
      this.masteryMeter.setProgress({ current: mastery.afterProgressCurrent, total: mastery.afterProgressTotal });
      this.masteryMeter.setVisible(this.visible);
    }

    if (this.lastLayout) this.layout(this.lastLayout);
    if (!this.visible) this.setVisible(false);
  }

  private createButton(scene: Phaser.Scene, action: () => void, depth: number): OverlayButton {
    const surface = new UiSurface(scene, depth);
    const label = scene.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    if (zone.input) zone.input.cursor = 'pointer';
    const button: OverlayButton = { surface, label, zone, action, enabled: true };
    zone.on('pointerover', () => {
      if (button.enabled) button.surface.feedback('hover');
    });
    zone.on('pointerout', () => {
      button.surface.feedback(button.enabled ? 'normal' : 'disabled');
    });
    zone.on('pointerdown', () => {
      if (!button.enabled) return;
      button.surface.feedback('pressed');
      playUiButtonSound(scene);
      button.action();
    });
    zone.on('pointerup', () => {
      if (button.enabled) button.surface.feedback('hover');
    });
    return button;
  }

  private layoutButton(
    button: OverlayButton,
    bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    primary: boolean,
  ): void {
    this.setButtonVisible(button, true);
    const isStatusRewardButton = button === this.rewardAction && !button.enabled && Boolean(this.content.rewardActionLabel);
    const alpha = button.enabled ? 1 : (isStatusRewardButton ? 0.82 : 0.45);
    button.surface.layout(bounds, primary ? 'gold' : 'paper');
    button.surface.feedback(button.enabled ? 'normal' : (isStatusRewardButton ? 'normal' : 'disabled'));
    const compact = this.lastLayout?.profile === 'compact-landscape';
    button.label.setAlpha(alpha)
      .setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      .setFontSize(compact ? Math.max(13, Math.min(16, bounds.height * 0.34)) : Math.max(12, Math.min(20, bounds.height * 0.38)))
      .setWordWrapWidth(bounds.width * 0.82, true)
      .setLineSpacing(2);
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
