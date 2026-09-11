export type SfxCue =
  | 'card-touch'
  | 'card-place'
  | 'deal'
  | 'undo'
  | 'button'
  | 'victory'
  | 'level-up'
  | 'coin-reward';

export interface SfxAssetGroup {
  readonly keys: readonly string[];
  readonly urls: readonly string[];
  readonly volume: number;
}

export const SFX_ASSETS: Readonly<Record<SfxCue, SfxAssetGroup>> = {
  'card-touch': {
    keys: ['sfx-card-touch-1'],
    urls: ['./assets/audio/sfx/card-touch-1.ogg'],
    volume: 0.04,
  },
  'card-place': {
    keys: ['sfx-card-place-1', 'sfx-card-place-2', 'sfx-card-place-3', 'sfx-card-place-4'],
    urls: [
      './assets/audio/sfx/card-place-1.ogg',
      './assets/audio/sfx/card-place-2.ogg',
      './assets/audio/sfx/card-place-3.ogg',
      './assets/audio/sfx/card-place-4.ogg',
    ],
    volume: 0.04,
  },
  deal: {
    keys: ['sfx-deal-1', 'sfx-deal-2', 'sfx-deal-3', 'sfx-deal-4'],
    urls: [
      './assets/audio/sfx/deal-1.ogg',
      './assets/audio/sfx/deal-2.ogg',
      './assets/audio/sfx/deal-3.ogg',
      './assets/audio/sfx/deal-4.ogg',
    ],
    volume: 0.04,
  },
  undo: {
    keys: ['sfx-undo-1', 'sfx-undo-2'],
    urls: ['./assets/audio/sfx/undo-1.ogg', './assets/audio/sfx/undo-2.ogg'],
    volume: 0.10,
  },
  button: {
    keys: ['sfx-button'],
    urls: ['./assets/audio/sfx/button.ogg'],
    volume: 0.05,
  },
  victory: {
    keys: ['sfx-victory'],
    urls: ['./assets/audio/sfx/victory.ogg'],
    volume: 0.07,
  },
  'level-up': {
    keys: ['sfx-level-up'],
    urls: ['./assets/audio/sfx/level-up.ogg'],
    volume: 0.10,
  },
  'coin-reward': {
    keys: ['sfx-coin-reward'],
    urls: ['./assets/audio/sfx/coin-reward.ogg'],
    volume: 0.10,
  },
};

interface SoundManagerLike {
  readonly locked?: boolean;
  play(key: string, config?: { volume?: number }): boolean;
}

export class SfxController {
  private readonly manager: SoundManagerLike;
  private readonly nextVariant = new Map<SfxCue, number>();

  constructor(manager: SoundManagerLike) {
    this.manager = manager;
  }

  play(cue: SfxCue): void {
    if (this.manager.locked === true) return;

    const asset = SFX_ASSETS[cue];
    const index = this.nextVariant.get(cue) ?? 0;
    const key = asset.keys[index % asset.keys.length];
    this.nextVariant.set(cue, index + 1);
    this.manager.play(key, { volume: asset.volume });
  }
}
