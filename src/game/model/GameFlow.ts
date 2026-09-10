import { GameSession } from './GameSession.ts';
import type { Deal, GameMode } from './types.ts';

export type GameFlowState = 'menu-required' | 'menu-paused' | 'playing';

export class GameFlow {
  private readonly session: GameSession;
  private flowState: GameFlowState = 'menu-required';
  private pendingMode: GameMode | null = null;

  constructor(session: GameSession) {
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

  playSelectedMode(verifiedSeed?: bigint): Deal {
    if (this.flowState === 'playing') {
      throw new Error('Cannot start from the main menu while gameplay is active.');
    }
    if (this.pendingMode === null) {
      throw new Error('Select a game mode before playing.');
    }

    let deal: Deal;
    if (this.pendingMode === 'original') {
      deal = this.session.startOriginal();
    } else if (this.pendingMode === 'winnable') {
      if (verifiedSeed === undefined) throw new Error('Standard seed is required.');
      deal = this.session.startStandard(verifiedSeed);
    } else {
      if (verifiedSeed === undefined) throw new Error('Daily seed is required.');
      deal = this.session.startDaily(verifiedSeed);
    }

    this.flowState = 'playing';
    return deal;
  }

  resume(deal: Deal, state: 'playing' | 'menu-paused'): Deal {
    if (state !== 'playing' && state !== 'menu-paused') {
      throw new Error('Resume state must be playing or menu-paused.');
    }

    const resumed = this.session.resume(deal);
    this.pendingMode = resumed.mode;
    this.flowState = state;
    return resumed;
  }

  startNewInCurrentMode(standardSeed?: bigint): Deal {
    if (this.flowState !== 'playing' || this.session.currentDeal === null) {
      throw new Error('Cannot start a new game without an active deal.');
    }

    let deal: Deal;
    if (this.session.currentDeal.mode === 'daily') {
      deal = this.session.restart();
    } else if (this.session.currentDeal.mode === 'winnable') {
      if (standardSeed === undefined) throw new Error('Standard seed is required.');
      deal = this.session.startStandard(standardSeed);
    } else {
      deal = this.session.startOriginal();
    }
    this.pendingMode = deal.mode;
    return deal;
  }

  openMainMenu(): boolean {
    if (this.flowState !== 'playing' || this.session.currentDeal === null) return false;
    this.pendingMode = this.session.currentDeal.mode;
    this.flowState = 'menu-paused';
    return true;
  }

  cancelMenu(): boolean {
    if (this.flowState !== 'menu-paused') return false;
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
