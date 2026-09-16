import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { getLanguage, t } from '../../localization/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { CoinPill } from '../components/CoinPill.ts';
import { SceneShell } from '../components/SceneShell.ts';
import { IconButton } from '../components/IconButton.ts';
import { ModalShell } from '../components/ModalShell.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { computeCalendarCellBounds, computeDailyLayout, computeMonthNavigationBounds } from '../daily/DailyCalendarLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { getDailyStreaks } from '../../meta/DailyStreak.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';
import type { DailyRecord } from '../../meta/MetaSave.ts';

interface CalendarCell {
  readonly surface: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly dateKey: string | null;
  readonly selectable: boolean;
  hovered: boolean;
  bounds: UiRect | null;
}

type DailyRecordMap = Readonly<Record<string, DailyRecord>>;

const DAY_MS = 86_400_000;
const ARCHIVE_DAYS = 90;

function dateAtOffset(dateKey: string, delta: number): string {
  const timestamp = Date.parse(`${dateKey}T00:00:00Z`) + delta * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function monthAnchor(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function shiftMonth(anchor: string, delta: number): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-01`;
}

function monthCells(anchor: string): readonly (string | null)[] {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: 42 }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells[mondayOffset + day - 1] = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  return cells;
}

function monthLabel(anchor: string): string {
  const locale = getLanguage() === 'ru' ? 'ru-RU' : 'en-US';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${anchor}T12:00:00Z`));
}

function formatTime(ms: number | undefined): string {
  if (!ms) return '—';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatStreakDays(count: number): string {
  if (getLanguage() === 'en') return `${count} ${count === 1 ? 'day' : 'days'}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? 'день'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня'
      : 'дней';
  return `${count} ${noun}`;
}

export class DailyScene extends BaseUiScene {
  private todayKey = '';
  private selectedDateKey = '';
  private visibleMonth = '';
  private shell: SceneShell | null = null;
  private coinPill: CoinPill | null = null;
  private summaryPanel: PaperPanel | null = null;
  private calendarPanel: PaperPanel | null = null;
  private dailyAction: ActionCard | null = null;
  private monthText: Phaser.GameObjects.Text | null = null;
  private summaryDividers: Phaser.GameObjects.Graphics | null = null;
  private summaryRowIconBadges: Phaser.GameObjects.Graphics[] = [];
  private summaryRowIcons: Phaser.GameObjects.Image[] = [];
  private summaryRowLabels: Phaser.GameObjects.Text[] = [];
  private summaryRowValues: Phaser.GameObjects.Text[] = [];
  private previousMonth: IconButton | null = null;
  private nextMonth: IconButton | null = null;
  private readonly cells: CalendarCell[] = [];
  private calendarRecords: DailyRecordMap = {};
  private weekdays: Phaser.GameObjects.Text[] = [];
  private confirmShell: ModalShell | null = null;
  private confirmText: Phaser.GameObjects.Text | null = null;
  private confirmCancel: ActionCard | null = null;
  private confirmStart: ActionCard | null = null;
  private unsubscribeBridge: (() => void) | null = null;

  constructor() { super('DailyScene'); }

  create(): void {
    this.clearDailySceneReferences();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const snapshot = productBridge.snapshot();
    this.todayKey = snapshot.currentDailyId ?? new Date().toISOString().slice(0, 10);
    this.selectedDateKey = snapshot.activeDailyId ?? this.todayKey;
    this.visibleMonth = monthAnchor(this.selectedDateKey);
    const viewport = this.currentUiViewport();

    this.shell = new SceneShell(this, viewport, 'Daily', () => this.scene.start('HomeScene'), 20);
    this.coinPill = new CoinPill(this, 20);
    this.summaryPanel = new PaperPanel(this, { depth: 10 });
    this.calendarPanel = new PaperPanel(this, { depth: 10 });
    this.dailyAction = new ActionCard(this, viewport, { title: t('ИГРАТЬ СЕГОДНЯ'), enabled: true, emphasis: 'highlight' }, () => this.pressSelectedDate(), 20);
    this.monthText = this.add.text(0, 0, monthLabel(this.visibleMonth), { color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
    this.summaryDividers = this.add.graphics().setDepth(20);
    const summaryRows = [
      { icon: UI_ICON_KEYS.fire, label: t('Серия') },
      { icon: UI_ICON_KEYS.trophy, label: t('Официальный рекорд') },
      { icon: UI_ICON_KEYS.crown, label: t('Личный рекорд') },
    ] as const;
    this.summaryRowIconBadges = summaryRows.map(() => this.add.graphics().setDepth(19));
    this.summaryRowIcons = summaryRows.map(row => this.add.image(0, 0, row.icon).setDepth(20));
    this.summaryRowLabels = summaryRows.map(row => this.add.text(0, 0, row.label, {
      color: '#746b58', fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0, 0.5).setDepth(20));
    this.summaryRowValues = summaryRows.map(() => this.add.text(0, 0, '', {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20));
    const weekdayLabels = getLanguage() === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.weekdays = weekdayLabels.map(day => this.add.text(0, 0, day, { fontFamily: 'Georgia, serif', color: '#655a43' }).setOrigin(0.5).setDepth(20));
    this.previousMonth = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.chevronLeft, enabled: true }, () => this.changeMonth(-1), 20);
    this.nextMonth = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.chevronRight, enabled: false }, () => this.changeMonth(1), 20);

    this.renderCalendarGrid(false);
    this.refreshSummary();
    this.unsubscribeBridge = productBridge.subscribe(() => {
      if (!this.isUiSceneActive()) return;
      this.refreshSummary();
      this.renderCalendarGrid(true);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownDailyScene());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.shell || !this.coinPill || !this.summaryPanel || !this.calendarPanel || !this.dailyAction) return;
    const shell = this.shell.layout(viewport);
    const bounds = computeDailyLayout(viewport, shell.content);
    const css = viewport.minTouchTarget / 44;
    this.dailyAction.setViewport(viewport);
    this.previousMonth?.setViewport(viewport);
    this.nextMonth?.setViewport(viewport);
    this.summaryPanel.layout(bounds.summary);
    this.calendarPanel.layout(bounds.calendar);

    const coinWidth = Math.min(shell.rightSlot.width, 150 * viewport.uiScale);
    this.coinPill.layout({ x: shell.rightSlot.x + shell.rightSlot.width - coinWidth, y: shell.rightSlot.y, width: coinWidth, height: shell.rightSlot.height });

    const inner: UiRect = {
      x: bounds.summary.x + bounds.summary.width * 0.07,
      y: bounds.summary.y + bounds.summary.height * 0.06,
      width: bounds.summary.width * 0.86,
      height: bounds.summary.height * 0.88,
    };
    const actionHeight = Math.max(viewport.minTouchTarget, Math.min(inner.height * 0.20, 104 * viewport.uiScale));
    const actionY = inner.y + inner.height - actionHeight;
    const rowsTop = inner.y + inner.height * 0.01;
    const rowsBottom = actionY - inner.height * 0.055;
    const rowHeight = Math.max(1, (rowsBottom - rowsTop) / 3);
    const badgeSize = Math.max(30 * css, Math.min(52 * css, rowHeight * 0.58));
    const iconSize = badgeSize * 0.56;
    const labelSize = Math.max(10 * css, Math.min(13 * css, rowHeight * 0.17));
    const valueSize = Math.max(12 * css, Math.min(18 * css, rowHeight * 0.24));
    const iconX = inner.x + inner.width * 0.06 + badgeSize / 2;
    const textX = inner.x + inner.width * 0.22;
    const textWidth = inner.x + inner.width - textX - inner.width * 0.04;
    this.summaryDividers?.clear();
    for (let index = 0; index < 3; index += 1) {
      const rowY = rowsTop + rowHeight * index;
      const centerY = rowY + rowHeight / 2;
      const badge = this.summaryRowIconBadges[index];
      badge?.clear();
      badge?.fillStyle(UI_TOKENS.color.goldLight, 0.22).fillCircle(iconX, centerY, badgeSize / 2);
      badge?.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.18).strokeCircle(iconX, centerY, badgeSize / 2);
      this.summaryRowIcons[index]?.setDisplaySize(iconSize, iconSize).setPosition(iconX, centerY);
      this.summaryRowLabels[index]?.setFontSize(labelSize).setPosition(textX, centerY - rowHeight * 0.15);
      this.summaryRowValues[index]?.setFontSize(valueSize).setWordWrapWidth(textWidth).setPosition(textX, centerY + rowHeight * 0.15);
      if (index < 2) {
        const dividerY = rowY + rowHeight;
        this.summaryDividers?.lineStyle(Math.max(1, css), UI_TOKENS.color.gold, 0.28)
          .lineBetween(inner.x + inner.width * 0.04, dividerY, inner.x + inner.width * 0.96, dividerY);
      }
    }
    this.dailyAction.layout({ x: inner.x, y: actionY, width: inner.width, height: actionHeight });

    const monthNav = computeMonthNavigationBounds(bounds.calendarHeader, viewport);
    this.previousMonth?.layout(monthNav.previous);
    this.nextMonth?.layout(monthNav.next);
    this.monthText?.setPosition(bounds.calendarHeader.x + bounds.calendarHeader.width / 2, bounds.calendarHeader.y + bounds.calendarHeader.height / 2)
      .setFontSize(Math.max(14, Math.min(24, bounds.calendarHeader.height * 0.32)));

    const cellBounds = computeCalendarCellBounds(bounds.calendarGrid, 42);
    this.weekdays.forEach((text, index) => {
      const cell = cellBounds[index]!;
      text.setPosition(cell.x + cell.width / 2, bounds.calendarGrid.y - 12 * css).setFontSize(12 * css);
    });
    const snapshot = productBridge.snapshot();
    const records = snapshot.state.daily.records;
    this.calendarRecords = records;
    this.cells.forEach((cell, index) => this.layoutCell(cell, cellBounds[index] ?? bounds.calendarGrid, viewport, records));
    this.layoutConfirmation(viewport);
  }

  private createCalendarCells(keys: readonly (string | null)[]): void {
    const oldest = dateAtOffset(this.todayKey, -(ARCHIVE_DAYS - 1));
    for (let index = 0; index < 42; index += 1) {
      const dateKey = keys[index] ?? null;
      const selectable = dateKey !== null && dateKey >= oldest && dateKey <= this.todayKey;
      const surface = this.add.graphics().setDepth(20);
      const label = this.add.text(0, 0, dateKey ? String(Number(dateKey.slice(8, 10))) : '', {
        color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
      const zone = this.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(22).setInteractive();
      zone.input!.cursor = selectable ? 'pointer' : 'default';
      const cell: CalendarCell = { surface, label, zone, dateKey, selectable, hovered: false, bounds: null };
      zone.on('pointerover', () => {
        if (!cell.selectable) return;
        cell.hovered = true;
        this.redrawCell(cell);
      });
      zone.on('pointerout', () => {
        if (!cell.hovered) return;
        cell.hovered = false;
        this.redrawCell(cell);
      });
      zone.on('pointerdown', () => {
        if (cell.selectable && cell.dateKey) { playUiButtonSound(this); this.selectDate(cell.dateKey); }
      });
      this.cells.push(cell);
    }
  }

  private destroyCalendarCells(): void {
    for (const cell of this.cells) {
      cell.zone.removeAllListeners();
      cell.zone.destroy();
      cell.label.destroy();
      cell.surface.destroy();
    }
    this.cells.length = 0;
  }

  private renderCalendarGrid(requestLayout: boolean): void {
    this.destroyCalendarCells();
    this.createCalendarCells(monthCells(this.visibleMonth));
    this.monthText?.setText(monthLabel(this.visibleMonth));
    const oldest = dateAtOffset(this.todayKey, -(ARCHIVE_DAYS - 1));
    const previous = shiftMonth(this.visibleMonth, -1);
    const next = shiftMonth(this.visibleMonth, 1);
    this.previousMonth?.setState({ iconKey: UI_ICON_KEYS.chevronLeft, enabled: previous.slice(0, 7) >= oldest.slice(0, 7) });
    this.nextMonth?.setState({ iconKey: UI_ICON_KEYS.chevronRight, enabled: next.slice(0, 7) <= this.todayKey.slice(0, 7) });
    if (requestLayout) this.requestUiLayout();
  }

  private layoutCell(cell: CalendarCell, bounds: UiRect, viewport: ResolvedUiViewport, records: DailyRecordMap): void {
    cell.bounds = bounds;
    const record = cell.dateKey ? records[cell.dateKey] : undefined;
    const selected = cell.dateKey === this.selectedDateKey;
    const hovered = cell.hovered && cell.selectable && !selected;
    const today = cell.dateKey === this.todayKey;
    const fill = selected ? UI_TOKENS.color.control
      : today ? UI_TOKENS.color.paperPressed
        : record?.completedOnTime ? 0xb9cba8
          : record?.completed ? 0xb9c4c9
            : UI_TOKENS.color.paper;
    const alpha = cell.dateKey ? (cell.selectable ? (hovered ? 1 : 0.94) : 0.55) : 0;
    cell.surface.clear();
    if (cell.dateKey) {
      cell.surface.fillStyle(fill, alpha).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.16));
      cell.surface.lineStyle(selected ? 3 : hovered ? 2 : 1, selected || hovered ? UI_TOKENS.color.gold : UI_TOKENS.color.mutedInk, selected ? 1 : hovered ? 0.82 : 0.35)
        .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.16));
    }
    cell.label.setColor(selected ? '#fff2d4' : '#24302e').setVisible(Boolean(cell.dateKey)).setAlpha(alpha).setScale(hovered ? 1.04 : 1)
      .setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      .setFontSize(Math.max(10 * viewport.minTouchTarget / 44, Math.min(18 * viewport.minTouchTarget / 44, bounds.height * 0.30)));
    const hitHeight = Math.max(bounds.height, viewport.minTouchTarget);
    cell.zone.setPosition(bounds.x, bounds.y - (hitHeight - bounds.height) / 2).setSize(bounds.width, hitHeight);
  }

  private redrawCell(cell: CalendarCell): void {
    if (!cell.bounds) return;
    this.layoutCell(cell, cell.bounds, this.currentUiViewport(), this.calendarRecords);
  }

  private selectDate(dateKey: string): void {
    this.selectedDateKey = dateKey;
    this.refreshSummary();
    this.renderCalendarGrid(true);
  }

  private refreshSummary(): void {
    const snapshot = productBridge.snapshot();
    this.calendarRecords = snapshot.state.daily.records;
    const record = this.calendarRecords[this.selectedDateKey];
    const active = snapshot.activeDailyId === this.selectedDateKey;
    const completed = record?.completed === true;
    const isToday = this.selectedDateKey === this.todayKey;
    const rankingInProgress = isToday
      && active
      && completed !== true
      && record?.rankingAttemptId !== undefined
      && record.attempts === 1;
    const rankingLocked = isToday
      && !rankingInProgress
      && (record?.rankingAttemptId !== undefined || completed);
    const title = active ? t('ПРОДОЛЖИТЬ')
      : completed ? t('ПОВТОРИТЬ')
        : isToday ? t('ИГРАТЬ СЕГОДНЯ') : t('ИГРАТЬ ИЗ АРХИВА');
    const firstReward = completed ? 0 : isToday ? 15 : 5;
    const reward = firstReward > 0 ? ` · +${firstReward} ${t('монет')}` : '';
    const rankingNote = isToday
      ? rankingLocked ? ` · ${t('Без изменения рейтинга')}` : ` · ${t('Первая попытка идёт в рейтинг')}`
      : '';
    this.dailyAction?.setState({ title, subtitle: `${this.selectedDateKey}${reward}${rankingNote}`, emphasis: 'highlight', enabled: true });

    const streak = getDailyStreaks(snapshot.state.daily.records, this.todayKey);
    this.summaryRowLabels[0]?.setText(t('Серия'));
    this.summaryRowLabels[1]?.setText(t('Официальный рекорд'));
    this.summaryRowLabels[2]?.setText(t('Личный рекорд'));
    this.summaryRowValues[0]?.setText(`${formatStreakDays(streak.current)} · ${t('Лучшее')} ${streak.best}`);
    const officialRecord = record?.bestMoves !== undefined && record.bestMovesTimeMs !== undefined
      ? `${record.bestMoves} ${getLanguage() === 'en' ? 'moves' : 'ходов'} · ${formatTime(record.bestMovesTimeMs)}`
      : rankingLocked ? t('Рейтинговая попытка использована')
        : t('Ещё не пройдено');
    this.summaryRowValues[1]?.setText(officialRecord);
    const hintRemaining = record?.hintUsed ? 0 : 1;
    const personalRecord = record?.bestTimeMs !== undefined ? formatTime(record.bestTimeMs) : t('Ещё не пройдено');
    this.summaryRowValues[2]?.setText(`${personalRecord} · ${t('Подсказка')} ${hintRemaining}/1`);
    this.coinPill?.setCoins(snapshot.state.progression.coins);
  }

  private pressSelectedDate(): void {
    const snapshot = productBridge.snapshot();
    if (snapshot.activeDailyId === this.selectedDateKey) {
      productBridge.resumeGame();
      return;
    }
    if (snapshot.activeDailyId && snapshot.activeDailyId !== this.selectedDateKey) {
      this.confirmReplacement();
      return;
    }
    productBridge.startDaily(this.selectedDateKey);
  }

  private confirmReplacement(): void {
    if (this.confirmShell) return;
    const viewport = this.currentUiViewport();
    const snapshot = productBridge.snapshot();
    const activeRecord = snapshot.activeDailyId ? snapshot.state.daily.records[snapshot.activeDailyId] : undefined;
    const forfeitsRanking = snapshot.activeDailyId === this.todayKey
      && activeRecord?.completed !== true
      && activeRecord?.rankingAttemptId !== undefined
      && activeRecord.attempts === 1;
    this.confirmShell = new ModalShell(this, t('Начать другую Daily-раздачу?'), () => this.closeConfirmation(), 5000);
    this.confirmText = this.add.text(0, 0, forfeitsRanking
      ? t('Рейтинговая попытка будет завершена. Повторные попытки сегодня не изменят место в таблице.')
      : t('Текущая Daily-партия будет завершена.'), {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center', wordWrap: { width: viewport.width * 0.5 },
    }).setOrigin(0.5).setDepth(5002);
    this.confirmCancel = new ActionCard(this, viewport, { title: t('ОТМЕНА'), enabled: true }, () => this.closeConfirmation(), 5002);
    this.confirmStart = new ActionCard(this, viewport, { title: t('ИГРАТЬ'), enabled: true, emphasis: 'highlight' }, () => {
      const dateKey = this.selectedDateKey;
      this.closeConfirmation();
      productBridge.startDaily(dateKey);
    }, 5002);
    this.layoutConfirmation(viewport);
  }

  private closeConfirmation(): void {
    this.confirmShell?.destroy();
    this.confirmText?.destroy();
    this.confirmCancel?.destroy();
    this.confirmStart?.destroy();
    this.confirmShell = null;
    this.confirmText = null;
    this.confirmCancel = null;
    this.confirmStart = null;
  }

  private layoutConfirmation(viewport: ResolvedUiViewport): void {
    if (!this.confirmShell || !this.confirmText || !this.confirmCancel || !this.confirmStart) return;
    this.confirmCancel.setViewport(viewport);
    this.confirmStart.setViewport(viewport);
    const width = Math.min(viewport.width * 0.64, 680 * viewport.uiScale);
    const height = Math.min(viewport.height * 0.62, 300 * viewport.uiScale);
    const bounds = { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height };
    this.confirmShell.layout(viewport.width, viewport.height, bounds);
    this.confirmText.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.45).setWordWrapWidth(bounds.width * 0.8)
      .setFontSize(Math.max(12, Math.min(19, height * 0.06)));
    const gap = 10 * viewport.uiScale;
    const buttonWidth = (bounds.width * 0.80 - gap) / 2;
    const buttonHeight = Math.max(viewport.minTouchTarget, bounds.height * 0.18);
    const x = bounds.x + bounds.width * 0.10;
    const y = bounds.y + bounds.height - buttonHeight - bounds.height * 0.09;
    this.confirmCancel.layout({ x, y, width: buttonWidth, height: buttonHeight });
    this.confirmStart.layout({ x: x + buttonWidth + gap, y, width: buttonWidth, height: buttonHeight });
  }

  private changeMonth(delta: number): void {
    const next = shiftMonth(this.visibleMonth, delta);
    const oldest = dateAtOffset(this.todayKey, -(ARCHIVE_DAYS - 1));
    if (next.slice(0, 7) < oldest.slice(0, 7) || next.slice(0, 7) > this.todayKey.slice(0, 7)) return;
    this.visibleMonth = next;
    this.renderCalendarGrid(true);
  }

  private clearDailySceneReferences(): void {
    this.shell = null;
    this.coinPill = null;
    this.summaryPanel = null;
    this.calendarPanel = null;
    this.dailyAction = null;
    this.monthText = null;
    this.summaryDividers = null;
    this.summaryRowIconBadges = [];
    this.summaryRowIcons = [];
    this.summaryRowLabels = [];
    this.summaryRowValues = [];
    this.previousMonth = null;
    this.nextMonth = null;
    this.calendarRecords = {};
    this.weekdays = [];
    this.confirmShell = null;
    this.confirmText = null;
    this.confirmCancel = null;
    this.confirmStart = null;
  }

  private shutdownDailyScene(): void {
    this.shell?.destroy();
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = null;
    this.destroyCalendarCells();
    this.closeConfirmation();
    this.clearDailySceneReferences();
  }
}
