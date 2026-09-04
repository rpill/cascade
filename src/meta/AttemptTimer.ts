export class AttemptTimer {
  private started = false;
  private activeStartedAt: number | null = null;
  private accumulatedMs = 0;

  get running(): boolean {
    return this.started;
  }

  get paused(): boolean {
    return this.started && this.activeStartedAt === null;
  }

  start(nowMs: number, initialElapsedMs = 0): void {
    this.assertTime(nowMs);
    this.assertElapsed(initialElapsedMs);
    this.started = true;
    this.activeStartedAt = nowMs;
    this.accumulatedMs = initialElapsedMs;
  }

  elapsed(nowMs: number): number {
    if (!this.started) return 0;
    if (this.activeStartedAt === null) {
      return Math.max(0, Math.round(this.accumulatedMs));
    }

    this.assertForward(nowMs, this.activeStartedAt);
    return Math.max(
      0,
      Math.round(this.accumulatedMs + nowMs - this.activeStartedAt),
    );
  }

  pause(nowMs: number): void {
    if (!this.started || this.activeStartedAt === null) return;
    this.assertForward(nowMs, this.activeStartedAt);
    this.accumulatedMs += nowMs - this.activeStartedAt;
    this.activeStartedAt = null;
  }

  resume(nowMs: number): void {
    if (!this.started || this.activeStartedAt !== null) return;
    this.assertTime(nowMs);
    this.activeStartedAt = nowMs;
  }

  finish(nowMs: number): number {
    if (!this.started) throw new Error('Attempt timer was not started.');
    const elapsedMs = Math.max(1, this.elapsed(nowMs));
    this.reset();
    return elapsedMs;
  }

  reset(): void {
    this.started = false;
    this.activeStartedAt = null;
    this.accumulatedMs = 0;
  }

  private assertElapsed(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Timer initial elapsed duration must be finite and non-negative.');
    }
  }

  private assertTime(value: number): void {
    if (!Number.isFinite(value)) throw new Error('Timer timestamp must be finite.');
  }

  private assertForward(nowMs: number, fromMs: number): void {
    this.assertTime(nowMs);
    if (nowMs < fromMs) throw new Error('Timer cannot move backwards.');
  }
}
