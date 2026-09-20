import type { PlatformServices } from './services.ts';
import { initializePlatform as initializeYandexPlatform } from './yandex.ts';
import { initializePikabuPlatform } from './pikabu.ts';

let selectedPlatform: Promise<PlatformServices> | null = null;

export function initializePlatform(): Promise<PlatformServices> {
  if (selectedPlatform !== null) return selectedPlatform;
  const target = import.meta.env.VITE_PLATFORM_TARGET?.trim().toLowerCase();
  selectedPlatform = target === 'pikabu'
    ? initializePikabuPlatform()
    : initializeYandexPlatform();
  return selectedPlatform;
}
