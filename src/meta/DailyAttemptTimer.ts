export class DailyAttemptTimer {
  private started = false;
  private activeStartedAt: number | null = null;
  private accumulatedMs = 0;

  get running(): boolean {
    return this.started;
  }

  start(nowMs: number): void {
    this.assertTime(nowMs);
    this.started = true;
    this.activeStartedAt = nowMs;
    this.accumulatedMs = 0;
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
    if (!this.started) throw new Error('Daily timer was not started.');
    if (this.activeStartedAt !== null) {
      this.assertForward(nowMs, this.activeStartedAt);
      this.accumulatedMs += nowMs - this.activeStartedAt;
    }
    const elapsed = Math.max(1, Math.round(this.accumulatedMs));
    this.reset();
    return elapsed;
  }

  reset(): void {
    this.started = false;
    this.activeStartedAt = null;
    this.accumulatedMs = 0;
  }

  private assertTime(value: number): void {
    if (!Number.isFinite(value)) throw new Error('Timer timestamp must be finite.');
  }

  private assertForward(nowMs: number, fromMs: number): void {
    this.assertTime(nowMs);
    if (nowMs < fromMs) throw new Error('Timer cannot move backwards.');
  }
}
