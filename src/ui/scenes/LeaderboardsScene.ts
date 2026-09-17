import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { t } from '../../localization/Localization.ts';
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

interface RowVisual {
  readonly entry: LeaderboardRow;
  readonly background: Phaser.GameObjects.Graphics;
  readonly rankBadge: Phaser.GameObjects.Graphics;
  readonly rank: Phaser.GameObjects.Text;
  readonly avatar: Phaser.GameObjects.Graphics;
  readonly avatarInitial: Phaser.GameObjects.Text;
  readonly name: Phaser.GameObjects.Text;
  readonly valueA: Phaser.GameObjects.Text;
  readonly valueB: Phaser.GameObjects.Text;
  readonly pinned: boolean;
}

const AVATAR_TONES = [0x315f55, 0x8a6a48, 0x536b78, 0x6e7656, 0x765667, 0x466a68] as const;
const PODIUM_TONES = [0xd3aa50, 0xb8b8ae, 0xb47745] as const;
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
  private tabs: SegmentedControl<GlobalLeaderboardMode> | null = null;
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
  private selected: GlobalLeaderboardMode = 'winnable';
  private loading = false;
  private authorizing = false;
  private unsubscribe: (() => void) | null = null;
  private dailyId: string | null = null;

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
      { value: 'streak', label: t('Серия') },
      { value: 'mastery', label: t('Мастерство') },
    ], this.selected, (tab) => {
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
    const gap = viewport.profile === 'desktop' ? 12 : 8;

    this.tabs.setViewport(viewport);
    this.signIn.setViewport(viewport);

    const tabsY = content.y;
    const tabsH = Math.max(viewport.minTouchTarget, viewport.profile === 'desktop' ? 50 : 44);
    this.tabs.layout({ x: contentX, y: tabsY, width: contentW, height: tabsH });

    const auth = productBridge.leaderboardSnapshot();
    const authH = auth.authorized ? 0 : Math.max(viewport.minTouchTarget, viewport.profile === 'desktop' ? 66 : 56);
    this.signIn.setVisible(!auth.authorized);
    const panelY = tabsY + tabsH + gap;
    const panelH = Math.max(150, content.y + content.height - panelY - (authH > 0 ? authH + gap : 0));
    const panelBounds: UiRect = { x: contentX, y: panelY, width: contentW, height: panelH };
    this.panel.layout(panelBounds);
    if (authH > 0) this.signIn.layout({ x: contentX, y: panelY + panelH + gap, width: contentW, height: authH });

    const inset = Math.max(12, Math.min(22, panelBounds.width * 0.025));
    const inner: UiRect = { x: panelBounds.x + inset, y: panelBounds.y + inset, width: panelBounds.width - inset * 2, height: panelBounds.height - inset * 2 };
    const sectionH = viewport.profile === 'desktop' ? 34 : 28;
    const headerRowH = viewport.profile === 'desktop' ? 34 : 28;
    this.sectionTitle.setPosition(inner.x + inner.width / 2, inner.y + sectionH * 0.46).setFontSize(viewport.profile === 'desktop' ? 20 : 15);

    const headerY = inner.y + sectionH;
    const column = this.columnLayout(inner, viewport);
    const headerFont = viewport.profile === 'desktop' ? 14 : 11;
    this.headerRank.setPosition(column.rank, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerPlayer.setPosition(column.player, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerA.setPosition(column.valueA, headerY + headerRowH / 2).setFontSize(headerFont);
    this.headerB.setPosition(column.valueB, headerY + headerRowH / 2).setFontSize(headerFont);
    this.divider.clear().lineStyle(1, UI_TOKENS.color.gold, 0.5).lineBetween(inner.x, headerY + headerRowH, inner.x + inner.width, headerY + headerRowH);

    const hasPinned = this.pinnedRow !== null;
    const pinnedGap = hasPinned ? gap : 0;
    const pinnedH = hasPinned ? (viewport.profile === 'desktop' ? 54 : 44) : 0;
    const rowsTop = headerY + headerRowH + 4;
    const rowsBottom = inner.y + inner.height - pinnedH - pinnedGap;
    const rowsH = Math.max(0, rowsBottom - rowsTop);
    const rowH = viewport.profile === 'desktop' ? 46 : 38;

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
      .setFontSize(viewport.profile === 'desktop' ? 17 : 13);
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
      this.sectionTitle.setText(this.dailyId ? `Daily · ${this.dailyId}` : 'Daily');
    } else if (this.selected === 'streak') {
      this.headerA.setText(t('Текущая серия'));
      this.headerB.setText(t('Лучшая серия'));
      this.sectionTitle.setText(t('Серия'));
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
      avatarInitial: this.add.text(0, 0, (name[0] ?? '?').toUpperCase(), { color: '#f7ecd6', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(23),
      name: this.add.text(0, 0, name, { color: '#26342f', fontFamily: 'system-ui, sans-serif' }).setOrigin(0, 0.5).setDepth(23),
      valueA: this.add.text(0, 0, values[0], { color: '#26342f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(23),
      valueB: this.add.text(0, 0, values[1], { color: '#26342f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(23),
      pinned,
    };
    if (scrollable && this.scroll) {
      this.scroll.add(row.background);
      this.scroll.add(row.rankBadge);
      this.scroll.add(row.rank);
      this.scroll.add(row.avatar);
      this.scroll.add(row.avatarInitial);
      this.scroll.add(row.name);
      this.scroll.add(row.valueA);
      this.scroll.add(row.valueB);
    }
    return row;
  }

  private layoutRow(row: RowVisual, bounds: UiRect, viewport: ResolvedUiViewport): void {
    const column = this.columnLayout(bounds, viewport);
    const radius = Math.max(6, Math.min(11, bounds.height * 0.22));
    row.background.clear();
    if (row.pinned) {
      row.background.fillStyle(UI_TOKENS.color.goldLight, 0.44).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
      row.background.lineStyle(1, UI_TOKENS.color.gold, 0.8).strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    } else {
      row.background.fillStyle(UI_TOKENS.color.paper, row.entry.rank % 2 === 0 ? 0.16 : 0.05).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    }

    const cy = bounds.y + bounds.height / 2;
    const badgeR = Math.min(bounds.height * 0.28, viewport.profile === 'desktop' ? 14 : 11);
    row.rankBadge.clear();
    if (row.entry.rank <= 3) {
      row.rankBadge.fillStyle(PODIUM_TONES[row.entry.rank - 1]!, 0.95).fillCircle(column.rank, cy, badgeR);
      row.rank.setColor('#fff8e8');
    } else {
      row.rank.setColor('#26342f');
    }
    row.rank.setPosition(column.rank, cy).setFontSize(Math.max(10, Math.min(15, bounds.height * 0.30)));

    const avatarR = Math.min(bounds.height * 0.31, viewport.profile === 'desktop' ? 15 : 12);
    row.avatar.clear().fillStyle(AVATAR_TONES[hashName(row.entry.publicName) % AVATAR_TONES.length]!, 1).fillCircle(column.avatar, cy, avatarR);
    row.avatar.lineStyle(1, UI_TOKENS.color.gold, 0.55).strokeCircle(column.avatar, cy, avatarR);
    row.avatarInitial.setPosition(column.avatar, cy).setFontSize(Math.max(10, avatarR * 0.85));

    const fontSize = Math.max(10, Math.min(viewport.profile === 'desktop' ? 16 : 13, bounds.height * 0.33));
    const nameWidth = Math.max(60, column.valueA - column.player - bounds.width * 0.08);
    row.name.setPosition(column.player, cy).setFontSize(fontSize).setWordWrapWidth(nameWidth, false);
    row.valueA.setPosition(column.valueA, cy).setFontSize(fontSize);
    row.valueB.setPosition(column.valueB, cy).setFontSize(fontSize);
  }

  private setRowVisible(row: RowVisual, visible: boolean): void {
    row.background.setVisible(visible);
    row.rankBadge.setVisible(visible);
    row.rank.setVisible(visible);
    row.avatar.setVisible(visible);
    row.avatarInitial.setVisible(visible);
    row.name.setVisible(visible);
    row.valueA.setVisible(visible);
    row.valueB.setVisible(visible);
  }

  private destroyRow(row: RowVisual): void {
    row.background.destroy(); row.rankBadge.destroy(); row.rank.destroy(); row.avatar.destroy();
    row.avatarInitial.destroy(); row.name.destroy(); row.valueA.destroy(); row.valueB.destroy();
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
  }

  private async refreshRows(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.status?.setText(t('Загрузка…')).setVisible(true);
    this.updateHeaders();
    try {
      const result = await productBridge.loadLeaderboard(this.selected);
      if (!this.isUiSceneActive()) return;
      if (result.status === 'ready') {
        this.rebuildRows(result);
        this.status?.setText(result.entries.length === 0 ? t('Пока нет результатов') : '').setVisible(result.entries.length === 0);
      } else {
        this.clearRows();
        this.status?.setText(result.status === 'unavailable' ? t('Таблица лидеров недоступна') : t('Не удалось загрузить таблицу лидеров')).setVisible(true);
      }
      this.updateSignInState();
      this.requestUiLayout();
    } finally {
      this.loading = false;
    }
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
    this.loading = false; this.authorizing = false;
  }
}
