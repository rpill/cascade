import type { GameMode } from '../../game/model/types.ts';
import type { MetaSave, StandardDifficulty } from '../../meta/MetaSave.ts';
import type { Language } from '../../settings/Preferences.ts';
import type { ThemeProduct } from '../../theme/ThemeCatalog.ts';
import type { LeaderboardLoadResult } from '../../leaderboards/LeaderboardService.ts';
import type { GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';

export interface CascadeProductSnapshot {
  readonly state: MetaSave;
  readonly activeMode: GameMode | null;
  readonly activeDifficulty: StandardDifficulty | null;
  readonly currentDailyId: string | null;
  readonly activeDailyId: string | null;
  readonly leaderboardsEnabled: boolean;
  readonly themesTotal: number;
}

export interface CascadeThemeCard extends ThemeProduct {
  readonly owned: boolean;
  readonly equipped: boolean;
}

export interface CascadeThemesSnapshot {
  readonly cards: readonly CascadeThemeCard[];
  readonly coins: number;
  readonly ready: boolean;
  readonly busyId: string | null;
  readonly rewardedAvailable: boolean;
  readonly rewardedBusy: boolean;
  readonly rewardedRemaining: number;
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
  readonly themesSnapshot: () => CascadeThemesSnapshot;
  readonly buyTheme: (themeId: string) => void;
  readonly equipTheme: (themeId: string) => Promise<void>;
  readonly rewardedCoins: () => Promise<void>;
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
  themesSnapshot(): CascadeThemesSnapshot { return requireHandlers().themesSnapshot(); },
  buyTheme(themeId: string): void { requireHandlers().buyTheme(themeId); },
  equipTheme(themeId: string): Promise<void> { return requireHandlers().equipTheme(themeId); },
  rewardedCoins(): Promise<void> { return requireHandlers().rewardedCoins(); },
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
