import { GameSession } from './GameSession.ts';
import type { Deal, GameMode } from './types.ts';

export type GameFlowState = 'menu-required' | 'menu-paused' | 'playing';

export class GameFlow {
  private readonly session: GameSession;
  private flowState: GameFlowState = 'menu-required';
  private pendingMode: GameMode | null = null;

  constructor(session = new GameSession()) {
    this.session = session;
  }

  get state(): GameFlowState {
    return this.flowState;
  }

  get currentDeal(): Deal | null {
    return this.session.currentDeal;
  }

  get selectedMode(): GameMode | null {
    return this.pendingMode;
  }

  get canCancelMenu(): boolean {
    return this.flowState === 'menu-paused';
  }

  selectMenuMode(mode: GameMode): void {
    if (this.flowState === 'playing') {
      throw new Error('Cannot select a game mode while the main menu is closed.');
    }

    this.pendingMode = mode;
  }

  playSelectedMode(dailySeed?: bigint): Deal {
    if (this.flowState === 'playing') {
      throw new Error('Cannot start from the main menu while gameplay is active.');
    }

    if (this.pendingMode === null) {
      throw new Error('Select a game mode before playing.');
    }

    const deal = this.pendingMode === 'daily'
      ? this.session.startDaily(
          dailySeed ?? (() => { throw new Error('Daily seed is required.'); })(),
        )
      : this.session.startNew(this.pendingMode);
    this.flowState = 'playing';
    return deal;
  }

  startNewInCurrentMode(): Deal {
    if (this.flowState !== 'playing' || this.session.currentDeal === null) {
      throw new Error('Cannot start a new game without an active deal.');
    }

    const deal = this.session.currentDeal.mode === 'daily'
      ? this.session.restart()
      : this.session.startNew(this.session.currentDeal.mode);
    this.pendingMode = deal.mode;
    return deal;
  }

  openMainMenu(): boolean {
    if (this.flowState !== 'playing' || this.session.currentDeal === null) {
      return false;
    }

    this.pendingMode = this.session.currentDeal.mode;
    this.flowState = 'menu-paused';
    return true;
  }

  cancelMenu(): boolean {
    if (this.flowState !== 'menu-paused') {
      return false;
    }

    this.pendingMode = this.session.currentDeal?.mode ?? this.pendingMode;
    this.flowState = 'playing';
    return true;
  }

  restart(): Deal {
    if (this.flowState !== 'playing') {
      throw new Error('Cannot restart while the main menu is open.');
    }

    return this.session.restart();
  }
}
