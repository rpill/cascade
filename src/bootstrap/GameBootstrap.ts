export interface HostSize {
  readonly width: number;
  readonly height: number;
}

export type ReadHostSize = () => HostSize;
export type WaitForNextMeasurement = () => Promise<void>;

function normalizeSize(size: HostSize): HostSize {
  return {
    width: Math.max(0, Math.floor(Number.isFinite(size.width) ? size.width : 0)),
    height: Math.max(0, Math.floor(Number.isFinite(size.height) ? size.height : 0)),
  };
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function waitForUsableHostSize(
  readSize: ReadHostSize,
  waitForNextMeasurement: WaitForNextMeasurement = waitForAnimationFrame,
): Promise<HostSize> {
  for (;;) {
    const size = normalizeSize(readSize());
    if (size.width > 0 && size.height > 0) {
      return size;
    }
    await waitForNextMeasurement();
  }
}

export async function startWhenHostReady<T>(
  readSize: ReadHostSize,
  createGame: (size: HostSize) => T,
  waitForNextMeasurement?: WaitForNextMeasurement,
): Promise<T> {
  const size = await waitForUsableHostSize(readSize, waitForNextMeasurement);
  return createGame(size);
}
