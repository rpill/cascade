export type ThemeId = keyof typeof import('./ThemeRegistry.ts').THEMES;

export interface ThemeAssetRef {
  readonly key: string;
  readonly url: string;
}

export interface SlotPalette {
  readonly recess: string;
  readonly edge: string;
  readonly highlight: string;
  readonly blackSuit: string;
  readonly redSuit: string;
}

export interface ThemeSlots {
  readonly palette: SlotPalette;
  /** Optional full-card frame only. Suit and stock symbols are separate layers. */
  readonly frame?: ThemeAssetRef;
}

export interface CardBackAsset extends ThemeAssetRef {
  /** Visible artwork in an imported bitmap; excludes transparent export padding. */
  readonly crop?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface SurfaceInsets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ThemeControls {
  readonly surface: string;
  readonly hover: string;
  readonly ink: string;
  readonly edge: string;
  readonly labelSurface: string;
  readonly labelInk: string;
  readonly focus: string;
}

interface ThemeCosmetics {
  readonly id: string;
  readonly name: string;
  readonly cardBack: CardBackAsset;
  readonly slots: ThemeSlots;
  readonly controls: ThemeControls;
  readonly boardTint?: number;
}

export type ThemeDefinition = ThemeCosmetics & {
  readonly boardSurface: ThemeAssetRef;
} & (
  | { readonly surfaceScale: 'tile' | 'cover' }
  | {
    readonly surfaceScale: 'framed';
    readonly surfaceSlices: SurfaceInsets;
    /** Optional source trim for balancing an imported scene's outer margins. */
    readonly surfaceCrop?: { readonly width: number; readonly height: number };
  }
);
