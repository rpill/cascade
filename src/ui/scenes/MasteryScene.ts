import * as Phaser from 'phaser';
import { getLanguage, t } from '../../localization/Localization.ts';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { CoinPill } from '../components/CoinPill.ts';
import { SceneShell } from '../components/SceneShell.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { ProgressMeter } from '../components/ProgressMeter.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { buildMasteryViewModel, type MasteryViewModel } from '../mastery/MasteryViewModel.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';

interface MasterySections {
  readonly rank: UiRect;
  readonly overall: UiRect;
  readonly requirements: UiRect;
  readonly path: UiRect;
}

export class MasteryScene extends BaseUiScene {
  private vm: MasteryViewModel | null = null;
  private panel: PaperPanel | null = null;
  private shell: SceneShell | null = null;
  private coinPill: CoinPill | null = null;

  private badge: Phaser.GameObjects.Image | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private subtitle: Phaser.GameObjects.Text | null = null;
  private overallMeter: ProgressMeter | null = null;
  private overallMeterFrame: Phaser.GameObjects.Graphics | null = null;

  private requirementTexts: Phaser.GameObjects.Text[] = [];
  private meters: ProgressMeter[] = [];
  private meterFrames: Phaser.GameObjects.Graphics[] = [];

  private rewardFrame: Phaser.GameObjects.Graphics | null = null;
  private rewardCoins: Phaser.GameObjects.Image[] = [];
  private rewardText: Phaser.GameObjects.Text | null = null;

  private structureChrome: Phaser.GameObjects.Graphics | null = null;
  private pathBackdrop: Phaser.GameObjects.Graphics | null = null;
  private pathTrack: Phaser.GameObjects.Graphics | null = null;
  private pathSelection: Phaser.GameObjects.Graphics | null = null;
  private pathHeading: Phaser.GameObjects.Text | null = null;
  private pathTexts: Phaser.GameObjects.Text[] = [];
  private pathBadges: Phaser.GameObjects.Image[] = [];
  private pathLocks: Array<Phaser.GameObjects.Image | null> = [];

  constructor() { super('MasteryScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const snapshot = productBridge.snapshot();
    this.vm = buildMasteryViewModel(snapshot.state, getLanguage());
    const viewport = this.currentUiViewport();

    this.panel = new PaperPanel(this, { depth: 10 });
    this.shell = new SceneShell(this, viewport, t('Мастерство'), () => this.scene.start('HomeScene'), 30);
    this.coinPill = new CoinPill(this, 30);
    this.coinPill.setCoins(snapshot.state.progression.coins);

    this.badge = this.add.image(0, 0, CASCADE_UI_ART_KEYS.rank[this.vm.rank]).setDepth(20);
    this.title = this.add.text(0, 0, this.vm.rankLabel, {
      color: '#202b29', fontFamily: 'Georgia, serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    const totals = this.masteryTotals();
    const subtitle = this.vm.requirements.length
      ? `${t('До следующего ранга')}: ${totals.current} / ${totals.total}`
      : t('Максимальный ранг');
    this.subtitle = this.add.text(0, 0, subtitle, {
      color: '#35413d', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20);
    this.overallMeter = new ProgressMeter(this, 20);
    this.overallMeter.setProgress({ current: totals.current, total: Math.max(1, totals.total) });
    this.overallMeter.setVisible(this.vm.requirements.length > 0);
    this.overallMeterFrame = this.add.graphics().setDepth(19.8);

    this.requirementTexts = this.vm.requirements.map(req => this.add.text(0, 0, `${req.label}: ${req.current} / ${req.total}`, {
      color: '#202b29', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20));
    this.meters = this.vm.requirements.map(req => {
      const meter = new ProgressMeter(this, 20);
      meter.setProgress({ current: req.current, total: req.total });
      return meter;
    });
    this.meterFrames = this.vm.requirements.map(() => this.add.graphics().setDepth(19.8));

    this.rewardFrame = this.add.graphics().setDepth(18.5);
    this.rewardCoins = [0, 1, 2].map(() => this.add.image(0, 0, UI_ICON_KEYS.coin)
      .setTint(UI_TOKENS.color.goldLight).setDepth(20));
    this.rewardText = this.add.text(0, 0, this.vm.nextRewardCoins > 0
      ? t('Награда за ранг: +{count} монет', { count: this.vm.nextRewardCoins })
      : t('Все ранги открыты'), {
      color: '#5f481d', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20);

    this.structureChrome = this.add.graphics().setDepth(16);
    this.pathBackdrop = this.add.graphics().setDepth(15);
    this.pathTrack = this.add.graphics().setDepth(18);
    this.pathSelection = this.add.graphics().setDepth(17.5);
    this.pathHeading = this.add.text(0, 0, t('Путь мастерства'), {
      color: '#26322f', fontFamily: 'Georgia, serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.pathTexts = this.vm.path.map(item => this.add.text(0, 0, item.label, {
      color: item.current ? '#60491b' : '#293330',
      fontFamily: 'Georgia, serif',
      fontStyle: item.current ? 'bold' : 'normal',
    }).setAlpha(item.current ? 1 : item.completed ? 0.96 : 0.9).setOrigin(0.5).setDepth(20));
    this.pathBadges = this.vm.path.map(item => this.add.image(0, 0, CASCADE_UI_ART_KEYS.rank[item.rank])
      .setAlpha(item.current ? 1 : item.completed ? 0.92 : 0.34).setDepth(20));
    this.pathLocks = this.vm.path.map(item => item.current || item.completed ? null : this.add.image(0, 0, UI_ICON_KEYS.lock)
      .setTint(UI_TOKENS.color.goldLight).setDepth(21));

    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.vm || !this.panel) return;
    if (!this.shell) return;
    const shell = this.shell.layout(viewport);
    const content = shell.content;
    const css = viewport.minTouchTarget / 44;
    const mobile = viewport.profile === 'mobile-landscape';
    const coinWidth = Math.min(shell.rightSlot.width, Math.max(92 * css, shell.header.height * 2.0));
    this.coinPill?.layout({
      x: shell.rightSlot.x + shell.rightSlot.width - coinWidth,
      y: shell.rightSlot.y,
      width: coinWidth,
      height: shell.rightSlot.height,
    });

    const bounds: UiRect = content;
    this.panel.layout(bounds);
    const sections = this.layoutMasterySections(bounds, css, mobile);
    this.layoutRankSection(sections.rank, css, mobile);
    this.layoutOverallSection(sections.overall, css, mobile);
    this.layoutRequirementSection(sections.requirements, css, mobile);
    this.layoutPathSection(sections.path, css, mobile);
    this.drawStructureChrome(sections, css, mobile);
  }

  private layoutMasterySections(
    bounds: UiRect,
    css: number,
    mobile: boolean,
  ): MasterySections {
    const insetX = bounds.width * (mobile ? 0.026 : 0.034);
    const insetTop = bounds.height * (mobile ? 0.045 : 0.05);
    const insetBottom = bounds.height * (mobile ? 0.035 : 0.045);
    const innerX = bounds.x + insetX;
    const innerY = bounds.y + insetTop;
    const innerW = bounds.width - insetX * 2;
    const innerH = bounds.height - insetTop - insetBottom;
    const gap = Math.max(9 * css, innerW * (mobile ? 0.012 : 0.016));
    const pathH = innerH * (mobile ? 0.34 : 0.36);
    const upperH = innerH - pathH - gap;
    const rankW = innerW * (mobile ? 0.25 : 0.28);
    const overallW = innerW * (mobile ? 0.33 : 0.31);
    const requirementsW = innerW - rankW - overallW - gap * 2;

    return {
      rank: { x: innerX, y: innerY, width: rankW, height: upperH },
      overall: { x: innerX + rankW + gap, y: innerY, width: overallW, height: upperH },
      requirements: { x: innerX + rankW + gap + overallW + gap, y: innerY, width: requirementsW, height: upperH },
      path: { x: innerX, y: innerY + upperH + gap, width: innerW, height: pathH },
    };
  }

  private layoutRankSection(bounds: UiRect, css: number, mobile: boolean): void {
    const badgeSize = Math.min(bounds.width * (mobile ? 0.58 : 0.61), bounds.height * (mobile ? 0.58 : 0.60));
    const cx = bounds.x + bounds.width * 0.50;
    const badgeY = bounds.y + bounds.height * (mobile ? 0.34 : 0.35);
    this.badge?.setPosition(cx, badgeY).setDisplaySize(badgeSize, badgeSize);
    this.title?.setPosition(cx, bounds.y + bounds.height * (mobile ? 0.76 : 0.78))
      .setFontSize(Math.max(20 * css, Math.min((mobile ? 32 : 42) * css, bounds.width * 0.105)));
  }

  private layoutOverallSection(bounds: UiRect, css: number, mobile: boolean): void {
    const textSize = Math.max(12 * css, Math.min((mobile ? 17 : 21) * css, bounds.width * 0.052));
    const left = bounds.x + bounds.width * 0.06;
    this.subtitle?.setPosition(left, bounds.y + bounds.height * 0.18).setFontSize(textSize);

    const meterBounds: UiRect = {
      x: left,
      y: bounds.y + bounds.height * 0.29,
      width: bounds.width * 0.88,
      height: Math.max(10 * css, bounds.height * (mobile ? 0.07 : 0.075)),
    };
    this.drawProgressFrame(this.overallMeterFrame, meterBounds, css);
    this.overallMeter?.layout(this.insetMeter(meterBounds, css));

    const reward: UiRect = {
      x: left,
      y: bounds.y + bounds.height * (mobile ? 0.53 : 0.55),
      width: bounds.width * 0.88,
      height: bounds.height * (mobile ? 0.28 : 0.25),
    };
    this.drawRewardFrame(reward, css);
    const showCoins = Boolean(this.vm && this.vm.nextRewardCoins > 0);
    const coinSize = Math.min(reward.height * 0.42, reward.width * 0.095);
    const coinBaseX = reward.x + reward.width * 0.12;
    const coinY = reward.y + reward.height / 2;
    this.rewardCoins.forEach((coin, index) => coin
      .setVisible(showCoins)
      .setDisplaySize(coinSize, coinSize)
      .setPosition(coinBaseX + index * coinSize * 0.34, coinY + (index === 1 ? -coinSize * 0.15 : index === 2 ? coinSize * 0.08 : coinSize * 0.10)));
    this.rewardText?.setPosition(reward.x + reward.width * (showCoins ? 0.30 : 0.08), coinY)
      .setFontSize(Math.max(11 * css, Math.min((mobile ? 15 : 18) * css, reward.height * 0.30)));
  }

  private layoutRequirementSection(bounds: UiRect, css: number, mobile: boolean): void {
    const count = Math.max(1, this.requirementTexts.length);
    const rowH = bounds.height / count;
    this.requirementTexts.forEach((text, index) => {
      const rowTop = bounds.y + index * rowH;
      text.setPosition(bounds.x + bounds.width * 0.03, rowTop + rowH * 0.30)
        .setFontSize(Math.max(12 * css, Math.min((mobile ? 17 : 21) * css, bounds.width * 0.047)));
      const meterBounds: UiRect = {
        x: bounds.x + bounds.width * 0.03,
        y: rowTop + rowH * 0.52,
        width: bounds.width * 0.92,
        height: Math.max(9 * css, rowH * (mobile ? 0.11 : 0.105)),
      };
      this.drawProgressFrame(this.meterFrames[index], meterBounds, css);
      this.meters[index]?.layout(this.insetMeter(meterBounds, css));
    });
  }

  private layoutPathSection(bounds: UiRect, css: number, mobile: boolean): void {
    const headingY = bounds.y + bounds.height * (mobile ? 0.14 : 0.13);
    this.pathHeading?.setPosition(bounds.x + bounds.width / 2, headingY)
      .setFontSize(Math.max(14 * css, Math.min((mobile ? 20 : 25) * css, bounds.height * 0.18)));

    const trackWidth = bounds.width * (mobile ? 0.90 : 0.88);
    const startX = bounds.x + (bounds.width - trackWidth) / 2;
    const step = this.pathTexts.length > 1 ? trackWidth / (this.pathTexts.length - 1) : 0;
    const badgeY = bounds.y + bounds.height * (mobile ? 0.55 : 0.56);
    const labelY = bounds.y + bounds.height * (mobile ? 0.86 : 0.85);
    const badgeSize = Math.min(bounds.height * (mobile ? 0.37 : 0.42), step * (mobile ? 0.46 : 0.50));
    const xs = this.pathTexts.map((_, index) => startX + index * step);

    const pathBackdrop = this.pathBackdrop;
    const sepY = bounds.y + bounds.height * 0.01;
    const sepGap = bounds.width * 0.09;
    if (pathBackdrop) {
      pathBackdrop.clear();
      pathBackdrop.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.48)
        .lineBetween(bounds.x, sepY, bounds.x + bounds.width / 2 - sepGap, sepY)
        .lineBetween(bounds.x + bounds.width / 2 + sepGap, sepY, bounds.x + bounds.width, sepY);
      this.drawDiamond(pathBackdrop, bounds.x + bounds.width / 2 - sepGap * 0.82, sepY, 3.5 * css, 0.7);
      this.drawDiamond(pathBackdrop, bounds.x + bounds.width / 2 + sepGap * 0.82, sepY, 3.5 * css, 0.7);
    }

    this.drawPathConnectors(xs, badgeY, badgeSize, css, mobile);
    this.pathSelection?.clear();
    this.pathTexts.forEach((text, index) => {
      const x = xs[index];
      const item = this.vm?.path[index];
      const badge = this.pathBadges[index];
      badge?.setPosition(x, badgeY).setDisplaySize(badgeSize, badgeSize);
      if (item && !item.current && !item.completed) badge?.setTint(0x8e8a79);
      else badge?.clearTint();

      const lock = this.pathLocks[index];
      lock?.setPosition(x, badgeY).setDisplaySize(badgeSize * 0.31, badgeSize * 0.31).setAlpha(0.92);
      text.setPosition(x, labelY).setFontSize(Math.max(9 * css, Math.min((mobile ? 12 : 15) * css, bounds.height * 0.105)));

      if (item?.current) {
        const padX = Math.max(8 * css, text.width * 0.16);
        const h = Math.max(22 * css, text.height * 1.35);
        this.pathSelection?.fillStyle(0xf3e2bd, 0.92)
          .fillRoundedRect(x - text.width / 2 - padX, labelY - h / 2, text.width + padX * 2, h, h * 0.22)
          .lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.72)
          .strokeRoundedRect(x - text.width / 2 - padX, labelY - h / 2, text.width + padX * 2, h, h * 0.22);
      }
    });
  }


  private drawStructureChrome(sections: MasterySections, css: number, mobile: boolean): void {
    if (!this.structureChrome) return;
    const top = sections.rank.y + sections.rank.height * 0.03;
    const bottom = sections.rank.y + sections.rank.height * 0.96;
    const firstX = sections.overall.x - (sections.overall.x - (sections.rank.x + sections.rank.width)) / 2;
    const secondX = sections.requirements.x - (sections.requirements.x - (sections.overall.x + sections.overall.width)) / 2;
    this.structureChrome.clear().lineStyle(Math.max(1, css), UI_TOKENS.color.gold, mobile ? 0.25 : 0.32)
      .lineBetween(firstX, top, firstX, bottom)
      .lineBetween(secondX, top, secondX, bottom);
  }

  private drawRewardFrame(bounds: UiRect, css: number): void {
    if (!this.rewardFrame) return;
    const radius = Math.max(5 * css, bounds.height * 0.12);
    this.rewardFrame.clear()
      .fillStyle(0xf8ead0, 0.76).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius)
      .lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.68).strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    const c = Math.max(5 * css, bounds.height * 0.11);
    const inset = 6 * css;
    this.rewardFrame.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.45)
      .lineBetween(bounds.x + inset, bounds.y + inset, bounds.x + inset + c, bounds.y + inset)
      .lineBetween(bounds.x + inset, bounds.y + inset, bounds.x + inset, bounds.y + inset + c)
      .lineBetween(bounds.x + bounds.width - inset - c, bounds.y + bounds.height - inset, bounds.x + bounds.width - inset, bounds.y + bounds.height - inset)
      .lineBetween(bounds.x + bounds.width - inset, bounds.y + bounds.height - inset - c, bounds.x + bounds.width - inset, bounds.y + bounds.height - inset);
  }

  private drawProgressFrame(graphics: Phaser.GameObjects.Graphics | null, bounds: UiRect, css: number): void {
    if (!graphics) return;
    const radius = bounds.height / 2;
    graphics.clear()
      .fillStyle(0xf7edd8, 0.78).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius)
      .lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.72).strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    const diamond = Math.max(2.5 * css, bounds.height * 0.17);
    this.drawDiamond(graphics, bounds.x - diamond * 1.35, bounds.y + bounds.height / 2, diamond, 0.72);
    this.drawDiamond(graphics, bounds.x + bounds.width + diamond * 1.35, bounds.y + bounds.height / 2, diamond, 0.72);
  }

  private insetMeter(bounds: UiRect, css: number): UiRect {
    const inset = Math.max(2 * css, bounds.height * 0.20);
    return {
      x: bounds.x + inset,
      y: bounds.y + inset,
      width: Math.max(1, bounds.width - inset * 2),
      height: Math.max(2 * css, bounds.height - inset * 2),
    };
  }

  private drawPathConnectors(xs: readonly number[], y: number, badgeSize: number, css: number, mobile: boolean): void {
    if (!this.pathTrack) return;
    this.pathTrack.clear();
    const lineAlpha = mobile ? 0.68 : 0.74;
    const edgePad = badgeSize * 0.59;
    const diamondSize = Math.max(2.5 * css, badgeSize * 0.055);
    const arrow = Math.max(4 * css, badgeSize * 0.085);
    this.pathTrack.lineStyle(Math.max(1, 1.4 * css), UI_TOKENS.color.gold, lineAlpha);
    for (let index = 0; index < xs.length - 1; index += 1) {
      const start = xs[index] + edgePad;
      const end = xs[index + 1] - edgePad;
      const mid = (start + end) / 2;
      const gap = diamondSize * 2.1;
      this.pathTrack.lineBetween(start, y, mid - gap, y).lineBetween(mid + gap, y, end - arrow, y);
      this.drawDiamond(this.pathTrack, mid, y, diamondSize, 0.85);
      this.pathTrack.beginPath().moveTo(end - arrow, y - arrow * 0.62).lineTo(end, y).lineTo(end - arrow, y + arrow * 0.62).strokePath();
    }
  }

  private drawDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, alpha: number): void {
    graphics.fillStyle(UI_TOKENS.color.gold, alpha).beginPath()
      .moveTo(x, y - size).lineTo(x + size, y).lineTo(x, y + size).lineTo(x - size, y).closePath().fillPath();
  }

  private masteryTotals(): { current: number; total: number } {
    if (!this.vm) return { current: 0, total: 0 };
    return this.vm.requirements.reduce((sum, req) => ({
      current: sum.current + Math.min(req.current, req.total),
      total: sum.total + req.total,
    }), { current: 0, total: 0 });
  }
}
