export interface PlayerStorage {
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock {
  nowMs(): number | null;
}

export interface PlatformServices {
  readonly playerStorage: PlayerStorage;
  readonly trustedClock: TrustedClock;
  readonly ready: () => void;
}

class MemoryPlayerStorage implements PlayerStorage {
  private data: Record<string, unknown> = {};

  async load(): Promise<unknown> {
    return structuredClone(this.data);
  }

  async save(data: Record<string, unknown>): Promise<void> {
    this.data = structuredClone(data);
  }
}

export function createUnavailablePlatformServices(): PlatformServices {
  return {
    playerStorage: new MemoryPlayerStorage(),
    trustedClock: { nowMs: () => null },
    ready: () => undefined,
  };
}
