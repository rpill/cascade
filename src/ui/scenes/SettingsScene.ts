import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import type { Language } from '../../settings/Preferences.ts';
import { t } from '../../localization/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import { SceneShell } from '../components/SceneShell.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { computeNarrowScenePanel } from '../layout/SceneShellLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';

interface SettingsLaunchData { readonly returnScene?: string }

export class SettingsScene extends BaseUiScene {
  private returnScene: string | null = null;
  private shell: SceneShell | null = null;
  private stateText: Phaser.GameObjects.Text | null = null;
  private languageText: Phaser.GameObjects.Text | null = null;
  private toggle: ActionCard | null = null;
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
    this.stateText = this.add.text(0, 0, '', {
      color: '#e7ddc5', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5);
    this.toggle = new ActionCard(this, viewport, { title: '', enabled: true }, () => this.toggleSfx(), 20);
    this.languageText = this.add.text(0, 0, t('Язык'), {
      color: '#e7ddc5', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5);
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
    const panel = computeNarrowScenePanel(shell.content, viewport);
    const css = viewport.minTouchTarget / 44;
    this.paper?.layout(panel);
    this.stateText?.setColor('#526055');
    this.languageText?.setColor('#526055');
    const controlHeight = Math.max(viewport.minTouchTarget, 52 * viewport.uiScale);
    const controlWidth = panel.width * 0.76;
    const x = panel.x + (panel.width - controlWidth) / 2;
    this.stateText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(panel.x + panel.width / 2, panel.y + panel.height * 0.22);
    this.toggle?.setViewport(viewport);
    this.toggle?.layout({ x, y: panel.y + panel.height * 0.30, width: controlWidth, height: controlHeight });
    this.languageText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(panel.x + panel.width / 2, panel.y + panel.height * 0.52);
    this.languageControl?.setViewport(viewport);
    this.languageControl?.layout({ x, y: panel.y + panel.height * 0.60, width: controlWidth, height: controlHeight });
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
    this.languageText?.destroy(); this.languageText = null;
    this.toggle?.destroy(); this.toggle = null;
    this.languageControl?.destroy(); this.languageControl = null;
  }
}
