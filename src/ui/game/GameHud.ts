import * as Phaser from 'phaser';
import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { UI_ART_KEYS, UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { calculateGameHudLayout } from './GameHudLayout.ts';
import type { GameHudViewModel } from './GameHudViewModel.ts';
import { UiSurface } from '../components/UiSurface.ts';

export interface GameHudActions {
  readonly home: () => void;
  readonly newDeal: () => void;
  readonly restart: () => void;
  readonly undo: () => void;
  readonly hint: () => void;
  readonly sound?: () => void;
}

type HudPriority = 'nav' | 'primary' | 'secondary';

interface HudButton {
  readonly graphics: UiSurface;
  readonly icon: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly action: () => void;
  readonly iconOnly: boolean;
  readonly priority: HudPriority;
  text: string;
  enabled: boolean;
  hovered: boolean;
}

export class GameHud {
  private readonly buttons: Readonly<Record<'home' | 'newDeal' | 'restart' | 'undo' | 'hint', HudButton>>;
  private readonly metricsSurface: UiSurface;
  private readonly metricsArt: Phaser.GameObjects.Image;
  private readonly metricsRule: Phaser.GameObjects.Graphics;
  private readonly difficultyText: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
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
      home: this.createButton(scene, viewModel.homeLabel, UI_ICON_KEYS.home, true, wrap(actions.home), depth, false, 'nav'),
      newDeal: this.createButton(scene, viewModel.newDealLabel, UI_ICON_KEYS.newDeal, viewModel.newDealEnabled, wrap(actions.newDeal), depth, false, 'secondary'),
      restart: this.createButton(scene, viewModel.restartLabel, UI_ICON_KEYS.restart, true, wrap(actions.restart), depth, false, 'secondary'),
      undo: this.createButton(scene, viewModel.undoLabel, UI_ICON_KEYS.undo, viewModel.undoEnabled, wrap(actions.undo), depth, false, 'primary'),
      hint: this.createButton(scene, viewModel.hintLabel, UI_ICON_KEYS.hint, viewModel.hintEnabled, wrap(actions.hint), depth, false, 'primary'),
    };
    this.metricsSurface = new UiSurface(scene, depth);
    this.metricsArt = scene.add.image(0, 0, UI_ART_KEYS.jade).setOrigin(0).setAlpha(0.72).setDepth(depth + 0.05).setVisible(false);
    this.metricsRule = scene.add.graphics().setDepth(depth + 0.06);
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: '#f0e6d3', fontFamily: 'system-ui, sans-serif', align: 'center',
    };
    this.difficultyText = scene.add.text(0, 0, '', { ...textStyle, color: '#e4c78a', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 0.1);
    this.movesText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.timeText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.syncText();
  }

  setState(viewModel: GameHudViewModel): void {
    this.viewModel = viewModel;
    for (const [key, label] of [
      ['home', viewModel.homeLabel], ['newDeal', viewModel.newDealLabel], ['restart', viewModel.restartLabel], ['undo', viewModel.undoLabel], ['hint', viewModel.hintLabel],
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
    const hud = calculateGameHudLayout(viewport, this.viewModel.newDealVisible);
    this.layoutButton(this.buttons.home, hud.home);
    this.layoutButton(this.buttons.undo, hud.undo);
    this.layoutButton(this.buttons.hint, hud.hint);
    this.layoutButton(this.buttons.restart, hud.restart);
    this.setButtonVisible(this.buttons.newDeal, this.viewModel.newDealVisible);
    if (this.viewModel.newDealVisible) this.layoutButton(this.buttons.newDeal, hud.newDeal);
    this.layoutMetrics(hud.metrics);
  }

  destroy(): void {
    for (const button of Object.values(this.buttons)) {
      button.graphics.destroy(); button.icon.destroy(); button.label.destroy(); button.zone.destroy();
    }
    this.metricsSurface.destroy(); this.metricsArt.destroy(); this.metricsRule.destroy();
    this.difficultyText.destroy(); this.movesText.destroy(); this.timeText.destroy();
  }

  private createButton(scene: Phaser.Scene, text: string, iconKey: string, enabled: boolean, action: () => void, depth: number, iconOnly = false, priority: HudPriority = 'primary'): HudButton {
    const graphics = new UiSurface(scene, depth);
    const icon = scene.add.image(0, 0, iconKey).setOrigin(0.5).setTint(UI_TOKENS.color.goldLight).setDepth(depth + 0.1);
    const label = scene.add.text(0, 0, text, { color:'#f0e6d3', fontFamily:'system-ui, sans-serif', fontStyle:'bold', align:'center' }).setOrigin(0.5).setDepth(depth + 0.1);
    const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    const button: HudButton = { graphics, icon, label, zone, action, text, enabled, iconOnly, priority, hovered: false };
    zone.on('pointerdown', () => { if (button.enabled) { graphics.feedback('pressed'); button.action(); } });
    zone.input!.cursor = 'pointer';
    zone.on('pointerover', () => {
      button.hovered = true;
      if (button.enabled) graphics.feedback('hover');
    });
    zone.on('pointerout', () => {
      button.hovered = false;
      graphics.feedback(button.enabled ? 'normal' : 'disabled');
      const restingAlpha = button.priority === 'secondary' ? 0.82 : button.priority === 'nav' ? 0.92 : 1;
      graphics.setAlpha(button.enabled ? restingAlpha : 0.42);
    });
    return button;
  }

  private layoutButton(button: HudButton, bounds: LayoutBounds): void {
    button.graphics.layout(bounds, 'jade');
    button.graphics.feedback(button.enabled ? (button.hovered ? 'hover' : 'normal') : 'disabled');
    const restingAlpha = button.priority === 'secondary' ? 0.82 : button.priority === 'nav' ? 0.92 : 1;
    const visualAlpha = button.enabled ? (button.hovered ? 1 : restingAlpha) : 0.38;
    button.graphics.setAlpha(button.enabled ? (button.hovered ? 1 : restingAlpha) : 0.42);
    const iconSize = Math.max(16, Math.min(bounds.height * 0.46, bounds.width * (button.iconOnly ? 0.42 : 0.25)));
    button.icon.setAlpha(visualAlpha).setDisplaySize(iconSize, iconSize);
    button.label.setAlpha(visualAlpha).setVisible(!button.iconOnly);
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
    this.metricsSurface.layout(bounds, 'jade', true);
    const css = 1 / this.scene.scale.zoom;
    this.metricsArt.setVisible(false);
    this.metricsRule.clear();

    const centerX = bounds.x + bounds.width / 2;
    const topInset = 18 * css;
    const bottomInset = 18 * css;
    const contentHeight = Math.max(0, bounds.height - topInset - bottomInset);
    const titleSize = Math.max(13 * css, Math.min(20 * css, bounds.width * 0.135));
    const statSize = Math.max(10 * css, Math.min(15 * css, bounds.width * 0.112));
    const lineGap = 8 * css;
    const statGap = 7 * css;
    const stackHeight = titleSize + lineGap + statSize + statGap + statSize;
    const titleY = bounds.y + topInset + Math.max(0, (contentHeight - stackHeight) / 2) + titleSize / 2;
    const ruleY = titleY + titleSize * 0.72;
    const movesY = titleY + titleSize / 2 + lineGap + statSize / 2;
    const timeY = movesY + statSize / 2 + statGap + statSize / 2;

    this.metricsRule.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.55)
      .lineBetween(bounds.x + bounds.width * 0.2, ruleY, bounds.x + bounds.width * 0.8, ruleY);

    this.difficultyText.setFontSize(titleSize).setPosition(centerX, titleY);
    this.movesText.setFontSize(statSize).setPosition(centerX, movesY);
    this.timeText.setFontSize(statSize).setPosition(centerX, timeY);

  }

  private syncText(): void {
    this.difficultyText.setText(this.viewModel.difficultyLabel);
    this.movesText.setText(this.viewModel.movesLabel);
    this.timeText.setText(this.viewModel.timeLabel);
  }

  private setButtonVisible(button: HudButton, visible: boolean): void {
    button.graphics.setVisible(visible);
    button.icon.setVisible(visible);
    button.label.setVisible(visible && !button.iconOnly);
    button.zone.setVisible(visible).setActive(visible);
    if (!visible) {
      button.hovered = false;
      button.zone.disableInteractive();
    }
  }
}

