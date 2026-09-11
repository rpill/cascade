import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const DEFAULT_THEME_ID: ThemeId = 'walnut_study';

const GREEN_FELT_ROOT = './assets/themes/green-felt-club';
const BURGUNDY_ROOT = './assets/themes/burgundy-club';
const NAVY_STUDY_ROOT = './assets/themes/navy-study';
const AUTUMN_EVENING_ROOT = './assets/themes/autumn-evening';
const WINTER_LIVING_ROOM_ROOT = './assets/themes/winter-living-room';
const SPRING_MORNING_ROOT = './assets/themes/spring-morning';
const SUMMER_VERANDA_ROOT = './assets/themes/summer-veranda';
const OFFICE_ROOT = './assets/themes/office';

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
      url: './assets/themes/walnut-study/card-back.png',
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

  autumn_evening: {
    id: 'autumn_evening',
    name: 'Autumn Evening',
    boardSurface: {
      key: 'cascade-board-surface-autumn-evening',
      url: `${AUTUMN_EVENING_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-autumn-evening',
      url: `${AUTUMN_EVENING_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#2a160d', edge: '#c4934f', highlight: '#e3bd78',
        blackSuit: '#cfaa70', redSuit: '#b85f3a',
      },
    },
    controls: {
      surface: '#d9bd86', hover: '#e7cc98', ink: '#3b2417', edge: '#9f6a35',
      labelSurface: '#3a2115', labelInk: '#e1bd75', focus: '#f0cf8c',
    },
    boardTint: 0xffffff,
  },

  winter_living_room: {
    id: 'winter_living_room',
    name: 'Winter Living Room',
    boardSurface: {
      key: 'cascade-board-surface-winter-living-room',
      url: `${WINTER_LIVING_ROOM_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-winter-living-room',
      url: `${WINTER_LIVING_ROOM_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#17202a', edge: '#9faeaf', highlight: '#d6d0b7',
        blackSuit: '#bfc4bd', redSuit: '#a8665d',
      },
    },
    controls: {
      surface: '#d7d1bd', hover: '#e5e0d1', ink: '#26313a', edge: '#85969a',
      labelSurface: '#1b252c', labelInk: '#d7cda9', focus: '#eee0b0',
    },
    boardTint: 0xffffff,
  },

  spring_morning: {
    id: 'spring_morning',
    name: 'Spring Morning',
    boardSurface: {
      key: 'cascade-board-surface-spring-morning',
      url: `${SPRING_MORNING_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-spring-morning',
      url: `${SPRING_MORNING_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#24301f', edge: '#a9a36f', highlight: '#d8cf9f',
        blackSuit: '#b7b48d', redSuit: '#b87972',
      },
    },
    controls: {
      surface: '#d7cfaa', hover: '#e4ddbc', ink: '#33402a', edge: '#8d8d62',
      labelSurface: '#2a3323', labelInk: '#d7cf9b', focus: '#e8dca9',
    },
    boardTint: 0xffffff,
  },


  summer_veranda: {
    id: 'summer_veranda',
    name: 'Summer Veranda',
    boardSurface: {
      key: 'cascade-board-surface-summer-veranda',
      url: `${SUMMER_VERANDA_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-summer-veranda',
      url: `${SUMMER_VERANDA_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#2c1b10', edge: '#c4a05d', highlight: '#e0c487',
        blackSuit: '#c2ae7c', redSuit: '#b66d4e',
      },
    },
    controls: {
      surface: '#dbc58f', hover: '#e7d39f', ink: '#3d2a18', edge: '#9b7b45',
      labelSurface: '#3a2617', labelInk: '#dfc783', focus: '#eed995',
    },
    boardTint: 0xffffff,
  },


  office: {
    id: 'office',
    name: 'Office',
    boardSurface: {
      key: 'cascade-board-surface-office',
      url: `${OFFICE_ROOT}/board-surface.webp`,
    },
    surfaceScale: 'cover',
    cardBack: {
      key: 'card-back-office',
      url: `${OFFICE_ROOT}/card-back.png`,
    },
    slots: {
      palette: {
        recess: '#141916', edge: '#a98752', highlight: '#d6bb7b',
        blackSuit: '#c3ab78', redSuit: '#a56a5d',
      },
    },
    controls: {
      surface: '#cfbb8c', hover: '#ddc99b', ink: '#252a24', edge: '#8d7045',
      labelSurface: '#171c19', labelInk: '#d7bb7a', focus: '#e7cf90',
    },
    boardTint: 0xffffff,
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
