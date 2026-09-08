export type ThemeId = keyof typeof import('./ThemeRegistry.ts').THEMES;

export interface ThemeAssetRef {
  readonly key: string;
  readonly url: string;
}

export interface ThemeSlotAssets {
  readonly tableauEmpty: ThemeAssetRef;
  readonly foundations: {
    readonly clubs: ThemeAssetRef;
    readonly diamonds: ThemeAssetRef;
    readonly hearts: ThemeAssetRef;
    readonly spades: ThemeAssetRef;
  };
  readonly stockFreeCell: ThemeAssetRef;
}

export interface SlotPalette {
  readonly recess: string;
  readonly edge: string;
  readonly highlight: string;
  readonly blackSuit: string;
  readonly redSuit: string;
}

export type ThemeSlots =
  | { readonly kind: 'vector'; readonly palette: SlotPalette }
  | { readonly kind: 'images'; readonly assets: ThemeSlotAssets };

export interface ThemeControls {
  readonly surface: string;
  readonly hover: string;
  readonly ink: string;
  readonly edge: string;
  readonly labelSurface: string;
  readonly labelInk: string;
  readonly focus: string;
}

export interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly boardSurface: ThemeAssetRef;
  readonly surfaceScale: 'tile' | 'cover';
  readonly cardBack: ThemeAssetRef;
  readonly slots: ThemeSlots;
  readonly controls: ThemeControls;
  readonly boardTint?: number;
}
