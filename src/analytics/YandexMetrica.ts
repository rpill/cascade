import {
  analytics,
  type AnalyticsEvent,
  type AnalyticsGoal,
  type AnalyticsTransport,
  type SanitizedAnalyticsParams,
} from './AnalyticsService.ts';

export const METRICA_COUNTER_ID = 112502032;
const METRICA_SCRIPT_URL = `https://mc.yandex.ru/metrika/tag.js?id=${METRICA_COUNTER_ID}`;

interface MetricaFunction {
  (...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
}

declare global {
  interface Window {
    ym?: MetricaFunction;
    __cascadeMetricaInitialized?: boolean;
  }
}

class YandexMetricaTransport implements AnalyticsTransport {
  reachGoal(name: AnalyticsGoal, params: SanitizedAnalyticsParams): void {
    try {
      window.ym?.(METRICA_COUNTER_ID, 'reachGoal', name, params);
    } catch {
      // Metrica may be blocked by the browser/ad blocker; gameplay continues.
    }
  }

  event(name: AnalyticsEvent, params: SanitizedAnalyticsParams): void {
    try {
      window.ym?.(METRICA_COUNTER_ID, 'params', {
        cascade_event: {
          schema_version: 1,
          name,
          ...params,
        },
      });
    } catch {
      // Metrica may be blocked by the browser/ad blocker; gameplay continues.
    }
  }
}

function ensureMetricaQueue(): MetricaFunction {
  if (window.ym !== undefined) return window.ym;

  const queued: MetricaFunction = (...args: unknown[]) => {
    (queued.a ??= []).push(args);
  };
  queued.l = Date.now();
  window.ym = queued;
  return queued;
}

function ensureMetricaScript(): void {
  const alreadyPresent = Array.from(document.scripts).some((script) => script.src === METRICA_SCRIPT_URL);
  if (alreadyPresent) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = METRICA_SCRIPT_URL;
  document.head.appendChild(script);
}

export function initializeYandexMetrica(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const ym = ensureMetricaQueue();
  ensureMetricaScript();
  analytics.setTransport(new YandexMetricaTransport());

  if (window.__cascadeMetricaInitialized) return;
  window.__cascadeMetricaInitialized = true;

  ym(METRICA_COUNTER_ID, 'init', {
    ssr: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  });
}
