import { getTheme } from './ThemeRegistry.ts';
import type { ThemeId } from './ThemeDefinition.ts';

export interface ThemeProduct {
  readonly id: ThemeId;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly previewUrl: string;
  readonly cardBackUrl: string;
}

function product(id: ThemeId, name: string, description: string, price: number): ThemeProduct {
  const theme = getTheme(id);
  const root = `./assets/themes/${id.replaceAll('_','-')}`;
  return { id, name, description, price, previewUrl: `${root}/shop-preview.webp`,
    cardBackUrl: id === 'walnut_study' ? theme.cardBack.url : `${root}/shop-card-back.webp` };
}

/** Only released themes belong here; adding renderer experiments never publishes a product. */
export const THEME_CATALOG: readonly ThemeProduct[] = [
  product('walnut_study', 'Ореховый кабинет', 'Тёплое дерево и классическая рубашка. Ваша первая тема.', 0),
  product('navy_study', 'Синий кабинет', 'Глубокий синий стол, золотые детали и морской орнамент.', 300),
  product('burgundy_club', 'Бордовый клуб', 'Бордовая кожа, благородная патина и клубная рубашка.', 300),
  product('autumn_evening', 'Осенний вечер', 'Тёплое дерево, янтарный свет и осенние листья.', 300),
  product('winter_living_room', 'Зимняя гостиная', 'Тёмное дерево, хвоя и тёплый свет зимнего вечера.', 300),
  product('spring_morning', 'Весеннее утро', 'Свежая зелень, цветущие ветви и мягкий весенний свет.', 300),
  product('summer_veranda', 'Летняя веранда', 'Тёплый стол, цитрусы и солнечные тени летнего дня.', 300),
  product('office', 'Офис', 'Тёмная кожа, латунные детали и аккуратный рабочий стол.', 350),
];

export function getThemeProduct(id: string): ThemeProduct | undefined {
  return THEME_CATALOG.find(item => item.id === id);
}

export function hasAffordableUnownedTheme(
  coins: number,
  ownedThemes: readonly string[],
): boolean {
  const balance = Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
  const owned = new Set(ownedThemes);
  return THEME_CATALOG.some((item) => item.price > 0 && !owned.has(item.id) && item.price <= balance);
}

export function didCoinsUnlockThemePurchase(
  beforeCoins: number,
  afterCoins: number,
  ownedThemes: readonly string[],
): boolean {
  return !hasAffordableUnownedTheme(beforeCoins, ownedThemes)
    && hasAffordableUnownedTheme(afterCoins, ownedThemes);
}

