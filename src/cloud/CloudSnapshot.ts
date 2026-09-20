import { normalizeMetaSave, type MetaSave } from '../meta/MetaSave.ts';
import { normalizeActiveGameSave, type ActiveGameSaveV2 } from '../persistence/ActiveGameSave.ts';

export const CLOUD_SNAPSHOT_VERSION = 1 as const;

export interface CloudActiveGameCheckpoint {
  readonly save: ActiveGameSaveV2;
  readonly updatedAtMs: number;
}

export interface CloudSnapshot {
  readonly schemaVersion: typeof CLOUD_SNAPSHOT_VERSION;
  readonly meta: MetaSave;
  readonly activeGame?: CloudActiveGameCheckpoint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeCloudSnapshot(raw: unknown): CloudSnapshot | null {
  if (!isRecord(raw) || raw.schemaVersion !== CLOUD_SNAPSHOT_VERSION) return null;
  const meta = normalizeMetaSave(raw.meta);
  if (raw.activeGame === undefined) return { schemaVersion: CLOUD_SNAPSHOT_VERSION, meta };
  if (!isRecord(raw.activeGame)) return null;

  const save = normalizeActiveGameSave(raw.activeGame.save);
  const updatedAtMs = raw.activeGame.updatedAtMs;
  if (save === null || !Number.isSafeInteger(updatedAtMs) || (updatedAtMs as number) < 0) return null;

  return {
    schemaVersion: CLOUD_SNAPSHOT_VERSION,
    meta,
    activeGame: { save, updatedAtMs: updatedAtMs as number },
  };
}
