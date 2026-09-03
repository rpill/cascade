import type { SolitaireGame } from './SolitaireGame.ts';
import type { SolitaireSnapshot } from './types.ts';

export class GameHistory {
  private readonly snapshots: SolitaireSnapshot[] = [];

  get canUndo(): boolean {
    return this.snapshots.length > 0;
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

  clear(): void {
    this.snapshots.length = 0;
  }
}
