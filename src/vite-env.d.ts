/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM_TARGET?: 'yandex' | 'pikabu';
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
