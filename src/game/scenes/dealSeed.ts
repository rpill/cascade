export function createNextDealSeed(
  currentSeed: number,
  proposedSeed: number,
): number {
  const normalizedCurrent = currentSeed >>> 0;
  const normalizedProposed = proposedSeed >>> 0;

  return normalizedProposed === normalizedCurrent
    ? (normalizedProposed + 1) >>> 0
    : normalizedProposed;
}
