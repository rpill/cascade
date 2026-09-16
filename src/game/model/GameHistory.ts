import type { SolitaireGame } from './SolitaireGame.ts';
import type { SolitaireSnapshot } from './types.ts';

export class GameHistory {
  private readonly snapshots: SolitaireSnapshot[] = [];
  private countedMoves = 0;

  get canUndo(): boolean {
    return this.snapshots.length > 0;
  }

  get moveCount(): number {
    return this.countedMoves;
  }

  execute<T>(
    game: SolitaireGame,
    action: () => T,
    changed: (result: T) => boolean,
  ): T {
    const before = game.snapshot();
    const result = action();

    if (changed(result)) {
      this.snapshots.push(before);
      this.countedMoves += 1;
    }

    return result;
  }

  undo(game: SolitaireGame): boolean {
    const snapshot = this.snapshots.pop();

    if (snapshot === undefined) {
      return false;
    }

    game.restore(snapshot);
    return true;
  }

  restoreMoveCount(moveCount: number): void {
    this.countedMoves = Number.isSafeInteger(moveCount) && moveCount >= 0 ? moveCount : 0;
  }

  clear(): void {
    this.snapshots.length = 0;
    this.countedMoves = 0;
  }
}
