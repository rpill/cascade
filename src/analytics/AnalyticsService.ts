export type AnalyticsPrimitive = string | number | boolean;
export type AnalyticsParams = Readonly<Record<string, AnalyticsPrimitive | null | undefined>>;
export type SanitizedAnalyticsParams = Readonly<Record<string, AnalyticsPrimitive>>;

export const ANALYTICS_GOALS = [
  'tutorial_complete',
  'game_win',
  'daily_complete',
] as const;

export type AnalyticsGoal = typeof ANALYTICS_GOALS[number];

export const ANALYTICS_EVENTS = [
  'game_start',
  'daily_start',
  'game_abandon',
  'new_deal',
  'tutorial_start',
  'fullscreen_requested',
  'fullscreen_shown',
  'fullscreen_not_shown',
] as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

export interface AnalyticsTransport {
  reachGoal(name: AnalyticsGoal, params: SanitizedAnalyticsParams): void;
  event(name: AnalyticsEvent, params: SanitizedAnalyticsParams): void;
}

export interface AnalyticsClient {
  event(name: AnalyticsEvent, params?: AnalyticsParams): void;
  goal(name: AnalyticsGoal, params?: AnalyticsParams): void;
}

const NOOP_TRANSPORT: AnalyticsTransport = {
  reachGoal: () => undefined,
  event: () => undefined,
};

function sanitizeParams(params: AnalyticsParams | undefined): SanitizedAnalyticsParams {
  if (params === undefined) return {};

  const sanitized: Record<string, AnalyticsPrimitive> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) sanitized[key] = value;
      continue;
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AnalyticsService implements AnalyticsClient {
  private transport: AnalyticsTransport;

  constructor(transport: AnalyticsTransport = NOOP_TRANSPORT) {
    this.transport = transport;
  }

  setTransport(transport: AnalyticsTransport): void {
    this.transport = transport;
  }

  event(name: AnalyticsEvent, params?: AnalyticsParams): void {
    try {
      this.transport.event(name, sanitizeParams(params));
    } catch {
      // Analytics is optional telemetry and must never affect gameplay.
    }
  }

  goal(name: AnalyticsGoal, params?: AnalyticsParams): void {
    try {
      this.transport.reachGoal(name, sanitizeParams(params));
    } catch {
      // Analytics is optional telemetry and must never affect gameplay.
    }
  }
}

export const analytics = new AnalyticsService();
