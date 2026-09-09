import { preferences, type Preferences } from './Preferences.ts';

/** One gate for all Phaser audio, including any sounds added in the future. */
export class AudioController {
  private readonly manager: {mute:boolean};
  private readonly preferences: Preferences;
  private suspended=false;
  private readonly unsubscribe: () => void;
  constructor(manager: {mute:boolean}, settings: Preferences = preferences) {
    this.manager=manager;
    this.preferences=settings;
    this.unsubscribe=settings.subscribe(()=>this.apply());
    this.apply();
  }
  setSuspended(suspended: boolean): void { this.suspended=suspended; this.apply(); }
  destroy(): void { this.unsubscribe(); }
  private apply(): void { this.manager.mute=this.suspended || !this.preferences.soundEnabled; }
}
