export type ThemeId = 'walnut_study' | 'green_felt_club';

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

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  readonly boardSurface: ThemeAssetRef;
  readonly cardBack: ThemeAssetRef;
  readonly slots?: ThemeSlotAssets;
  readonly boardTint?: number;
}
