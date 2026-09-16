export type LeaderboardSubmit = (
  technicalName: string,
  score: number,
) => Promise<void>;

export type LeaderboardDelay = (ms: number) => Promise<void>;
export type LeaderboardNow = () => number;

interface PendingWaiter {
  resolve(): void;
  reject(error: unknown): void;
}

type CoalescePolicy = 'max' | 'latest';

interface PendingWrite {
  score: number;
  policy: CoalescePolicy;
  waiters: PendingWaiter[];
}

const defaultDelay: LeaderboardDelay = async (ms) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class LeaderboardSubmissionQueue {
  private readonly submit: LeaderboardSubmit;
  private readonly delay: LeaderboardDelay;
  private readonly now: LeaderboardNow;
  private readonly minIntervalMs: number;
  private readonly pending = new Map<string, PendingWrite>();
  private drainScheduled = false;
  private draining = false;
  private activeWrites = 0;
  private lastSubmitAt: number | null = null;

  constructor(
    submit: LeaderboardSubmit,
    delay: LeaderboardDelay = defaultDelay,
    now: LeaderboardNow = () => Date.now(),
    minIntervalMs = 1100,
  ) {
    if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
      throw new Error('Leaderboard submit interval must be finite and non-negative.');
    }

    this.submit = submit;
    this.delay = delay;
    this.now = now;
    this.minIntervalMs = minIntervalMs;
  }

  get pendingCount(): number {
    return this.pending.size + this.activeWrites;
  }

  enqueue(technicalName: string, score: number, policy: CoalescePolicy = 'max'): Promise<void> {
    if (!Number.isFinite(score) || score <= 0) {
      return Promise.reject(
        new Error('Leaderboard score must be finite and positive.'),
      );
    }

    const promise = new Promise<void>((resolve, reject) => {
      const existing = this.pending.get(technicalName);
      if (existing !== undefined) {
        existing.score = policy === 'latest' ? score : Math.max(existing.score, score);
        existing.policy = policy;
        existing.waiters.push({ resolve, reject });
      } else {
        this.pending.set(technicalName, {
          score,
          policy,
          waiters: [{ resolve, reject }],
        });
      }
    });

    this.scheduleDrain();
    return promise;
  }

  private scheduleDrain(): void {
    if (this.drainScheduled || this.draining) {
      return;
    }

    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;
    try {
      while (this.pending.size > 0) {
        const next = this.pending.entries().next().value as
          | [string, PendingWrite]
          | undefined;
        if (next === undefined) {
          break;
        }

        const [technicalName, pending] = next;
        this.pending.delete(technicalName);
        this.activeWrites += 1;

        try {
          if (this.lastSubmitAt !== null) {
            const elapsed = this.now() - this.lastSubmitAt;
            const waitMs = Math.max(0, this.minIntervalMs - elapsed);
            if (waitMs > 0) {
              await this.delay(waitMs);
            }
          }

          this.lastSubmitAt = this.now();
          await this.submit(technicalName, pending.score);
          for (const waiter of pending.waiters) {
            waiter.resolve();
          }
        } catch (error) {
          for (const waiter of pending.waiters) {
            waiter.reject(error);
          }
        } finally {
          this.activeWrites -= 1;
        }
      }
    } finally {
      this.draining = false;
      if (this.pending.size > 0) {
        this.scheduleDrain();
      }
    }
  }
}
