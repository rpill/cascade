export interface GameAssetRef {
  readonly key: string;
  readonly url: string;
}

export interface SurfaceInsets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface GameControlsPalette {
  readonly surface: string;
  readonly hover: string;
  readonly ink: string;
  readonly edge: string;
  readonly labelSurface: string;
  readonly labelInk: string;
  readonly focus: string;
}

export type GameAppearance = {
  readonly boardSurface: GameAssetRef;
  readonly cardBack: GameAssetRef;
  readonly controls: GameControlsPalette;
  readonly boardTint?: number;
} & (
  | { readonly surfaceScale: 'tile' | 'cover' }
  | {
      readonly surfaceScale: 'framed';
      readonly surfaceSlices: SurfaceInsets;
      readonly surfaceCrop?: { readonly width: number; readonly height: number };
    }
);

export const GAME_APPEARANCE: GameAppearance = {
  boardSurface: {
    key: 'cascade-board-surface',
    url: './assets/game/board-surface.webp',
  },
  surfaceScale: 'cover',
  cardBack: {
    key: 'card-back',
    url: './assets/cards/redBack.webp',
  },
  controls: {
    surface: '#d6bf8d',
    hover: '#e3cea2',
    ink: '#35261a',
    edge: '#987747',
    labelSurface: '#281b13',
    labelInk: '#d2b273',
    focus: '#e8cc91',
  },
  boardTint: 0xffffff,
};
