import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';
import type { LeaderboardLoadResult, LeaderboardMetric, LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { SceneShell } from '../components/SceneShell.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import { ScrollRegion } from '../components/ScrollRegion.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { formatDailyDateLabel } from '../daily/DailyDateFormat.ts';

interface RowVisual {
  readonly entry: LeaderboardRow;
  readonly background: Phaser.GameObjects.Graphics;
  readonly rankBadge: Phaser.GameObjects.Graphics;
  readonly rank: Phaser.GameObjects.Text;
  readonly avatar: Phaser.GameObjects.Graphics;
  readonly avatarImage: Phaser.GameObjects.Image;
  readonly avatarInitial: Phaser.GameObjects.Text;
  readonly rankIcon: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
  readonly valueA: Phaser.GameObjects.Text;
  readonly valueB: Phaser.GameObjects.Text;
  readonly pinned: boolean;
  avatarReady: boolean;
  visible: boolean;
}

const AVATAR_TONES = [0x315f55, 0x8a6a48, 0x536b78, 0x6e7656, 0x765667, 0x466a68] as const;
const PODIUM_TONES = [0xd3aa50, 0xb8b8ae, 0xb47745] as const;
const PODIUM_ROW_ALPHAS = [0.16, 0.10, 0.08] as const;
type VisibleLeaderboardMode = Exclude<GlobalLeaderboardMode, 'streak'>;

const RANK_LABELS = {
  novice: 'Новичок', player: 'Игрок', tactician: 'Тактик', expert: 'Эксперт', master: 'Мастер', grandmaster: 'Грандмастер',
} as const;

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function hashName(name: string): number {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function metricValues(metric: LeaderboardMetric): readonly [string, string] {
  if (metric.kind === 'standard') return [String(metric.bestStreak), ''];
  if (metric.kind === 'daily') {
    if (metric.moves <= 0 || metric.elapsedMs <= 0) return ['—', '—'];
    return [String(metric.moves), formatTime(metric.elapsedMs)];
  }
  if (metric.kind === 'streak') return [String(metric.current), String(metric.best)];
  return [t(RANK_LABELS[metric.rank]), String(metric.points)];
}

export class LeaderboardsScene extends BaseUiScene {
  private shell: SceneShell | null = null;
  private tabs: SegmentedControl<VisibleLeaderboardMode> | null = null;
  private panel: PaperPanel | null = null;
  private sectionTitle: Phaser.GameObjects.Text | null = null;
  private status: Phaser.GameObjects.Text | null = null;
  private headerRank: Phaser.GameObjects.Text | null = null;
  private headerPlayer: Phaser.GameObjects.Text | null = null;
  private headerA: Phaser.GameObjects.Text | null = null;
  private headerB: Phaser.GameObjects.Text | null = null;
  private divider: Phaser.GameObjects.Graphics | null = null;
  private scroll: ScrollRegion | null = null;
  private rows: RowVisual[] = [];
  private pinnedRow: RowVisual | null = null;
  private signIn: ActionCard | null = null;
  private selected: VisibleLeaderboardMode = 'winnable';
  private refreshRequestId = 0;
  private authorizing = false;
  private unsubscribe: (() => void) | null = null;
  private dailyId: string | null = null;
  private avatarLoadChain: Promise<void> = Promise.resolve();

  constructor() { super('LeaderboardsScene'); }

  create(): void {
    this.resetOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const viewport = this.currentUiViewport();
    this.dailyId = productBridge.snapshot().currentDailyId;
    this.shell = new SceneShell(this, viewport, t('Таблица лидеров'), () => this.scene.start('HomeScene'), 30);
    this.tabs = new SegmentedControl(this, viewport, [
      { value: 'winnable', label: t('Обычная') },
      { value: 'daily', label: 'Daily' },
      { value: 'mastery', label: t('Мастерство') },
    ], this.selected, (tab) => {
      if (tab === this.selected) return;
      this.selected = tab;
      this.tabs?.setSelected(tab);
      this.scroll?.scrollToTop();
      this.clearRows();
      void this.refreshRows();
    }, 30);
    this.panel = new PaperPanel(this, {
      depth: 10,
      textureKey: CASCADE_UI_ART_KEYS.leaderboardPanelBg,
      artworkAlpha: 0.80,
      artworkWashAlpha: 0.80,
      artworkMode: 'cover',
      artworkFocusX: 0.50,
      artworkFocusY: 0.52,
    });
    this.sectionTitle = this.add.text(0, 0, '', {
      color: '#7b6337', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(30);
    this.status = this.add.text(0, 0, '', {
      color: '#68746d', fontFamily: 'system-ui, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(30);
    this.headerRank = this.createHeader('#');
    this.headerPlayer = this.createHeader(t('Игрок'));
    this.headerA = this.createHeader('');
    this.headerB = this.createHeader('');
    this.divider = this.add.graphics().setDepth(21);
    this.scroll = new ScrollRegion(this, 20);
    this.signIn = new ActionCard(this, viewport, {
      title: t('ВОЙТИ'),
      subtitle: t('Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.'),
      enabled: false,
    }, () => { void this.authorizeAndReload(); }, 30);
    this.updateHeaders();
    this.updateSignInState();
    this.unsubscribe = productBridge.subscribe(() => this.updateSignInState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.resetOwnedUi());
    this.bindResponsiveLayout();
    void this.refreshRows();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.shell || !this.tabs || !this.panel || !this.sectionTitle || !this.status || !this.signIn
      || !this.headerRank || !this.headerPlayer || !this.headerA || !this.headerB || !this.divider || !this.scroll) return;

    const shell = this.shell.layout(viewport);
    const content = shell.content;
    const contentX = content.x;
    const contentW = content.width;
    const css = viewport.minTouchTarget / 44;
    const desktopTypeScale = viewport.profile === 'desktop'
      ? Math.max(1, Math.min(1.15, (viewport.height / css) / 960))
      : 1;
    const gap = viewport.profile === 'desktop' ? 12 * css : 8 * css;

    this.tabs.setViewport(viewport);
    this.signIn.setViewport(viewport);

    const tabsY = content.y;
    const tabsH = Math.max(viewport.minTouchTarget, viewport.profile === 'desktop' ? 56 * css : 44 * css);
    this.tabs.layout({ x: contentX, y: tabsY, width: contentW, height: tabsH });

    const auth = productBridge.leaderboardSnapshot();
    const authH = auth.authorized ? 0 : Math.max(viewport.minTouchTarget, viewport.profile === 'desktop' ? 66 * css : 56 * css);
    this.signIn.setVisible(!auth.authorized);
    const panelY = tabsY + tabsH + gap;
    const panelH = Math.max(150, content.y + content.height - panelY - (authH > 0 ? authH + gap : 0));
    const panelBounds: UiRect = { x: contentX, y: panelY, width: contentW, height: panelH };
    this.panel.layout(panelBounds);
    if (authH > 0) this.signIn.layout({ x: contentX, y: panelY + panelH + gap, width: contentW, height: authH });

    const inset = Math.max(12 * css, Math.min(22 * css, panelBounds.width * 0.025));
    const inner: UiRect = { x: panelBounds.x + inset, y: panelBounds.y + inset, width: panelBounds.width - inset * 2, height: panelBounds.height - inset * 2 };
    const sectionH = viewport.profile === 'desktop' ? 34 * css : 28 * css;
    const headerRowH = viewport.profile === 'desktop' ? 34 * css : 28 * css;
    this.sectionTitle.setPosition(inner.x + inner.width / 2, inner.y + sectionH * 0.46)
      .setFontSize(viewport.profile === 'desktop' ? 20 * css * desktopTypeScale : 15 * css);

    const headerY = inner.y + sectionH;
    const column = this.columnLayout(inner, viewport);
    const headerFont = viewport.profile === 'desktop' ? 14 * css * desktopTypeScale : 11 * css;
    this.headerRank.setPosition(column.rank, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerPlayer.setPosition(column.player, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerA.setPosition(column.valueA, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerB.setPosition(column.valueB, headerY + headerRowH / 2).setFontSize(headerFont);
    this.divider.clear().lineStyle(1, UI_TOKENS.color.gold, 0.5).lineBetween(inner.x, headerY + headerRowH, inner.x + inner.width, headerY + headerRowH);

    const hasPinned = this.pinnedRow !== null;
    const pinnedGap = hasPinned ? gap : 0;
    const pinnedH = hasPinned ? (viewport.profile === 'desktop' ? 54 * css : 44 * css) : 0;
    const rowsTop = headerY + headerRowH + 4 * css;
    const rowsBottom = inner.y + inner.height - pinnedH - pinnedGap;
    const rowsH = Math.max(0, rowsBottom - rowsTop);
    const rowH = viewport.profile === 'desktop' ? 46 * css : 38 * css;

    this.scroll.layout({ x: inner.x, y: rowsTop, width: inner.width, height: rowsH });
    this.scroll.setContentHeight(this.rows.length * rowH);
    this.rows.forEach((row, index) => {
      this.setRowVisible(row, true);
      this.layoutRow(row, { x: 0, y: index * rowH, width: inner.width, height: rowH - 2 }, viewport);
    });

    if (this.pinnedRow) {
      this.setRowVisible(this.pinnedRow, true);
      this.layoutRow(this.pinnedRow, {
        x: inner.x, y: inner.y + inner.height - pinnedH, width: inner.width, height: pinnedH,
      }, viewport);
    }

    this.status.setPosition(inner.x + inner.width / 2, rowsTop + rowsH / 2)
      .setFontSize(viewport.profile === 'desktop' ? 17 * css * desktopTypeScale : 13 * css);
  }

  private createHeader(label: string): Phaser.GameObjects.Text {
    return this.add.text(0, 0, label, {
      color: '#6b715f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(22);
  }

  private columnLayout(bounds: UiRect, viewport: ResolvedUiViewport) {
    const compact = viewport.profile !== 'desktop';
    return {
      rank: bounds.x + bounds.width * (compact ? 0.055 : 0.05),
      avatar: bounds.x + bounds.width * (compact ? 0.125 : 0.11),
      player: bounds.x + bounds.width * (compact ? 0.205 : 0.17),
      valueA: bounds.x + bounds.width * (compact ? 0.70 : 0.73),
      valueB: bounds.x + bounds.width * (compact ? 0.89 : 0.90),
    };
  }

  private updateHeaders(): void {
    if (!this.headerA || !this.headerB || !this.sectionTitle) return;
    if (this.selected === 'winnable') {
      this.headerA.setText(t('Лучшая серия'));
      this.headerB.setText('');
      this.sectionTitle.setText(t('Обычная'));
    } else if (this.selected === 'daily') {
      this.headerA.setText(t('Ходы'));
      this.headerB.setText(t('Время'));
      this.sectionTitle.setText(this.dailyId ? `Daily · ${formatDailyDateLabel(this.dailyId, getLanguage())}` : 'Daily');
    } else {
      this.headerA.setText(t('Ранг'));
      this.headerB.setText(t('Очки'));
      this.sectionTitle.setText(t('Мастерство'));
    }
  }

  private createRow(entry: LeaderboardRow, pinned: boolean, scrollable: boolean): RowVisual {
    const values = metricValues(entry.metric);
    const rawName = entry.publicName.trim();
    const name = rawName === 'Вы' ? t('Вы') : rawName || t('Игрок');
    const row: RowVisual = {
      entry,
      background: this.add.graphics().setDepth(20),
      rankBadge: this.add.graphics().setDepth(22),
      rank: this.add.text(0, 0, entry.rank > 0 ? String(entry.rank) : '—', { color: '#26342f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(23),
      avatar: this.add.graphics().setDepth(22),
      avatarImage: this.add.image(0, 0, CASCADE_UI_ART_KEYS.paperGrain).setOrigin(0.5).setDepth(22.5).setVisible(false),
      avatarInitial: this.add.text(0, 0, (name[0] ?? '?').toUpperCase(), { color: '#f7ecd6', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(23),
      rankIcon: this.add.image(0, 0, CASCADE_UI_ART_KEYS.rankLeaderboard.novice)
        .setOrigin(0.5).setDepth(23).setVisible(false),
      name: this.add.text(0, 0, name, { color: '#26342f', fontFamily: 'system-ui, sans-serif' }).setOrigin(0, 0.5).setDepth(23),
      valueA: this.add.text(0, 0, values[0], { color: '#26342f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(23),
      valueB: this.add.text(0, 0, values[1], { color: '#26342f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(23),
      pinned,
      avatarReady: false,
      visible: true,
    };
    if (scrollable && this.scroll) {
      this.scroll.add(row.background);
      this.scroll.add(row.rankBadge);
      this.scroll.add(row.rank);
      this.scroll.add(row.avatar);
      this.scroll.add(row.avatarImage);
      this.scroll.add(row.avatarInitial);
      this.scroll.add(row.rankIcon);
      this.scroll.add(row.name);
      this.scroll.add(row.valueA);
      this.scroll.add(row.valueB);
    }
    return row;
  }

  private layoutRow(row: RowVisual, bounds: UiRect, viewport: ResolvedUiViewport): void {
    const column = this.columnLayout(bounds, viewport);
    const css = viewport.minTouchTarget / 44;
    const desktopTypeScale = viewport.profile === 'desktop'
      ? Math.max(1, Math.min(1.15, (viewport.height / css) / 960))
      : 1;
    const radius = Math.max(6 * css, Math.min(11 * css, bounds.height * 0.22));
    const rowEdgeInset = row.pinned ? 0 : 1 * css;
    const backgroundX = bounds.x + rowEdgeInset;
    const backgroundWidth = Math.max(0, bounds.width - rowEdgeInset * 2);
    row.background.clear();
    const podiumRank = row.entry.rank >= 1 && row.entry.rank <= 3 ? row.entry.rank : null;
    if (row.pinned) {
      row.background.fillStyle(UI_TOKENS.color.goldLight, 0.44).fillRoundedRect(backgroundX, bounds.y, backgroundWidth, bounds.height, radius);
      row.background.lineStyle(1, UI_TOKENS.color.gold, 0.8).strokeRoundedRect(backgroundX, bounds.y, backgroundWidth, bounds.height, radius);
    } else if (podiumRank !== null) {
      const podiumTone = PODIUM_TONES[podiumRank - 1]!;
      row.background.fillStyle(podiumTone, PODIUM_ROW_ALPHAS[podiumRank - 1]!).fillRoundedRect(backgroundX, bounds.y, backgroundWidth, bounds.height, radius);
      row.background.lineStyle(1, podiumTone, podiumRank === 1 ? 0.54 : 0.34).strokeRoundedRect(backgroundX, bounds.y, backgroundWidth, bounds.height, radius);
    } else {
      row.background.fillStyle(UI_TOKENS.color.paper, row.entry.rank % 2 === 0 ? 0.16 : 0.05).fillRoundedRect(backgroundX, bounds.y, backgroundWidth, bounds.height, radius);
    }

    const cy = bounds.y + bounds.height / 2;
    const badgeR = Math.min(bounds.height * 0.28, viewport.profile === 'desktop' ? 14 * css : 11 * css);
    row.rankBadge.clear();
    if (podiumRank !== null) {
      const podiumTone = PODIUM_TONES[podiumRank - 1]!;
      row.rankBadge.fillStyle(podiumTone, 0.16).fillCircle(column.rank, cy, badgeR + 4);
      row.rankBadge.lineStyle(podiumRank === 1 ? 2 * css : Math.max(1, css), podiumTone, 0.86).strokeCircle(column.rank, cy, badgeR + 2 * css);
      row.rankBadge.fillStyle(podiumTone, 0.96).fillCircle(column.rank, cy, badgeR);
      row.rank.setColor('#fff8e8');
    } else {
      row.rank.setColor('#26342f');
    }
    row.rank.setPosition(column.rank, cy).setFontSize(Math.max(10 * css, Math.min(15 * css * desktopTypeScale, bounds.height * 0.30)));

    const avatarR = Math.min(bounds.height * 0.31, viewport.profile === 'desktop' ? 15 * css : 12 * css);
    const avatarSize = avatarR * 2;
    row.avatar.clear();
    if (row.avatarReady) {
      row.avatar.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.66)
        .strokeCircle(column.avatar, cy, avatarR + css);
    } else {
      row.avatar.fillStyle(AVATAR_TONES[hashName(row.entry.publicName) % AVATAR_TONES.length]!, 1).fillCircle(column.avatar, cy, avatarR);
      row.avatar.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.55).strokeCircle(column.avatar, cy, avatarR);
    }
    row.avatarImage.setPosition(column.avatar, cy).setDisplaySize(avatarSize, avatarSize).setVisible(row.visible && row.avatarReady);
    row.avatarInitial.setPosition(column.avatar, cy).setFontSize(Math.max(10 * css, avatarR * 0.85)).setVisible(row.visible && !row.avatarReady);

    const fontSize = Math.max(10 * css, Math.min(viewport.profile === 'desktop' ? 16 * css * desktopTypeScale : 13 * css, bounds.height * 0.33));
    const nameWidth = Math.max(60 * css, column.valueA - column.player - bounds.width * 0.08);
    row.name.setPosition(column.player, cy).setFontSize(fontSize).setWordWrapWidth(nameWidth, false);
    if (row.entry.metric.kind === 'mastery') {
      const iconSize = Math.max(30 * css, Math.min(viewport.profile === 'desktop' ? 40 * css : 34 * css, bounds.height * 0.88));
      const iconX = column.valueA - (viewport.profile === 'desktop' ? 72 * css : 54 * css);
      row.rankIcon.setTexture(CASCADE_UI_ART_KEYS.rankLeaderboard[row.entry.metric.rank])
        .setPosition(iconX, cy).setDisplaySize(iconSize, iconSize).setAlpha(0.98).setVisible(row.visible);
      row.valueA.setOrigin(0, 0.5).setPosition(iconX + iconSize * 0.72, cy).setFontSize(fontSize);
    } else {
      row.rankIcon.setVisible(false);
      row.valueA.setOrigin(0.5, 0.5).setPosition(column.valueA, cy).setFontSize(fontSize);
    }
    row.valueB.setPosition(column.valueB, cy).setFontSize(fontSize);
  }

  private setRowVisible(row: RowVisual, visible: boolean): void {
    row.visible = visible;
    row.background.setVisible(visible);
    row.rankBadge.setVisible(visible);
    row.rank.setVisible(visible);
    row.avatar.setVisible(visible);
    row.avatarImage.setVisible(visible && row.avatarReady);
    row.avatarInitial.setVisible(visible && !row.avatarReady);
    row.rankIcon.setVisible(visible && row.entry.metric.kind === 'mastery');
    row.name.setVisible(visible);
    row.valueA.setVisible(visible);
    row.valueB.setVisible(visible);
  }

  private destroyRow(row: RowVisual): void {
    row.background.destroy(); row.rankBadge.destroy(); row.rank.destroy(); row.avatar.destroy(); row.avatarImage.destroy();
    row.avatarInitial.destroy(); row.rankIcon.destroy(); row.name.destroy(); row.valueA.destroy(); row.valueB.destroy();
  }

  private clearRows(): void {
    for (const row of this.rows) this.destroyRow(row);
    this.rows = [];
    if (this.pinnedRow) this.destroyRow(this.pinnedRow);
    this.pinnedRow = null;
  }

  private rebuildRows(result: Extract<LeaderboardLoadResult, { status: 'ready' }>): void {
    this.clearRows();
    const playerRank = result.playerEntry?.rank ?? null;
    this.rows = result.entries.map((entry) => this.createRow(entry, playerRank === entry.rank, true));
    const playerVisible = result.playerEntry !== null && result.entries.some((entry) => entry.rank === result.playerEntry?.rank && entry.publicName === result.playerEntry?.publicName);
    if (result.playerEntry !== null && !playerVisible) {
      this.pinnedRow = this.createRow(result.playerEntry, true, false);
    } else if (this.selected === 'daily' && result.playerEntry === null) {
      this.pinnedRow = this.createRow({
        rank: 0,
        publicName: 'Вы',
        value: 0,
        metric: { kind: 'daily', moves: 0, elapsedMs: 0 },
      }, true, false);
    }
    this.scroll?.scrollToTop();
    void this.loadAvatarTextures();
  }

  private avatarTextureKey(url: string): string {
    return `leaderboard.avatar.${hashName(url).toString(16)}`;
  }

  private circularAvatarTextureKey(url: string): string {
    return `${this.avatarTextureKey(url)}.circle`;
  }

  private ensureCircularAvatarTexture(sourceKey: string, circularKey: string): boolean {
    if (this.textures.exists(circularKey)) return true;
    const source = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const size = Math.floor(Math.min(sourceWidth, sourceHeight));
    if (size <= 0) return false;

    const texture = this.textures.createCanvas(circularKey, size, size);
    if (!texture) return false;
    const context = texture.getContext();
    const sourceX = (sourceWidth - size) / 2;
    const sourceY = (sourceHeight - size) / 2;
    context.save();
    context.clearRect(0, 0, size, size);
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(source, sourceX, sourceY, size, size, 0, 0, size, size);
    context.restore();
    texture.refresh();
    return true;
  }

  private allRows(): readonly RowVisual[] {
    return this.pinnedRow ? [...this.rows, this.pinnedRow] : this.rows;
  }

  private syncAvatarTextures(): void {
    for (const row of this.allRows()) {
      const url = row.entry.avatarUrl?.trim();
      if (!url) continue;
      const key = this.avatarTextureKey(url);
      if (!this.textures.exists(key)) continue;
      const circularKey = this.circularAvatarTextureKey(url);
      if (!this.ensureCircularAvatarTexture(key, circularKey)) continue;
      row.avatarImage.setTexture(circularKey);
      row.avatarReady = true;
      row.avatarImage.setVisible(row.visible);
      row.avatarInitial.setVisible(false);
    }
    this.requestUiLayout();
  }

  private loadAvatarTextures(): Promise<void> {
    const assets = new Map<string, string>();
    for (const row of this.allRows()) {
      const url = row.entry.avatarUrl?.trim();
      if (!url) continue;
      const key = this.avatarTextureKey(url);
      if (!this.textures.exists(key)) assets.set(key, url);
    }
    if (assets.size === 0) {
      this.syncAvatarTextures();
      return Promise.resolve();
    }

    const task = this.avatarLoadChain.then(() => new Promise<void>((resolve) => {
      if (!this.isUiSceneActive()) { resolve(); return; }
      const finish = () => {
        this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
        resolve();
      };
      const cancel = () => {
        this.load.off(Phaser.Loader.Events.COMPLETE, finish);
        resolve();
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      this.load.once(Phaser.Loader.Events.COMPLETE, finish);
      for (const [key, url] of assets) if (!this.textures.exists(key)) this.load.image(key, url);
      if (!this.load.isLoading()) this.load.start();
    }));
    this.avatarLoadChain = task.catch(() => undefined);
    return task.then(() => { if (this.isUiSceneActive()) this.syncAvatarTextures(); });
  }

  private async refreshRows(): Promise<void> {
    const requestedMode = this.selected;
    const requestId = ++this.refreshRequestId;
    this.status?.setText(t('Загрузка…')).setVisible(true);
    this.updateHeaders();
    const result = await productBridge.loadLeaderboard(requestedMode);
    if (!this.isUiSceneActive() || requestId !== this.refreshRequestId || this.selected !== requestedMode) return;
    if (result.status === 'ready') {
      this.rebuildRows(result);
      this.status?.setText(result.entries.length === 0 ? t('Пока нет результатов') : '').setVisible(result.entries.length === 0);
    } else {
      this.clearRows();
      this.status?.setText(result.status === 'unavailable' ? t('Таблица лидеров недоступна') : t('Не удалось загрузить таблицу лидеров')).setVisible(true);
    }
    this.updateSignInState();
    this.requestUiLayout();
  }

  private updateSignInState(): void {
    const state = productBridge.leaderboardSnapshot();
    this.signIn?.setVisible(!state.authorized);
    this.signIn?.setState({
      title: t('ВОЙТИ'),
      subtitle: t('Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.'),
      enabled: state.available && state.authorizationAllowed && !state.authorized && !state.authPending && !this.authorizing,
    });
    this.requestUiLayout();
  }

  private async authorizeAndReload(): Promise<void> {
    if (this.authorizing) return;
    this.authorizing = true;
    this.updateSignInState();
    try { if (await productBridge.authorizeLeaderboard()) await this.refreshRows(); }
    finally { this.authorizing = false; this.updateSignInState(); }
  }

  private resetOwnedUi(): void {
    this.unsubscribe?.(); this.unsubscribe = null;
    this.shell?.destroy(); this.tabs?.destroy(); this.panel?.destroy(); this.sectionTitle?.destroy(); this.status?.destroy();
    this.headerRank?.destroy(); this.headerPlayer?.destroy(); this.headerA?.destroy(); this.headerB?.destroy(); this.divider?.destroy(); this.signIn?.destroy();
    this.clearRows();
    this.scroll?.destroy();
    this.shell = null; this.tabs = null; this.panel = null; this.sectionTitle = null; this.status = null;
    this.headerRank = null; this.headerPlayer = null; this.headerA = null; this.headerB = null; this.divider = null; this.scroll = null; this.signIn = null;
    this.refreshRequestId += 1; this.authorizing = false;
  }
}
