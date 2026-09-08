import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const DEFAULT_THEME_ID: ThemeId = 'walnut_study';

const GREEN_FELT_ROOT = './assets/themes/green-felt-club';

const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  walnut_study: {
    id: 'walnut_study',
    name: 'Walnut Study',
    boardSurface: {
      key: 'cascade-board-surface',
      url: './assets/theme/walnut-table.jpg',
    },
    cardBack: {
      key: 'card-back',
      url: './assets/cards/redBack.png',
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
    cardBack: {
      key: 'card-back-green-felt-club',
      url: `${GREEN_FELT_ROOT}/card-back.png`,
    },
    slots: {
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
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'walnut_study' || value === 'green_felt_club';
}

export function getTheme(id: string = DEFAULT_THEME_ID): ThemeDefinition {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME_ID];
}
