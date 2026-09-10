import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const DEFAULT_THEME_ID: ThemeId = 'walnut_study';

const GREEN_FELT_ROOT = './assets/themes/green-felt-club';
const BURGUNDY_ROOT = './assets/themes/burgundy-club';
const NAVY_STUDY_ROOT = './assets/themes/navy-study';

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
      palette: {
        recess: '#102d24', edge: '#a89e69', highlight: '#d0c694',
        blackSuit: '#b4a275', redSuit: '#ba7863',
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
      url: `${BURGUNDY_ROOT}/board-surface-refined.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-burgundy-club',
      url: `${BURGUNDY_ROOT}/card-back.png`,
      crop: { x: 2, y: 2, width: 356, height: 466 },
    },
    slots: {
      palette: {
        recess: '#1e1118', edge: '#ae956b', highlight: '#cfb68c',
        blackSuit: '#c2a779', redSuit: '#c2a779',
      },
    },
    controls: {
      surface: '#dbc394', hover: '#ead6ac', ink: '#3a231e', edge: '#9b6d57',
      labelSurface: '#2f1719', labelInk: '#e4c67d', focus: '#f0d48f',
    },
  },

  navy_study: {
    id: 'navy_study',
    name: 'Navy Study',
    boardSurface: {
      key: 'cascade-board-surface-navy-study',
      url: `${NAVY_STUDY_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-navy-study',
      url: `${NAVY_STUDY_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#071a2b', edge: '#9c8357', highlight: '#d3ba80',
        blackSuit: '#b9a170', redSuit: '#a66f61',
      },
    },
    controls: {
      surface: '#d7c89b', hover: '#e7d8ad', ink: '#172b3a', edge: '#9b8356',
      labelSurface: '#0c2335', labelInk: '#d9bd79', focus: '#ead391',
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
