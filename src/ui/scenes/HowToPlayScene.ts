import * as Phaser from 'phaser';
import { t } from '../../localization/Localization.ts';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { RULE_SLIDES } from '../../game/view/RulesSlides.ts';
import { ActionCard } from '../components/ActionCard.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { RulesIllustration } from '../components/RulesIllustration.ts';
import { SceneShell } from '../components/SceneShell.ts';

export class HowToPlayScene extends BaseUiScene {
  private pageIndex = 0;
  private onboarding = false;
  private returnToGame = false;
  private titleText: Phaser.GameObjects.Text | null = null;
  private counterText: Phaser.GameObjects.Text | null = null;
  private bodyText: Phaser.GameObjects.Text | null = null;
  private pagination: Phaser.GameObjects.Graphics | null = null;
  private shell: SceneShell | null = null;
  private prev: ActionCard | null = null;
  private next: ActionCard | null = null;
  private play: ActionCard | null = null;
  private paper: PaperPanel | null = null;
  private illustration: RulesIllustration | null = null;
  constructor() { super('HowToPlayScene'); }
  init(data?: { onboarding?: boolean; returnToGame?: boolean }): void {
    this.onboarding = data?.onboarding === true; this.returnToGame = data?.returnToGame === true; this.pageIndex = 0;
  }
  create(): void {
    this.destroyOwnedUi(); this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const viewport = this.currentUiViewport();
    this.shell = new SceneShell(this, viewport, t('Как играть'), () => this.exitHowToPlay(), 20);
    this.paper = new PaperPanel(this, { depth: -10 }); this.illustration = new RulesIllustration(this);
    this.pagination = this.add.graphics().setDepth(3);
    this.titleText = this.add.text(0, 0, '', { color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0);
    this.counterText = this.add.text(0, 0, '', { color: '#846b3b', fontFamily: 'Georgia, serif' }).setOrigin(0);
    this.bodyText = this.add.text(0, 0, '', { color: '#526055', fontFamily: 'system-ui, sans-serif', lineSpacing: 6 }).setOrigin(0);
    this.prev = new ActionCard(this, viewport, { title: '←', enabled: true }, () => this.changePage(-1), 20);
    this.next = new ActionCard(this, viewport, { title: '→', enabled: true }, () => this.changePage(1), 20);
    this.play = new ActionCard(this, viewport, { title: this.onboarding ? t('ИГРАТЬ') : t('ЗАКРЫТЬ'), enabled: true, emphasis: 'highlight' }, () => this.exitHowToPlay(), 20);
    this.refreshPage(); this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOwnedUi()); this.bindResponsiveLayout();
  }
  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.shell || !this.titleText || !this.bodyText) return;
    const content = this.shell.layout(viewport).content;
    const css = viewport.minTouchTarget / 44;
    const compact = viewport.height / css < 560;
    const width = Math.min(content.width, 1080 * css);
    const height = Math.min(content.height, (compact ? 320 : 440) * css);
    const panel = { x: content.x + (content.width - width) / 2, y: content.y + (content.height - height) / 2, width, height };
    this.paper?.layout(panel);
    const inset = (compact ? 20 : 32) * css;
    const gap = (compact ? 24 : 38) * css;
    const illustrationWidth = (width - inset * 2 - gap) * 0.47;
    const textX = panel.x + inset + illustrationWidth + gap;
    const textWidth = width - inset * 2 - illustrationWidth - gap;
    const top = panel.y + inset;
    this.illustration?.layout({ x: panel.x + inset, y: top, width: illustrationWidth, height: height - inset * 2 }, RULE_SLIDES[this.pageIndex]!.id);
    this.counterText?.setText(`${String(this.pageIndex + 1).padStart(2, '0')}  /  ${String(RULE_SLIDES.length).padStart(2, '0')}`)
      .setFontSize((compact ? 13 : 15) * css).setPosition(textX, top);
    const titleY = top + (compact ? 27 : 38) * css;
    this.titleText.setFontSize((compact ? 20 : 28) * css).setWordWrapWidth(textWidth).setPosition(textX, titleY);
    const bodyY = titleY + this.titleText.height + (compact ? 10 : 20) * css;
    const buttonHeight = Math.max(viewport.minTouchTarget, (compact ? 44 : 52) * css);
    const bottomY = panel.y + height - inset - buttonHeight;
    this.bodyText.setFontSize((compact ? 14 : 18) * css).setLineSpacing((compact ? 3 : 7) * css)
      .setWordWrapWidth(textWidth).setPosition(textX, bodyY);
    const bodyAvailable = bottomY - bodyY - 18 * css;
    if (this.bodyText.height > bodyAvailable) this.bodyText.setFontSize(Math.max(12 * css, (compact ? 14 : 18) * css * bodyAvailable / this.bodyText.height));
    const navWidth = buttonHeight; const buttonGap = 8 * css;
    this.prev?.setViewport(viewport); this.prev?.layout({ x: textX, y: bottomY, width: navWidth, height: buttonHeight });
    this.next?.setViewport(viewport); this.next?.layout({ x: textX + navWidth + buttonGap, y: bottomY, width: navWidth, height: buttonHeight });
    this.play?.setViewport(viewport); this.play?.layout({ x: textX + (navWidth + buttonGap) * 2, y: bottomY, width: textWidth - (navWidth + buttonGap) * 2, height: buttonHeight });
    this.pagination?.clear();
    for (let index = 0; index < RULE_SLIDES.length; index += 1) {
      this.pagination?.fillStyle(0xb69557, index === this.pageIndex ? 1 : 0.25)
        .fillCircle(textX + textWidth - (RULE_SLIDES.length - 1 - index) * 13 * css, top + 8 * css, (index === this.pageIndex ? 3.5 : 2.5) * css);
    }
  }
  private exitHowToPlay(): void {
    if (this.returnToGame) { productBridge.closeHowToPlay(this.onboarding); return; } this.scene.start('HomeScene');
  }
  private changePage(delta: number): void {
    this.pageIndex = (this.pageIndex + delta + RULE_SLIDES.length) % RULE_SLIDES.length; this.refreshPage(); this.requestUiLayout();
  }
  private refreshPage(): void {
    const page = RULE_SLIDES[this.pageIndex]; if (!page) return;
    this.titleText?.setText(t(page.title)); this.bodyText?.setText(t(page.body));
  }
  private destroyOwnedUi(): void {
    this.paper?.destroy(); this.paper = null; this.illustration?.destroy(); this.illustration = null;
    this.pagination?.destroy(); this.pagination = null; this.titleText?.destroy(); this.titleText = null;
    this.counterText?.destroy(); this.counterText = null; this.bodyText?.destroy(); this.bodyText = null;
    this.shell?.destroy(); this.shell = null; this.prev?.destroy(); this.prev = null;
    this.next?.destroy(); this.next = null; this.play?.destroy(); this.play = null;
  }
}
