import * as Phaser from 'phaser';
import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { UI_ART_KEYS, UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { calculateGameHudLayout } from './GameHudLayout.ts';
import type { GameHudViewModel } from './GameHudViewModel.ts';
import { UiSurface } from '../components/UiSurface.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';

export interface GameHudActions {
  readonly home: () => void;
  readonly newDeal: () => void;
  readonly undo: () => void;
  readonly hint: () => void;
  readonly settings: () => void;
  readonly sound?: () => void;
}

interface HudButton {
  readonly graphics: UiSurface;
  readonly icon: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly action: () => void;
  readonly iconOnly: boolean;
  text: string;
  enabled: boolean;
}

export class GameHud {
  private readonly buttons: Readonly<Record<'home' | 'newDeal' | 'undo' | 'hint' | 'settings', HudButton>>;
  private readonly metricsSurface: UiSurface;
  private readonly metricsArt: Phaser.GameObjects.Image;
  private readonly metricsRule: Phaser.GameObjects.Graphics;
  private readonly difficultyText: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly coinsIcon: Phaser.GameObjects.Image;
  private readonly coinsText: Phaser.GameObjects.Text;
  private viewModel: GameHudViewModel;
  private currentLayout: ViewportLayout | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    viewModel: GameHudViewModel,
    actions: GameHudActions,
    depth = 2000,
  ) {
    this.viewModel = viewModel;
    const wrap = (action: () => void) => () => { actions.sound?.(); action(); };
    this.buttons = {
      home: this.createButton(scene, viewModel.homeLabel, UI_ICON_KEYS.home, true, wrap(actions.home), depth),
      newDeal: this.createButton(scene, viewModel.newDealLabel, UI_ICON_KEYS.newDeal, viewModel.newDealEnabled, wrap(actions.newDeal), depth),
      undo: this.createButton(scene, viewModel.undoLabel, UI_ICON_KEYS.undo, viewModel.undoEnabled, wrap(actions.undo), depth),
      hint: this.createButton(scene, viewModel.hintLabel, UI_ICON_KEYS.hint, viewModel.hintEnabled, wrap(actions.hint), depth),
      settings: this.createButton(scene, '', UI_ICON_KEYS.settings, true, wrap(actions.settings), depth, true),
    };
    this.metricsSurface = new UiSurface(scene, depth);
    this.metricsArt = scene.add.image(0, 0, UI_ART_KEYS.jade).setOrigin(0).setAlpha(0.72).setDepth(depth + 0.05);
    this.metricsRule = scene.add.graphics().setDepth(depth + 0.06);
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: '#f0e6d3', fontFamily: 'system-ui, sans-serif', align: 'center',
    };
    this.difficultyText = scene.add.text(0, 0, '', { ...textStyle, fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 0.1);
    this.movesText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.timeText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.coinsIcon = scene.add.image(0, 0, UI_ICON_KEYS.coin).setOrigin(0.5).setTint(UI_TOKENS.color.goldLight).setDepth(depth + 0.1);
    this.coinsText = scene.add.text(0, 0, '', textStyle).setOrigin(0, 0.5).setDepth(depth + 0.1);
    this.syncText();
  }

  setState(viewModel: GameHudViewModel): void {
    this.viewModel = viewModel;
    for (const [key, label] of [
      ['home', viewModel.homeLabel], ['newDeal', viewModel.newDealLabel], ['undo', viewModel.undoLabel], ['hint', viewModel.hintLabel],
    ] as const) {
      this.buttons[key].text = label;
      this.buttons[key].label.setText(label);
    }
    this.buttons.newDeal.enabled = viewModel.newDealEnabled;
    this.buttons.undo.enabled = viewModel.undoEnabled;
    this.buttons.hint.enabled = viewModel.hintEnabled;
    this.syncText();
    if (this.currentLayout) this.layout(this.currentLayout);
  }

  layout(viewport: ViewportLayout): void {
    this.currentLayout = viewport;
    const hud = calculateGameHudLayout(viewport);
    this.layoutButton(this.buttons.home, hud.home);
    this.layoutButton(this.buttons.newDeal, hud.newDeal);
    this.layoutButton(this.buttons.undo, hud.undo);
    this.layoutButton(this.buttons.hint, hud.hint);
    this.layoutButton(this.buttons.settings, hud.settings);
    this.layoutMetrics(hud.metrics);
  }

  destroy(): void {
    for (const button of Object.values(this.buttons)) {
      button.graphics.destroy(); button.icon.destroy(); button.label.destroy(); button.zone.destroy();
    }
    this.metricsSurface.destroy(); this.metricsArt.destroy(); this.metricsRule.destroy();
    this.difficultyText.destroy(); this.movesText.destroy(); this.timeText.destroy(); this.coinsIcon.destroy(); this.coinsText.destroy();
  }

  private createButton(scene: Phaser.Scene, text: string, iconKey: string, enabled: boolean, action: () => void, depth: number, iconOnly = false): HudButton {
    const graphics = new UiSurface(scene, depth);
    const icon = scene.add.image(0, 0, iconKey).setOrigin(0.5).setTint(UI_TOKENS.color.goldLight).setDepth(depth + 0.1);
    const label = scene.add.text(0, 0, text, { color:'#f0e6d3', fontFamily:'system-ui, sans-serif', fontStyle:'bold', align:'center' }).setOrigin(0.5).setDepth(depth + 0.1);
    const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    const button: HudButton = { graphics, icon, label, zone, action, text, enabled, iconOnly };
    zone.on('pointerdown', () => { if (button.enabled) { graphics.feedback('pressed'); button.action(); } });
    zone.input!.cursor = 'pointer';
    zone.on('pointerover', () => { if (button.enabled) graphics.feedback('hover'); });
    zone.on('pointerout', () => graphics.feedback(button.enabled ? 'normal' : 'disabled'));
    return button;
  }

  private layoutButton(button: HudButton, bounds: LayoutBounds): void {
    button.graphics.layout(bounds, 'jade');
    button.graphics.feedback(button.enabled ? 'normal' : 'disabled');
    const iconSize = Math.max(16, Math.min(bounds.height * 0.46, bounds.width * (button.iconOnly ? 0.32 : 0.25)));
    button.icon.setAlpha(button.enabled ? 1 : 0.38).setDisplaySize(iconSize, iconSize);
    button.label.setAlpha(button.enabled ? 1 : 0.38).setVisible(!button.iconOnly);
    if (button.iconOnly) {
      button.icon.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    } else {
      const iconX = bounds.x + Math.max(iconSize * 0.9, bounds.width * 0.22);
      const labelX = bounds.x + bounds.width * 0.62;
      button.icon.setPosition(iconX, bounds.y + bounds.height / 2);
      button.label.setFontSize(Math.max(9, Math.min(bounds.height * 0.28, (bounds.width * 0.56) / Math.max(3.4, button.text.length * 0.62))))
        .setPosition(labelX, bounds.y + bounds.height / 2);
    }
    button.zone.setPosition(bounds.x, bounds.y).setSize(bounds.width, bounds.height);
    if (button.enabled) button.zone.setInteractive(); else button.zone.disableInteractive();
  }

  private layoutMetrics(bounds: LayoutBounds): void {
    this.metricsSurface.layout(bounds, 'jade');
    const css = 1 / this.scene.scale.zoom;
    const baseSize = Math.max(9 * css, Math.min(16 * css, bounds.width * 0.13));
    const lineGap = Math.min(baseSize * 1.45, bounds.height / 5);
    const textHeight = lineGap * 5;
    const artHeight = bounds.height - textHeight - 12 * css;
    const showArt = artHeight >= bounds.width * 0.8;
    this.metricsArt.setVisible(showArt);
    this.metricsRule.clear();
    if (showArt) {
      const inset = 5 * css;
      const artWidth = bounds.width - inset * 2;
      const crop = coverCrop(this.metricsArt.frame.realWidth, this.metricsArt.frame.realHeight, artWidth, artHeight, 0.14, 0.62);
      const scale = artWidth / crop.width;
      this.metricsArt.setCrop(crop.x, crop.y, crop.width, crop.height).setScale(scale)
        .setPosition(bounds.x + inset - crop.x * scale, bounds.y + inset - crop.y * scale);
      const ruleY = bounds.y + artHeight + 10 * css;
      this.metricsRule.lineStyle(css, UI_TOKENS.color.gold, 0.65)
        .lineBetween(bounds.x + bounds.width * 0.15, ruleY, bounds.x + bounds.width * 0.85, ruleY);
    }
    const contentY = showArt ? bounds.y + bounds.height - textHeight : bounds.y;
    const contentHeight = showArt ? textHeight : bounds.height;
    const startY = contentY + Math.max(lineGap * 0.8, (contentHeight - lineGap * 3) / 2);
    const centerX = bounds.x + bounds.width / 2;
    [this.difficultyText, this.movesText, this.timeText].forEach((text, index) => text.setFontSize(baseSize).setPosition(centerX, startY + lineGap * index));
    const coinsY = startY + lineGap * 3;
    const coinSize = Math.max(10, baseSize * 0.82);
    this.coinsIcon.setDisplaySize(coinSize, coinSize).setPosition(centerX - baseSize * 0.5, coinsY);
    this.coinsText.setFontSize(baseSize).setPosition(centerX - baseSize * 0.1, coinsY);
  }

  private syncText(): void {
    this.difficultyText.setText(this.viewModel.difficultyLabel);
    this.movesText.setText(this.viewModel.movesLabel);
    this.timeText.setText(this.viewModel.timeLabel);
    this.coinsText.setText(String(this.viewModel.coins));
  }
}
