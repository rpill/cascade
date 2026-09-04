import type { MetaSave } from './MetaSave.ts';

export type MetaMutation = (state: MetaSave) => MetaSave;

export class MetaMutationQueue {
  private settled = false;
  private readonly pending: MetaMutation[] = [];

  get loaded(): boolean {
    return this.settled;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  apply(state: MetaSave, mutation: MetaMutation): MetaSave {
    const next = mutation(state);
    if (!this.settled) {
      this.pending.push(mutation);
    }
    return next;
  }

  settleLoadedState(loaded: MetaSave): MetaSave {
    if (this.settled) {
      throw new Error('Meta state was already settled.');
    }

    let merged = loaded;
    for (const mutation of this.pending) {
      merged = mutation(merged);
    }

    this.pending.length = 0;
    this.settled = true;
    return merged;
  }
}
