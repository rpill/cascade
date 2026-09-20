import type { CloudProfileService, CloudProfileSaveResult } from '../backend/CloudProfileService.ts';
import type { BackendIdentityProvider } from '../platform/services.ts';
import { mergeCloudSnapshots } from './CloudMerge.ts';
import type { CloudSnapshot } from './CloudSnapshot.ts';
import type { CloudSyncState, CloudSyncStateStore, PendingProfileOperation } from './CloudSyncState.ts';

export interface CloudSyncLocalPort {
  readSnapshot(): CloudSnapshot;
  applySnapshot(snapshot: CloudSnapshot): Promise<boolean>;
  todayId(): string;
}

export type CloudSyncReason = 'startup' | 'authorization' | 'online' | 'game-complete' | 'home';
export type CloudSyncResult = 'synced' | 'guest' | 'offline' | 'pending';

export interface CloudSyncCoordinatorOptions {
  readonly identity: BackendIdentityProvider;
  readonly profiles: CloudProfileService;
  readonly local: CloudSyncLocalPort;
  readonly stateStoreFactory: (provider: string, localIdentityKey: string) => CloudSyncStateStore;
  readonly nowMs?: () => number;
  readonly random?: () => number;
}

const MAX_SAVE_ATTEMPTS = 3;
const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

function createOperationId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') throw new Error('Secure random UUID generation is unavailable.');
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function snapshotsEqual(left: CloudSnapshot, right: CloudSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class CloudSyncCoordinator {
  private readonly identity: BackendIdentityProvider;
  private readonly profiles: CloudProfileService;
  private readonly local: CloudSyncLocalPort;
  private readonly stateStoreFactory: (provider: string, localIdentityKey: string) => CloudSyncStateStore;
  private readonly nowMs: () => number;
  private readonly random: () => number;
  private inFlight: Promise<CloudSyncResult> | null = null;
  private disposed = false;
  private readonly onlineHandler: (() => void) | null;

  constructor(options: CloudSyncCoordinatorOptions) {
    this.identity = options.identity;
    this.profiles = options.profiles;
    this.local = options.local;
    this.stateStoreFactory = options.stateStoreFactory;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.random = options.random ?? Math.random;

    const target = globalThis as typeof globalThis & {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };
    if (typeof target.addEventListener === 'function') {
      this.onlineHandler = () => { void this.retryPending(); };
      target.addEventListener('online', this.onlineHandler);
    } else {
      this.onlineHandler = null;
    }
  }

  sync(reason: CloudSyncReason): Promise<CloudSyncResult> {
    if (this.disposed) return Promise.resolve('pending');
    if (this.inFlight !== null) return this.inFlight;
    const active = this.runSync(reason).finally(() => {
      if (this.inFlight === active) this.inFlight = null;
    });
    this.inFlight = active;
    return active;
  }

  async retryPending(): Promise<void> {
    await this.sync('online');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.onlineHandler !== null) {
      const target = globalThis as typeof globalThis & { removeEventListener?: (type: string, listener: () => void) => void };
      target.removeEventListener?.('online', this.onlineHandler);
    }
  }

  private async runSync(_reason: CloudSyncReason): Promise<CloudSyncResult> {
    if (!this.identity.isAuthorized()) return 'guest';
    const localIdentityKey = this.identity.localIdentityKey();
    if (localIdentityKey === null) return 'guest';

    let assertion;
    try {
      assertion = await this.identity.getAssertion();
    } catch {
      return 'offline';
    }
    if (assertion === null) return 'guest';

    const store = this.stateStoreFactory(assertion.provider, localIdentityKey);
    let state = store.load();
    const now = this.nowMs();
    if (state.nextRetryAtMs !== undefined && now < state.nextRetryAtMs) return 'pending';

    if (state.pendingProfile !== null) {
      return this.replayPending(store, state);
    }

    const originalLocal = this.local.readSnapshot();
    const originalBase = state.base;
    let remote;
    try {
      remote = await this.profiles.load();
    } catch {
      this.persistTransportFailure(store, state);
      return 'offline';
    }

    let merged = mergeCloudSnapshots({
      base: originalBase,
      local: originalLocal,
      cloud: remote.profile,
      todayId: this.local.todayId(),
    });
    await this.local.applySnapshot(merged);

    let operation: PendingProfileOperation = this.createProfileOperation(remote.revision, merged);
    state = { ...state, pendingProfile: operation };
    store.save(state);

    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
      let result: CloudProfileSaveResult;
      try {
        result = await this.profiles.save(operation);
      } catch {
        this.persistTransportFailure(store, { ...store.load(), pendingProfile: operation });
        return 'offline';
      }

      if (result.status === 'saved') {
        return this.acceptSaved(store, store.load(), operation, result);
      }

      // The stale idempotent operation has been consumed. A retry against a new
      // revision must use a new operation id so the server treats it as new work.
      state = { ...store.load(), pendingProfile: null };
      store.save(state);

      let latest;
      try {
        latest = await this.profiles.load();
      } catch {
        this.persistTransportFailure(store, state);
        return 'offline';
      }

      merged = mergeCloudSnapshots({
        base: originalBase,
        local: originalLocal,
        cloud: latest.profile,
        todayId: this.local.todayId(),
      });
      await this.local.applySnapshot(merged);
      operation = this.createProfileOperation(latest.revision, merged);
      state = { ...store.load(), pendingProfile: operation };
      store.save(state);
    }

    return 'pending';
  }

  private async replayPending(store: CloudSyncStateStore, state: CloudSyncState): Promise<CloudSyncResult> {
    let operation = state.pendingProfile!;
    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
      let result: CloudProfileSaveResult;
      try {
        result = await this.profiles.save(operation);
      } catch {
        this.persistTransportFailure(store, { ...store.load(), pendingProfile: operation });
        return 'offline';
      }

      if (result.status === 'saved') {
        return this.acceptSaved(store, store.load(), operation, result);
      }

      let nextState: CloudSyncState = { ...store.load(), pendingProfile: null };
      store.save(nextState);
      let latest;
      try {
        latest = await this.profiles.load();
      } catch {
        this.persistTransportFailure(store, nextState);
        return 'offline';
      }

      // Pending.profile is the snapshot the client believed it had submitted.
      // Treat it as the merge BASE so local progress accumulated after staging
      // the pending request is retained when resolving a late conflict.
      const currentLocal = this.local.readSnapshot();
      const merged = mergeCloudSnapshots({
        base: operation.profile,
        local: currentLocal,
        cloud: latest.profile,
        todayId: this.local.todayId(),
      });
      await this.local.applySnapshot(merged);
      operation = this.createProfileOperation(latest.revision, merged);
      nextState = { ...store.load(), pendingProfile: operation };
      store.save(nextState);
    }
    return 'pending';
  }

  private async acceptSaved(
    store: CloudSyncStateStore,
    state: CloudSyncState,
    operation: PendingProfileOperation,
    result: Extract<CloudProfileSaveResult, { status: 'saved' }>,
  ): Promise<CloudSyncResult> {
    const localAtConfirmation = this.local.readSnapshot();
    const reconciled = mergeCloudSnapshots({
      base: operation.profile,
      local: localAtConfirmation,
      cloud: result.profile,
      todayId: this.local.todayId(),
    });
    await this.local.applySnapshot(reconciled);

    const accepted: CloudSyncState = {
      ...state,
      revision: result.revision,
      base: result.profile,
      pendingProfile: null,
      retryAttempt: 0,
      lastSuccessfulSyncAtMs: this.nowMs(),
    };
    const { nextRetryAtMs: _ignored, ...withoutRetry } = accepted;
    store.save(withoutRetry);

    // If gameplay changed the local snapshot while the request was in flight,
    // keep that delta local and stage it for the next trigger rather than
    // pretending it was accepted by the server.
    if (!snapshotsEqual(reconciled, result.profile)) {
      const followUp = this.createProfileOperation(result.revision, reconciled);
      store.save({ ...store.load(), pendingProfile: followUp });
      return 'pending';
    }
    return 'synced';
  }

  private createProfileOperation(expectedRevision: number, profile: CloudSnapshot): PendingProfileOperation {
    return {
      kind: 'profile',
      operationId: createOperationId(),
      expectedRevision,
      profile: structuredClone(profile),
    };
  }

  private persistTransportFailure(store: CloudSyncStateStore, state: CloudSyncState): void {
    const retryAttempt = state.retryAttempt + 1;
    const exponential = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, retryAttempt - 1)));
    const jitter = exponential * 0.25 * Math.max(0, Math.min(1, this.random()));
    store.save({
      ...state,
      retryAttempt,
      nextRetryAtMs: Math.round(this.nowMs() + exponential + jitter),
    });
  }
}
