import * as Phaser from 'phaser';
import { t } from '../../localization/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { ModalShell } from '../components/ModalShell.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { resolveUiViewport, scaleUiViewportForBacking, type ResolvedUiViewport } from '../layout/UiViewport.ts';

export type NewDealConfirmKind = 'new-deal' | 'daily-ranking-restart';

export class NewDealConfirmOverlay {
  private readonly scene: Phaser.Scene;
  private readonly shell: ModalShell;
  private readonly copy: Phaser.GameObjects.Text;
  private readonly cancel: ActionCard;
  private readonly confirmAction: ActionCard;
  private resolver: ((confirmed: boolean) => void) | null = null;
  private visible = false;
  private kind: NewDealConfirmKind = 'new-deal';

  constructor(scene: Phaser.Scene, depth = 6100) {
    this.scene = scene;
    const viewport = this.resolveViewport();
    this.shell = new ModalShell(scene, '', () => this.finish(false), depth, {
      textureKey: CASCADE_UI_ART_KEYS.homeHero,
      artworkAlpha: 0.82,
      artworkWashAlpha: 0.76,
      artworkMode: 'cover',
      artworkFocusX: 0.46,
      artworkFocusY: 0.50,
    });
    this.copy = scene.add.text(0, 0, '', {
      color: '#64706a',
      fontFamily: 'system-ui, sans-serif',
      align: 'center',
      wordWrap: { width: Math.max(1, viewport.width * 0.44) },
    }).setOrigin(0.5).setDepth(depth + 2);
    this.cancel = new ActionCard(scene, viewport, { title: t('ОТМЕНА'), enabled: true, surfaceStyle: 'card' }, () => this.finish(false), depth + 2);
    this.confirmAction = new ActionCard(scene, viewport, { title: t('НОВАЯ РАЗДАЧА'), emphasis: 'highlight', enabled: true, surfaceStyle: 'card' }, () => this.finish(true), depth + 2);
    this.scene.input.keyboard?.on('keydown-ESC', this.handleEscape, this);
    this.syncCopy();
    this.setVisible(false);
  }

  confirm(kind: NewDealConfirmKind = 'new-deal'): Promise<boolean> {
    if (this.resolver !== null) this.finish(false);
    this.kind = kind;
    this.syncCopy();
    this.visible = true;
    this.setVisible(true);
    this.relayout();
    return new Promise<boolean>((resolve) => { this.resolver = resolve; });
  }

  refreshLocalization(): void {
    this.syncCopy();
  }

  relayout(): void {
    if (!this.visible) return;
    const viewport = this.resolveViewport();
    this.cancel.setViewport(viewport);
    this.confirmAction.setViewport(viewport);
    const css = viewport.minTouchTarget / 44;
    const width = Math.min(viewport.width * 0.58, 610 * css);
    const height = Math.min(viewport.height * 0.58, 330 * css);
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;
    this.shell.layout(viewport.width, viewport.height, { x, y, width, height });
    this.copy
      .setFontSize(Math.max(13 * css, Math.min(20 * css, height * 0.065)))
      .setWordWrapWidth(width * 0.78)
      .setPosition(viewport.width / 2, y + height * 0.47);
    const buttonHeight = Math.max(viewport.minTouchTarget, 52 * viewport.uiScale);
    const gap = Math.max(10 * css, width * 0.025);
    const buttonWidth = (width * 0.78 - gap) / 2;
    const actionsX = x + width * 0.11;
    const actionsY = y + height - buttonHeight - height * 0.10;
    this.cancel.layout({ x: actionsX, y: actionsY, width: buttonWidth, height: buttonHeight });
    this.confirmAction.layout({ x: actionsX + buttonWidth + gap, y: actionsY, width: buttonWidth, height: buttonHeight });
  }

  destroy(): void {
    if (this.resolver !== null) this.finish(false);
    this.scene.input.keyboard?.off('keydown-ESC', this.handleEscape, this);
    this.shell.destroy();
    this.copy.destroy();
    this.cancel.destroy();
    this.confirmAction.destroy();
  }

  private syncCopy(): void {
    const rankingRestart = this.kind === 'daily-ranking-restart';
    this.shell.setTitle(rankingRestart ? t('Перезапустить Daily?') : t('Начать новую раздачу?'));
    this.copy.setText(rankingRestart
      ? t('Рейтинговая попытка будет завершена. Повторные попытки сегодня не изменят место в таблице.')
      : t('Текущая партия будет завершена.'));
    this.cancel.setState({ title: t('ОТМЕНА'), enabled: true, surfaceStyle: 'card' });
    this.confirmAction.setState({
      title: rankingRestart ? t('ПЕРЕЗАПУСТИТЬ') : t('НОВАЯ РАЗДАЧА'),
      emphasis: 'highlight',
      enabled: true,
    });
  }

  private setVisible(visible: boolean): void {
    this.shell.setVisible(visible);
    this.copy.setVisible(visible);
    this.cancel.setVisible(visible);
    this.confirmAction.setVisible(visible);
  }

  private finish(confirmed: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.visible = false;
    this.setVisible(false);
    resolve?.(confirmed);
  }

  private handleEscape(): void {
    if (this.visible) this.finish(false);
  }

  private resolveViewport(): ResolvedUiViewport {
    const cssZoom = this.scene.scale.zoom > 0 ? this.scene.scale.zoom : 1;
    const renderScale = 1 / cssZoom;
    const touchPrimary = typeof window !== 'undefined'
      && ((typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
        || navigator.maxTouchPoints > 0);
    const logical = resolveUiViewport({
      width: this.scene.scale.width / renderScale,
      height: this.scene.scale.height / renderScale,
      touchPrimary,
    });
    return scaleUiViewportForBacking(logical, renderScale);
  }
}
