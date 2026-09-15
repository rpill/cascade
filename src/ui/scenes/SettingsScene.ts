import Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import type { Language } from '../../settings/Preferences.ts';
import { t } from '../../localization/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';

interface SettingsLaunchData { readonly returnScene?: string }

export class SettingsScene extends BaseUiScene {
  private returnScene: string | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private stateText: Phaser.GameObjects.Text | null = null;
  private languageText: Phaser.GameObjects.Text | null = null;
  private toggle: ActionCard | null = null;
  private languageControl: SegmentedControl<Language> | null = null;
  private back: ActionCard | null = null;
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

    this.paper = new PaperPanel(this, { depth: -10 });
    this.titleText = this.add.text(0, 0, t('НАСТРОЙКИ'), {
      color: '#f2e6c9', fontFamily: 'Georgia, serif', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.stateText = this.add.text(0, 0, '', {
      color: '#e7ddc5', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5);
    this.toggle = new ActionCard(this, viewport, { title: '', enabled: true }, () => this.toggleSfx(), 20);
    this.languageText = this.add.text(0, 0, t('Язык'), {
      color: '#e7ddc5', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5);
    this.languageControl = new SegmentedControl<Language>(this, viewport, [
      { value: 'ru', label: t('Русский') },
      { value: 'en', label: t('Английский') },
    ], state.language, (value) => this.selectLanguage(value), 20);
    this.back = new ActionCard(this, viewport, { title: t('НАЗАД'), enabled: true }, () => this.close(), 20);

    // Do this during create as well as on bridge notifications. The old scene
    // guard skipped this first refresh while Phaser was still starting the scene,
    // leaving the sound button with its intentionally empty constructor title.
    this.refreshState();
    this.unsubscribe = productBridge.subscribe(() => this.refreshState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOwnedUi());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.titleText) return;
    const css = viewport.minTouchTarget / 44;
    const width = Math.min(viewport.width * 0.66, 630 * css);
    const x = (viewport.width - width) / 2;
    const panelHeight = Math.min(viewport.height * 0.90, 520 * css);
    const y = (viewport.height - panelHeight) / 2;
    this.paper?.layout({ x: x - width * 0.12, y, width: width * 1.24, height: panelHeight });
    this.titleText.setColor('#24302e');
    this.stateText?.setColor('#526055');
    this.languageText?.setColor('#526055');
    const height = Math.max(viewport.minTouchTarget, 52 * viewport.uiScale);
    this.titleText.setFontSize(Math.max(22 * css, 34 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.12);
    this.stateText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.26);
    this.toggle?.setViewport(viewport);
    this.toggle?.layout({ x, y: y + panelHeight * 0.32, width, height });
    this.languageText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.52);
    this.languageControl?.setViewport(viewport);
    this.languageControl?.layout({ x, y: y + panelHeight * 0.58, width, height });
    this.back?.setViewport(viewport);
    this.back?.layout({ x, y: y + panelHeight - height - panelHeight * 0.06, width, height });
  }

  private toggleSfx(): void {
    const current = productBridge.settingsSnapshot();
    productBridge.setSoundEnabled(!current.soundEnabled);
    this.refreshState();
  }

  private selectLanguage(language: Language): void {
    productBridge.setLanguage(language);
    this.refreshState();
    this.requestUiLayout();
  }

  private refreshState(): void {
    const state = productBridge.settingsSnapshot();
    this.titleText?.setText(t('НАСТРОЙКИ'));
    this.stateText?.setText(state.soundEnabled ? t('Звук включён') : t('Звук выключен'));
    this.toggle?.setState({ title: state.soundEnabled ? t('ВЫКЛЮЧИТЬ ЗВУК') : t('ВКЛЮЧИТЬ ЗВУК'), enabled: true });
    this.languageText?.setText(t('Язык'));
    this.languageControl?.setSelected(state.language);
    this.back?.setState({ title: t('НАЗАД'), enabled: true });
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
    this.titleText?.destroy(); this.titleText = null;
    this.stateText?.destroy(); this.stateText = null;
    this.languageText?.destroy(); this.languageText = null;
    this.toggle?.destroy(); this.toggle = null;
    this.languageControl?.destroy(); this.languageControl = null;
    this.back?.destroy(); this.back = null;
  }
}
