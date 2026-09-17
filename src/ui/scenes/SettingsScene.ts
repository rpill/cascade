import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import type { Language } from '../../settings/Preferences.ts';
import { t } from '../../localization/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import { SceneShell } from '../components/SceneShell.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';

interface SettingsLaunchData { readonly returnScene?: string }

export class SettingsScene extends BaseUiScene {
  private returnScene: string | null = null;
  private shell: SceneShell | null = null;
  private stateText: Phaser.GameObjects.Text | null = null;
  private soundLabel: Phaser.GameObjects.Text | null = null;
  private decoration: Phaser.GameObjects.Graphics | null = null;
  private soundIcon: Phaser.GameObjects.Image | null = null;
  private languageIcon: Phaser.GameObjects.Text | null = null;
  private languageText: Phaser.GameObjects.Text | null = null;
  private toggle: ActionCard | null = null;
  private closeButton: ActionCard | null = null;
  private languageControl: SegmentedControl<Language> | null = null;
  private paper: PaperPanel | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() { super('SettingsScene'); }

  init(data: SettingsLaunchData = {}): void {
    this.returnScene = typeof data.returnScene === 'string' ? data.returnScene : null;
  }

  create(): void {
    this.destroyOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const state = productBridge.settingsSnapshot();
    const viewport = this.currentUiViewport();

    this.shell = new SceneShell(this, viewport, t('Настройки'), () => this.close(), 20);
    this.paper = new PaperPanel(this, { depth: -10 });
    this.decoration = this.add.graphics();
    this.soundIcon = this.add.image(0, 0, UI_ICON_KEYS.soundOn).setTint(0xb69557);
    this.languageIcon = this.add.text(0, 0, 'Aa', { color: '#b69557', fontFamily: 'Georgia, serif' }).setOrigin(0.5);
    this.soundLabel = this.add.text(0, 0, t('Звук'), { color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.stateText = this.add.text(0, 0, '', {
      color: '#e7ddc5', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0, 0.5);
    this.toggle = new ActionCard(this, viewport, { title: '', enabled: true }, () => this.toggleSfx(), 20);
    this.closeButton = new ActionCard(this, viewport, { title: t('ЗАКРЫТЬ'), enabled: true }, () => this.close(), 20);
    this.languageText = this.add.text(0, 0, t('Язык'), {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.languageControl = new SegmentedControl<Language>(this, viewport, [
      { value: 'ru', label: 'Русский' },
      { value: 'en', label: 'English' },
    ], state.language, (value) => this.selectLanguage(value), 20);

    // Do this during create as well as on bridge notifications. The old scene
    // guard skipped this first refresh while Phaser was still starting the scene,
    // leaving the sound button with its intentionally empty constructor title.
    this.refreshState();
    this.unsubscribe = productBridge.subscribe(() => this.refreshState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOwnedUi());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.shell) return;
    const shell = this.shell.layout(viewport);
    const css = viewport.minTouchTarget / 44;
    const compact = viewport.height / css < 560;
    const width = Math.min(shell.content.width, 760 * css);
    const height = Math.min(shell.content.height, (compact ? 308 : 388) * css);
    const panel = { x: shell.content.x + (shell.content.width - width) / 2, y: shell.content.y + (shell.content.height - height) / 2, width, height };
    this.paper?.layout(panel);
    this.stateText?.setColor('#526055');
    const inset = (compact ? 24 : 42) * css;
    const bottomInset = (compact ? 22 : 28) * css;
    const iconSize = (compact ? 24 : 30) * css;
    const iconX = panel.x + inset + iconSize / 2;
    const labelX = iconX + iconSize / 2 + 18 * css;
    const soundY = panel.y + height * (compact ? 0.24 : 0.26);
    const languageY = panel.y + height * (compact ? 0.56 : 0.58);
    const controlHeight = Math.max(viewport.minTouchTarget, (compact ? 48 : 58) * css);
    const controlWidth = panel.width * 0.43;
    const x = panel.x + panel.width - inset - controlWidth;
    const closeWidth = Math.min(panel.width * 0.34, 250 * css);
    const closeX = panel.x + (panel.width - closeWidth) / 2;
    const closeY = panel.y + panel.height - bottomInset - controlHeight;
    this.soundIcon?.setPosition(iconX, soundY).setDisplaySize(iconSize, iconSize);
    this.languageIcon?.setFontSize(iconSize).setPosition(iconX, languageY);
    this.soundLabel?.setFontSize((compact ? 21 : 25) * css).setPosition(labelX, soundY - 10 * css);
    this.stateText?.setFontSize((compact ? 13 : 15) * css).setPosition(labelX, soundY + 17 * css);
    this.decoration?.clear().lineStyle(css, 0xb69557, 0.35)
      .lineBetween(panel.x + inset, panel.y + height * 0.42, panel.x + width - inset, panel.y + height * 0.42);
    this.toggle?.setViewport(viewport);
    this.toggle?.layout({ x, y: soundY - controlHeight / 2, width: controlWidth, height: controlHeight });
    this.languageText?.setFontSize((compact ? 21 : 25) * css).setPosition(labelX, languageY);
    this.languageControl?.setViewport(viewport);
    this.languageControl?.layout({ x, y: languageY - controlHeight / 2, width: controlWidth, height: controlHeight });
    this.closeButton?.setViewport(viewport);
    this.closeButton?.layout({ x: closeX, y: closeY, width: closeWidth, height: controlHeight });
  }

  private toggleSfx(): void {
    const current = productBridge.settingsSnapshot();
    productBridge.setSoundEnabled(!current.soundEnabled);
    if (!current.soundEnabled) playUiButtonSound(this);
    this.refreshState();
  }

  private selectLanguage(language: Language): void {
    productBridge.setLanguage(language);
    this.refreshState();
    this.requestUiLayout();
  }

  private refreshState(): void {
    const state = productBridge.settingsSnapshot();
    this.shell?.setTitle(t('Настройки'));
    this.soundLabel?.setText(t('Звук'));
    this.soundIcon?.setTexture(state.soundEnabled ? UI_ICON_KEYS.soundOn : UI_ICON_KEYS.soundOff);
    this.stateText?.setText(state.soundEnabled ? t('Звук включён') : t('Звук выключен'));
    this.toggle?.setState({ title: state.soundEnabled ? t('ВЫКЛЮЧИТЬ ЗВУК') : t('ВКЛЮЧИТЬ ЗВУК'), enabled: true });
    this.languageText?.setText(t('Язык'));
    this.languageControl?.setSelected(state.language);
  }

  private close(): void {
    const returnScene = this.returnScene;
    if (returnScene && this.scene.isPaused(returnScene)) {
      this.scene.get(returnScene).events.emit('service-overlay-closed');
      this.scene.resume(returnScene);
      this.scene.stop();
      return;
    }
    this.scene.start('HomeScene');
  }

  private destroyOwnedUi(): void {
    this.unsubscribe?.(); this.unsubscribe = null;
    this.paper?.destroy(); this.paper = null;
    this.shell?.destroy(); this.shell = null;
    this.stateText?.destroy(); this.stateText = null;
    this.soundLabel?.destroy(); this.soundLabel = null;
    this.soundIcon?.destroy(); this.soundIcon = null;
    this.languageIcon?.destroy(); this.languageIcon = null;
    this.decoration?.destroy(); this.decoration = null;
    this.languageText?.destroy(); this.languageText = null;
    this.toggle?.destroy(); this.toggle = null;
    this.closeButton?.destroy(); this.closeButton = null;
    this.languageControl?.destroy(); this.languageControl = null;
  }
}
