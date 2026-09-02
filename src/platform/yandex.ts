declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<{
        features?: {
          LoadingAPI?: {
            ready: () => void;
          };
        };
      }>;
    };
  }
}

export async function notifyPlatformReady(): Promise<void> {
  try {
    const sdk = await window.YaGames?.init();
    sdk?.features?.LoadingAPI?.ready();
  } catch {
    // The local preview and other portals do not provide the Yandex SDK.
  }
}
