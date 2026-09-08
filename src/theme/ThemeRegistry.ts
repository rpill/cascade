import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const DEFAULT_THEME_ID: ThemeId = 'walnut_study';

const GREEN_FELT_ROOT = './assets/themes/green-felt-club';
const BURGUNDY_ROOT = './assets/themes/burgundy-club';

export const THEMES = {
  walnut_study: {
    id: 'walnut_study',
    name: 'Walnut Study',
    boardSurface: {
      key: 'cascade-board-surface',
      url: './assets/themes/walnut-study/board-surface.webp',
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back',
      url: './assets/themes/walnut-study/card-back.svg',
    },
    slots: {
      kind: 'vector',
      palette: {
        recess: '#160f0b',
        edge: '#bd9b63',
        highlight: '#e0c48d',
        blackSuit: '#c0a272',
        redSuit: '#b16a55',
      },
    },
    controls: {
      surface: '#d6bf8d', hover: '#e3cea2', ink: '#35261a', edge: '#987747',
      labelSurface: '#281b13', labelInk: '#d2b273', focus: '#e8cc91',
    },
    boardTint: 0xffffff,
  },
  green_felt_club: {
    id: 'green_felt_club',
    name: 'Green Felt Club',
    boardSurface: {
      key: 'cascade-board-surface-green-felt-club',
      url: `${GREEN_FELT_ROOT}/board-surface.jpg`,
    },
    surfaceScale: 'tile',
    cardBack: {
      key: 'card-back-green-felt-club',
      url: `${GREEN_FELT_ROOT}/card-back.png`,
    },
    slots: {
      kind: 'images',
      assets: {
        tableauEmpty: {
          key: 'green-felt-slot-tableau-empty',
          url: `${GREEN_FELT_ROOT}/slots/tableau-empty.png`,
        },
        foundations: {
          clubs: {
            key: 'green-felt-slot-clubs',
            url: `${GREEN_FELT_ROOT}/slots/clubs.png`,
          },
          diamonds: {
            key: 'green-felt-slot-diamonds',
            url: `${GREEN_FELT_ROOT}/slots/diamonds.png`,
          },
          hearts: {
            key: 'green-felt-slot-hearts',
            url: `${GREEN_FELT_ROOT}/slots/hearts.png`,
          },
          spades: {
            key: 'green-felt-slot-spades',
            url: `${GREEN_FELT_ROOT}/slots/spades.png`,
          },
        },
        stockFreeCell: {
          key: 'green-felt-slot-stock-free-cell',
          url: `${GREEN_FELT_ROOT}/slots/stock-free-cell.png`,
        },
      },
    },
    controls: {
      surface: '#d0c5a2', hover: '#e0d6b6', ink: '#233c31', edge: '#80977b',
      labelSurface: '#142e24', labelInk: '#d5c596', focus: '#e0d5a6',
    },
  },
  burgundy_club: {
    id: 'burgundy_club',
    name: 'Burgundy Club',
    boardSurface: {
      key: 'cascade-board-surface-burgundy-club',
      url: `${BURGUNDY_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-burgundy-club',
      url: `${BURGUNDY_ROOT}/card-back.png`,
    },
    slots: {
      kind: 'images',
      assets: {
        tableauEmpty: {
          key: 'burgundy-slot-tableau-empty',
          url: `${BURGUNDY_ROOT}/slots/tableau-empty.png`,
        },
        foundations: {
          clubs: {
            key: 'burgundy-slot-clubs',
            url: `${BURGUNDY_ROOT}/slots/clubs.png`,
          },
          diamonds: {
            key: 'burgundy-slot-diamonds',
            url: `${BURGUNDY_ROOT}/slots/diamonds.png`,
          },
          hearts: {
            key: 'burgundy-slot-hearts',
            url: `${BURGUNDY_ROOT}/slots/hearts.png`,
          },
          spades: {
            key: 'burgundy-slot-spades',
            url: `${BURGUNDY_ROOT}/slots/spades.png`,
          },
        },
        stockFreeCell: {
          key: 'burgundy-slot-stock-free-cell',
          url: `${BURGUNDY_ROOT}/slots/stock-free-cell.png`,
        },
      },
    },
    controls: {
      surface: '#dbc394', hover: '#ead6ac', ink: '#3a231e', edge: '#9b6d57',
      labelSurface: '#2f1719', labelInk: '#e4c67d', focus: '#f0d48f',
    },
  },
} as const satisfies Readonly<Record<string, ThemeDefinition>>;

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

export function getThemes(): readonly ThemeDefinition[] {
  return Object.values(THEMES);
}

export function getTheme(id: string = DEFAULT_THEME_ID): ThemeDefinition {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME_ID];
}
