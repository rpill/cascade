/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM_TARGET?: 'yandex' | 'pikabu';
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_GAMEPUSH_PROJECT_ID?: string;
  readonly VITE_GAMEPUSH_PUBLIC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
