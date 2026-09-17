import type { GameMode } from '../../game/model/types.ts';
import type { MetaSave, StandardDifficulty } from '../../meta/MetaSave.ts';
import type { Language } from '../../settings/Preferences.ts';
import type { LeaderboardLoadResult } from '../../leaderboards/LeaderboardService.ts';
import type { GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';

export interface CascadeProductSnapshot {
  readonly state: MetaSave;
  readonly activeMode: GameMode | null;
  readonly activeDifficulty: StandardDifficulty | null;
  readonly currentDailyId: string | null;
  readonly activeDailyId: string | null;
  readonly leaderboardsEnabled: boolean;
}

export interface CascadeLeaderboardSnapshot {
  readonly available: boolean;
  readonly authorized: boolean;
  readonly authorizationAllowed: boolean;
  readonly authPending: boolean;
}

export interface CascadeSettingsSnapshot {
  readonly soundEnabled: boolean;
  readonly language: Language;
}

export interface CascadeProductHandlers {
  readonly snapshot: () => CascadeProductSnapshot;
  readonly resumeGame: () => void;
  readonly startStandard: (difficulty: StandardDifficulty) => void;
  readonly setStandardDifficulty: (difficulty: StandardDifficulty) => void;
  readonly startDaily: (dailyId?: string) => void;
  readonly leaderboardSnapshot: () => CascadeLeaderboardSnapshot;
  readonly loadLeaderboard: (mode: GlobalLeaderboardMode) => Promise<LeaderboardLoadResult>;
  readonly authorizeLeaderboard: () => Promise<boolean>;
  readonly settingsSnapshot: () => CascadeSettingsSnapshot;
  readonly setSoundEnabled: (enabled: boolean) => void;
  readonly setLanguage: (language: Language) => void;
  readonly closeHowToPlay: (onboarding: boolean) => void;
}

type Subscriber = () => void;
let handlers: CascadeProductHandlers | null = null;
const subscribers = new Set<Subscriber>();

function requireHandlers(): CascadeProductHandlers {
  if (!handlers) throw new Error('Cascade product bridge is not installed.');
  return handlers;
}

export const productBridge = {
  install(next: CascadeProductHandlers): void { handlers = next; this.notify(); },
  uninstall(next?: CascadeProductHandlers): void { if (!next || handlers === next) handlers = null; },
  snapshot(): CascadeProductSnapshot { return requireHandlers().snapshot(); },
  resumeGame(): void { requireHandlers().resumeGame(); },
  startStandard(difficulty: StandardDifficulty): void { requireHandlers().startStandard(difficulty); },
  setStandardDifficulty(difficulty: StandardDifficulty): void { requireHandlers().setStandardDifficulty(difficulty); },
  startDaily(dailyId?: string): void { requireHandlers().startDaily(dailyId); },
  leaderboardSnapshot(): CascadeLeaderboardSnapshot { return requireHandlers().leaderboardSnapshot(); },
  loadLeaderboard(mode: GlobalLeaderboardMode): Promise<LeaderboardLoadResult> { return requireHandlers().loadLeaderboard(mode); },
  authorizeLeaderboard(): Promise<boolean> { return requireHandlers().authorizeLeaderboard(); },
  settingsSnapshot(): CascadeSettingsSnapshot { return requireHandlers().settingsSnapshot(); },
  setSoundEnabled(enabled: boolean): void { requireHandlers().setSoundEnabled(enabled); this.notify(); },
  setLanguage(language: Language): void { requireHandlers().setLanguage(language); this.notify(); },
  closeHowToPlay(onboarding: boolean): void { requireHandlers().closeHowToPlay(onboarding); },
  subscribe(listener: Subscriber): () => void { subscribers.add(listener); return () => subscribers.delete(listener); },
  notify(): void { for (const listener of [...subscribers]) listener(); },
};
