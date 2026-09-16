import * as Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { normalizeTouchTarget } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { ProgressMeter, type ProgressValue } from './ProgressMeter.ts';
import { UiSurface } from './UiSurface.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';

export interface ActionCardState {
  readonly title: string;
  readonly subtitle?: string;
  readonly emphasis?: 'normal' | 'highlight';
  readonly enabled: boolean;
  readonly progress?: ProgressValue;
  readonly artwork?: 'landscape' | 'daily' | 'mastery' | 'themes';
  readonly artworkKey?: string;
}

export class ActionCard {
  private readonly surface: UiSurface;
  private readonly motif: Phaser.GameObjects.Image | null;
  private readonly arrowBadge: Phaser.GameObjects.Graphics | null;
  private readonly arrow: Phaser.GameObjects.Image | null;
  private readonly calendarDay: Phaser.GameObjects.Text | null;
  private bounds: UiRect | null = null;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly progress: ProgressMeter;
  private readonly onPress: () => void;
  private state: ActionCardState;
  private viewport: ResolvedUiViewport;
  private visible = true;
  private armed = false;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    state: ActionCardState,
    onPress: () => void,
    depth = 0,
  ) {
    this.viewport = viewport;
    this.state = state;
    this.onPress = onPress;
    this.surface = new UiSurface(scene, depth, Boolean(state.artwork), 0.72, state.artwork === 'landscape' ? CASCADE_UI_ART_KEYS.homeHero : undefined);
    this.motif = state.artwork && state.artwork !== 'landscape'
      ? scene.add.image(0, 0, state.artworkKey ?? (state.artwork === 'daily' ? CASCADE_UI_ART_KEYS.calendar : state.artwork === 'themes' ? CASCADE_UI_ART_KEYS.themeFan : CASCADE_UI_ART_KEYS.rank.novice)).setDepth(depth + 0.1) : null;
    this.calendarDay = state.artwork === 'daily' ? scene.add.text(0, 0, String(new Date().getDate()), { fontFamily: 'Georgia, serif', color: '#643f29' }).setOrigin(0.5).setAngle(6).setDepth(depth + 0.12) : null;
    this.arrowBadge = state.artwork ? scene.add.graphics().setDepth(depth + 0.08) : null;
    this.arrow = state.artwork ? scene.add.image(0, 0, UI_ICON_KEYS.chevronRight).setTint(UI_TOKENS.color.goldLight).setDepth(depth + 0.1) : null;
    this.title = scene.add.text(0, 0, state.title, {
      color: '#24302e',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    this.subtitle = scene.add.text(0, 0, state.subtitle ?? '', {
      color: '#64706a',
      fontFamily: 'system-ui, sans-serif',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    this.zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    this.zone.input!.cursor = 'pointer';
    this.zone.on('pointerover', () => { if (this.state.enabled) { this.surface.feedback('hover'); this.drawArrowBadge('hover'); } });
    this.zone.on('pointerout', () => { this.armed = false; this.surface.feedback(this.state.enabled ? 'normal' : 'disabled'); this.drawArrowBadge(this.state.enabled ? 'normal' : 'disabled'); });
    this.zone.on('pointerdown', () => { this.armed = this.state.enabled; if (this.armed) { this.surface.feedback('pressed'); this.drawArrowBadge('pressed'); } });
    this.zone.on('pointerup', () => {
      const activate = this.armed && this.state.enabled;
      this.armed = false;
      if (activate) { this.surface.feedback('normal'); this.drawArrowBadge('hover'); playUiButtonSound(scene); this.onPress(); }
    });
    this.progress = new ProgressMeter(scene, depth + 0.1);
  }

  setState(state: ActionCardState): void {
    this.state = { ...this.state, ...state };
    this.title.setText(state.title);
    this.subtitle.setText(state.subtitle ?? '');
    if (state.artworkKey) this.motif?.setTexture(state.artworkKey);
    if (state.progress) this.progress.setProgress(state.progress);
    if (this.bounds) this.layout(this.bounds);
  }

  setViewport(viewport: ResolvedUiViewport): void {
    this.viewport = viewport;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.armed = false;
    this.surface.setVisible(visible);
    this.motif?.setVisible(visible);
    this.calendarDay?.setVisible(visible);
    this.arrowBadge?.setVisible(visible);
    this.arrow?.setVisible(visible);
    this.title.setVisible(visible);
    this.subtitle.setVisible(visible && Boolean(this.state.subtitle));
    this.zone.setVisible(visible).setActive(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    this.progress.setVisible(visible && Boolean(this.state.progress));
  }

  layout(bounds: UiRect): void {
    this.bounds = bounds;
    const alpha = this.state.enabled ? 1 : 0.55;
    const hitHeight = normalizeTouchTarget(bounds.height, this.viewport);
    const hitY = bounds.y - (hitHeight - bounds.height) / 2;
    const css = this.viewport.minTouchTarget / 44;
    const decorated = Boolean(this.state.artwork);
    const tile = decorated && this.state.artwork !== 'landscape';
    const side = tile;
    const titleSize = Math.max(15 * css, Math.min(bounds.height * (decorated ? 0.28 : 0.30), (decorated ? 36 : 24) * this.viewport.uiScale));
    const subtitleSize = Math.max(11 * css, Math.min(17 * this.viewport.uiScale, titleSize * 0.53));
    this.surface.layout(bounds, this.state.emphasis === 'highlight' ? 'gold' : 'paper', decorated);
    this.surface.feedback(this.state.enabled ? 'normal' : 'disabled');

    const hasSubtitle = Boolean(this.state.subtitle);
    this.title.setOrigin(side ? 0 : 0.5, 0.5).setFontSize(titleSize).setAlpha(alpha).setPosition(
      bounds.x + bounds.width * (side ? 0.08 : 0.5),
      bounds.y + bounds.height * (tile ? 0.16 : hasSubtitle ? 0.40 : 0.50),
    );
    const available = bounds.width * 0.84;
    if (this.title.width > available) this.title.setFontSize(titleSize * available / this.title.width);
    this.subtitle.setOrigin(side ? 0 : 0.5, 0.5).setFontSize(subtitleSize).setWordWrapWidth(available).setAlpha(alpha).setVisible(this.visible && hasSubtitle).setPosition(
      bounds.x + bounds.width * (side ? 0.08 : 0.5),
      bounds.y + bounds.height * (tile ? 0.30 : 0.64),
    );
    this.subtitle.setAlign(side ? 'left' : 'center');
    if (hasSubtitle) {
      const gap = Math.max(3 * css, bounds.height * 0.025);
      if (tile) this.subtitle.setY(this.title.y + this.title.height / 2 + gap + this.subtitle.height / 2);
      else {
        const blockHeight = this.title.height + gap + this.subtitle.height;
        const top = bounds.y + (bounds.height - blockHeight) / 2;
        this.title.setY(top + this.title.height / 2);
        this.subtitle.setY(top + this.title.height + gap + this.subtitle.height / 2);
      }
    }
    const textBottom = hasSubtitle ? this.subtitle.y + this.subtitle.height / 2 : this.title.y + this.title.height / 2;
    const motifTop = Math.max(bounds.y + bounds.height * 0.38, textBottom + 5 * css);
    const motifBottom = bounds.y + bounds.height * 0.94;
    const motifSize = Math.max(1, Math.min(motifBottom - motifTop, bounds.height * 0.56, bounds.width * 0.64));
    const motifY = (motifTop + motifBottom) / 2;
    this.motif?.setPosition(bounds.x + bounds.width * 0.49, motifY).setDisplaySize(motifSize, motifSize);
    this.calendarDay?.setFontSize(motifSize * 0.23).setPosition(bounds.x + bounds.width * 0.49, motifY + motifSize * 0.055);
    const arrowCap = tile ? (this.viewport.profile === 'mobile-landscape' ? 32 : 44) : 48;
    const arrowDiameter = Math.min(bounds.height * (tile ? 0.27 : 0.28), arrowCap * css);
    const arrowSize = arrowDiameter * 0.44;
    const arrowX = bounds.x + bounds.width * (tile ? (this.viewport.profile === 'mobile-landscape' ? 0.82 : 0.86) : 0.91);
    const arrowY = bounds.y + bounds.height * (tile ? 0.82 : 0.65);
    this.arrow?.setPosition(arrowX, arrowY).setDisplaySize(arrowSize, arrowSize);
    this.drawArrowBadge(this.state.enabled ? 'normal' : 'disabled');
    this.zone.setPosition(bounds.x, hitY).setSize(bounds.width, hitHeight);

    const progress = this.state.progress;
    this.progress.setVisible(this.visible && Boolean(progress));
    if (progress) {
      this.progress.setProgress(progress);
      this.progress.layout({
        x: bounds.x + bounds.width * 0.10,
        y: bounds.y + bounds.height * 0.80,
        width: bounds.width * 0.80,
        height: Math.max(5, bounds.height * 0.055),
      });
    }
  }

  private drawArrowBadge(feedback: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    if (!this.arrowBadge || !this.arrow || !this.bounds) return;
    const css = this.viewport.minTouchTarget / 44;
    const tile = this.state.artwork !== 'landscape';
    const arrowCap = tile ? (this.viewport.profile === 'mobile-landscape' ? 32 : 44) : 48;
    const diameter = Math.min(this.bounds.height * (tile ? 0.27 : 0.28), arrowCap * css);
    const radius = diameter / 2;
    const fill = feedback === 'hover' ? UI_TOKENS.color.controlActive : UI_TOKENS.color.control;
    const alpha = feedback === 'disabled' ? 0.42 : feedback === 'pressed' ? 0.92 : 1;
    this.arrowBadge.clear()
      .fillStyle(fill, alpha).fillCircle(this.arrow.x, this.arrow.y, radius)
      .lineStyle(Math.max(1, css), UI_TOKENS.color.gold, feedback === 'disabled' ? 0.35 : 0.95)
      .strokeCircle(this.arrow.x, this.arrow.y, radius);
    this.arrow.setAlpha(feedback === 'disabled' ? 0.45 : 1);
  }

  destroy(): void {
    this.surface.destroy();
    this.motif?.destroy();
    this.calendarDay?.destroy();
    this.arrowBadge?.destroy();
    this.arrow?.destroy();
    this.title.destroy();
    this.subtitle.destroy();
    this.zone.destroy();
    this.progress.destroy();
  }
}
